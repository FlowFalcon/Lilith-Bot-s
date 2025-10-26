import cmd from "./command-map.js";

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
      sock: socket,
      store,
      args,
      command: commandName,
      isCmd,
      config,
    };

    if (!isCmd) return;

    const foundCommand = commands.find((plugin) => {
      if (!plugin?.name) return false;
      const nameMatch = plugin.name.toLowerCase() === commandName;
      const aliasMatch =
        Array.isArray(plugin.alias) &&
        plugin.alias.some((a) => a?.toLowerCase() === commandName);
      return nameMatch || aliasMatch;
    });

    if (!foundCommand) return;

    if (!this.checkPermissions(foundCommand, processedMessage, config)) {
      return processedMessage.reply(
        "Anda tidak memiliki izin untuk menggunakan perintah ini."
      );
    }

    try {
      if (typeof foundCommand.run === "function") {
        const newContext = {
          conn: socket,
          store,
          args,
          command: commandName,
          isCmd,
          config,
          commands, // sudah array
        };
        await Promise.resolve(foundCommand.run(processedMessage, newContext));
      }
    } catch (error) {
      console.error(`Error executing command '${commandName}':`, error);
      processedMessage.reply(
        `Terjadi kesalahan saat menjalankan perintah: ${error.message}`
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
    const alt = message?.key?.participantAlt;
    if (alt) return this.normalizeNumberFromJid(alt);
    const participant = message?.key?.participant || message?.participant;
    if (message?.isGroup && participant?.endsWith("@lid")) {
      const meta = message?.metadata;
      const hit =
        meta?.participants?.find((p) => p.id === participant) ||
        meta?.participants?.find((p) => p.jid?.includes("@s.whatsapp.net"));
      if (hit?.jid) return this.normalizeNumberFromJid(hit.jid);
    }
    if (message?.sender) return this.normalizeNumberFromJid(message.sender);
    if (participant && !participant.endsWith("@g.us")) {
      return this.normalizeNumberFromJid(participant);
    }
    return "";
  }

  normalizeNumberFromJid(jid = "") {
    const num = String(jid).split("@")[0] || "";
    return num.replace(/[^\d]/g, "");
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
    if (command.isOwner && !ownerNumbers.includes(senderNumber)) return false;

    if (command.isGroup && !message.isGroup) return false;
    if (command.isPrivate && message.isGroup) return false;

    return true;
  }
}

export default new CommandHandler();
