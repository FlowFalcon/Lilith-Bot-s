const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// --- DATABASE MANAGER ---
const dbPath = path.join(__dirname, '../../data/savings.json');
const imgDir = path.join(__dirname, '../../data/savings_img');

// Pastikan folder data ada
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const readDb = () => {
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath));
};

const writeDb = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// --- HELPER FORMAT CURRENCY ---
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// --- CANVAS GENERATOR ---
const drawProgressCard = async (data, msgText) => {
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1f3a'); // Dark Blue
    gradient.addColorStop(1, '#0a0e27'); // Darker
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Dekorasi background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(700, 50, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(100, 350, 150, 0, Math.PI * 2);
    ctx.fill();

    // 2. Load Gambar Barang Impian
    let itemImage;
    try {
        if (fs.existsSync(data.imagePath)) {
            itemImage = await loadImage(data.imagePath);
        } else {
            // Fallback image jika file hilang (menggunakan placeholder warna)
            itemImage = null;
        }
    } catch (e) {
        itemImage = null;
    }

    // Gambar lingkaran/kotak untuk foto barang
    const imgX = 50;
    const imgY = 75;
    const imgSize = 250;

    ctx.save();
    // Shadow untuk gambar
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    
    // Rounded Rect untuk gambar
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgSize, imgSize, 20);
    ctx.clip();

    if (itemImage) {
        ctx.drawImage(itemImage, imgX, imgY, imgSize, imgSize);
    } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(imgX, imgY, imgSize, imgSize);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('?', imgX + 110, imgY + 130);
    }
    ctx.restore();

    // 3. Info Text
    const startTextX = 340;
    
    // Judul Tabungan
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(data.title.toUpperCase(), startTextX, 100);

    // Pesan Update (misal: "Nabung Rp 50.000")
    ctx.fillStyle = '#4ade80'; // Green light
    ctx.font = 'italic 24px Arial';
    ctx.fillText(msgText, startTextX, 140);

    // Info Nominal
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Arial';
    ctx.fillText(`Terkumpul:`, startTextX, 200);
    ctx.fillText(`Target:`, startTextX + 300, 200);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(formatRupiah(data.current), startTextX, 240);
    ctx.fillText(formatRupiah(data.target), startTextX + 300, 240);

    // 4. Progress Bar
    const percent = Math.min((data.current / data.target) * 100, 100);
    const barX = startTextX;
    const barY = 300;
    const barW = 400;
    const barH = 30;

    // Background Bar
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 15);
    ctx.fill();

    // Fill Bar
    const fillW = (barW * percent) / 100;
    const barGradient = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    barGradient.addColorStop(0, '#3b82f6');
    barGradient.addColorStop(1, '#8b5cf6');
    
    ctx.fillStyle = barGradient;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(fillW, 20), barH, 15); // min width 20 biar keliatan dikit
    ctx.fill();

    // Persentase Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${percent.toFixed(1)}%`, barX + barW, barY - 10);

    return canvas.toBuffer();
};

// --- HANDLER UTAMA ---
let handler = async (m, { conn, args, command }) => {
    const userId = m.sender;
    const db = readDb();
    if (!db[userId]) db[userId] = [];

    const action = args[0] ? args[0].toLowerCase() : 'menu';

    try {
        switch (action) {
            case 'create': 
            case 'buat': {
                // Usage: .tabung create <nama_barang> <target> (reply gambar)
                if (args.length < 3) return m.reply(`⚠️ Format salah!\nContoh: *.tabung create PS5 8000000* (Sambil reply gambar barangnya)`);
                
                const q = m.quoted ? m.quoted : m;
                const mime = (q.msg || q).type || '';
                if (!/imageMessage/.test(mime)) return m.reply(`⚠️ Harap kirim/reply gambar barang impianmu!`);

                const targetRaw = args[args.length - 1];
                const title = args.slice(1, args.length - 1).join(" ");
                const target = parseInt(targetRaw.replace(/[^0-9]/g, ''));

                if (isNaN(target)) return m.reply(`⚠️ Target harus berupa angka!`);

                // Download gambar
                const imgBuffer = await q.download();
                const imgFileName = `${userId.split('@')[0]}_${Date.now()}.jpg`;
                const savePath = path.join(imgDir, imgFileName);
                fs.writeFileSync(savePath, imgBuffer);

                const newGoal = {
                    id: Date.now().toString(36), // ID unik simple
                    title: title,
                    target: target,
                    current: 0,
                    imagePath: savePath,
                    lastUpdated: new Date().toISOString()
                };

                db[userId].push(newGoal);
                writeDb(db);

                const canvas = await drawProgressCard(newGoal, "Target Baru Dibuat!");
                await conn.sendMessage(m.chat, { image: canvas, caption: `✅ Tabungan *${title}* berhasil dibuat!\nTarget: ${formatRupiah(target)}` }, { quoted: m });
                break;
            }

            case 'add':
            case 'isi': 
            case 'nabung': {
                // Usage: .tabung add <nama_atau_index> <jumlah>
                if (db[userId].length === 0) return m.reply("Kamu belum punya tabungan. Ketik *.tabung create* dulu.");
                if (args.length < 3) return m.reply("⚠️ Format: *.tabung add <nama_barang> <nominal>*");

                const amountRaw = args[args.length - 1];
                const searchName = args.slice(1, args.length - 1).join(" ").toLowerCase();
                const amount = parseInt(amountRaw.replace(/[^0-9]/g, '')); // Hapus karakter non-angka (rp, titik, koma)

                if (isNaN(amount)) return m.reply("Nominal harus angka.");

                // Cari tabungan berdasarkan nama (fuzzy search simple)
                const index = db[userId].findIndex(g => g.title.toLowerCase().includes(searchName));
                
                if (index === -1) return m.reply(`Tabungan dengan nama "${searchName}" tidak ditemukan.`);

                db[userId][index].current += amount;
                db[userId][index].lastUpdated = new Date().toISOString();
                writeDb(db);

                const data = db[userId][index];
                const canvas = await drawProgressCard(data, `+ ${formatRupiah(amount)}`);
                
                let caption = `🎉 *Tabungan Bertambah!*\n\n`;
                caption += `Barang: ${data.title}\n`;
                caption += `Progress: ${((data.current/data.target)*100).toFixed(1)}%`;
                
                if (data.current >= data.target) caption += `\n\n🥳 *SELAMAT! TARGET TERCAPAI!* 🥳`;

                await conn.sendMessage(m.chat, { image: canvas, caption: caption }, { quoted: m });
                break;
            }

            case 'tarik':
            case 'kurang': {
                 if (db[userId].length === 0) return m.reply("Belum ada tabungan.");
                 if (args.length < 3) return m.reply("⚠️ Format: *.tabung tarik <nama_barang> <nominal>*");

                 const amountRaw = args[args.length - 1];
                 const searchName = args.slice(1, args.length - 1).join(" ").toLowerCase();
                 const amount = parseInt(amountRaw.replace(/[^0-9]/g, ''));

                 const index = db[userId].findIndex(g => g.title.toLowerCase().includes(searchName));
                 if (index === -1) return m.reply(`Tabungan "${searchName}" tidak ditemukan.`);

                 db[userId][index].current -= amount;
                 if (db[userId][index].current < 0) db[userId][index].current = 0; // Gak boleh minus
                 writeDb(db);

                 const data = db[userId][index];
                 const canvas = await drawProgressCard(data, `- ${formatRupiah(amount)} (Ditarik)`);
                 
                 await conn.sendMessage(m.chat, { image: canvas, caption: `⚠️ Uang ditarik dari tabungan *${data.title}*.` }, { quoted: m });
                 break;
            }

            case 'list':
            case 'cek': {
                if (db[userId].length === 0) return m.reply("Belum ada tabungan. Buat dengan *.tabung create*");
                
                // Jika user mengetik .tabung list <nama>, tampilkan detail canvas
                if (args[1]) {
                    const searchName = args.slice(1).join(" ").toLowerCase();
                    const index = db[userId].findIndex(g => g.title.toLowerCase().includes(searchName));
                    if (index !== -1) {
                        const data = db[userId][index];
                        const canvas = await drawProgressCard(data, "Status Tabungan");
                        return await conn.sendMessage(m.chat, { image: canvas, caption: `📊 Status: *${data.title}*` }, { quoted: m });
                    }
                }

                // List text biasa jika banyak
                let msg = `💰 *DAFTAR TABUNGANMU*\n\n`;
                db[userId].forEach((g, i) => {
                    const percent = ((g.current / g.target) * 100).toFixed(1);
                    msg += `${i + 1}. *${g.title}*\n`;
                    msg += `   Prog: ${formatRupiah(g.current)} / ${formatRupiah(g.target)} (${percent}%)\n`;
                });
                msg += `\nKetik *.tabung cek <nama>* untuk lihat kartu progress.`;
                m.reply(msg);
                break;
            }
            
            case 'delete':
            case 'hapus': {
                if (args.length < 2) return m.reply("Sebutkan nama tabungan yang mau dihapus.");
                const searchName = args.slice(1).join(" ").toLowerCase();
                const index = db[userId].findIndex(g => g.title.toLowerCase().includes(searchName));

                if (index === -1) return m.reply("Tabungan tidak ditemukan.");
                
                // Hapus file gambar juga biar hemat storage
                try {
                    if (fs.existsSync(db[userId][index].imagePath)) {
                        fs.unlinkSync(db[userId][index].imagePath);
                    }
                } catch(e) {}

                const deletedName = db[userId][index].title;
                db[userId].splice(index, 1);
                writeDb(db);
                
                m.reply(`✅ Tabungan *${deletedName}* berhasil dihapus.`);
                break;
            }

            default: {
                let help = `*🏦 FITUR TABUNGAN 🏦*\n\n`;
                help += `1️⃣ *Buat Tabungan*\n`;
                help += `   Reply gambar barang -> ketik:\n`;
                help += `   *.tabung create <nama> <target>*\n`;
                help += `   _Contoh: .tabung create iPhone 15000000_\n\n`;
                help += `2️⃣ *Nabung (Isi)*\n`;
                help += `   *.tabung isi <nama> <nominal>*\n`;
                help += `   _Contoh: .tabung isi iPhone 50000_\n\n`;
                help += `3️⃣ *Tarik Saldo*\n`;
                help += `   *.tabung tarik <nama> <nominal>*\n\n`;
                help += `4️⃣ *Cek Progress*\n`;
                help += `   *.tabung list* (Lihat semua)\n`;
                help += `   *.tabung cek <nama>* (Lihat gambar)\n\n`;
                help += `5️⃣ *Hapus*\n`;
                help += `   *.tabung hapus <nama>*`;
                
                m.reply(help);
            }
        }
    } catch (e) {
        console.error(e);
        m.reply(`Terjadi error: ${e.message}`);
    }
};

handler.help = ['tabung'];
handler.tags = ['owner'];
handler.command = ['tabung', 'tabungan'];
handler.isOwner = true;

module.exports = handler;