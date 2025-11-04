global.config = {
  // --- PLATFORM SETTING ---
  // Atur ke 'true' untuk mengaktifkan, 'false' untuk menonaktifkan
  enableTelegram: true, // true untuk mengaktifkan bot Telegram
  enableDiscord: true, // true untuk mengaktifkan bot Discord
  enableWhatsApp: true, // true untuk mengaktifkan bot WhatsApp

  // --- BOT CONFIG ---
     telegramToken: "", // Token bot Telegram
     discordToken: "", // Token bot Discord
     discordClientId: "", // Client ID bot Discord
     whatsappNumber: "", // example: 628123456789
  
  // --- OWNER CONFIG ---
  ownerTelegram: "OWNER_TELEGRAM",
  ownerDiscord: "OWNER_DISCORD",
  ownerWhatsapp: "OWNER_WHATSAPP",

  // --- BOT SETTING ---
  prefix: ["/", "."],
  ownerName: "Fathur",
  botName: "Lilith Bot's",
};

module.exports = global.config;