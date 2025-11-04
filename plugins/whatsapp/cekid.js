let handler = async (m, { conn }) => {
  try {
    let text = `*Your Info:*\n`;
    text += `• Name: ${m.pushName}\n`;
    text += `• ID: ${m.sender}\n`;
    
    if (m.isGroup) {
        text += `• Group: ${m.metadata?.subject}\n`;
        text += `• Group ID: ${m.chat}\n`;
    }
    
    if (m.key?.participant?.endsWith("@lid")) {
        text += `\n*LID Detected:*\n`;
        text += `• LID: ${m.key.participant}\n`;
        
        if (m.participantAlt) {
            text += `• Alt ID: ${m.participantAlt}\n`;
        }
        
        if (m.addressingMode) {
            text += `• Mode: ${m.addressingMode}\n`;
        }
        
        text += `• Resolved: ${m.sender}\n`;
    }
    
    text += `\n*Device Info:*\n`;
    text += `• Type: ${m.device}\n`;
    text += `• From Bot: ${m.fromMe ? "Yes" : "No"}\n`;
    
    m.reply(text);
  } catch (e) {
    m.reply(e.message);
  }
};

handler.help = ["cekid", "myid"];
handler.tags = ["info"];
handler.command = ["cekid", "myid"];

module.exports = handler;