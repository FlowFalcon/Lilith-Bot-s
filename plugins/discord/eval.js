import util from "node:util";
import vm from "node:vm";
import axios from "axios";
import FormData from "form-data";
import config from "../../config.js";
import { EmbedBuilder } from "discord.js";

let handler = async (msg) => {
  try {
    const isOwner = msg.author.id === config.ownerDiscord; 
    if (!isOwner) {
      return msg.reply("⚠️ Perintah ini hanya untuk owner!");
    }

    const args = msg.content.slice(process.env.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const code = args.join(" ");
    
    // Simplified depth logic, assuming it's not passed as an option
    const depth = 2;

    if (!code.trim()) {
      const hint = "Contoh: /eval 2+2";
      return msg.channel.send(hint);
    }

    const logs = [];
    const sandbox = {
      console: {
        log: (...a) => logs.push(a.map(x => util.inspect(x, { depth: 1 })).join(" ")),
        error: (...a) => logs.push("[err] " + a.join(" ")),
      },
      Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    };
    const ctxVm = vm.createContext(sandbox);
    let result, error;

    try {
      const wrapped = /^\s*\((.*)\)\s*=>|^async\s+|\bawait\b/.test(code)
        ? `(async()=>{ return (${code}); })()`
        : `(async()=>{ ${code} })()`
      result = await vm.runInContext(wrapped, ctxVm, { timeout: 1000 });
    } catch (e) { error = e; }

    const block = (s) => "```\n" + String(s).slice(0, 1900) + "\n```";
    const out =
      (logs.length ? `📜 console:\n${block(logs.join("\n"))}\n` : "") +
      (error ? `❌ error:\n${block(error)}`
             : `✅ result:\n${block(util.inspect(result, { depth }))}`);

    return msg.channel.send({ embeds: [ new EmbedBuilder().setColor(0x2ecc71).setDescription(out) ] });
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Menjalankan kode JavaScript secara dinamis.";
handler.help = ["eval"];
handler.tags = ["owner"];
handler.command = ["eval"];

export default handler;