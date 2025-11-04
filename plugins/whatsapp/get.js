const axios = require("axios");
const { convert } = require("liora-lib");
const util = require("util");
const path = require("path");
const { sizeFormatter } = require("human-readable");

const formatSize = sizeFormatter({
  std: "JEDEC",
  decimalPlaces: 2,
  keepTrailingZeroes: false,
  render: (literal, symbol) => `${literal} ${symbol}B`,
});

let handler = async (m, { conn, text }) => {
  try {
    const url = text.trim();
    if (!url) return m.reply("Perintah salah. Contoh: .get https://example.com/file.jpg");

    if (!/^(https|http):\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
      return m.reply("URL tidak valid. Harus dimulai dengan http:// atau https://");
    }

    const loadingMsg = await m.reply("⏳ Mengambil data...");

    let response;
    try {
      response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
    } catch (e) {
      let errorMsg = `error: ${e.message}`;
      
      if (e.response) {
        const statusCode = e.response.status;
        let errorData = e.response.data;

        try {
          if (errorData instanceof ArrayBuffer || errorData instanceof Buffer) {
            errorData = Buffer.from(errorData).toString("utf8");
          }

          const jsonError = JSON.parse(errorData);
          errorMsg = `error (HTTP ${statusCode})\n\n\`\`\`json\n${JSON.stringify(jsonError, null, 2)}\n\`\`\``;

        } catch (parseError) {
          errorMsg = `error (HTTP ${statusCode})\n\n\`\`\`\n${String(errorData).slice(0, 500)}\n\`\`\``;
        }
      }
      await conn.sendMessage(m.chat, { text: errorMsg, edit: loadingMsg.key });
      return;
    }

    const buffer = Buffer.from(response.data);
    const contentType = (response.headers["content-type"] || "application/octet-stream").toLowerCase();
    const contentLength = response.headers["content-length"] || buffer.length;
    const size = formatSize(contentLength);
    
    await conn.sendMessage(m.chat, { delete: loadingMsg.key });
    if (contentType.startsWith("image/")) {
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `*Tipe:* ${contentType}\n*Ukuran:* ${size}\n*URL:* ${url}`
      }, { quoted: m });
    }

    if (contentType.startsWith("video/")) {
      return await conn.sendMessage(m.chat, {
        video: buffer,
        caption: `*Tipe:* ${contentType}\n*Ukuran:* ${size}\n*URL:* ${url}`,
        mimetype: contentType
      }, { quoted: m });
    }

    if (contentType.startsWith("audio/")) {
      await m.reply(`*Tipe:* ${contentType}\n*Ukuran:* ${size}\n*URL:* ${url}\n\n⏳ Mengonversi audio...`);
      
      const audio = await convert(buffer, {
        format: "opus",
        sampleRate: 48000,
        channels: 1,
        bitrate: "64k",
        ptt: false,
      });
      
      const finalBuffer = audio instanceof Buffer ? audio : Buffer.from(audio.buffer || audio.data);

      return await conn.sendMessage(m.chat, {
        audio: finalBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: false
      }, { quoted: m });
    }

    const TEXT_MAX_LENGTH = 4096;
    if (contentType.startsWith("text/") || contentType.includes("application/json")) {
      const textData = buffer.toString("utf8");

      if (textData.length < TEXT_MAX_LENGTH) {
        let contentToSend = textData;
        let header = `*Tipe: Teks (${size}):*\n\n`;

        if (contentType.includes("application/json")) {
          try {
            const jsonObj = JSON.parse(textData);
            header = `*Tipe: JSON (${size}):*\n\n`;
            contentToSend = util.inspect(jsonObj, { depth: 10, colors: false });
          } catch (e) {
          }
        }
        
        return m.reply(header + contentToSend);
        
      } else {
        const extension = contentType.includes("json") ? "json" : contentType.split("/")[1] || "txt";
        const fileName = path.basename(url).split('?')[0] || `response.${extension}`;
        
        return await conn.sendMessage(m.chat, {
          document: buffer,
          mimetype: contentType,
          fileName: fileName,
          caption: `Teks terlalu besar, dikirim sebagai file.\n*Tipe:* ${contentType}\n*Ukuran:* ${size}\n*URL:* ${url}`
        }, { quoted: m });
      }
    }

    const extension = path.extname(url).split('?')[0] || "";
    let fileName = path.basename(url).split('?')[0];
    if (!fileName || fileName.length < 3) fileName = `file${extension || '.txt'}`;

    return await conn.sendMessage(m.chat, {
      document: buffer,
      mimetype: contentType,
      fileName: fileName,
      caption: `mengambil file...\n*Tipe:* ${contentType}\n*Ukuran:* ${size}\n*URL:* ${url}`
    }, { quoted: m });

  } catch (e) {
    console.error("Get Handler Error:", e);
    m.reply(`Terjadi kesalahan: ${e.message}`);
  }
};

handler.help = ["get <url>", "fetch <url>"];
handler.command = ["get", "fetch"];
handler.tags = ["downloader"];
handler.description = "Mengambil data dari URL.";

module.exports = handler;