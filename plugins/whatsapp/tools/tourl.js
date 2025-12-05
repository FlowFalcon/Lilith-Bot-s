const axios = require("axios");
const FormData = require("form-data");
const { Buffer } = require("buffer");

const getFilename = (q) => {
  if (q.message?.documentMessage?.fileName) {
    return q.message.documentMessage.fileName;
  }
  if (q.type === 'imageMessage') return 'image.jpg';
  if (q.type === 'videoMessage') return 'video.mp4';
  if (q.type === 'stickerMessage') return 'sticker.webp';
  if (q.type === 'audioMessage') return 'audio.mp3';
  if (q.type === 'conversation' || q.type === 'extendedTextMessage') return 'input.txt';
  
  return 'upload.dat'; 
};

let handler = async (m, { conn }) => {
  try {
    const q = m.quoted;
    if (!q) return m.reply("reply media atau pesan teks.");

    const isText = q.type === 'conversation' || q.type === 'extendedTextMessage';
    const isMedia = /imageMessage|videoMessage|stickerMessage|documentMessage|audioMessage/.test(q.type);

    if (!isText && !isMedia) {
      return m.reply("Jenis tidak didukung (bukan media atau teks).");
    }

    const loadingMsg = await m.reply("Mengunggah ke Qu.ax...");

    let inputBuffer;
    let inputFilename = getFilename(q);

    if (isText) {
      inputBuffer = Buffer.from(q.text, 'utf-8');
    } else {
      inputBuffer = await q.download();
      if (!inputBuffer) {
        return conn.sendMessage(m.chat, {
          text: "Gagal mengunduh media.",
          edit: loadingMsg.key
        });
      }
    }

    const form = new FormData();
    form.append("files[]", inputBuffer, { filename: inputFilename });

    let apiResult;
    try {
      const { data } = await axios.post("https://qu.ax/upload.php", form, {
        headers: form.getHeaders(),
        timeout: 60000,
      });
      apiResult = data;
    } catch (e) {
      throw new Error(e.response ? JSON.stringify(e.response.data) : e.message);
    }

    if (!apiResult || !apiResult.files || !apiResult.files[0] || !apiResult.files[0].url) {
      throw new Error("Gagal mengunggah. API tidak merespon dengan format yang diharapkan.");
    }

    const resultUrl = apiResult.files[0].url;

    await conn.sendMessage(m.chat, {
      text: `Done!\n\n${resultUrl}`,
      edit: loadingMsg.key
    });

  } catch (e) {
    console.error("Qu.ax Upload Error:", e);
    await m.reply(`Terjadi error: ${e.message}`);
  }
};

handler.command = ["tourl"];
handler.tags = ["tools"];
handler.help = ["tourl (reply media/text)"];
handler.description = "ubah media ke url";

module.exports = handler;