global.config = {
  // - PLATFORM SETTING -
  // Atur ke 'true' untuk mengaktifkan, 'false' untuk menonaktifkan
  enableTelegram: true,
  enableDiscord: true,
  enableWhatsApp: true,

  // - BOT CONFIG -
  telegramToken: "Your_telegram_token_here",
  discordToken: "YOUR_discord_token_here",
  discordClientId: "YOUR_discord_client_id_here",
  whatsappNumber: "YOU_NUMBER_BOT", // example: 628123456789
  
  // - OWNER CONFIG -
  ownerTelegram: "YOU_TELEGRAM_ID", // example: 123456789"",
  ownerDiscord: "YOU_DISCORD_ID", // example: 123456789012345678
  ownerWhatsapp: "YOU_NUMBER", // example: 628123456789

  // - BOT SETTING -
  selfMode: false, // false = Public, true = Self
  prefix: ["/", "."],
  ownerName: "Fathur",
  botName: "Lilith Bot's",

  // - GEMINI API KEY -
  geminikey: "YOUR_API_KEY",
    /* ganti dengan API Key Gemini kamu sendiri dari http://aistudio.google.com/
       agar bisa menggunakan fitur AI Dev Assistant (Aidev) */
};

module.exports = global.config;
