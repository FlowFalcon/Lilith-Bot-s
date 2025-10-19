const { downloadContentFromMessage, getContentType, jidNormalizedUser, proto, extractMessageContent, isJidGroup, isJidUser, } = require("baileys");

const extractText = (message) => {
    if (!message)
        return "";
    try {
        const content = extractMessageContent(message);
        if (!content)
            return "";
        if (content.conversation)
            return content.conversation;
        if (content.extendedTextMessage?.text)
            return content.extendedTextMessage.text;
        if (content.imageMessage?.caption)
            return content.imageMessage.caption;
        if (content.videoMessage?.caption)
            return content.videoMessage.caption;
        if (content.documentMessage?.caption)
            return content.documentMessage.caption;
        return "";
    }
    catch (error) {
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
        if (msgKeys.length === 0) {
            return null;
        }
        const type = msgKeys[0];
        if (!type) {
            return null;
        }
        const m = message[type];
        if (!m) {
            return null;
        }
        if (type === "conversation") {
            return Buffer.from(m);
        }
        const mediaType = mimeMap[type];
        if (!mediaType) {
            return null;
        }
        const stream = await downloadContentFromMessage(m, mediaType);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return buffer;
    }
    catch (error) {
        console.error("Error downloading media:", error);
        return null;
    }
};

const getDeviceType = (id) => {
    if (!id)
        return "unknown";
    const idLength = id.length;
    const startsWith3EB0 = id.startsWith("3EB0");
    if (idLength >= 16 && startsWith3EB0) {
        return "ios";
    }
    else if (idLength >= 16 && !startsWith3EB0) {
        return "web";
    }
    else {
        return "android";
    }
};

const procMsg = async (originalMessage, socket, dStore) => {
    const message = filterMsgs(originalMessage);
    const { key, message: rawMessage } = message || originalMessage;
    if (!rawMessage) {
        return null;
    }
    const id = key?.id || "";
    const chatJid = key?.remoteJid || "";
    const fromMe = key?.fromMe || false;
    const isGroup = isJidGroup(chatJid) || chatJid?.endsWith("@g.us");
    const timestamp = message.messageTimestamp;
    const rawPushName = message.pushName;
    const pushName = (typeof rawPushName === "string" && rawPushName) || "Unknown";
    const metadata = isGroup && chatJid ? dStore.groupMetadata?.[chatJid] || {} : {};
    const senderJid = key?.participant || (isGroup ? chatJid : jidNormalizedUser(chatJid) || "");
    const sender = isGroup && metadata?.participants
        ? metadata.participants.find((p) => p.id === senderJid)?.jid ||
            senderJid
        : senderJid;
    const type = getContentType(rawMessage) ||
        (rawMessage && typeof rawMessage === "object"
            ? Object.keys(rawMessage)[0] || ""
            : "");
    const msgType = type;
    const messageContent = rawMessage[msgType];
    const contextInfo = messageContent?.contextInfo || rawMessage.contextInfo;
    const quotedRawMessage = contextInfo?.stanzaId;
    const isQuoted = !!quotedRawMessage;
    const body = messageContent
        ? messageContent.text ||
            messageContent.caption ||
            (typeof messageContent === "string" ? messageContent : "")
        : "";
    const isMedia = /imageMessage|videoMessage|stickerMessage|documentMessage|audioMessage/.test(msgType);
    const currentMentions = (contextInfo?.mentionedJid || []);
    const quotedMentions = isQuoted && quotedRawMessage?.contextInfo?.mentionedJid
        ? quotedRawMessage.contextInfo.mentionedJid
        : [];
    const uniqueMentions = new Set([...currentMentions, ...quotedMentions]);
    const allMentions = Array.from(uniqueMentions);
    let quoted;
    let quotedType = "";
    let quotedText = "";
    let quotedSender = "";
    if (isQuoted) {
        const quotedMsgId = contextInfo?.stanzaId;
        let quotedContent = undefined;
        if (quotedMsgId) {
            quotedContent = Object.entries(dStore.messages)
                .map(([a, i]) => i.find((b) => b.key.id === quotedMsgId))
                .find((item) => item && typeof item === "object" && item.key?.id === quotedMsgId);
        }
        if (quotedContent) {
            quoted = await procMsg(quotedContent, socket, dStore);
            quotedType = getContentType(quotedContent.message || undefined) || "";
            const quotedMessageForExtract = quotedContent.message === null ? undefined : quotedContent.message;
            quotedText = extractText(quotedMessageForExtract);
            quotedSender = contextInfo?.participant || "";
        }
        else {
            quoted = null;
        }
    }
    const device = id ? getDeviceType(id) : "unknown";
    const isBot = fromMe;
    const normalizedTimestamp = timestamp
        ? typeof timestamp === "number"
            ? timestamp
            : Number(timestamp)
        : 0;
    return {
        key: key,
        id,
        chat: chatJid,
        fromMe,
        isGroup,
        sender,
        senderName: pushName,
        participant: key?.participant || undefined,
        pushName,
        type: msgType,
        metadata,
        message: rawMessage || proto.Message.fromObject({}),
        msgType,
        msgTimestamp: normalizedTimestamp,
        text: body,
        body: body,
        mentionedJids: allMentions,
        isMedia,
        isQuoted: isQuoted || false,
        ...(isQuoted
            ?
            {
                quoted,
                quotedType,
                quotedMessage: quoted,
                quotedText,
                quotedSender,
            }
            : {}),
        mentioned: allMentions,
        device,
        isBot,
        reply: async (text) => {
            return await socket.sendMessage(chatJid, { text }, {
                quoted: message,
                ephemeralExpiration: isGroup
                    ? metadata?.ephemeralDuration
                    : message[type]?.contextInfo?.expiration,
            });
        },
    };
};

function filterMsgs(message) {
    const filteredMessage = { ...message };
    if (filteredMessage?.message &&
        Object.keys(filteredMessage.message).length > 1) {
        if (filteredMessage.message?.protocolMessage) {
            delete filteredMessage.message.protocolMessage;
        }
        else if (filteredMessage.message?.messageContextInfo) {
            delete filteredMessage.message.messageContextInfo;
        }
        else if (filteredMessage.message?.senderKeyDistributionMessage) {
            delete filteredMessage.message.senderKeyDistributionMessage;
        }
    }
    return filteredMessage;
}

module.exports = { procMsg, dlMedia };