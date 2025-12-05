const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

let handler = async (m, { conn }) => {
  let loadingMsg;
  try {
    loadingMsg = await m.reply("Sedang menjalankan speedtest server...\n(Proses ini bisa memakan waktu 1-2 menit, mohon tunggu)");

    const command = "curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py | python3 - --share";

    const { stdout, stderr } = await execPromise(command, { timeout: 180000 });

    if (stderr) {
      if (stdout) {
         console.warn("Speedtest STDERR (but proceeding with STDOUT):", stderr);
      } else {
         throw new Error(stderr);
      }
    }

    if (!stdout) {
        throw new Error("Tidak ada output dari speedtest-cli.");
    }
    const pingMatch = stdout.match(/Hosted by .*: ([\d.]+) ms/);
    const downloadMatch = stdout.match(/Download: ([\d.]+) Mbit\/s/);
    const uploadMatch = stdout.match(/Upload: ([\d.]+) Mbit\/s/);
    const shareMatch = stdout.match(/Share results: (http.*\.png)/);
    const ping = pingMatch ? pingMatch[1] + " ms" : "N/A";
    const download = downloadMatch ? downloadMatch[1] + " Mbit/s" : "N/A";
    const upload = uploadMatch ? uploadMatch[1] + " Mbit/s" : "N/A";
    const imageUrl = shareMatch ? shareMatch[1].trim() : null;

    if (imageUrl) {
      const filteredCaption = `Ping: \`${ping}\`\n` +
                              `Download: \`${download}\`\n` +
                              `Upload: \`${upload}\``;
      await conn.sendMessage(
        m.chat,
        {
          image: { url: imageUrl },
          caption: filteredCaption
        },
        { quoted: m }
      );
      
      await conn.sendMessage(m.chat, { delete: loadingMsg.key });

    } 
  } catch (e) {
    console.error("Speedtest Error:", e);
    const errorMsg = `Gagal menjalankan speedtest:\n${e.message}`;
    
    if (loadingMsg && loadingMsg.key) {
        await conn.sendMessage(m.chat, { text: errorMsg, edit: loadingMsg.key });
    } else {
        await m.reply(errorMsg);
    }
  }
};

handler.command = ["speedtest"];
handler.tags = ["info"];
handler.help = ["speedtest"];
handler.description = "Menjalankan speedtest server.";

module.exports = handler;