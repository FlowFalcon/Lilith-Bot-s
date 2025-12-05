const axios = require("axios");
const { toVideo, toAudio } = require("../../../lib/whatsapp/ffmpeg.js");

async function handler(m, { conn, args }) {
  try {
    let type = "mp3";
    if (args.includes("-mp4") || args.includes("--mp4")) type = "mp4";
    else if (args.includes("-mp3") || args.includes("--mp3")) type = "mp3";

    const query = (args || [])
      .filter(a => !/^(-|--)(mp3|mp4)$/.test(a))
      .join(" ")
      .trim();

    if (!query)
      return m.reply("❓ Mau cari apa? Contoh: *.play aku bukan boneka -mp4*");

    await m.reply(`⏳ Mencari dan memproses "${query}"...`);

    const apiUrl = `https://fathurweb.qzz.io/api/download/ytplay?query=${encodeURIComponent(query)}`;
    const { data } = await axios.get(apiUrl, { timeout: 60000 });

    if (!data || !data.status || !data.result)
      throw new Error("API tidak memberikan hasil yang valid.");

    const result = data.result;
    const mediaInfo = type === "mp3" ? result.mp3 : result.mp4;
    if (!mediaInfo || !mediaInfo.url)
      return m.reply(`❌ Link ${type.toUpperCase()} tidak ditemukan.`);

    let caption = `🎶 *${result.title || "Judul tidak ditemukan"}*\n`;
    caption += `🎤 *Author:* ${result.author || "N/A"}\n`;
    caption += `⏱️ *Durasi:* ${result.duration || "N/A"}\n`;
    caption += `🔗 *URL:* ${result.url}\n\n`;
    caption += `📦 *Menyiapkan file...*`;

    await conn.sendMessage(
      m.chat,
      {
        image: { url: result.thumbnail },
        caption,
      },
      { quoted: m }
    );

    const response = await axios.get(mediaInfo.url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);

    let sendOptions = {};
    let converted;

    if (type === "mp3") {
      // Convert ke Audio Opus OGG
      converted = await toAudio(buffer, "mp3");
      
      sendOptions = { 
        audio: converted.data, 
        mimetype: "audio/ogg; codecs=opus", 
        ptt: false 
      };
    } else {
      // Convert ke Video MP4 H.264
      converted = await toVideo(buffer, "mp4");
      
      sendOptions = {
        video: converted.data,
        mimetype: "video/mp4",
        caption: result.title,
        fileName: `${result.title}.mp4`,
      };
    }

    // Kirim hasil
    await conn.sendMessage(m.chat, sendOptions, { quoted: m });
    
    // Bersihkan file temp
    if (converted) await converted.delete();

  } catch (e) {
    console.error("Handler Error:", e);
    m.reply(`❌ Terjadi kesalahan: ${e.message}`);
  }
}

handler.help = ["play <judul> [-mp3|-mp4]"];
handler.command = ["play", "ytplay"];
handler.tags = ["downloader"];

module.exports = handler;