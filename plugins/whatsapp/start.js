const os = require("os");

let handler = async (m, { conn, config }) => {
  try {
    const botName = config.botName || "Bot";
    const userName = m.pushName || "User";
    const thumbnailUrl = "https://files.catbox.moe/x98vn2.jpg";

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
- *Name:* ${m.pushName} 
- *ID:* ${m.sender}
`;

    const text = `Hello, ${userName}!
I am ${botName}, ready to serve you.
${msg}`;
        
    await conn.sendMessage(m.chat, {
        image: { url: thumbnailUrl },
        caption: text
    });
  } catch (e) {
    m.reply(e.message);
  }
};

handler.help = ["start"];
handler.tags = ["main"];
handler.command = ["start"];

module.exports = handler;
