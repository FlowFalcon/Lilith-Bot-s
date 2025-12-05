const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "..", "data", "groups.json");

const readDb = () => {
    try {
        if (!fs.existsSync(dbPath)) return {};
        return JSON.parse(fs.readFileSync(dbPath));
    } catch (e) { return {}; }
};

let handler = async (m, { conn }) => {
};

handler.middleware = async ({ m, conn, isAdmin, isBotAdmin }) => {
    if (!m.isGroup || !m.body) return;
    const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    const isGroupLink = linkRegex.test(m.body);

    if (!isGroupLink) return;
    const db = readDb();
    const settings = db[m.chat] || {};
    if (!settings.antilink) return; 
    if (isAdmin) return;
    await m.reply("⚠️ *Antilink Terdeteksi!*\nMaaf link grup dilarang di sini.");
    
    if (isBotAdmin) {
        await conn.sendMessage(m.chat, { delete: m.key });
        // await conn.groupParticipantsUpdate(m.chat, [m.sender], "remove"); // Kick
    } else {
        await m.reply("*(Jadikan bot admin agar bisa menghapus pesan link)*");
    }
};
module.exports = handler;