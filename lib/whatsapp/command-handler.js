const cmd = require("./command-map.js");

class CommandHandler {
  async handleCommand(processedMessage, socket, store, config) {
    const messageText = (processedMessage.body || "").trim();
    const isCmd = this.isCommand(messageText);
    const [commandName, args] = this.parseCommand(messageText);

    const commands = Array.isArray(cmd)
      ? cmd
      : typeof cmd?.values === "function"
      ? Array.from(cmd.values())
      : Object.values(cmd || {});

    const context = {
      m: processedMessage,
      conn: socket,
      sock: socket,
      store,
      args,
      command: commandName,
      isCmd,
      config,
      commands,
      text: args.join(" "),
    };

    for (const command of commands) {
      if (typeof command.middleware === "function") {
        try {
          await Promise.resolve(command.middleware(context));
        } catch (error) {
          console.error(`Middleware error in ${command.name}:`, error);
        }
      }
    }

    if (!isCmd) return;

    const foundCommand = commands.find((plugin) => {
      if (!plugin?.name) return false;
      const nameMatch = plugin.name.toLowerCase() === commandName;
      const aliasMatch = Array.isArray(plugin.alias) &&
        plugin.alias.some((a) => a?.toLowerCase() === commandName);
      return nameMatch || aliasMatch;
    });

    if (!foundCommand) return;

    if (!this.checkPermissions(foundCommand, processedMessage, config)) {
      return processedMessage.reply(
        "⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini."
      );
    }

    try {
      if (typeof foundCommand.run === "function") {
        await Promise.resolve(foundCommand.run(processedMessage, context));
      }
    } catch (error) {
      console.error(`Error executing command '${commandName}':`, error);
      processedMessage.reply(
        `❌ Terjadi kesalahan saat menjalankan perintah:\n${error.message}`
      );
    }
  }

  isCommand(text) {
    return /^[\/.]/.test(text);
  }

  parseCommand(text) {
    if (!this.isCommand(text)) return ["", []];
    const args = text.slice(1).trim().split(/\s+/);
    const commandName = (args.shift() || "").toLowerCase();
    return [commandName, args];
  }

  getSenderNumber(message) {
    if (message?.sender && message.sender.includes("@")) {
      const num = message.sender.split("@")[0];
      return num.replace(/[^\d]/g, "");
    }
    
    return "";
  }

  normalizeOwnerNumbers(owner) {
    const arr = Array.isArray(owner) ? owner : [owner];
    return arr
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((x) => x.replace(/[^\d]/g, ""));
  }

  checkPermissions(command, message, config) {
    const ownerNumbers = this.normalizeOwnerNumbers(config?.ownerWhatsapp);
    const senderNumber = this.getSenderNumber(message);

    if (command.isOwner && !ownerNumbers.includes(senderNumber)) {
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