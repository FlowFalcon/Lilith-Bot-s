const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

let handler = async (m, { conn, config }) => {
  try {
    await m.reply("⏳ Memulai proses backup...");

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFolder = path.join(__dirname, "..", "..", "backup");
      
      if (!fs.existsSync(backupFolder)) {
        fs.mkdirSync(backupFolder, { recursive: true });
      }

      const zipFileName = `backup-${timestamp}.zip`;
      const zipPath = path.join(backupFolder, zipFileName);
      const zip = new AdmZip();

      const rootDir = path.join(__dirname, "..", "..");

      const filesToBackup = ["index.js", "config.js", "package.json", "README.md", "LICENSE"];
      filesToBackup.forEach(file => {
        const filePath = path.join(rootDir, file);
        if (fs.existsSync(filePath)) {
          zip.addLocalFile(filePath);
        }
      });
      
      const sessionFile = "creds.json";
      const sessionPath = path.join(rootDir, "sessions", sessionFile);
      if (fs.existsSync(sessionPath)) zip.addLocalFile(sessionPath, "sessions");

      const foldersToBackup = ["lib", "plugins", "data"];
      foldersToBackup.forEach(folder => {
        const dirPath = path.join(rootDir, folder);
        if (fs.existsSync(dirPath)) {
          zip.addLocalFolder(dirPath, folder);
        }
      });

      zip.writeZip(zipPath);

      await conn.sendMessage(m.chat, {
        document: { url: zipPath },
        mimetype: 'application/zip',
        fileName: zipFileName,
        caption: '✅ Backup selesai!'
      }, { quoted: m });

      fs.unlinkSync(zipPath);

    } catch (err) {
      console.error("❌ Backup error:", err);
      await m.reply(`⚠️ Terjadi error saat melakukan backup:\n${err.message}`);
    }
  } catch (e) {
    console.error("❌ Handler error:", e);
    m.reply(e.message || "Terjadi error pada handler backup.");
  }
};

handler.description = "Membuat backup seluruh file bot dalam format zip.";
handler.help = ["backup"];
handler.tags = ["owner"];
handler.command = ["backup"];

module.exports = handler;