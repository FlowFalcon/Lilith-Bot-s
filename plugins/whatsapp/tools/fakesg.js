const axios = require("axios");
const FormData = require("form-data");

let handler = async (m, { conn, args }) => {
  try {
    const quoted = m.quoted;
    const mime = quoted?.type || '';

    const username = args.join(' ');
    if (!username) {
      m.reply('Format salah. Tutor: .fakestory <username>');
      return;
    }

    if (!/imageMessage/.test(mime)) {
      m.reply('Harap reply gambar yang ingin dijadikan story.');
      return;
    }

    const loadingMsg = await m.reply('Membuat story...');

    const imageBuffer = await quoted.download();
    if (!imageBuffer) {
      return conn.sendMessage(m.chat, { 
        text: 'Gagal mengunduh gambar yang di-reply.', 
        edit: loadingMsg.key 
      });
    }

    let avatarBuffer;
    try {
      const ppUrl = await conn.profilePictureUrl(m.sender, 'image');
      const { data } = await axios.get(ppUrl, { responseType: 'arraybuffer' });
      avatarBuffer = Buffer.from(data);
    } catch {
      avatarBuffer = imageBuffer;
    }

    const jam = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',      
        minute: '2-digit',     
        hour12: false            
    }) + ' WIB';

    const form = new FormData();
    form.append('username', username);
    form.append('jam', jam);
    form.append('image', imageBuffer, { filename: 'image.jpg' });
    form.append('avatar', avatarBuffer, { filename: 'avatar.jpg' });

    const res = await axios.post('https://fathurweb.qzz.io/api/canvas/fakestory', form, {
      headers: form.getHeaders(),
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const hasil = Buffer.from(res.data);

    await conn.sendMessage(m.chat, { delete: loadingMsg.key });

    await conn.sendMessage(m.chat, {
      image: hasil,
      caption: `Story: ${username}`
    }, { quoted: m });

  } catch (e) {
    console.error("Fakestory Error:", e);
    m.reply(`Eror bang : ${e.message}`);
  }
}

handler.command = ['fakestory'];
handler.tags = ['tools'];
handler.help = ['fakestory <username>'];
module.exports = handler;