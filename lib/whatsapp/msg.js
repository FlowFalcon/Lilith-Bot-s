const {
  downloadContentFromMessage,
  getContentType,
  jidNormalizedUser,
  proto,
  extractMessageContent,
  isJidGroup,
} = require("baileys");

const extractText = (message) => {
  if (!message) return "";
  try {
    const content = extractMessageContent(message);
    if (!content) return "";

    if (content.conversation) return content.conversation;
    if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
    if (content.imageMessage?.caption) return content.imageMessage.caption;
    if (content.videoMessage?.caption) return content.videoMessage.caption;
    if (content.documentMessage?.caption) return content.documentMessage.caption;
    return "";
  } catch {
    return "";
  }
};

const dlMedia = async (message) => {
  try {
    const mimeMap = {
      imageMessage: "image",
      videoMessage: "video",
      stickerMessage: "sticker",
      documentMessage: "document",
      audioMessage: "audio",
    };

    const msgKeys = Object.keys(message || {});
    if (msgKeys.length === 0) return null;

    const type = msgKeys[0];
    if (!type) return null;

    const m = message[type];
    if (!m) return null;

    if (type === "conversation") return Buffer.from(m);

    const mediaType = mimeMap[type];
    if (!mediaType) return null;

    const stream = await downloadContentFromMessage(m, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error downloading media:", error);
    return null;
  }
};

const getDeviceType = (id) => {
  if (!id) return "unknown";
  const idLength = id.length;
  const startsWith3EB0 = id.startsWith("3EB0");

  if (idLength >= 16 && startsWith3EB0) return "ios";
  else if (idLength >= 16 && !startsWith3EB0) return "web";
  else return "android";
};

const resolveActualSender = (key, metadata, isGroupChat) => {
  const participant = key?.participant;

  if (!isGroupChat) {
    return jidNormalizedUser(key?.remoteJid || "");
  }
  if (!participant) {
    return jidNormalizedUser(key?.remoteJid || "");
  }
  if (participant.endsWith("@lid")) {
    if (key?.participantAlt && key.participantAlt.endsWith("@s.whatsapp.net")) {
      return key.participantAlt;
    }
    if (metadata?.participants) {
      const found = metadata.participants.find(p => p.id === participant);
      if (found?.jid && found.jid.endsWith("@s.whatsapp.net")) {
        return found.jid;
      }
    }

    const lidNumber = participant.split("@")[0];
    return `${lidNumber}@s.whatsapp.net`;
  }

  return participant;
};

const procMsg = async (originalMessage, socket, dStore) => {
  const message = filterMsgs(originalMessage);
  const { key, message: rawMessage } = message || originalMessage;

  if (!rawMessage) {
    return createEmptyMessage();
  }

  const id = key?.id || "";
  const chatJid = key?.remoteJid || "";
  const isGroup = isJidGroup(chatJid) || chatJid?.endsWith("@g.us");
  const timestamp = message.messageTimestamp;
  const rawPushName = message.pushName;
  const pushName = (typeof rawPushName === "string" && rawPushName) ? rawPushName : "Unknown";

  let metadata = isGroup && chatJid 
    ? (dStore.groupMetadata?.[chatJid] || await getGroupMetadata(socket, chatJid, dStore))
    : {};

  const actualSender = resolveActualSender(key, metadata, isGroup);
  const sender = actualSender;

  const type = getContentType(rawMessage) || 
    (rawMessage && typeof rawMessage === "object" ? Object.keys(rawMessage)[0] || "" : "");
  const msgType = type;

  const messageContent = rawMessage[msgType];
  const contextInfo = messageContent?.contextInfo || rawMessage.contextInfo;
  const quotedRawMessage = contextInfo?.stanzaId;
  const isQuoted = !!quotedRawMessage;

  const body = messageContent?.text || 
    messageContent?.caption || 
    (typeof messageContent === "string" ? messageContent : "") || "";

  const isMedia = /imageMessage|videoMessage|stickerMessage|documentMessage|audioMessage/.test(msgType);

  const currentMentions = contextInfo?.mentionedJid || [];
  const quotedMentions = isQuoted && quotedRawMessage?.contextInfo?.mentionedJid
    ? quotedRawMessage.contextInfo.mentionedJid : [];
  const allMentions = Array.from(new Set([...currentMentions, ...quotedMentions]));

  let quoted, quotedType = "", quotedText = "", quotedSender = "";

  if (isQuoted) {
    const quotedMsgId = contextInfo?.stanzaId;
    let quotedContent = findQuotedMessage(dStore, quotedMsgId);

    if (quotedContent) {
      quoted = await procMsg(quotedContent, socket, dStore);
      quotedType = getContentType(quotedContent.message || undefined) || "";
      quotedText = extractText(quotedContent.message === null ? undefined : quotedContent.message);
      
      const quotedIsGroup = isJidGroup(quotedContent.key?.remoteJid || "") || 
        quotedContent.key?.remoteJid?.endsWith("@g.us");
      quotedSender = resolveActualSender(quotedContent.key, metadata, quotedIsGroup);
    } else {
      quoted = createEmptyMessage();
    }
  }

  const device = id ? getDeviceType(id) : "unknown";
  const isFromMe = key?.fromMe || false;
  const isBot = isFromMe;
  const normalizedTimestamp = timestamp
    ? (typeof timestamp === "number" ? timestamp : Number(timestamp))
    : 0;

  const replyMethod = async (text, options = {}) => {
    try {
      return await socket.sendMessage(
        chatJid, 
        { text: String(text), ...options }, 
        { quoted: message, ...options }
      );
    } catch (error) {
      console.error("Reply error:", error);
      return null;
    }
  };

  const downloadMethod = async () => {
    if (!isMedia) return null;
    return await dlMedia(rawMessage);
  };

  return {
    key,
    id,
    chat: chatJid,
    fromMe: isFromMe,
    isGroup,
    sender,
    senderName: pushName,
    participant: key?.participant || undefined,
    participantAlt: key?.participantAlt || undefined,
    addressingMode: key?.addressingMode || undefined,
    pushName,
    type: msgType,
    metadata,
    message: rawMessage || proto.Message.fromObject({}),
    msgType,
    msgTimestamp: normalizedTimestamp,
    text: body,
    body,
    mentionedJids: allMentions,
    isMedia,
    isQuoted: isQuoted || false,
    ...(isQuoted ? { quoted, quotedType, quotedMessage: quoted, quotedText, quotedSender } : {}),
    mentioned: allMentions,
    device,
    isBot,
    reply: replyMethod,
    download: downloadMethod,
  };
};

function filterMsgs(message) {
  const filteredMessage = { ...message };
  if (filteredMessage?.message && Object.keys(filteredMessage.message).length > 1) {
    if (filteredMessage.message?.protocolMessage) {
      delete filteredMessage.message.protocolMessage;
    } else if (filteredMessage.message?.messageContextInfo) {
      delete filteredMessage.message.messageContextInfo;
    } else if (filteredMessage.message?.senderKeyDistributionMessage) {
      delete filteredMessage.message.senderKeyDistributionMessage;
    }
  }
  return filteredMessage;
}

function createEmptyMessage() {
  return {
    key: { id: "", remoteJid: "", fromMe: false },
    id: "",
    chat: "",
    fromMe: false,
    isGroup: false,
    sender: "",
    senderName: "",
    participant: undefined,
    participantAlt: undefined,
    addressingMode: undefined,
    pushName: "",
    type: "",
    metadata: {},
    message: proto.Message.fromObject({}),
    msgType: "",
    msgTimestamp: 0,
    text: "",
    body: "",
    mentionedJids: [],
    isMedia: false,
    isQuoted: false,
    mentioned: [],
    device: "unknown",
    isBot: false,
    reply: async () => Promise.resolve(null),
    download: async () => Promise.resolve(null),
  };
}

function findQuotedMessage(dStore, msgId) {
  if (!msgId) return null;
  return Object.entries(dStore.messages)
    .map(([_, arr]) => arr.find((b) => b.key.id === msgId))
    .find((item) => item && typeof item === "object" && item.key?.id === msgId);
}

async function getGroupMetadata(socket, jid, dStore) {
  try {
    const metadata = await socket.groupMetadata(jid);
    if (dStore.groupMetadata) {
      dStore.groupMetadata[jid] = metadata;
    }
    return metadata;
  } catch (error) {
    console.error(`Failed to fetch metadata for ${jid}:`, error);
    return {};
  }
}

module.exports = { procMsg, dlMedia, extractText };