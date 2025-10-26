import { performance } from "perf_hooks";
import os from "os";
import fs from "fs";

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  
  let parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  if (s > 0) parts.push(`${s} detik`);
  
  return parts.join(', ') || '0 detik';
}

function getCpuModel() {
  try {
    const cpus = os.cpus();
    const model = cpus?.[0]?.model;

    if (model && model.toLowerCase() !== 'unknown') {
      return model;
    }
    
    if (os.platform() === 'linux') {
      const cpuInfo = fs.readFileSync("/proc/cpuinfo", "utf8");
      const modelNameLine = cpuInfo.split("\n").find(line => line.trim().startsWith("model name"));
      if (modelNameLine) {
        return modelNameLine.split(":")[1].trim();
      }
    }
    
    return model || 'N/A'; 
  } catch (e) {
    console.warn("Gagal mendapatkan model CPU secara detail:", e.message);
    return os.cpus()?.[0]?.model || 'N/A'; 
  }
}

let handler = async (m, { conn }) => {
  try {
    const start = performance.now();
    
    const sentMsg = await m.reply(`Pong! 🏓\nMengambil info server...`);
    
    const latency = (performance.now() - start).toFixed(2);
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    const cpuModel = getCpuModel();
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const uptime = os.uptime(); 

    let text = `*Pong!* 🏓\n\n`;
    text += `*Kecepatan Respon:*\n${latency} ms\n\n`;
    text += `*Info Server:*\n`;
    text += `- *OS:* ${os.type()} (${os.platform()} ${os.release()})\n`;
    text += `- *Arsitektur:* ${os.arch()}\n`;
    text += `- *CPU:* ${cpuModel}\n`;
    text += `- *RAM:* ${freeMem} GB / ${totalMem} GB\n`;
    text += `- *Uptime:* ${formatUptime(uptime)}`;

    await conn.sendMessage(m.chat, {
      text: text,
      edit: sentMsg.key
    });

  } catch (e) {
    console.error(e);
    m.reply(`Terjadi error: ${e.message}`);
  }
};

handler.help = ["ping"];
handler.tags = ["info"];
handler.command = ["ping"];

export default handler;