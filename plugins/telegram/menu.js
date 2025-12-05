const { font1 } = require(global.root("lib/font.js"));
const fs = require("fs");
const path = require("path");

let handler = async (ctx) => {
  try {
    const config = require(global.root("config.js"));
    const pkg = require(global.root("package.json"));
    const prefix = "/"; 
    const imagePath = global.root("img/p1.jpg");
    const pluginDir = global.root("plugins/telegram");
    const commands = [];

    const files = fs.readdirSync(pluginDir);
    for (const file of files) {
        if (file.endsWith(".js")) {
            try {
                const cmd = require(path.join(pluginDir, file));
                if (cmd && cmd.command) commands.push(cmd);
            } catch (e) {}
        }
    }
    const username = ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "");
    let menuText = `*ʜɪ, ${font1(username)}!* 👋\n`;
    menuText += `*ʙᴏᴛ:* ${font1(config.botName)}\n`;
    menuText += `*ʟɪʙ:* ᴛᴇʟᴇɢʀᴀꜰ\n`;
    menuText += `*ᴍᴏᴅᴇ:* ${config.selfMode ? 'sᴇʟꜰ' : 'ᴘᴜʙʟɪᴄ'}\n`;
    menuText += `\n` + "—".repeat(22) + `\n\n`;
    const commandsByCategory = {};

    commands.forEach(cmd => {
        const ownerId = config.telegramOwnerId ? parseInt(config.telegramOwnerId) : 0;
        if (cmd.isOwner && ctx.from.id !== ownerId) return;

        const rawTag = (cmd.tags && cmd.tags.length > 0) ? cmd.tags[0] : 'others';
        const tag = rawTag.toLowerCase();

        if (!commandsByCategory[tag]) {
            commandsByCategory[tag] = [];
        }
        commandsByCategory[tag].push(cmd);
    });

    const sortedCategories = Object.keys(commandsByCategory).sort();
    for (const category of sortedCategories) {
        const categoryCmds = commandsByCategory[category];
        
        menuText += `*– ᴍᴇɴᴜ ${font1(category)}*\n`;
        categoryCmds.sort((a, b) => {
            const nameA = Array.isArray(a.command) ? a.command[0] : a.command;
            const nameB = Array.isArray(b.command) ? b.command[0] : b.command;
            return nameA.localeCompare(nameB);
        });

        categoryCmds.forEach((cmd) => {
            const cmdName = Array.isArray(cmd.command) ? cmd.command[0] : cmd.command;
            menuText += `│  ◦ ${prefix}${font1(cmdName)}\n`;
        });

        menuText += `└––\n\n`;
    }

    menuText += `*${font1('powered by ' + config.ownerName)}*`;
    await ctx.replyWithPhoto(
        { source: imagePath }, 
        { caption: menuText, parse_mode: "Markdown" }
    );

  } catch (e) {
    console.error("Telegram Menu Error:", e);
    ctx.reply("❌ Terjadi kesalahan saat memuat menu.");
  }
};

handler.command = ["menu", "help", "start"];
handler.tags = ["main"];
handler.help = ["menu"];

module.exports = handler;