let handler = async (m, { conn, args, config }) => {
  const mode = args[0]?.toLowerCase();

  if (mode === 'self') {
    config.selfMode = true;
    m.reply("Mode berubah menjadi **SELF**. Hanya owner yang bisa menggunakan bot.");
  } else if (mode === 'public') {
    config.selfMode = false;
    m.reply("Mode berubah menjadi **PUBLIC**. Semua orang bisa menggunakan bot.");
  } else {
    m.reply(`Mode saat ini: *${config.selfMode ? 'SELF' : 'PUBLIC'}*\n\nGunakan:\n.mode self\n.mode public`);
  }
};

handler.help = ["mode <self/public>", "self", "public"];
handler.tags = ["owner"];
handler.command = ["mode", "self", "public"];
handler.isOwner = true;

module.exports = handler;