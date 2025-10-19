const cmd = require("./command-map.js");

class CommandHandler {
    async handleCommand(processedMessage, socket, store, config) {
        const messageText = processedMessage.body.trim() || "";
        
        const isCmd = this.isCommand(messageText);
        const [commandName, args] = this.parseCommand(messageText);

        const context = {
            m: processedMessage,
            sock: socket,
            store: store,
            args,
            command: commandName,
            isCmd,
            config,
        };

        if (!isCmd) return;

        const foundCommand = cmd.values().find(plugin => {
            if (!plugin.name) return false;
            const nameMatch = plugin.name.toLowerCase() === commandName;
            const aliasMatch = Array.isArray(plugin.alias) && plugin.alias.some(a => a.toLowerCase() === commandName);
            return nameMatch || aliasMatch;
        });

        if (!foundCommand) return;
        
        // Cek izin terpusat di sini
        if (!this.checkPermissions(foundCommand, processedMessage, config)) {
             return processedMessage.reply("Anda tidak memiliki izin untuk menggunakan perintah ini.");
        }

        try {
            if (typeof foundCommand.run === 'function') {
                const newContext = {
                    conn: socket,
                    store: store,
                    args,
                    command: commandName,
                    isCmd,
                    config,
                    commands: cmd.values(),
                };
                await Promise.resolve(foundCommand.run(processedMessage, newContext));
            }
        } catch (error) {
            console.error(`Error executing command '${commandName}':`, error);
            processedMessage.reply(`Terjadi kesalahan saat menjalankan perintah: ${error.message}`);
        }
    }

    isCommand(text) {
        const prefix = /^[\/.]/;
        return prefix.test(text);
    }

    parseCommand(text) {
        if (!this.isCommand(text)) return ["", []];
        const args = text.slice(1).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase() || "";
        return [commandName, args];
    }

    checkPermissions(command, message, config) {
        const ownerNumber = config.ownerWhatsapp ? config.ownerWhatsapp.toString() : "";
        if (command.isOwner && message.sender.split("@")[0] !== ownerNumber) {
            return false;
        }
        if (command.isGroup && !message.isGroup) {
            return false;
        }
        if (command.isPrivate && message.isGroup) {
            return false;
        }
        return true;
    }
}

module.exports = new CommandHandler();
