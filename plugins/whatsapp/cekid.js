let handler = async (m, { conn }) => {
  try {
    let text = `*Your Info:*
`;
    text += `• Name: ${m.pushName}
`;
    text += `• ID: ${m.sender}`;
    if (m.isGroup) {
        text += `
• Group: ${m.metadata?.subject}`;
        text += `
• Group ID: ${m.chat}`;
    }
    m.reply(text);
  } catch (e) {
    m.reply(e.message);
  }
};

handler.help = ["cekid", "myid"];
handler.tags = ["info"];
handler.command = ["cekid", "myid"];

module.exports = handler;