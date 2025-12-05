const {
  downloadContentFromMessage,
  getContentType,
  jidNormalizedUser,
  proto,
  extractMessageContent,
  isJidGroup,
} = require("baileys");
const fs = require("fs");

let thumbnailCache = null;

const extractText = (content) => {
  if (!content) return "";
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.documentMessage?.caption) return content.documentMessage.caption;
  
  if (content.templateButtonReplyMessage) {
      return content.templateButtonReplyMessage.selectedId || content.templateButtonReplyMessage.selectedDisplayText || "";
  }
  if (content.interactiveResponseMessage) {
      try {
          const params = JSON.parse(content.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || "{}");
          return params.id || "";
      } catch {}
  }
  if (content.buttonsResponseMessage) {
      return content.buttonsResponseMessage.selectedButtonId || content.buttonsResponseMessage.selectedDisplayText || "";
  }
  if (content.listResponseMessage) {
      return content.listResponseMessage.singleSelectReply?.selectedRowId || "";
  }

  return "";
};

const dlMedia = async (msgContent, msgType) => {
  try {
    const stream = await downloadContentFromMessage(msgContent, msgType.replace("Message", ""));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
  } catch (error) {
    console.error("Error downloading media:", error);
    return null;
  }
};

const getDeviceType = (id) => {
  if (!id) return "unknown";
  return id.length > 21 ? "android" : id.substring(0, 2) === "3A" ? "ios" : "web"; 
};

const procMsg = async (raw, socket, store) => {
  if (!raw.message) return null;

  const key = raw.key;
  const isGroup = isJidGroup(key.remoteJid) || key.remoteJid?.endsWith("@g.us");
  const chat = key.remoteJid;
  let sender = "";
  if (key.fromMe) {
      sender = jidNormalizedUser(socket.user.id);
  } else if (isGroup) {
      sender = jidNormalizedUser(key.participantAlt || key.participant);
  } else {
      if (key.remoteJid && key.remoteJid.endsWith("@s.whatsapp.net")) {
          sender = jidNormalizedUser(key.remoteJid);
      } else if (key.remoteJidAlt && key.remoteJidAlt.endsWith("@s.whatsapp.net")) {
          sender = jidNormalizedUser(key.remoteJidAlt);
      } else {
          sender = jidNormalizedUser(key.remoteJid || "");
      }
  }

  let mContent = raw.message;
  if (mContent.viewOnceMessageV2) mContent = mContent.viewOnceMessageV2.message;
  if (mContent.ephemeralMessage) mContent = mContent.ephemeralMessage.message;
  if (mContent.documentWithCaptionMessage) mContent = mContent.documentWithCaptionMessage.message;
  
  const type = getContentType(mContent);
  if (!type) return null;

  const msg = mContent[type];
  const body = extractText(mContent); 
  
  // --- Load Thumbnail ---
  if (!thumbnailCache) {
      try {
          const thumbPath = global.root("img/p2.jpg");
          if (fs.existsSync(thumbPath)) {
              thumbnailCache = fs.readFileSync(thumbPath);
          }
      } catch (e) {}
  }

  let config = {};
  try {
      config = require(global.root("config.js"));
  } catch (e) {}

  let metadata = null;
  let participants = [];
  let isAdmin = false;
  let isBotAdmin = false;

  if (isGroup) {
      try {
          if (store?.groupMetadata?.[chat]) {
              metadata = store.groupMetadata[chat];
          } else {
              metadata = await socket.groupMetadata(chat);
              if (store) {
                  if (!store.groupMetadata) store.groupMetadata = {};
                  store.groupMetadata[chat] = metadata;
              }
          }
          
          participants = metadata.participants || [];
          const findParticipant = (targetJid) => {
              return participants.find(p => {
                  const id = jidNormalizedUser(p.id); 
                  const phone = p.phoneNumber ? jidNormalizedUser(p.phoneNumber) : null; 
                  return id === targetJid || phone === targetJid;
              });
          };

          const botIdRaw = socket.user?.id || socket.authState?.creds?.me?.id;
          const botId = botIdRaw ? jidNormalizedUser(botIdRaw) : "";

          const userParticipant = findParticipant(sender);
          const botParticipant = findParticipant(botId);

          isAdmin = userParticipant?.admin === "admin" || userParticipant?.admin === "superadmin";
          isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";

      } catch (e) {
          console.error(`[MSG] Metadata Error ${chat}:`, e.message);
      }
  }

  let quoted = null;
  const contextInfo = msg?.contextInfo;
  if (contextInfo?.quotedMessage) {
      const qMsg = contextInfo.quotedMessage;
      const qType = getContentType(qMsg);
      const qContent = qMsg[qType];
      const qText = extractText(qMsg);
      const qSender = jidNormalizedUser(contextInfo.participant);

      quoted = {
          key: { remoteJid: chat, fromMe: qSender === jidNormalizedUser(socket.user.id), id: contextInfo.stanzaId, participant: qSender },
          id: contextInfo.stanzaId,
          sender: qSender,
          type: qType,
          msg: qContent,
          text: qText,
          isMedia: ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage"].includes(qType),
          download: async () => dlMedia(qContent, qType),
          delete: () => socket.sendMessage(chat, { delete: { remoteJid: chat, fromMe: false, id: contextInfo.stanzaId, participant: qSender } })
      };
  }

  return {
      key,
      id: key.id,
      chat,
      sender,
      senderName: raw.pushName || "Unknown",
      pushName: raw.pushName || "Unknown",
      fromMe: key.fromMe,
      isGroup,
      isBot: key.id.startsWith("BAE5") || key.id.length === 22,
      type,
      msgType: type,
      message: mContent,
      msgTimestamp: raw.messageTimestamp,
      body,
      text: body,
      isMedia: ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage"].includes(type),
      download: async () => dlMedia(msg, type),
      isQuoted: !!quoted,
      quoted,
      metadata,
      participants,
      isAdmin,
      isBotAdmin,
      device: getDeviceType(key.id),
      
      reply: async (text, options = {}) => socket.sendMessage(chat, { text: String(text), ...options }, { quoted: { key, message: raw.message }, ...options }),
      
      adReply: async (text, title = "", options = {}) => {
          return await socket.sendMessage(chat, {
              text: String(text),
              contextInfo: {
                externalAdReply: {
                title: title || config.botName || "Lilith Bot",
                body: title ? "" : `Version ${require(global.root('package.json')).version}`,
                thumbnail: thumbnailCache,
                mediaType: 1,
                renderLargerThumbnail: false,
                sourceUrl: ""
                                },
                  mentionedJid: options.mentions || []
              }
          }, { quoted: { key, message: raw.message }, ...options });
      },

      react: async (emoji) => socket.sendMessage(chat, { react: { text: emoji, key } }),
      delete: async () => socket.sendMessage(chat, { delete: key })
  };
};

module.exports = { procMsg, dlMedia, extractText };