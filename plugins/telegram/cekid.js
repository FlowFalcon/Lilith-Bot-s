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

let handler = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    const now = new Date().toISOString();
    
    const users = readUsers();

    users[userId] = {
      id: userId,
      username,
      platform: "telegram",
      lastSeen: now
    };

    writeUsers(users);

    const msg = `
📌 **Info Pengguna**
**Platform** : Telegram
**ID** : 
${userId}
**Username** : ${username}
**Terakhir Dilihat**: ${now}
    `.trim();

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (e) {
    ctx.reply(e.message);
  }
};

handler.description = "Menampilkan ID dan info pengguna di Telegram.";
handler.help = ["cekid"];
handler.tags = ["info"];
handler.command = ["cekid"];

module.exports = handler;