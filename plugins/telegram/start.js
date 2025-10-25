import os from "os";

let handler = async (ctx) => {
  try {
    let userId, username;
    userId = ctx.from.id;
    username = ctx.from.username || ctx.from.first_name;
    const botName = ctx._client.botName || "Bot";
    const userName = ctx.from.first_name || "User";
    const thumbnailUrl = "https://files.cloudkuimages.guru/images/Xa6scHBF.jpg";

    // Server Info
    const cpu = os.cpus()[0];
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const serverInfo = `
*Server Info*
- *OS:* ${os.platform()}
- *CPU:* ${cpu.model}
- *RAM:* ${freeMem}GB / ${totalMem}GB

*User Info*
- *Platform:* Telegram
- *User ID:* ${userId}
- *Username:* ${username}
`;

    const text = `Hello, ${userName}!
I am ${botName}, ready to serve you.${serverInfo}`;

    return ctx.replyWithPhoto(
      { url: thumbnailUrl },
      { caption: text, parse_mode: "Markdown" }
    );
  } catch (e) {
    ctx.reply(e.message);
  }
};

handler.description = "Menampilkan informasi dasar bot dan pengguna.";
handler.help = ["start"];
handler.tags = ["main"];
handler.command = ["start"];

export default handler;
