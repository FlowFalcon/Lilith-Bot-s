const cmd = require("./command-map.js");
const { jidNormalizedUser } = require("baileys");

class CommandHandler {
  async handleCommand(processedMessage, socket, store, config) {
    const messageText = (processedMessage.body || "").trim();
    const isCmd = this.isCommand(messageText);
    const [commandName, args] = this.parseCommand(messageText);

    const isOwner = this.isOwner(processedMessage, config, socket);

    if (config.selfMode && isCmd && !isOwner) return;

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
      isOwner,
      isAdmin: processedMessage.isAdmin || false,
      isBotAdmin: processedMessage.isBotAdmin || false,
      isGroup: processedMessage.isGroup,
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

    const permission = this.checkPermissions(foundCommand, processedMessage, isOwner);
    if (!permission.status) {
      return processedMessage.reply(permission.msg);
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
    const rawJid = message?.sender || message?.remoteJid || "";
    const jid = jidNormalizedUser(rawJid);
    return jid.split("@")[0];
  }

  normalizeOwnerNumbers(owner) {
    const arr = Array.isArray(owner) ? owner : [owner];
    return arr
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .map((x) => x.replace(/[^\d]/g, ""));
  }

  isOwner(message, config, socket) {
    const ownerNumbers = this.normalizeOwnerNumbers(config?.ownerWhatsapp);
    
    let botIdRaw;
    if (socket?.user?.id) {
        botIdRaw = socket.user.id;
    } else if (socket?.authState?.creds?.me?.id) {
        botIdRaw = socket.authState.creds.me.id;
    }

    if (botIdRaw) {
        const botNumber = jidNormalizedUser(botIdRaw).split('@')[0];
        if (!ownerNumbers.includes(botNumber)) ownerNumbers.push(botNumber);
    }

    const senderNumber = this.getSenderNumber(message);
    return ownerNumbers.includes(senderNumber);
  }

  checkPermissions(command, message, isOwner) {
    if (command.isOwner && !isOwner) {
        return { status: false, msg: "⚠️ Perintah ini hanya untuk Owner." };
    }
    
    if (command.isGroup && !message.isGroup) {
      return { status: false, msg: "⚠️ Perintah ini hanya bisa digunakan di dalam Grup." };
    }
    
    if (command.isPrivate && message.isGroup) {
      return { status: false, msg: "⚠️ Perintah ini hanya bisa digunakan di Private Chat." };
    }
    if (command.isAdmin && !message.isAdmin) {
        return { status: false, msg: "⚠️ Perintah ini hanya untuk Admin Grup." };
    }

    if (command.isBotAdmin && !message.isBotAdmin) {
        return { status: false, msg: "⚠️ Bot harus menjadi Admin Grup untuk melakukan perintah ini." };
    }

    return { status: true };
  }
}

module.exports = new CommandHandler();
