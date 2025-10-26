import { EmbedBuilder } from "discord.js";

let handler = async (msgOrCtx) => {
  try {
    const client = msgOrCtx.client || msgOrCtx._client; 
    const user = msgOrCtx.author || msgOrCtx.user; 
    const channel = msgOrCtx.channel;
    const isOwner = String(user.id) === String(client?.config?.ownerDiscord || process.env.OWNER_ID_DISCORD); // Dapatkan status owner

    const registry = client?.commands || new Map();
    const thumbnailUrl = "https://files.cloudkuimages.guru/images/Xa6scHBF.jpg";

    const commandsByCategory = {};
    const ownerCommands = [];

    for (const [, cmd] of registry.entries()) {
        if (!cmd.name) continue;
        const item = {
            name: cmd.name,
            desc: cmd.description || cmd.name,
        };

        const isOwnerCmd = !!(cmd.permissions && cmd.permissions.ownerOnly);

        if (isOwnerCmd) {
            if (isOwner) {
                ownerCommands.push(item);
            }
        } else {
            const category = (Array.isArray(cmd.tags) && cmd.tags.length > 0) ? cmd.tags[0] : 'Uncategorized';
            const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

            if (!commandsByCategory[categoryTitle]) {
                commandsByCategory[categoryTitle] = [];
            }
            commandsByCategory[categoryTitle].push(item);
        }
    }

    const sortedCategories = Object.keys(commandsByCategory).sort();
    for (const category in commandsByCategory) {
        commandsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
    }
    ownerCommands.sort((a, b) => a.name.localeCompare(b.name));

    const truncate = (s, n = 1024) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

    const embed = new EmbedBuilder()
      .setTitle(`${client.user?.username || "Bot"} — Menu`)
      .setColor(0x5865F2)
      .setThumbnail(thumbnailUrl)
      .setFooter({ text: client.ownerName ? `Owner: ${client.ownerName}` : " " });

    let fieldCount = 0;
    const MAX_FIELDS = 25;

    for (const category of sortedCategories) {
        if (fieldCount >= MAX_FIELDS - (ownerCommands.length > 0 ? 1 : 0)) { 
            embed.addFields({ name: "...", value: "Terlalu banyak kategori untuk ditampilkan.", inline: false });
            break;
        }
        const commands = commandsByCategory[category];
        if (commands.length === 0) continue;

        const commandList = commands.map(i => `• \`/${i.name}\` — ${i.desc}`).join("\n");
        embed.addFields({ name: category, value: truncate(commandList), inline: false });
        fieldCount++;
    }

    if (isOwner && ownerCommands.length > 0 && fieldCount < MAX_FIELDS) {
        const ownerCommandList = ownerCommands.map(i => `• \`/${i.name}\` — ${i.desc}`).join("\n");
        embed.addFields({ name: "Owner Menu", value: truncate(ownerCommandList), inline: false });
    } else if (isOwner && ownerCommands.length > 0 && fieldCount >= MAX_FIELDS) {
        embed.addFields({ name: "Owner Menu", value: "_Kategori terlalu banyak, menu owner tidak dapat ditampilkan di sini._", inline: false });
    }

    if (embed.data.fields?.length === 0) {
        embed.setDescription("_(Tidak ada perintah yang tersedia untuk Anda saat ini)_");
    }

     if (msgOrCtx.isInteraction) {
          return msgOrCtx.reply({ embeds: [embed] });
     } else {
          return channel.send({ embeds: [embed] });
     }


  } catch (e) {
    console.error("Error in Discord menu handler:", e);
    const replyContent = `Terjadi error saat menampilkan menu: ${e.message}`;
     if (msgOrCtx.channel?.send) {
          msgOrCtx.channel.send(replyContent).catch(() => {}); 
     } else if (msgOrCtx.reply) {
          msgOrCtx.reply(replyContent).catch(() => {});
     }
  }
};

handler.description = "Menampilkan menu perintah yang tersedia.";
handler.help = ["menu", "help"];
handler.tags = ["main"];
handler.command = ["menu", "help"];

export default handler;