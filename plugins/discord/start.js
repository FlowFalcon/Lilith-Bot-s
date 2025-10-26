import os from "os";
import { EmbedBuilder } from "discord.js";

let handler = async (msg) => {
  try {
    let userId, username;

    userId = msg.author.id;
    username = msg.author.username;

    const botName = msg.client.user.username || "Bot";
    const userName = msg.author.username || "User";
    const thumbnailUrl = "https://files.cloudkuimages.guru/images/Xa6scHBF.jpg";

    // Server Info
    const cpu = os.cpus()[0];
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle(`Hello, ${userName}!`)
      .setDescription(`I am ${botName}, ready to serve you.`)
      .setThumbnail(thumbnailUrl)
      .setColor(0x5865F2)
      .addFields(
        { name: "Server Info", value: `**OS:** ${os.platform()}\n**CPU:** ${cpu.model}\n**RAM:** ${freeMem}GB / ${totalMem}GB\n` },
        { name: "User Info", value: `*Platform:* Discord\n**ID:** ${userId}\n**Username:** ${username}` }
      )
      .setFooter({ text: `Owner: ${process.env.OWNER_NAME || " "}` });

    return msg.channel.send({ embeds: [embed] });
  } catch (e) {
    msg.reply(e.message);
  }
};

handler.description = "Memulai bot.";
handler.help = ["start"];
handler.tags = ["main"];
handler.command = ["start"];

export default handler;
