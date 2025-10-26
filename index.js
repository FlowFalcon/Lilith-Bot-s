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

// WhatsApp Imports
const { procMsg } = require("./lib/whatsapp/msg.js");
const { prMsg } = require("./lib/whatsapp/fmt.js");
const CmdRegisWA = require("./lib/whatsapp/command-register.js");
const handlerWA = require("./lib/whatsapp/command-handler.js");

// Telegram Imports
const CommandRegisterTelegram = require("./lib/telegram/command-register.js");
const { handleMessage: handleTelegramMessage } = require("./lib/telegram/command-handler.js");

// Discord Imports
const CommandRegisterDiscord = require("./lib/discord/command-register.js");
const { handleInteraction: handleDiscordInteraction, handleMessage: handleDiscordMessage } = require("./lib/discord/command-handler.js");

const has = (v) => v !== undefined && v !== null && v !== "";

function showWelcome() {
    console.log(chalk.bold.cyan("======================================="));
    console.log(chalk.bold.green(` ${config.botName || name} v${version}`));
    console.log(chalk.gray(`Dibuat oleh: ${config.ownerName || author}`));
    console.log(chalk.gray("TYPE: CommonJS"))
    console.log(chalk.gray("Repository:https://github.com/FlowFalcon/Lilith-Bot-s.git"));
    console.log(chalk.red("JANGAN PERNAH MENJUAL SCRIPT INI KARENA GRATIS!"));
    console.log(chalk.bold.cyan("======================================="));

    const platforms = [];
    let tgReady = false;
    let dcReady = false;
    let waReady = false;

    if (config.enableTelegram) {
        tgReady = has(config.telegramToken);
        platforms.push(tgReady ? chalk.green("✔ Telegram") : chalk.red("✖ Telegram (Token Hilang)"));
    }
    if (config.enableDiscord) {
        dcReady = has(config.discordToken) && has(config.discordClientId);
        platforms.push(dcReady ? chalk.green("✔ Discord") : chalk.red("✖ Discord (Token/Client ID Hilang)"));
    }
    if (config.enableWhatsApp) {
        waReady = true;
        platforms.push(chalk.green("✔ WhatsApp"));
    }

    console.log(chalk.bold("Platform Dikonfigurasi:"));
    if (platforms.length > 0) {
        platforms.forEach(p => console.log(` - ${p}`));
    } else {
        console.log(chalk.yellow("  (Tidak ada platform yang diaktifkan)"));
    }
    console.log(chalk.bold.cyan("======================================="));

    const anyPlatformEnabled = config.enableTelegram || config.enableDiscord || config.enableWhatsApp;
    const anyPlatformReady = tgReady || dcReady || waReady;

    if (!anyPlatformEnabled) {
        console.log(chalk.bold.red("\n[STARTUP DIBATALKAN]"));
        console.log(chalk.yellow("Semua platform di-nonaktifkan di 'config.js'."));
        console.log(chalk.yellow("Bot tidak akan terhubung."));
        return false;
    }

    if (!anyPlatformReady) {
        console.log(chalk.bold.red("\n[STARTUP DIBATALKAN]"));
        console.log(chalk.yellow("Platform diaktifkan, tetapi Token/ID yang diperlukan belum diisi."));
        console.log(chalk.yellow("Silakan periksa file 'config.js' Anda."));
        return false;
    }

    console.log(chalk.cyan("\nInisialisasi bot dalam 2 detik..."));
    return true;
}

// ---------- TELEGRAM ----------
async function startTelegram() {
  if (!has(config.telegramToken)) {
    console.warn("Missing telegramToken in config.js, skipping Telegram bot.");
    return null;
  }
  const tg = new Telegraf(config.telegramToken);
  tg.use(session());

  tg.botName = config.botName;
  tg.ownerName = config.ownerName;

  const cmdRegister = new CommandRegisterTelegram(tg);
  await cmdRegister.loadCommands();
  cmdRegister.watch();

  tg.on("message", async (ctx, next) => {
    logTelegram(ctx);
    return next();
  });

  tg.on("text", (ctx) => handleTelegramMessage(ctx, tg));

  tg.catch((err) => {
    logError("telegram:middleware", err);
  });

  await tg.launch();
  console.log(chalk.green("[TELEGRAM] Bot launched"));
  return tg;
}

// ---------- DISCORD ----------
async function startDiscord() {
  if (!has(config.discordToken) || !has(config.discordClientId)) {
    console.warn("Missing discordToken or discordClientId in config.js, skipping Discord bot.");
    return null;
  }

  const dc = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  dc.botName = config.botName;
  dc.ownerName = config.ownerName;
  dc.id = config.discordClientId;

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
      if (!msg.author || msg.author.bot) return; 
      logDiscord(msg);
      await handleDiscordMessage(msg);
  });
  

  dc.on("error", (e) => logError("discord:client", e));
  dc.on("warn", (e) => logError("discord:warn", new Error(String(e))));
  dc.rest?.on?.("rateLimited", (info) => logError("discord:ratelimit", new Error(JSON.stringify(info))));

  await dc.login(config.discordToken);
  return dc;
}

// ---------- WHATSAPP ----------
async function startWhatsapp() {
    const localStore = {
        messages: {},
        groupMetadata: {},
        contacts: {}
    };
    const logger = pino({ level: "silent" });
    const msgRetryCounterCache = new NodeCache();

    await CmdRegisWA.load();
    await CmdRegisWA.watch();

    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.green(`[WHATSAPP] using WA v${version.join(".")}, isLatest: ${isLatest}`));

    const whatsapp = makeWASocket({
        version,
        printQRInTerminal: false,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            const jid = key.remoteJid;
            const msg = localStore.messages[jid]?.find(m => m.key.id === key.id);
            return msg || proto.Message.fromObject({});
        },
    });

    if (!whatsapp.authState.creds.registered && has(config.whatsappNumber)) {
        console.log(chalk.yellow(`[WHATSAPP] Sesi tidak ditemukan. Meminta pairing code untuk nomor ${config.whatsappNumber}...`));
        setTimeout(async () => {
            try {
                const code = await whatsapp.requestPairingCode(config.whatsappNumber);
                console.log(chalk.green.bold(`[WHATSAPP] Pairing code Anda: ${code}`));
                console.log(chalk.yellow("[WHATSAPP] Silakan masukkan kode ini di perangkat WhatsApp Anda (Setelan > Perangkat Tertaut > Tautkan perangkat > Tautkan dengan nomor telepon)."));
            } catch (error) {
                console.error(chalk.red("[WHATSAPP] Gagal meminta pairing code:"), error);
            }
        }, 3000); 
    } else if (!whatsapp.authState.creds.registered && !has(config.whatsappNumber)) {
        console.log(chalk.yellow("[WHATSAPP] Sesi tidak ditemukan."));
        console.log(chalk.yellow("           Silakan isi 'whatsappNumber' di config.js untuk mendapatkan pairing code."));
        console.log(chalk.yellow("           Bot WhatsApp TIDAK akan terhubung sampai sesi dibuat."));
    }

    whatsapp.ev.process(async (events) => {
        if (events["connection.update"]) {
            const { connection, lastDisconnect, qr } = events["connection.update"];
            if(qr) console.log(chalk.yellow("[WHATSAPP] Menerima event QR (ditahan)."));

            if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = (lastDisconnect.error instanceof Boom) && statusCode !== DisconnectReason.loggedOut;
                console.log(chalk.red(`[WHATSAPP] Koneksi ditutup: ${lastDisconnect.error}, reconnect: ${shouldReconnect}`));
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log(chalk.red.bold("\n[WHATSAPP FATAL] ANDA TELAH LOGOUT."));
                    console.log(chalk.red("Hapus folder 'sessions' dan isi 'whatsappNumber' di config.js untuk pairing ulang."));
                    return;
                } else if (shouldReconnect) {
                    startWhatsapp();
                }
            } else if (connection === "open") {
                console.log(chalk.green("[WHATSAPP] Bot terhubung"));
            }
        }

        if (events["creds.update"]) await saveCreds();

        if (events["messages.upsert"]) {
            const upsert = events["messages.upsert"];
            for (let msg of upsert.messages) {
                if (upsert.type === "notify" && msg.message) {
                    const processedMessage = await procMsg(msg, whatsapp, localStore);
                    if (!processedMessage) continue;
                    await handlerWA.handleCommand(processedMessage, whatsapp, localStore, config);
                    prMsg(processedMessage);
                }
            }
        }

if (events["groups.update"]) {
    const updates = events["groups.update"];
    for (const update of updates) {
        const id = update.id;
        if (!id) continue;
        
        try {
            console.log(`[GROUPS.UPDATE] Updating metadata for ${id}`);
            const metadata = await whatsapp.groupMetadata(id);
            
            // ✅ Simpan ke localStore
            localStore.groupMetadata[id] = metadata;
            
            console.log(`[GROUPS.UPDATE] Updated ${id} - ${metadata.participants?.length || 0} participants`);
        } catch (error) {
            console.error(`[GROUPS.UPDATE] Error updating group ${id}:`, error.message);
        }
    }
}

// ✅ Update untuk group-participants.update
if (events["group-participants.update"]) {
    const { id, participants, action } = events["group-participants.update"];
    
    if (id) {
        try {
            console.log(`[GROUP-PARTICIPANTS.UPDATE] ${action} in ${id}: ${participants.join(', ')}`);
            
            // ✅ Fetch metadata terbaru
            const metadata = await whatsapp.groupMetadata(id);
            localStore.groupMetadata[id] = metadata;
            
            console.log(`[GROUP-PARTICIPANTS.UPDATE] Metadata refreshed for ${id}`);
        } catch (error) {
            console.error(`[GROUP-PARTICIPANTS.UPDATE] Error processing group ${id}:`, error.message);
        }
    }
}

    });

    return whatsapp;
}

// ---------- BOOT ----------
(async () => {
  if (!showWelcome()) return;
  await delay(2000);
  try {
    console.log(chalk.yellow("🔔 Memulai koneksi ke platform yang diaktifkan..."));
    
    const platformPromises = [];
    
    if (config.enableTelegram && has(config.telegramToken)) {
        platformPromises.push(startTelegram());
    }
    if (config.enableDiscord && has(config.discordToken) && has(config.discordClientId)) {
        platformPromises.push(startDiscord());
    }
    if (config.enableWhatsApp) {
        platformPromises.push(startWhatsapp());
    }

    await Promise.all(platformPromises);
    console.log(chalk.yellow("🚀 Semua platform yang aktif telah terhubung."));
    
  } catch (e) {
    logError("bootstrap", e);
    process.exitCode = 1;
  }
})();

process.on("unhandledRejection", (e) => logError("unhandledRejection", e));
process.on("uncaughtException", (e) => logError("uncaughtException", e));