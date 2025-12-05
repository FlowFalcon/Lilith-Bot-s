const os = require("os");
const fs = require("fs");
const { font1 } = require(global.root("lib/font.js"));

let handler = async (m, { conn, config, commands }) => {
  try {
    const ownerNumber = config.ownerWhatsapp ? config.ownerWhatsapp.toString() : "";
    const senderNumber = m.sender.split('@')[0];
    const isOwner = senderNumber === ownerNumber;
    const prefix = config.prefix[1] || "."; 

    const thumbnailUrl = fs.readFileSync(global.root("img/p1.jpg"));
    
    const botName = config.botName || "Lilith Bot";
    const sourceUrl = "https://whatsapp.com/channel/0029VbB1IEFICVft683rXG1P"; 

    let menuText = `*hi, ${m.pushName || 'user'}!* 👋\n`
    menuText += `*bot:* ${botName}\n`;
    menuText += `*mode:* ${config.selfMode ? 'self' : 'public'}\n\n`;
    menuText += `*os:* ${os.platform()}\n`;
    menuText += `*cpu:* ${os.cpus()[0].model}\n`;
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    menuText += `*ram:* ${freeMem}GB / ${totalMem}GB\n`;
    menuText += `\n` + "—".repeat(22) + `\n\n`;
    
    const commandsByCategory = {};
    
    commands.forEach(cmd => {
        if (cmd.isOwner && !isOwner) return;
        if (cmd.name.startsWith("_middleware_")) return;

        const rawTag = (cmd.category && cmd.category.length > 0) ? cmd.category[0] : 'others';
        const tag = rawTag.toLowerCase();

        if (!commandsByCategory[tag]) {
            commandsByCategory[tag] = [];
        }
        commandsByCategory[tag].push(cmd);
    });

    const sortedCategories = Object.keys(commandsByCategory).sort();
    for (const category of sortedCategories) {
        const categoryCmds = commandsByCategory[category];
        menuText += `*– Menu ${category}*\n`;
        
        categoryCmds.sort((a, b) => a.name.localeCompare(b.name));

        categoryCmds.forEach((cmd) => {
            menuText += `│  ◦ ${prefix}${cmd.name}\n`;
        });

        menuText += `└––\n\n`;
    }

    menuText += `*powered by ${config.ownerName}*`;

    await conn.sendMessage(m.chat, {
        text: font1(menuText),
        contextInfo: {
            externalAdReply: {
                title: font1(botName),
                body: font1(`Version ${require(global.root('package.json')).version}`),
                thumbnail: thumbnailUrl,
                sourceUrl: sourceUrl,
                mediaType: 1,
                renderLargerThumbnail: true
            }
        }
    }, { quoted: m });

  } catch (e) {
    console.error("Menu Error:", e);
    m.reply("Terjadi kesalahan saat menampilkan menu.");
  }
};

handler.help = ["menu", "help"];
handler.tags = ["main"];
handler.command = ["menu", "help"];

module.exports = handler;