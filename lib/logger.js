const chalk = require("chalk");

function logTelegram(ctx) {
    try {
        const msg = ctx.message || ctx.update?.message || {};
        const from = ctx.from;
        const chat = ctx.chat;

        console.log(chalk.bold.cyan("\n┌─[") + chalk.bold.blue(" Telegram Message ") + chalk.bold.cyan("]"));
        console.log(chalk.bold.cyan("├─[") + chalk.bold.red("User") + chalk.bold.cyan("] ") + chalk.green(`${from.first_name}${from.last_name ? ' ' + from.last_name : ''} (@${from.username} / ${from.id})`));
        if (chat.id !== from.id) {
            console.log(chalk.bold.cyan("├─[") + chalk.bold.red("Chat") + chalk.bold.cyan("] ") + chalk.yellow(`${chat.title} (${chat.id})`));
        }
        if (msg.text) {
            console.log(chalk.bold.cyan("├─[") + chalk.bold.red("Text") + chalk.bold.cyan("] "));
            console.log(chalk.white("│  ") + chalk.white.bold(msg.text));
        }
        if (msg.photo || msg.video || msg.document || msg.sticker) {
            let mediaType = msg.photo ? 'Photo' : msg.video ? 'Video' : msg.document ? 'Document' : 'Sticker';
            console.log(chalk.bold.cyan("├─[") + chalk.bold.red("Media") + chalk.bold.cyan("] ") + chalk.yellow(mediaType));
        }
        if (msg.reply_to_message) {
            console.log(chalk.bold.cyan("├─[") + chalk.bold.red("Quoted") + chalk.bold.cyan("] ") + chalk.green("Yes"));
        }
        console.log(chalk.bold.cyan("└──────────────────────────────────"));

    } catch (e) {
        console.error(chalk.red("Error logging Telegram message:"), e);
    }
}

function logDiscord(msgOrIx) {
    try {
        const isIx = !!msgOrIx.applicationId;
        const user = isIx ? msgOrIx.user : msgOrIx.author;
        const channel = msgOrIx.channel;
        const guild = msgOrIx.guild;

        console.log(chalk.bold.magenta("\n┌─[") + chalk.bold.blue(" Discord Event ") + chalk.bold.magenta("]"));
        console.log(chalk.bold.magenta("├─[") + chalk.bold.red("User") + chalk.bold.magenta("] ") + chalk.green(`${user.tag} (${user.id})`));
        if (guild) {
            console.log(chalk.bold.magenta("├─[") + chalk.bold.red("Guild") + chalk.bold.magenta("] ") + chalk.yellow(`${guild.name} (${guild.id})`));
        }
        if (channel) {
            console.log(chalk.bold.magenta("├─[") + chalk.bold.red("Channel") + chalk.bold.magenta("] ") + chalk.cyan(`#${channel.name} (${channel.id})`));
        }

        if (isIx && msgOrIx.isCommand()) {
            const commandName = msgOrIx.commandName;
            const options = msgOrIx.options.data.map(o => `${o.name}:${o.value}`).join(' ');
            console.log(chalk.bold.magenta("├─[") + chalk.bold.red("Slash CMD") + chalk.bold.magenta("] "));
            console.log(chalk.white("│  ") + chalk.white.bold(`/${commandName} ${options}`));
        } else if (!isIx && msgOrIx.content) {
            console.log(chalk.bold.magenta("├─[") + chalk.bold.red("Message") + chalk.bold.magenta("] "));
            console.log(chalk.white("│  ") + chalk.white.bold(msgOrIx.content));
        }
        
        if (!isIx && msgOrIx.attachments.size > 0) {
            console.log(chalk.bold.magenta("├─[") + chalk.bold.red("Attachments") + chalk.bold.magenta("] ") + chalk.yellow(msgOrIx.attachments.size));
        }

        console.log(chalk.bold.magenta("└──────────────────────────────────"));
    } catch (e) {
        console.error(chalk.red("Error logging Discord message:"), e);
    }
}

function logError(source, error) {
    console.error(chalk.bold.red(`\n┌─[ Error in ${source} ]`));
    console.error(chalk.red(error.stack || error.message || String(error)));
    console.error(chalk.bold.red("└───────────────────────────────"));
}

module.exports = { logTelegram, logDiscord, logError };
