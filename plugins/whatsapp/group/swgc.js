const { generateWAMessageFromContent, generateWAMessageContent, proto } = require("baileys");
const crypto = require("crypto");
const { font1 } = require(global.root("lib/font.js"));

let handler = async (m, { conn, args, text, isGroup }) => {
  try {
    // 1. Parsing Input (Pesan & ID Grup)
    let messageContent = text;
    let targetJid = "";

    // Cek apakah ada pemisah koma (pesan, id_grup)
    if (messageContent.includes(",")) {
      const split = messageContent.split(",");
      targetJid = split.pop().trim(); // Ambil bagian terakhir sebagai ID
      messageContent = split.join(",").trim(); // Sisanya adalah pesan
    } else if (/@g\.us$/i.test(messageContent)) {
      // Jika input hanya ID Grup
      targetJid = messageContent.trim();
      messageContent = "";
    }

    // Jika ID Grup kosong, gunakan ID grup saat ini (kalau lagi di grup)
    if (!targetJid && isGroup) {
      targetJid = m.chat;
    }

    // Validasi Akhir ID Grup
    if (!targetJid || !targetJid.endsWith("@g.us")) {
      return m.reply(
        font1(`❌ ID Grup tidak valid atau tidak ditemukan!\n\n` +
        `Cara pakai:\n` +
        `1. Di dalam grup: .swgc Halo Semuanya\n` +
        `2. Dari luar: .swgc Halo, 1203630xxx@g.us\n` +
        `3. Reply media: .swgc (caption opsional)`)
      );
    }

    // 2. Deteksi Media (Quoted atau Pesan Langsung)
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || "";
    
    // Cek apakah ada media atau text
    if (!messageContent && !/image|video|audio|sticker/.test(mime)) {
       return m.reply(font1("❌ Kirim/Reply teks atau media untuk dijadikan status grup."));
    }

    await m.react("⏳");

    // 3. Persiapkan Konten Media
    let content = {};
    if (/image|video|audio|sticker/.test(mime)) {
      const buffer = await q.download();
      if (!buffer) return m.reply("❌ Gagal mendownload media.");

      if (/image/.test(mime)) {
        content = { image: buffer, caption: messageContent };
      } else if (/video/.test(mime)) {
        content = { video: buffer, caption: messageContent };
      } else if (/audio/.test(mime)) {
        content = { audio: buffer, mimetype: "audio/mpeg", ptt: true }; // Audio jadi VN
      } else if (/sticker/.test(mime)) {
        content = { sticker: buffer };
      }
    } else {
      // Jika cuma teks (Status Teks dengan background warna acak)
      content = { text: messageContent };
      // Opsi tambahan untuk background status teks bisa ditambahkan di sini jika perlu
    }

    // 4. Generate WA Message Content
    const msgContent = await generateWAMessageContent(content, {
      upload: conn.waUploadToServer,
    });

    // 5. Buat Struktur Pesan Status Grup (V2)
    // Ini adalah struktur spesifik agar muncul sebagai status di profil grup
    const messageSecret = crypto.randomBytes(32);
    
    const statusMsg = generateWAMessageFromContent(
      targetJid,
      {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: {
          message: {
            ...msgContent,
            messageContextInfo: { messageSecret },
          },
        },
      },
      { userJid: conn.user.id }
    );

    // 6. Kirim (Relay)
    await conn.relayMessage(targetJid, statusMsg.message, { 
        messageId: statusMsg.key.id,
        additionalNodes: [
            // Node ini terkadang diperlukan untuk memvalidasi status grup
            {
                tag: "meta",
                attrs: { is_status: "true" } 
            }
        ]
    });

    await m.react("✅");
    m.reply(font1(`✅ Sukses upload status ke grup!`));

  } catch (e) {
    console.error("SWGC Error:", e);
    m.reply(font1(`❌ Gagal: ${e.message}`));
  }
};

handler.help = ["swgc"];
handler.tags = ["tools", "group"];
handler.command = ["swgc", "gcstatus"];
handler.isAdmin = true; // Hanya admin grup (biasanya) yang bisa post status grup
handler.isGroup = false; // Bisa dipakai di private chat asal tau ID grupnya

module.exports = handler;