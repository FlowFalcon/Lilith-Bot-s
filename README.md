# 💫 Lilith Bot's

**Lilith Bot's** adalah bot serbaguna yang dapat berjalan di **Telegram**, **Discord**, dan **WhatsApp** dengan satu basis kode.

![img](https://files.catbox.moe/5utuf4.jpg)

---

## ✨ Fitur Utama

* **Multi-Platform:** Satu kode untuk tiga platform populer: Telegram, Discord, dan WhatsApp.
* **Sistem Plugin Modular:** Tambahkan atau ubah perintah hanya dengan membuat file di folder `plugins/`.
* **Hot-Reload:** Plugin dapat dimuat ulang tanpa restart bot.
* **Dukungan Discord Lengkap:** Mendukung **Slash Commands** (`/command`) dan **Prefix Commands** (`.command`).
* **Manajemen Sesi WhatsApp:** Menggunakan Baileys dengan penyimpanan sesi multi-file.
* **Fitur Bawaan:** Termasuk perintah seperti `/start`, `/menu`, `/cekid`, dan fitur owner `/backup`, `/eval`.

---

## 🚀 Instalasi

1. **Persiapan Awal**
   Pastikan sudah menginstal **Node.js v20+**

2. **Clone Repository**

   ```bash
   git clone https://github.com/FlowFalcon/Lilith-Bot-s.git
   cd Lilith-Bot-s
   ```

3. **Instal Dependensi**

   ```bash
   npm install
   ```

4. **Konfigurasi**
   Salin `config.js.example` menjadi `config.js`, lalu isi nilainya:

   ```javascript
   global.config = {
     enableTelegram: true,
     enableDiscord: true,
     enableWhatsApp: true,

     telegramToken: "TOKEN_TELEGRAM",
     discordToken: "TOKEN_DISCORD",
     discordClientId: "CLIENT_ID_DISCORD",
     whatsappNumber: "628123456789",

     ownerTelegram: "ID_TELEGRAM_OWNER",
     ownerDiscord: "ID_DISCORD_OWNER",
     ownerWhatsapp: "628123456789",

     prefix: ["/", "."],
     ownerName: "NamaOwner",
     botName: "NamaBot",
   };
   ```

   **Catatan (WhatsApp):**

   * Saat pertama kali dijalankan, bot akan menampilkan **Pairing Code** di konsol.
   * Masukkan kode tersebut di WhatsApp melalui:
     `Setelan > Perangkat Tertaut > Tautkan perangkat > Tautkan dengan nomor telepon`.

5. **Menjalankan Bot**

   ```bash
   npm start
   ```

   Bot akan otomatis menjalankan platform yang diaktifkan di `config.js`.

---

## 📂 Struktur Proyek

```text
lilith Bot
├── bot/
│   ├── lib/
│   │   ├── discord/    # Logika inti Discord
│   │   ├── telegram/   # Logika inti Telegram
│   │   └── whatsapp/   # Logika inti WhatsApp
│   ├── plugins/        # Folder plugin tiap platform
│   ├── data/           # Data lokal (mis. users.json)
│   ├── sessions/       # Sesi WhatsApp (otomatis)
│   ├── config.js       # Konfigurasi utama
│   └── index.js        # Titik masuk utama
├── package.json
└── README.md
```

---

## ⚙️ Arsitektur & Alur Sistem

### 1. Inisialisasi (`index.js`)

* Memuat konfigurasi (`config.js`)
* Menampilkan pesan selamat datang
* Menjalankan `startTelegram()`, `startDiscord()`, dan `startWhatsapp()` sesuai konfigurasi

### 2. Pendaftaran Perintah

* Memindai folder `plugins/<platform>` untuk file `.js`
* Membaca metadata (`handler.command`, `handler.tags`, dsb.)
* Mendaftarkan ke platform (termasuk Slash Command)
* **Hot-Reload:** dipantau dengan `chokidar`

### 3. Penanganan Perintah

* Parsing pesan → validasi perintah → cek izin (mis. ownerOnly)
* Menjalankan fungsi `run()` dari plugin
* Sistem kompatibel untuk Slash, Prefix, dan pesan biasa

---

## Tutorial Buat Plugin

### 1. 📝 Cara Membuat Plugin Telegram
Plugin Telegram ditempatkan di folder plugins/telegram/.
Struktur File
Buat file baru, misalnya plugins/telegram/ping.js.
```javascript
// plugins/telegram/ping.js
// 1. Fungsi handler utama
let handler = async (ctx) => {
  try {
    // 2. Logika perintah Anda di sini
    const startTime = new Date();
    const msg = await ctx.reply("Pong!");
    const endTime = new Date();
    const latency = endTime - startTime;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `Pong! 🏓\nLatensi: ${latency} ms`
    );

  } catch (e) {
    console.error(e);
    ctx.reply("Terjadi error.");
  }
};

// 3. Metadata (Wajib untuk dimuat)
handler.command = ["ping"]; // Perintah utama dan alias
handler.description = "Mengecek latensi bot ke server Telegram.";
handler.tags = ["main"]; // Kategori untuk /menu
handler.help = ["ping"]; // Bantuan (seringkali sama dengan nama perintah)

// 5. Ekspor handler
module.exports = handler;
```
Penjelasan Bagian
 * let handler = async (ctx) => { ... }
   * Ini adalah fungsi utama yang akan dieksekusi.
   * ctx adalah objek Konteks Telegraf standar. Bot ini menambahkan beberapa properti ke dalamnya:
     * ctx.args: Array string argumen (contoh: /say hello world, ctx.args akan berisi ['hello', 'world']).
     * ctx._client: Instance bot Telegraf (berguna untuk mengakses bot.commands, dll.).
 * Logika Perintah
   * Anda bisa menggunakan ctx.reply() untuk membalas pesan.
   * ctx.from berisi info pengguna (ID, username).
   * ctx.chat berisi info obrolan.
 * handler.command
   * Wajib. Ini adalah array string. Elemen pertama ("ping") adalah perintah utama, dan sisanya ("pong") adalah alias.
 * handler.tags & handler.description
   * Digunakan oleh plugin menu.js untuk mengelompokkan dan memberi deskripsi perintah Anda.
   * Otomatis menjadi fitur Owner Only dengan tags "owner"
   
### 2. 💬 Cara Membuat Plugin Discord
Plugin Discord ditempatkan di folder plugins/discord/.
Sistem ini unik karena satu file plugin dapat menangani keduanya: Perintah prefix (cth: .ping) dan Slash Command (cth: /ping).
Struktur File
Buat file baru, misalnya plugins/discord/userinfo.js.
```javascript
// plugins/discord/userinfo.js
const { EmbedBuilder } = require("discord.js");

// 1. Fungsi handler utama
let handler = async (msgOrCtx, args) => {
  try {
    // 2. Dapatkan data pengguna (kompatibel untuk prefix & slash)
    let user;
    if (msgOrCtx._interaction) {
      // Ini adalah Slash Command
      user = msgOrCtx._optionsData?.user || msgOrCtx.author;
    } else {
      // Ini adalah Prefix Command
      user = msgOrCtx.mentions.users.first() || msgOrCtx.author;
    }

    // 3. Logika Perintah
    const embed = new EmbedBuilder()
      .setTitle(`Info Pengguna: ${user.tag}`)
      .setColor(0x00AE86)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "ID", value: user.id },
        { name: "Akun Dibuat", value: user.createdAt.toDateString() }
      );

    // 4. Membalas (kompatibel untuk prefix & slash)
    await msgOrCtx.reply({ embeds: [embed] });

  } catch (e) {
    console.error(e);
    await msgOrCtx.reply("Terjadi error.");
  }
};

// 5. Metadata (Wajib)
handler.command = ["userinfo"]; // Nama perintah & alias
handler.description = "Menampilkan info tentang seorang pengguna."; // Wajib untuk Slash Command
handler.tags = ["info"];
handler.help = ["userinfo [@user]"];

// 6. Izin (Opsional)
handler.permissions = {
  guildOnly: false, // Set 'true' jika hanya bisa di server
};

// 7. Opsi Slash Command (Opsional)
handler.options = [
  {
    name: "user", // Harus sama dengan _optionsData
    description: "Pengguna yang ingin Anda lihat infonya",
    type: "user", // Tipe data (string, integer, boolean, user, channel, role, attachment)
    required: false,
  },
];

// 8. Ekspor handler
module.exports = handler;
```
Penjelasan Bagian
 * let handler = async (msgOrCtx, args) => { ... }
   * msgOrCtx: Ini adalah konteks terpadu.
     * Jika dipicu oleh prefix command (cth: .userinfo), ini adalah objek Message Discord.js standar.
     * Jika dipicu oleh slash command (cth: /userinfo), ini adalah objek buatan yang meniru Message.
   * args: Ini adalah array argumen hanya untuk prefix command.
 * Mendeteksi Konteks
   * Anda bisa mengecek msgOrCtx._interaction atau msgOrCtx._optionsData untuk tahu apakah ini slash command.
 * Mengakses Opsi Slash Command
   * Gunakan msgOrCtx._optionsData?.nama_opsi untuk mendapatkan nilai dari opsi yang didefinisikan di handler.options.
 * Membalas Pesan
   * Gunakan msgOrCtx.reply(...). Fungsi ini sudah di-wrapper untuk menangani ix.reply() (slash) atau msg.reply() (prefix) secara otomatis.
 * handler.tags & handler.description
   * Digunakan oleh plugin menu.js untuk mengelompokkan dan memberi deskripsi perintah Anda.
   * Wajib untuk Slash Command. Ini adalah teks yang muncul di UI Discord.
   * Otomatis menjadi fitur Owner Only dengan tags "owner"
 * handler.options
   * Ini adalah array yang mendefinisikan opsi untuk Slash Command Anda.
   * type: Gunakan tipe data seperti "string", "integer", "user", "channel", "role", "attachment".
   
### 3. 📱 Cara Membuat Plugin WhatsApp
Plugin WhatsApp ditempatkan di folder plugins/whatsapp/.
Struktur File
Buat file baru, misalnya plugins/whatsapp/ping.js.
```javascript
// plugins/whatsapp/ping.js

// 1. Fungsi handler utama
let handler = async (m, { conn, args, config }) => {
  try {
    // 2. Logika Perintah
    const start = Date.now();
    await m.reply("Pong!");
    const latency = Date.now() - start;
    
    await m.reply(`Pong! 🏓\nLatensi: ${latency} ms`);

  } catch (e) {
    console.error(e);
    m.reply("Terjadi error.");
  }
};

// 3. Metadata (Wajib)
handler.command = ["ping"]; // Perintah utama dan alias
handler.tags = ["main"]; // Kategori untuk /menu
handler.help = ["ping"]; // Deskripsi untuk /menu

// 4. Ekspor handler
module.exports = handler;
```
Penjelasan Bagian
 * let handler = async (m, { conn, args, config }) => { ... }
   * m: Objek pesan utama yang telah diproses (dari procMsg). Properti penting:
     * m.sender: JID pengguna (misal: 62812345@s.whatsapp.net).
     * m.chat: JID obrolan (bisa JID grup atau JID pengguna).
     * m.isGroup: Boolean, true jika pesan dari grup.
     * m.pushName: Nama "Push Name" pengguna.
     * m.reply("Teks balasan"): Fungsi cepat untuk membalas pesan.
   * { conn, args, config }: Objek konteks kedua.
     * conn: Instance socket Baileys. Gunakan ini untuk fungsi WA lanjutan (misal: conn.sendMessage(...)).
     * args: Array string argumen (sudah dipisah).
     * config: Objek config.js global.
 * handler.command
   * Wajib. Array string untuk perintah dan alias.
 * handler.tags
   * Penting. Digunakan untuk kategorisasi di /menu.
   * Izin Owner: Jika Anda menambahkan tag "owner", perintah tersebut secara otomatis menjadi owner-only.
 * handler.help
   * Digunakan sebagai deskripsi perintah di /menu.


Setelah file disimpan di folder yang sesuai, bot akan otomatis (hot-reload) mendeteksinya dan perintah baru akan langsung tersedia.

---

## Made By Fathur 
