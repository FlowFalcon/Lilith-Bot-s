const fs = require("fs");
const path = require("path");
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
  return resp.data;
}

let handler = async (msg) => {
  try {
    const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
    
    // Simplified argument parsing
    const args = msg.content.slice(process.env.PREFIX.length).trim().split(/ +/);
    const scaleArg = args.find(arg => arg.startsWith("scale:"));
    const scale = scaleArg ? parseInt(scaleArg.split(":")[1]) : null;
    
    const att = msg.attachments.first();

    if (!att?.url || ![2, 4].includes(scale)) {
      return msg.channel.send("❌ Harap gunakan `/hdr image:<gambar> scale:2|4`");
    }

    const loading = await msg.channel.send(`⏳ Sedang memperbesar gambar ${scale}x...`);

    try {
      const imgResp = await axios.get(att.url, { responseType: "arraybuffer" });
      const out = await upscale(Buffer.from(imgResp.data), scale);

      const file = new AttachmentBuilder(out, { name: `hdr_${scale}x.jpg` });
      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle("🖼️ HDR Upscale")
        .setDescription(`Gambar berhasil diperbesar **${scale}x**`);

      await loading.delete().catch(() => {});
      return msg.channel.send({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error(err);
      return msg.channel.send("❌ Gagal memproses gambar.");
    }
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Memperbesar resolusi gambar menggunakan teknologi HDR.";
handler.help = ["hdr"];
handler.tags = ["tools"];
handler.command = ["hdr"];

module.exports = handler;
