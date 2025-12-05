const os = require("os");
const fs = require("fs");
const { font1 } = require(global.root("lib/font.js"));

let handler = async (m, { conn, config }) => {
  try {
    const botName = config.botName || "Lilith-Bots";
    const userName = m.pushName || "User";
    const sourceUrl = "https://whatsapp.com/channel/0029VbB1IEFICVft683rXG1P"; 
    const thumbnailUrl = fs.readFileSync(global.root("img/p1.jpg"));

    const cpu = os.cpus()[0];
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const msg = `
*Server Info*
- *OS:* ${os.platform()}
- *CPU:* ${cpu.model}
- *RAM:* ${freeMem}GB / ${totalMem}GB
       
*User Info*
- *Platfrom:* WhatsApp
- *Name:* ${m.senderName} 
- *ID:* ${m.sender}
`;

    const text = `Hello, ${userName}!
I am ${botName}, ready to serve you.
${msg}`;
        
  await conn.sendMessage(m.chat, {
        text: font1(text),
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
    m.reply(e.message);
  }
};

handler.help = ["start"];
handler.tags = ["main"];
handler.command = ["start"];

module.exports = handler;