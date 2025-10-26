const axios = require("axios");
const { sizeFormatter } = require('human-readable');

const formatSize = sizeFormatter({
  std: 'JEDEC', 
  decimalPlaces: 2,
  keepTrailingZeroes: false,
  render: (literal, symbol) => `${literal} ${symbol}B`,
});

async function getFileSize(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 5000,
      maxRedirects: 5
    });
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
  } catch (error) {
  }
  return null; 
}

async function handler(m, { conn, args }) {
  try {
    let type = "mp3";
    if (Array.isArray(args)) {
      if (args.includes("-mp4") || args.includes("--mp4")) type = "mp4";
      else if (args.includes("-mp3") || args.includes("--mp3")) type = "mp3";
    }
    const query = (args || [])
      .filter(a => !/^(-|--)(mp3|mp4)$/.test(a))
      .join(" ")
      .trim();
      
    if (!query) return m.reply("❓ Mau cari apa? Contoh: *.play pppp -mp4*");

    const apiUrl = `https://fathurweb.qzz.io/api/download/ytplay?query=${encodeURIComponent(query)}`;
    await m.reply(`⏳ Mencari dan memproses "${query}"...`);

    let apiData;
    try {
      const response = await axios.get(apiUrl, { timeout: 60000 });
      apiData = response.data;

      if (!apiData || !apiData.status || !apiData.result) {
        throw new Error("API tidak memberikan hasil yang valid.");
      }
    } catch (apiError) {
      console.error("API Error:", apiError);
      return m.reply(`❌ Gagal mengambil data dari API: ${apiError.message}`);
    }

    const result = apiData.result;
    const mediaInfo = type === "mp3" ? result.mp3 : result.mp4;

    if (!mediaInfo || !mediaInfo.url) {
      return m.reply(`❌ Link download untuk ${type.toUpperCase()} tidak ditemukan.`);
    }

    let caption = `*${result.title || 'Judul Tidak Ditemukan'}*\n\n`;
    caption += `🎤 *Author:* ${result.author || 'N/A'}\n`;
    caption += `⏱️ *Durasi:* ${result.duration || 'N/A'}\n`;
    caption += `🔗 *URL YT:* ${result.url || 'N/A'}\n\n`;
    caption += `Mengirim ${type.toUpperCase()}, mohon tunggu...`;

    const fileSize = await getFileSize(mediaInfo.url);
    if (fileSize) {
      caption += `\n📦 *Ukuran File:* ${formatSize(fileSize)}`;
    }

    await conn.sendMessage(m.chat, {
      image: { url: result.thumbnail },
      caption: caption,
    }, { quoted: m });

    const fileName = mediaInfo.filename || `${result.title}.${type}`;
    const mimeType = type === "mp3" ? "audio/mpeg" : "video/mp4";
    const mediaKey = type === "mp3" ? "audio" : "video";

    const finalFileSize = fileSize || await getFileSize(mediaInfo.url); 
    const sizeLimitMB = 100; 
    let sendAsDocument = false;

    if (finalFileSize && (finalFileSize / (1024 * 1024)) > sizeLimitMB) {
      sendAsDocument = true;
      console.log(`Ukuran file (${formatSize(finalFileSize)}) melebihi ${sizeLimitMB}MB, mengirim sebagai dokumen.`);
    }

    if (sendAsDocument) {
      await conn.sendMessage(m.chat, {
        document: { url: mediaInfo.url },
        mimetype: mimeType,
        fileName: fileName,
      }, { quoted: m });
    } else {
      const messageOptions = {
        [mediaKey]: { url: mediaInfo.url },
        mimetype: mimeType,
        fileName: fileName,
      };
      if (type === "mp3") {
        messageOptions.ptt = false;
      }
      await conn.sendMessage(m.chat, messageOptions, { quoted: m });
    }

  } catch (e) {
    console.error("Handler Error:", e);
    m.reply(`❌ Terjadi kesalahan: ${e.message}`);
  }
}

handler.help = ['play <judul> [-mp3|-mp4]']
handler.command = ['play', 'ytplay']
handler.tags = ['search', 'downloader']
module.exports = handler;