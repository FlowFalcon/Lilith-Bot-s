const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { font1 } = require(global.root("lib/font.js"));
const fs = require("fs");
const path = require("path");

let handler = async (msg, args) => {
  try {
    const config = require(global.root("config.js"));
    const pkg = require(global.root("package.json"));
    const prefix = config.prefix[0] || "/"; 

    const imagePath = global.root("img/p1.jpg");
    const attachment = new AttachmentBuilder(imagePath, { name: 'menu.jpg' });

    const username = msg.author.username;
    let menuText = `*ʜɪ, ${font1(username)}!* 👋\n`;
    menuText += `*ʙᴏᴛ:* ${font1(config.botName)}\n`;
    menuText += `*ʟɪʙ:* ᴅɪꜱᴄᴏʀᴅ.ᴊꜱ\n`;
    menuText += `*ᴍᴏᴅᴇ:* ${config.selfMode ? 'sᴇʟꜰ' : 'ᴘᴜʙʟɪᴄ'}\n`;
    menuText += `\n` + "—".repeat(22) + `\n\n`;

    const commands = msg.client.commands;
    const commandsByCategory = {};

    commands.forEach(cmd => {
        const ownerId = config.discordOwnerId || ""; 
        if (cmd.isOwner && msg.author.id !== ownerId) return;

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
        
        categoryCmds.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        categoryCmds.forEach((cmd) => {
            menuText += `│  ◦ ${prefix}${font1(cmd.name)}\n`;
        });

        menuText += `└––\n\n`;
    }

    menuText += `*${font1('powered by ' + config.ownerName)}*`;

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(font1(config.botName))
        .setDescription(menuText)
        .setThumbnail('attachment://menu.jpg')
        .setFooter({ text: font1(`Version ${pkg.version}`) });
    await msg.reply({ embeds: [embed], files: [attachment] });

  } catch (e) {
    console.error("Discord Menu Error:", e);
    msg.reply("❌ Terjadi kesalahan saat memuat menu.");
  }
};

handler.command = ["menu", "help"];
handler.tags = ["main"];
handler.help = ["menu"];

module.exports = handler;