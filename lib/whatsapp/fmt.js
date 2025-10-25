import chalk from "chalk";

export const prMsg = (msg) => {
    if (!msg)
        return;
    try {
        console.log(chalk.bold.blue("\n┌─[") +
            chalk.bold.yellow(" WhatsApp Message ") +
            chalk.bold.blue("]"));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("ID") +
            chalk.bold.blue("] ") +
            chalk.green(msg.id));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("From Me") +
            chalk.bold.blue("] ") +
            chalk.yellow(msg.fromMe ? "Yes" : "No"));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Sender") +
            chalk.bold.blue("] ") +
            chalk.cyan(msg.sender));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Push Name") +
            chalk.bold.blue("] ") +
            chalk.magenta(msg.pushName));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Sender Name") +
            chalk.bold.blue("] ") +
            chalk.magenta(msg.senderName));
        if (msg.isGroup) {
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Group") +
                chalk.bold.blue("] ") +
                chalk.yellow("Yes"));
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Subject") +
                chalk.bold.blue("] ") +
                chalk.cyan(msg.metadata?.subject || "N/A"));
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Chat") +
                chalk.bold.blue("] ") +
                chalk.cyan(msg.chat || "N/A"));
        }
        else {
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Group") +
                chalk.bold.blue("] ") +
                chalk.yellow("No"));
        }
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Type") +
            chalk.bold.blue("] ") +
            chalk.yellow(msg.type));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Message Type") +
            chalk.bold.blue("] ") +
            chalk.yellow(msg.msgType));
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Device") +
            chalk.bold.blue("] ") +
            chalk.yellow(msg.device));
        if (msg.body) {
            console.log(chalk.bold.blue("├─[") + chalk.bold.red("Text") + chalk.bold.blue("] "));
            console.log(chalk.white("│  ") + chalk.white.bold(msg.body));
        }
        if (msg.isMedia) {
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Media") +
                chalk.bold.blue("] ") +
                chalk.yellow("Yes"));
        }
        if (msg.mentioned && msg.mentioned.length > 0) {
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Mentioned") +
                chalk.bold.blue("] "));
            msg.mentioned.forEach((jid) => {
                console.log(chalk.white("│  ") + chalk.cyan(jid));
            });
        }
        if (msg.isQuoted && msg.quoted) {
            console.log(chalk.bold.blue("├─[") +
                chalk.bold.red("Quoted Message") +
                chalk.bold.blue("] "));
            console.log(chalk.white("│  ") +
                chalk.bold.blue("┌─[") +
                chalk.bold.yellow(" Quoted ") +
                chalk.bold.blue("]"));
            console.log(chalk.white("│  ") +
                chalk.bold.blue("├─[") +
                chalk.bold.red("Type") +
                chalk.bold.blue("] ") +
                chalk.yellow(msg.quotedType));
            if (msg.quotedText) {
                console.log(chalk.white("│  ") +
                    chalk.bold.blue("├─[") +
                    chalk.bold.red("Text") +
                    chalk.bold.blue("] "));
                console.log(chalk.white("│  │  ") + chalk.gray(msg.quotedText));
            }
            console.log(chalk.white("│  ") +
                chalk.bold.blue("├─[") +
                chalk.bold.red("Sender") +
                chalk.bold.blue("] ") +
                chalk.cyan(msg.quotedSender));
            console.log(chalk.white("│  ") + chalk.bold.blue("└──────────────────"));
        }
        console.log(chalk.bold.blue("├─[") +
            chalk.bold.red("Timestamp") +
            chalk.bold.blue("] ") +
            chalk.green(new Date(Number(msg.msgTimestamp || 0) * 1000).toLocaleString()));
        console.log(chalk.bold.blue("└─────────────────────────────────────"));
    }
    catch (error) {
        console.error(chalk.red("Error formatting message log:"), error);
    }
};
