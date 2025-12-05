const fs = require("fs");
const path = require("path");
const CmdRegisWA = require(root("lib/whatsapp/command-register.js"));
const pluginRoot = path.resolve(__dirname, ".."); 

let handler = async (m, { conn, args, text }) => {
  const getAllFiles = (dir, fileList = [], baseDir = dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        getAllFiles(filePath, fileList, baseDir);
      } else {
        if (file.endsWith(".js")) {
          fileList.push(path.relative(baseDir, filePath)); 
        }
      }
    }
    return fileList;
  };

  const action = args[0];
  const filename = args.slice(1).join(" ");

  if (!action) {
    try {
      const files = getAllFiles(pluginRoot);
      if (files.length === 0) return m.reply("Tidak ada plugin.");
      
      const groups = {};
      files.forEach(f => {
        const parts = f.split(path.sep);
        const folder = parts.length > 1 ? parts[0] : "main";
        if (!groups[folder]) groups[folder] = [];
        groups[folder].push(f);
      });

      let msg = "*DAFTAR PLUGIN*\n";
      for (const [folder, list] of Object.entries(groups)) {
        msg += `\n* *${folder.toUpperCase()}*\n`;
        msg += list.map(f => `  > ${f}`).join("\n");
      }
      
      msg += `\n\n*Cara Pakai:*\n`;
      msg += `> .plugin + <path> (Reply code)\n`;
      msg += `> .plugin - <path>\n`;
      msg += `> .plugin ? <path>\n`;
      msg += `_Contoh: .plugin ? group/kick.js_`;
      
      return m.reply(msg);
    } catch (e) {
      console.error(e);
      return m.reply("Gagal membaca direktori plugin.");
    }
  }

  if (!filename) return m.reply("Masukkan nama path file! Contoh: `group/kick.js`");

  if (filename.includes("..") || filename.startsWith("/")) {
    return m.reply("⚠️ Path traversal terdeteksi! Dilarang menggunakan '..' atau '/' di awal.");
  }

  const filePath = path.join(pluginRoot, filename);

  switch (action) {
    // --- TAMBAH / EDIT (+ path/file.js) ---
    case "+":
    case "add": {
      if (!m.quoted) return m.reply("Reply kodenya!");
      const content = m.quoted.text || "";
      
      if (!content) return m.reply("Kodenya kosong?");

      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content);
        
        await m.reply(`Berhasil menyimpan *${filename}*.\nMe-reload plugin...`);
        await CmdRegisWA.reloadCommands();
        m.reply("*Plugin berhasil dimuat ulang!*");
        
      } catch (e) {
        m.reply(`*Gagal menyimpan:* ${e.message}`);
      }
      break;
    }

    // --- HAPUS (- path/file.js) ---
    case "-":
    case "del": {
      if (!fs.existsSync(filePath)) return m.reply(`File *${filename}* tidak ditemukan.`);
      
      try {
        fs.unlinkSync(filePath);
        
        const dir = path.dirname(filePath);
        if (dir !== pluginRoot) {
             const remaining = fs.readdirSync(dir);
             if (remaining.length === 0) fs.rmdirSync(dir);
        }

        await m.reply(`Berhasil menghapus *${filename}*.\nMe-reload plugin...`);
        await CmdRegisWA.reloadCommands();
        m.reply("Plugin berhasil dimuat ulang!");
      } catch (e) {
        m.reply(`Gagal menghapus: ${e.message}`);
      }
      break;
    }

    // --- LIHAT (? path/file.js) ---
    case "?":
    case "get": {
      if (!fs.existsSync(filePath)) return m.reply(`File *${filename}* tidak ditemukan.`);
      
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        m.reply(content);
      } catch (e) {
        m.reply(`❌ Gagal membaca: ${e.message}`);
      }
      break;
    }

    default:
      m.reply("Aksi tidak valid. Gunakan: + (tambah), - (hapus), ? (lihat)");
  }
};

handler.help = ["plugin"];
handler.tags = ["owner"];
handler.command = ["plugin", "plugins"];
handler.isOwner = true;

module.exports = handler;
