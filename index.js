const { Telegraf, session } = require("telegraf");
const { Client, GatewayIntentBits } = require("discord.js");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const NodeCache = require("node-cache");
const makeWASocket = require("baileys").default;
const { delay, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, proto } = require("baileys");
const pino = require("pino");

const { name, version, author } = require("./package.json");
const config = require("./config.js");
const { logTelegram, logDiscord, logError } = require("./lib/logger.js");

// whatsapp lib
const { procMsg } = require("./lib/whatsapp/msg.js");
const { prMsg } = require("./lib/whatsapp/fmt.js");
const CmdRegisWA = require("./lib/whatsapp/command-register.js");
const handlerWA = require("./lib/whatsapp/command-handler.js");
const SessionCleaner = require("./lib/whatsapp/session-cleaner.js");
const MessageStore = require("./lib/whatsapp/message-store.js");
const GroupCache = require("./lib/whatsapp/group-cache.js");

// telegram & discord lib
const CommandRegisterTelegram = require("./lib/telegram/command-register.js");
const { handleMessage: handleTelegramMessage } = require("./lib/telegram/command-handler.js");
const CommandRegisterDiscord = require("./lib/discord/command-register.js");
const { handleInteraction: handleDiscordInteraction, handleMessage: handleDiscordMessage } = require("./lib/discord/command-handler.js");

const has = (v) => v !== undefined && v !== null && v !== "";
const path = require("path");
global.root = (...args) => path.join(process.cwd(), ...args);

function showWelcome() {
    console.log(chalk.bold.cyan("======================================="));
    console.log(chalk.bold.green(` ${config.botName || name} v${version}`));
    console.log(chalk.gray(`Dibuat oleh: ${config.ownerName || author}`));
    console.log(chalk.gray("TYPE: CommonJS"));
    console.log(chalk.red("JANGAN DIPERJUALBELIKAN!"));
    console.log(chalk.bold.cyan("======================================="));

    const platforms = [];
    if (config.enableTelegram && has(config.telegramToken)) platforms.push(chalk.green("✔ Telegram"));
    if (config.enableDiscord && has(config.discordToken)) platforms.push(chalk.green("✔ Discord"));
    if (config.enableWhatsApp) platforms.push(chalk.green("✔ WhatsApp"));

    if (platforms.length === 0) {
        console.log(chalk.red("[ERROR] Tidak ada platform yang aktif/dikonfigurasi di config.js."));
        return false;
    }
    
    console.log(chalk.bold("Platform Aktif:"));
    platforms.forEach(p => console.log(` - ${p}`));
    console.log(chalk.bold.cyan("=======================================\n"));
    return true;
}

// telegram bot
async function startTelegram() {
  if (!has(config.telegramToken)) {
      console.warn(chalk.yellow("[TELEGRAM] Token tidak ditemukan, melewati..."));
      return;
  }
  
  try {
      const tg = new Telegraf(config.telegramToken);
      tg.use(session());
      tg.botName = config.botName;

      const cmdRegister = new CommandRegisterTelegram(tg);
      await cmdRegister.loadCommands();
      cmdRegister.watch();

      tg.on("message", async (ctx, next) => {
          logTelegram(ctx);
          return next();
      });
      tg.on("text", (ctx) => handleTelegramMessage(ctx, tg));
      tg.catch((err) => logError("telegram:core", err));

      await tg.launch();
      console.log(chalk.green("[TELEGRAM] Bot Launched Successfully"));
      return tg;
  } catch (e) {
      console.error(chalk.red("[TELEGRAM] Gagal memulai:"), e.message);
  }
}

// discord bot
async function startDiscord() {
  if (!has(config.discordToken) || !has(config.discordClientId)) {
      console.warn(chalk.yellow("[DISCORD] Token/Client ID tidak ditemukan, melewati..."));
      return;
  }

  try {
      const dc = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildVoiceStates
        ],
      });

      dc.botName = config.botName;
      dc.musicQueues = new Map();

      const cmdRegister = new CommandRegisterDiscord(dc);
      
      dc.once("ready", async () => {
        console.log(chalk.green(`[DISCORD] Logged in as ${dc.user.tag}`));
        await cmdRegister.loadCommands();
        cmdRegister.watch();
      });

      dc.on("interactionCreate", async (ix) => {
          logDiscord(ix);
          await handleDiscordInteraction(ix);
      });

      dc.on("messageCreate", async (msg) => {
          if(!msg.author.bot) {
              logDiscord(msg);
              await handleDiscordMessage(msg);
          }
      });
      
      dc.on("error", (e) => logError("discord:client", e));

      await dc.login(config.discordToken);
      return dc;
  } catch (e) {
      console.error(chalk.red("[DISCORD] Gagal memulai:"), e.message);
  }
}

// whatsapp
async function startWhatsapp() {
    const sessionCleaner = new SessionCleaner("sessions");
    const messageStore = new MessageStore("sessions");
    const groupCache = new GroupCache(5 * 60 * 1000);

    sessionCleaner.startAutoClean(); 
    groupCache.startAutoCleanup(); 

    const localStore = { messages: {}, groupMetadata: {} };
    const msgRetryCounterCache = new NodeCache();

    await CmdRegisWA.load();
    await CmdRegisWA.watch();

    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.green(`[WHATSAPP] Menggunakan WA v${version.join(".")}, Latest: ${isLatest}`));

    const whatsapp = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            const stored = messageStore.get(key.id);
            if (stored) return stored.message || proto.Message.fromObject({});
            const jid = key.remoteJid;
            const msg = localStore.messages[jid]?.find(m => m.key.id === key.id);
            return msg?.message || proto.Message.fromObject({});
        },
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
    });

    if (!whatsapp.authState.creds.registered && has(config.whatsappNumber)) {
        setTimeout(async () => {
            try {
                console.log(chalk.yellow(`[WHATSAPP] Meminta Pairing Code untuk ${config.whatsappNumber}...`));
                const code = await whatsapp.requestPairingCode(config.whatsappNumber);
                console.log(chalk.green.bold(`[WHATSAPP] KODE PAIRING: ${code}`));
            } catch (e) {
                console.error(chalk.red("[WHATSAPP] Gagal request pairing code:"), e.message);
            }
        }, 3000);
    }

    whatsapp.ev.process(async (events) => {
        if (events["connection.update"]) {
            const { connection, lastDisconnect } = events["connection.update"];
            
            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = (lastDisconnect.error instanceof Boom) && statusCode !== DisconnectReason.loggedOut;
                
                console.log(chalk.red(`[WHATSAPP] Koneksi Terputus: ${lastDisconnect.error?.message || lastDisconnect.error}`));
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red.bold("[FATAL] Sesi Logout. Hapus folder 'sessions' dan scan ulang."));
                } else if (shouldReconnect) {
                    console.log(chalk.yellow("[WHATSAPP] Mencoba menyambung kembali dalam 3 detik..."));
                    await delay(3000);
                    startWhatsapp();
                }
            } else if (connection === "open") {
                console.log(chalk.green("[WHATSAPP] Terhubung ke Server WhatsApp"));
                sessionCleaner.clean();
            }
        }

        if (events["creds.update"]) await saveCreds();
        if (events["messages.upsert"]) {
            const { messages, type } = events["messages.upsert"];
            
            for (let msg of messages) {
                if (!msg.message) continue;

                const jid = msg.key.remoteJid;

                messageStore.add(msg.key.id, {
                    key: msg.key,
                    message: msg.message,
                    pushName: msg.pushName,
                    sender: msg.key.participant || msg.key.remoteJid
                });
                if (jid) {
                    if (!localStore.messages[jid]) localStore.messages[jid] = [];
                    localStore.messages[jid].push(msg);
                    if (localStore.messages[jid].length > 50) localStore.messages[jid].shift();
                }

                if (type === "notify") {
                    const processed = await procMsg(msg, whatsapp, localStore);
                    if (!processed) continue;
                    if (processed.isGroup) {
                        let metadata = groupCache.get(processed.chat);
                        if (!metadata) {
                            try {
                                metadata = await whatsapp.groupMetadata(processed.chat);
                                groupCache.set(processed.chat, metadata);
                            } catch (e) {
                                console.error(`[WA-GROUP] Gagal fetch metadata ${processed.chat}`);
                            }
                        }
                        if (metadata) processed.metadata = metadata;
                    }
                    await handlerWA.handleCommand(processed, whatsapp, localStore, config);
                    prMsg(processed);
                }
            }
        }
        if (events["groups.update"]) {
            for (const update of events["groups.update"]) {
                try {
                    console.log(chalk.cyan(`[WA-GROUP] Update terdeteksi pada ${update.id}`));
                    const metadata = await whatsapp.groupMetadata(update.id);
                    groupCache.set(update.id, metadata);
                } catch {}
            }
        }
        if (events["group-participants.update"]) {
            const { id, participants, action } = events["group-participants.update"];
            console.log(chalk.cyan(`[WA-GROUP] ${action} -> ${participants.length} members di ${id}`));
            try {
                const metadata = await whatsapp.groupMetadata(id);
                groupCache.set(id, metadata);
            } catch {}
        }
    });

    return whatsapp;
}

(async () => {
  if (!showWelcome()) return;
  
  await delay(1000);
  console.log(chalk.yellow("Memulai Menjalankan Bot..."));

  try {
    const promises = [];

    if (config.enableTelegram) promises.push(startTelegram());
    if (config.enableDiscord) promises.push(startDiscord());
    if (config.enableWhatsApp) promises.push(startWhatsapp());

    await Promise.all(promises);
    
    console.log(chalk.green.bold("\n[SYSTEM] Semua bot berhasil dijalankan!\n"));
  } catch (e) {
    logError("BOOTSTRAP", e);
    process.exit(1);
  }
})();
process.on("unhandledRejection", (e) => logError("unhandledRejection", e));
process.on("uncaughtException", (e) => logError("uncaughtException", e));