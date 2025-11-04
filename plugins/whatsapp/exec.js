const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

let handler = async (m, { conn, args }) => {
  let code = args.join(" ");
  if (!code) return m.reply("Masukkan perintah terminal-nya.");

  await m.reply("execute...");

  try {
    const { stdout, stderr } = await execPromise(code, { timeout: 30000 });

    let output = "";
    if (stdout) {
      output += `*STDOUT:*\n\`\`\`\n${stdout.trim()}\n\`\`\``;
    }
    if (stderr) {
      output += `\n\n*STDERR:*\n\`\`\`\n${stderr.trim()}\n\`\`\``;
    }
    if (!stdout && !stderr) {
      output = "Perintah selesai (tanpa output).";
    }
    
    await m.reply(output.trim());

  } catch (e) {
    console.error("EXEC Error:", e);
    await m.reply(`*Error Eksekusi:*\n\`\`\`\n${e.message || util.inspect(e)}\n\`\`\``);
  }
};

handler.command = ["exec", "$"];
handler.tags = ["owner"];
handler.help = ["exec <cmd>", "$ <cmd>"];
handler.description = "Menjalankan perintah terminal (Owner Only).";

module.exports = handler;
