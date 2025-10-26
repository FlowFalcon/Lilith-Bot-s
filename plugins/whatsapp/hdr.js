const axios = require("axios");
const FormData = require("form-data");

async function upscale(buffer, scale) {
  const form = new FormData();
  form.append("image", buffer, { filename: "input.jpg" });
  form.append("scale", scale);

  const resp = await axios.post("https://fathurweb.qzz.io/api/tools/upscale", form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
    timeout: 120000,
  });
  return Buffer.from(resp.data);
}

let handler = async (m, { conn, args }) => {
  try {
    let scale = (args[0] || "2").replace("x", "");
    if (!["2", "4"].includes(scale)) {
      scale = "2"; 
    }
    const q = m.quoted;
    if (!q || q.mtype !== 'imageMessage') {
      return m.reply(`Kirim/reply gambar dengan caption *.hdr ${scale}* atau *.hdr 4*`);
    }

    const loadingMsg = await m.reply(`⏳ Sedang memperbesar gambar ${scale}x... (Bisa 1-2 menit)`);

    const buffer = await q.download();
    if (!buffer) {
      return conn.sendMessage(m.chat, {
        text: "❌ Gagal mengunduh gambar yang di-reply.",
        edit: loadingMsg.key
      });
    }
    const outBuffer = await upscale(buffer, scale);

    await conn.sendMessage(
      m.chat,
      {
        image: outBuffer,
        caption: `✅ Gambar berhasil diperbesar ${scale}x!`,
      },
      { quoted: m }
    );
    await conn.sendMessage(m.chat, { delete: loadingMsg.key });

  } catch (err) {
    console.error(err);
    const msg = err.response?.data ? err.response.data.toString() : err.message;
    m.reply(`❌ *Terjadi error:*\n\`\`\`\n${msg}\n\`\`\``);
  }
};

handler.description = "Memperbesar resolusi gambar.";
handler.help = ["hdr <2|4>"];
handler.tags = ["tools"];
handler.command = ["hdr", "upscale"];

module.exports = handler;