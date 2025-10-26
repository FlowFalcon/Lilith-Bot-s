const { logError } = require("../logger.js");
const config = require("../../config.js");
const { ApplicationCommandOptionType, Collection } = require('discord.js');

const sendIx = (ix, payload) => {
    const p = typeof payload === "object" ? payload : { content: String(payload) };
    const ephemeral = ix.ephemeral || ((ix.options?.flags & 64) === 64);
    try {
        if (!ix.deferred && !ix.replied) {
            return ix.reply({ ...p, ephemeral: ephemeral || p.ephemeral });
        } else {
             if (ix.replied && !ix.deferred && payload.ephemeral !== ix.ephemeral) {
                  logError("discord:sendIx", "Warning: Cannot change ephemeral status after initial reply.");
             }
             const followUpEphemeral = payload.ephemeral === undefined ? ix.ephemeral : payload.ephemeral;
            return ix.followUp({ ...p, ephemeral: followUpEphemeral });
        }
    } catch (error) {
        logError("discord:sendIx", `Error sending interaction reply/followUp: ${error.message}`);
        ix.channel?.send(`⚠️ Gagal merespon interaksi: ${error.message}`).catch(e => logError("discord:sendIx:fallback", e));
        return null;
    }
};


async function handleInteraction(ix) {
    try {
        if (!ix.isChatInputCommand()) return;

        const cmd = ix.client.commands.get(ix.commandName);
        if (!cmd || typeof cmd.run !== 'function') {
            return sendIx(ix, { content: "Perintah tidak ditemukan atau tidak valid.", ephemeral: true });
        }

        if (!ix.user) {
            logError("discord:interactionCreate", new Error(`Interaction (ID: ${ix.id}, Command: ${ix.commandName}) missing 'user'.`));
            return sendIx(ix, { content: "⚠️ Terjadi error: Data pengguna tidak ditemukan.", ephemeral: true });
        }

        const isOwner = String(ix.user.id) === String(config.ownerDiscord);

        if (cmd.permissions?.guildOnly && !ix.inGuild()) {
            return sendIx(ix, { content: "Perintah ini hanya bisa digunakan di dalam server.", ephemeral: true });
        }
        if (cmd.permissions?.ownerOnly && !isOwner) {
            return sendIx(ix, { content: "Perintah ini hanya untuk owner.", ephemeral: true });
        }

        const args = []; 
        const optionsData = {};
        const attachments = new Collection(); 

        if (ix.options?.data) {
            for (const option of ix.options.data) {
                args.push(String(option.value ?? '')); 
                optionsData[option.name] = option.value; 

                if (option.type === ApplicationCommandOptionType.Attachment && option.attachment) {
                    attachments.set(option.attachment.id, option.attachment);
                }
                 if (option.user) optionsData[option.name + '_user'] = option.user;
                 if (option.member) optionsData[option.name + '_member'] = option.member; 
                 if (option.channel) optionsData[option.name + '_channel'] = option.channel;
                 if (option.role) optionsData[option.name + '_role'] = option.role;
            }
        }

        const sendPayloadWrapper = (payload) => sendIx(ix, payload);

        const msgContext = {
            client: ix.client,
            author: ix.user, 
            user: ix.user,
            member: ix.member, 
            guild: ix.guild, 
            channel: ix.channel, 
            channelId: ix.channelId,
            guildId: ix.guildId,

         
             id: ix.id, 
             content: `/${ix.commandName} ${args.join(' ')}`,
             createdAt: ix.createdAt,
             createdTimestamp: ix.createdTimestamp,
             attachments: attachments, 
             mentions: {
                  users: new Collection(),
                  members: new Collection(),
                  roles: new Collection(),
                  channels: new Collection(),
                  everyone: false, 
             },
             inGuild: () => ix.inGuild(),
             
             reply: sendPayloadWrapper, 
             channelSend: sendPayloadWrapper,
             delete: () => ix.deleteReply().catch(e => logError("discord:msgContext:delete", e)),
             edit: (payload) => ix.editReply(payload).catch(e => logError("discord:msgContext:edit", e)),

             _interaction: ix,
             _optionsData: optionsData,
        };

        if (msgContext.channel) {
            msgContext.channel.send = sendPayloadWrapper;
        }

        try {
        
            await cmd.run(msgContext, args, isOwner);
        } catch (e) {
            logError(`discord:interaction:cmd.run:${ix.commandName}`, e);
            const errorMsg = "⚠️ Error saat menjalankan perintah.";
            if (ix.replied || ix.deferred) {
                await ix.followUp({ content: errorMsg, ephemeral: true }).catch(() => {});
            } else {
                await ix.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
            }
        }
    } catch (e) {
        logError("discord:interactionCreate:outer", e);
         if (ix && ix.isRepliable()) {
             const errorMsg = "⚠️ Terjadi error internal saat memproses interaksi.";
              try {
                  if (!ix.replied && !ix.deferred) {
                      await ix.reply({ content: errorMsg, ephemeral: true });
                  } else {
                      await ix.followUp({ content: errorMsg, ephemeral: true });
                  }
             } catch (replyError) {
                  logError("discord:interactionCreate:outer:replyError", replyError);
             }
         }
    }
}

async function handleMessage(msg) {
    if (msg.author.bot) return;

    const prefix = config.prefix.find((p) => msg.content.startsWith(p));
    if (!prefix) return;

    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const cmd = msg.client.commands.get(commandName);
    if (!cmd || typeof cmd.run !== 'function') return;

    const isOwner = String(msg.author.id) === String(config.ownerDiscord);

    if (cmd.permissions?.ownerOnly && !isOwner) {
        return msg.reply("⚠️ Perintah ini hanya untuk owner!").catch(() => {});
    }
    if (cmd.permissions?.guildOnly && !msg.inGuild()) {
        return msg.reply("⚠️ Perintah ini hanya bisa digunakan di dalam server.").catch(() => {});
    }

    try {
        await cmd.run(msg, args, isOwner);
    } catch (e) {
        logError(`discord:messageCreate:command:${commandName}`, e);
        await msg.channel.send("⚠️ Terjadi error saat menjalankan command.").catch(() => {});
    }
}


module.exports = { handleInteraction, handleMessage };