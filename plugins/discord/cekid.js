const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "..", "data", "users.json");
const dbDir = path.dirname(dbPath);

const readUsers = () => {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const data = fs.readFileSync(dbPath, "utf-8");
        return JSON.parse(data);
    } catch (e) {
        console.error("Gagal membaca users.json:", e);
        return {};
    }
};

const writeUsers = (data) => {
    try {
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Gagal menulis ke users.json:", e);
    }
};

let handler = async (msg) => {
  try {
    const userId = msg.author.id;
    const username = msg.author.username;
    const now = new Date().toISOString();

    const users = readUsers();

    users[userId] = {
      id: userId,
      username,
      platform: "discord",
      lastSeen: now
    };
    
    writeUsers(users);

    const message = `
📌 **Info Pengguna**
**Platform** : Discord
**ID** : 
${userId}
**Username** : ${username}
**Terakhir Dilihat**: ${now}
    `.trim();

    const { EmbedBuilder } = require("discord.js");

    const embed = new EmbedBuilder()
      .setDescription(message)  
      .setColor(0x00AE86)
      .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() });
      
    await msg.channel.send({ embeds: [embed] });
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Menampilkan ID dan info pengguna di Discord.";
handler.help = ["cekid"];
handler.tags = ["info"];
handler.command = ["cekid"];

module.exports = handler;