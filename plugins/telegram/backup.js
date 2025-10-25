import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { fileURLToPath } from "url";
import config from "../../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let handler = async (ctx) => {
  try {
    const isOwner = ctx.from.id.toString() === config.ownerTelegram;

    if (!isOwner) {
      const msg = "⚠️ Hanya owner yang bisa menjalankan backup!";
      return ctx.reply(msg);
    }
    
    const loadingMsg = await ctx.reply("⏳ Memulai proses backup...");

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFolder = path.join(__dirname, "..", "..", "backup");
      if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });

      const zipName = path.join(backupFolder, `backup-${timestamp}.zip`);
      const zip = new AdmZip();

      const rootDir = path.join(__dirname, "..", "..");

      const filesToBackup = ["index.js", "config.js", "package.json", "package-lock.json", "docs.md"];
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

      zip.writeZip(zipName);

      const msgSuccess = `✅ Backup selesai!`;
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      await ctx.replyWithDocument({ source: zipName, caption: msgSuccess });

    } catch (err) {
      console.error("❌ Backup error:", err);
      const msgErr = "⚠️ Terjadi error saat melakukan backup!";
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, msgErr);
    }
  } catch (e) {
    ctx.reply(e.message);
  }
};

handler.description = "Membuat backup seluruh file bot dalam format zip.";
handler.help = ["backup"];
handler.tags = ["owner"];
handler.command = ["backup"];

export default handler;