const { performance } = require("perf_hooks");

let handler = async (m, { conn }) => {
  try {
    const start = performance.now();
    await m.reply(`Pong!`);
    const latency = (performance.now() - start).toFixed(2);
    m.reply(`Processing time: ${latency} ms`);
  } catch (e) {
    m.reply(e.message);
  }
};

handler.help = ["ping"];
handler.tags = ["info"];
handler.command = ["ping"];

module.exports = handler;