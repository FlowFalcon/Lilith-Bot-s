const fs = require("fs");
const path = require("path");
const dbPath = path.join(__dirname, "..", "..", "..", "data", "groups.json");
const readDb = () => {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath));
};
const writeDb = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

let handler = async (m, { args, conn }) => {
    const isGroup = m.isGroup;
    if (!isGroup) return m.reply("Fitur ini hanya untuk grup.");

    const action = args[0]?.toLowerCase();
    const feature = args[1]?.toLowerCase();

    if (!["enable", "disable", "on", "off"].includes(action)) {
        return m.reply("Contoh: *.gc enable antilink* atau *.gc disable antilink*");
    }

    const db = readDb();
    const chatId = m.chat;
    if (!db[chatId]) db[chatId] = { antilink: false, antitoxic: false };

    const isEnable = ["enable", "on"].includes(action);

    switch (feature) {
        case 'antilink':
            db[chatId].antilink = isEnable;
            m.reply(`✅ Fitur *Antilink* berhasil di-${isEnable ? 'aktifkan' : 'matikan'} untuk grup ini.`);
            break;

        default:
            return m.reply("Fitur tidak valid. Pilihan (sementara): antilink");
    }

    writeDb(db);
};

handler.help = ["gc"];
handler.tags = ["group", "admin"];
handler.command = ["gc"];
handler.isAdmin = true;
handler.isGroup = true;

module.exports = handler;