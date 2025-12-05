const util = require("util");
const vm = require("vm");

let handler = async (m, { conn, args, config }) => {
  let code = args.join(" ");
  if (!code) return m.reply("Masukkan kode JavaScript-nya.");

  let logs = [];
  let result, error;

  try {
    const sandbox = {
      ...global,
      m,
      conn,
      args,
      config,
      require,
      process,
      Buffer,
      setTimeout, clearTimeout, setInterval, clearInterval,
      console: { 
        log: (...a) => logs.push(a.map(x => util.inspect(x, { depth: 1 })).join(" ")),
        error: (...a) => logs.push("[ERR] " + a.map(x => util.inspect(x, { depth: 1 })).join(" ")),
      },
    };
    const context = vm.createContext(sandbox);

    const wrapped = /^\s*\((.*)\)\s*=>|^async\s+|\bawait\b/.test(code)
      ? `(async()=>{ return (${code}); })()`
      : `(async()=>{ return ${code} })()`
    
    result = await vm.runInContext(wrapped, context, { timeout: 10000 });

  } catch (e) {
    error = e;
  }

  const block = (s) => "```\n" + String(s).slice(0, 1900) + "\n```";
  const out = 
    (logs.length ? `*Console:*\n${block(logs.join("\n"))}\n` : "") +
    (error ? `*Error:*\n${block(error)}`
           : `*Result:*\n${block(util.inspect(result, { depth: 2 }))}`);

  await m.reply(out);
};

handler.command = ["eval", "=>"];
handler.tags = ["owner"];
handler.help = ["eval <code>", "=> <code>"];
handler.description = "(Owner Only).";

module.exports = handler;
