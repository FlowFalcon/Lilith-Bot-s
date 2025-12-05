const axios = require("axios");
const { toVideo, toAudio } = require(global.root("lib/whatsapp/ffmpeg.js"));
const { font1 } = require(global.root("lib/font.js"));

let handler = async (m, { conn, args }) => {
  try {
    const url = args[0] ? args[0].trim() : '';
    if (!url || !/tiktok\.com/i.test(url)) {
      return m.reply("Format salah. Contoh: .tiktok <url>");
    }
    
    await m.adReply(font1("⏳ Mengunduh data TikTok..."));
    
    const apiUrl = `https://fathurweb.qzz.io/api/download/tiktok?url=${encodeURIComponent(url)}`;
    
    let data;
    try {
      const res = await axios.get(apiUrl, { timeout: 30000 });
      data = res.data;
    } catch (e) {
      return m.reply(`Gagal mengambil data dari API: ${e.message}`);
    }

    if (!data || !data.status || !data.result) {
      return m.reply(data.message || "Gagal mendapatkan hasil dari API.");
    }
    const result = data.result;

    try {
      const mediaUrl = result.video_hd || result.video;
      if (!mediaUrl) {
        await m.reply("Video tidak ditemukan.");
      } else {
        const res = await axios.get(mediaUrl, { responseType: "arraybuffer" });
        
        const converted = await toVideo(Buffer.from(res.data), "mp4");
        
        await conn.sendMessage(m.chat, {
          video: converted.data,
          mimetype: "video/mp4",
          caption: result.caption || ""
        }, { quoted: m });
        
        await converted.delete();
      }
    } catch (videoError) {
      console.error("TikTok Video Error:", videoError);
      await m.reply(`Gagal mengirim video: ${videoError.message}`);
    }
    try {
      if (!result.audio) {
      } else {
        const res = await axios.get(result.audio, { responseType: "arraybuffer" });
        
        const converted = await toAudio(Buffer.from(res.data), "mp3");
        
        await conn.sendMessage(m.chat, {
          audio: converted.data,
          mimetype: "audio/ogg; codecs=opus",
          ptt: false
        }, { quoted: m });

        await converted.delete();
      }
    } catch (audioError) {
      console.error("TikTok Audio Error:", audioError);
    }

  } catch (e) {
    console.error("TikTok Handler Error:", e);
    m.reply(`Terjadi kesalahan: ${e.message}`);
  }
};

handler.help = ["tiktok <url>"];
handler.command = ["tiktok", "tt", "ttdl"];
handler.tags = ["downloader"];
handler.description = "Mengunduh video dan audio TikTok.";

module.exports = handler;