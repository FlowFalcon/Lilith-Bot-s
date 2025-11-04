const { logError } = require("../logger.js");
const config = require("../../config.js");

function parseSlash(text) {
    const parts = text.trim().split(/\s+/);
    const cmd = parts.shift().replace(/^\//, "");
    return { cmd, args: parts };
}

async function handleMessage(ctx, bot) {
    const text = ctx.message?.text || "";
    if (!text.startsWith("/") && !config.prefix.some((p) => text.startsWith(p))) return;

    const { cmd, args } = text.startsWith("/")
      ? parseSlash(text)
      : (() => {
          const p = config.prefix.find((px) => text.startsWith(px));
          const cut = text.slice(p.length).trim().split(/\s+/);
          return { cmd: (cut.shift() || "").toLowerCase(), args: cut };
        })();

    const command = bot.commands.get((cmd || "").toLowerCase());
    if (!command || typeof command.run !== 'function') return;

    const isOwner = String(ctx.from?.id) === String(config.ownerTelegram);
    if (command.permissions?.ownerOnly && !isOwner) {
      return ctx.reply("⚠️ Perintah ini hanya untuk owner!").catch(() => {});
    }
    ctx._client = bot;
    ctx.args = args; 

    try {
      await command.run(ctx);
    } catch (e) {
      logError("telegram:command.run", e);
      await ctx.reply("⚠️ Terjadi error saat menjalankan command.").catch(() => {});
    }
}

module.exports = { handleMessage };