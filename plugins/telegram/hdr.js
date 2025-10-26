const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { Markup } = require("telegraf");

const userState = new Map();

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

let handler = async (ctx) => {
  try {
    userState.set(ctx.from.id, { step: "awaiting_image" });
    await ctx.reply("📸 Kirim gambar yang ingin di-upscale:");
  } catch (e) {
    ctx.reply(e.message);
  }
};

handler.description = "Memperbesar resolusi gambar menggunakan AI.";
handler.help = ["hdr"];
handler.tags = ["tools"];
handler.command = ["hdr"];

handler.setup = (bot, platform) => {
  bot.on("photo", async (ctx, next) => {
    const state = userState.get(ctx.from.id);
    if (!state || state.step !== "awaiting_image") return next();

    const photo = ctx.message.photo.pop();
    const fileId = photo.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);

    const imgBuffer = await axios.get(fileLink.href, { responseType: "arraybuffer" }).then(r => Buffer.from(r.data));
    const tempDir = path.join(__dirname, "..", "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filePath = path.join(tempDir, `hdr_${ctx.from.id}.jpg`);
    fs.writeFileSync(filePath, imgBuffer);

    userState.set(ctx.from.id, { step: "choose_scale", filePath });

    await ctx.reply("🔍 Pilih skala perbesaran:", Markup.inlineKeyboard([
      [Markup.button.callback("2x", "upscale_2x"), Markup.button.callback("4x", "upscale_4x")]
    ]));
  });

  bot.action(/^upscale_(\dx)$/, async (ctx) => {
    const scale = ctx.match[1].replace("x", "");
    const state = userState.get(ctx.from.id);
    if (!state?.filePath) return;

    const loading = await ctx.reply(`⏳ Sedang memperbesar gambar ${scale}x...`);

    try {
      const buffer = fs.readFileSync(state.filePath);
      const out = await upscale(buffer, scale);

      const outPath = path.join(__dirname, "..", "..", "temp", `hdr_out_${ctx.from.id}.jpg`);
      fs.writeFileSync(outPath, out);

      await ctx.deleteMessage(loading.message_id).catch(() => {});
      await ctx.replyWithPhoto({ source: outPath }, { caption: `✅ Gambar berhasil diperbesar ${scale}x!` });

      fs.unlinkSync(state.filePath);
      fs.unlinkSync(outPath);
      userState.delete(ctx.from.id);
    } catch (err) {
      console.error(err);
      await ctx.editMessageText("❌ Gagal memproses gambar.");
    }
  });
};

module.exports = handler;
