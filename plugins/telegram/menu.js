const axios = require("axios");
const { Markup } = require("telegraf");

let handler = async (ctx) => {
  try {
    const registry = ctx._client?.commands || new Map();
    const thumbnailUrl = "https://files.catbox.moe/x98vn2.jpg";
    const isOwner = String(ctx.from?.id) === String(ctx._client?.config?.ownerTelegram);
    const commandsByCategory = {};
    const ownerCommands = [];

    for (const [, cmd] of registry.entries()) {
      if (!cmd.name) continue;
      const item = {
          name: cmd.name,
          desc: cmd.description || cmd.name,
      };

      const isOwnerCmd = !!(cmd.permissions && cmd.permissions.ownerOnly);

      if (isOwnerCmd) {
          if (isOwner) {
              ownerCommands.push(item);
          }
      } else {
          const category = (Array.isArray(cmd.tags) && cmd.tags.length > 0) ? cmd.tags[0] : 'Uncategorized';
          const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

          if (!commandsByCategory[categoryTitle]) {
              commandsByCategory[categoryTitle] = [];
          }
          commandsByCategory[categoryTitle].push(item);
      }
    }

    const sortedCategories = Object.keys(commandsByCategory).sort();
    for (const category in commandsByCategory) {
        commandsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    }
    ownerCommands.sort((a, b) => a.name.localeCompare(b.name));


    const title = `*${ctx._client.botName || "Bot"} — Menu*`;
    const ownerLine = `*Owner: ${ctx._client.ownerName || "-"}*`;
    const MAX_CAPTION = 1000;
    const baseHeader = `${title}\n\n`;
    const baseFooter = `\n\nKetik \`/<perintah>\` untuk menggunakan.\n${ownerLine}`;

    function buildPages() {
        const pages = [];
        let currentPageContent = baseHeader;

        for (const category of sortedCategories) {
            const commands = commandsByCategory[category];
            if (commands.length === 0) continue;

            const categoryHeader = `*${category}*\n`;
            const commandLines = commands.map(i => `• /${i.name} — ${i.desc}`).join("\n");
            const categoryBlock = categoryHeader + commandLines + "\n\n";

            if ((currentPageContent + categoryBlock + baseFooter).length > MAX_CAPTION) {
                if (currentPageContent !== baseHeader) {
                    pages.push((currentPageContent.trim() + baseFooter).slice(0, MAX_CAPTION));
                }
                currentPageContent = baseHeader + categoryBlock;
            } else {
                currentPageContent += categoryBlock;
            }
        }

         if (isOwner && ownerCommands.length > 0) {
              const ownerHeader = "*Owner Menu*\n";
              const ownerCommandLines = ownerCommands.map(i => `• /${i.name} — ${i.desc}`).join("\n");
              const ownerBlock = ownerHeader + ownerCommandLines + "\n\n";

               if ((currentPageContent + ownerBlock + baseFooter).length > MAX_CAPTION) {
                    if (currentPageContent !== baseHeader) {
                         pages.push((currentPageContent.trim() + baseFooter).slice(0, MAX_CAPTION));
                    }
                    currentPageContent = baseHeader + ownerBlock;
               } else {
                    currentPageContent += ownerBlock;
               }
         }

        if (currentPageContent !== baseHeader || pages.length === 0) {
             if (currentPageContent === baseHeader && ownerCommands.length === 0 && sortedCategories.length === 0) {
                 currentPageContent += "_(Tidak ada perintah tersedia saat ini)_\n\n";
             }
             pages.push((currentPageContent.trim() + baseFooter).slice(0, MAX_CAPTION));
        }

        return pages;
    }

    const pages = buildPages();

    if (pages.length === 1) {
      return ctx.replyWithPhoto(
        { url: thumbnailUrl },
        { caption: pages[0], parse_mode: "Markdown" }
      );
    } else {
        const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        if (!ctx._client._menuCache) ctx._client._menuCache = new Map();
        ctx._client._menuCache.set(token, { pages, userId: ctx.from.id });
        const kb = Markup.inlineKeyboard([
          [
            Markup.button.callback("⬅️ Prev", `menu_nav:${token}:0`), 
            Markup.button.callback(`📄 1/${pages.length}`, "menu_ignore"),
            Markup.button.callback("Next ➡️", `menu_nav:${token}:1`),
          ],
        ]);
         kb.reply_markup.inline_keyboard[0][0] = { text: "⬅️ Prev", callback_data: "menu_ignore" };


        return ctx.replyWithPhoto(
          { url: thumbnailUrl },
          { caption: pages[0], parse_mode: "Markdown", reply_markup: kb.reply_markup }
        );
    }

  } catch (e) {
    console.error("Error in Telegram menu handler:", e);
    ctx.reply(`Terjadi error saat menampilkan menu: ${e.message}`).catch(() => {});
  }
};

handler.description = "Menampilkan menu perintah bot dengan navigasi halaman.";
handler.help = ["menu"];
handler.tags = ["main"];
handler.command = ["menu"]; 

handler.setup = (bot, platform) => {
  if (!bot._menuCache) bot._menuCache = new Map();

  bot.action(/^menu_nav:(.+?):(\d+)$/, async (ctx) => {
    try {
        const token = ctx.match[1];
        const pageIdx = Number(ctx.match[2]);
        const entry = bot._menuCache.get(token);

        await ctx.answerCbQuery().catch(() => {});

        if (!entry) return;

        if (String(ctx.from.id) !== String(entry.userId)) {
          return ctx.answerCbQuery("Ini bukan sesi milikmu!", { show_alert: true }).catch(() => {});
        }

        const { pages } = entry;
        const curr = Math.max(0, Math.min(pages.length - 1, pageIdx));
        const caption = pages[curr];
        const kb = Markup.inlineKeyboard([
          [
            Markup.button.callback("⬅️ Prev", `menu_nav:${token}:${curr - 1}`),
            Markup.button.callback(`📄 ${curr + 1}/${pages.length}`, "menu_ignore"),
            Markup.button.callback("Next ➡️", `menu_nav:${token}:${curr + 1}`),
          ],
        ]);
        if (curr === 0) {
            kb.reply_markup.inline_keyboard[0][0] = { text: "⬅️ Prev", callback_data: "menu_ignore" };
        }
        if (curr === pages.length - 1) {
            kb.reply_markup.inline_keyboard[0][2] = { text: "Next ➡️", callback_data: "menu_ignore" };
        }

        await ctx.editMessageCaption(caption, { parse_mode: "Markdown", reply_markup: kb.reply_markup });
    } catch (e) {
         if (e.description && e.description.includes('message is not modified')) {
         } else {
              console.error("Error handling menu navigation:", e);
               ctx.answerCbQuery("Gagal navigasi menu.", { show_alert: false }).catch(() => {});
         }
    }
  });
  bot.action("menu_ignore", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });
   setInterval(() => {
        const now = Date.now();
        for (const [token, entry] of bot._menuCache.entries()) {
             const tokenTimestamp = parseInt(token.split('_')[0]);
             if (isNaN(tokenTimestamp) || now - tokenTimestamp > 3600000) {
                  bot._menuCache.delete(token);
             }
        }
   }, 600000);
};

module.exports = handler;