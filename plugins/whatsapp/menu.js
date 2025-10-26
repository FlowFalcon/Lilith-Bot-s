let handler = async (m, { conn, config, commands }) => {
  try {
    const ownerNumber = config.ownerWhatsapp ? config.ownerWhatsapp.toString() : "";
    const isOwner = m.sender.split('@')[0] === ownerNumber;
    const thumbnailUrl = "https://files.cloudkuimages.guru/images/Xa6scHBF.jpg";

    const commandsByCategory = {};
    commands.forEach(command => {
        if (command.isOwner && !isOwner) return;

        if (!command.category) {
            if (!commandsByCategory['uncategorized']) commandsByCategory['uncategorized'] = [];
            commandsByCategory['uncategorized'].push(command);
            return;
        }
        command.category.forEach(cat => {
            if (!commandsByCategory[cat]) commandsByCategory[cat] = [];
            commandsByCategory[cat].push(command);
        });
    });

    let menuText = `*${config.botName || 'Bot'} - Command Menu*\n\n`;
    const categories = Object.keys(commandsByCategory).sort();

    for (const category of categories) {
        const categoryCommands = commandsByCategory[category];
        if (categoryCommands.length === 0) continue;

        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        menuText += `*${categoryTitle}*\n`;
        for (const command of categoryCommands) {
            menuText += `- /${command.name}\n`;
        }
        menuText += '\n';
    }

    menuText += `Ketik /<perintah> untuk menggunakan.`;
                
    await conn.sendMessage(m.chat, {
        image: { url: thumbnailUrl },
        caption: menuText
    });
  } catch (e) {
    m.reply(e.message);
  }
};

handler.help = ["menu", "help"];
handler.tags = ["main"];
handler.command = ["menu", "help"];

module.exports = handler;