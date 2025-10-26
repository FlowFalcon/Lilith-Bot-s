import axios from "axios";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";

const API = "https://fathurweb.qzz.io/api/r/ba";

function extFrom(contentType = "") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

let handler = async (msg) => {
  try {
    let buf, ctype;
    try {
      const resp = await axios.get(API, {
        responseType: "arraybuffer",
        timeout: 20000,
        headers: { "User-Agent": "LilithBot/1.0" },
        validateStatus: () => true,
      });
      if (resp.status < 200 || resp.status >= 300) throw new Error(`HTTP ${resp.status}`);
      buf = Buffer.from(resp.data);
      ctype = String(resp.headers["content-type"] || "");
      if (!/^image\//i.test(ctype)) throw new Error(`Bukan image (content-type: ${ctype || "unknown"})`);
    } catch (e) {
      const message = `❌ Gagal ambil gambar: ${e.message || e}`;
      return msg.channel.send(message);
    }

    const ext = extFrom(ctype);

    const file = new AttachmentBuilder(buf, { name: `blue-archive.${ext}` });
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Blue Archive")
      .setImage(`attachment://blue-archive.${ext}`);

    if (msg.author) {
        embed.setFooter({ text: `Diminta oleh ${msg.author.tag}` }).setTimestamp(Date.now());
    }

    return msg.channel.send({ embeds: [embed], files: [file] });
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Random gambar Blue Archive";
handler.help = ["bluearchive"];
handler.tags = ["anime"];
handler.command = ["bluearchive"];

export default handler;
