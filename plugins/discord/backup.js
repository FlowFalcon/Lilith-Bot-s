const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

let handler = async (msg) => {
  try {
    const isOwner = msg.author.id === process.env.OWNER_ID; 

    if (!isOwner) {
      const replyMsg = "⚠️ Hanya owner yang bisa menjalankan backup!";
      return msg.channel.send(replyMsg);
    }

    const loadingMsg = await msg.channel.send("⏳ Memulai proses backup...");

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFolder = path.join(__dirname, "..", "..", "backup");
      if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });

      const zipName = path.join(backupFolder, `backup-${timestamp}.zip`);
      const zip = new AdmZip();

      const rootDir = path.join(__dirname, "..", "..");

      const filesToBackup = ["index.js", "config.js", "package.json", "LICENSE", "README.md"];
      filesToBackup.forEach(file => {
        const filePath = path.join(rootDir, file);
        if (fs.existsSync(filePath)) zip.addLocalFile(filePath);
      });

      const libDir = path.join(rootDir, "lib");
      if (fs.existsSync(libDir)) zip.addLocalFolder(libDir, "lib");

      const pluginsDir = path.join(rootDir, "plugins");
      if (fs.existsSync(pluginsDir)) zip.addLocalFolder(pluginsDir, "plugins");

      const dataDir = path.join(rootDir, "data");
      if (fs.existsSync(dataDir)) zip.addLocalFolder(dataDir, "data");
      
      const sessionFile = "creds.json";
      const sessionPath = path.join(rootDir, "sessions", sessionFile);
      if (fs.existsSync(sessionPath)) zip.addLocalFile(sessionPath, "sessions");

      zip.writeZip(zipName);

      const msgSuccess = `✅ Backup selesai!`;
      await loadingMsg.delete();
      await msg.channel.send({ content: msgSuccess, files: [zipName] });

    } catch (err) {
      console.error("❌ Backup error:", err);
      const msgErr = "⚠️ Terjadi error saat melakukan backup!";
      await loadingMsg.edit(msgErr);
    }
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Membuat backup seluruh file bot dalam format zip.";
handler.help = ["backup"];
handler.tags = ["owner"];
handler.command = ["backup"];

module.exports = handler;