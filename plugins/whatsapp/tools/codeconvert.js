const axios = require("axios");
const FormData = require("form-data");
const { Buffer } = require("buffer");

let handler = async (m, { conn, command }) => {
  try {
    const q = m.quoted;
    if (!q) return m.reply("Harap reply sebuah pesan teks (kode) atau file .js");

    const isDoc = q.type === 'documentMessage';
    const isText = q.type === 'conversation' || q.type === 'extendedTextMessage';

    if (!isDoc && !isText) {
      return m.reply("Reply harus berupa pesan teks (kode) atau file .js");
    }
    
    const mode = command === 'tocjs' ? 'esm' : 'cjs';
    const targetFormat = mode === 'esm' ? 'CommonJS' : 'ES Module';

    let inputBuffer;
    let inputFilename = "input.js";

    if (isText) {
      inputBuffer = Buffer.from(q.text, 'utf-8');
    } else if (isDoc) {
      if (!q.message.documentMessage.fileName.endsWith('.js')) {
        return m.reply("File yang di-reply harus berekstensi .js");
      }
      inputFilename = q.message.documentMessage.fileName;
      inputBuffer = await q.download();
      if (!inputBuffer) {
        return m.reply("Gagal mengunduh file.");
      }
    }

    const loadingMsg = await m.reply(`Mengonversi ${inputFilename} ke ${targetFormat}...`);

    const form = new FormData();
    form.append("file", inputBuffer, { filename: inputFilename });
    form.append("mode", mode);

    let apiResult;
    try {
      const { data } = await axios.post("https://fathurweb.qzz.io/api/tools/codeconvert", form, {
        headers: form.getHeaders(),
        timeout: 30000, 
      });
      apiResult = data;
    } catch (e) {
      throw new Error(e.response ? JSON.stringify(e.response.data) : e.message);
    }

    if (!apiResult || !apiResult.status || !apiResult.result_url) {
      throw new Error(apiResult.message || "Gagal mengonversi kode. API tidak merespon dengan benar.");
    }

    const { data: resultContentBuffer } = await axios.get(apiResult.result_url, {
      responseType: 'arraybuffer'
    });
    
    const resultBuffer = Buffer.from(resultContentBuffer);
    const caption = resultBuffer.toString('utf-8');

    await conn.sendMessage(m.chat, {
      document: resultBuffer,
      mimetype: 'application/javascript',
      fileName: 'result.js',
      caption: caption
    }, { quoted: m });

    await conn.sendMessage(m.chat, { delete: loadingMsg.key });

  } catch (e) {
    console.error("CodeConvert Error:", e);
    await m.reply(`Terjadi error: ${e.message}`);
  }
};

handler.command = ["tocjs", "toesm"];
handler.tags = ["tools"];
handler.help = ["tocjs (reply code/file)", "toesm (reply code/file)"];
handler.description = "Mengonversi kode JavaScript antara ESM dan CJS.";
module.exports = handler;