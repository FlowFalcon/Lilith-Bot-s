const { promises } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');
const fs = require('fs'); // Tambahan fs sync untuk cek folder

// Pastikan folder tmp ada
const tmpDir = global.root("tmp");
if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
}

async function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      // Gunakan global.root() agar path pasti benar
      const tmp = join(tmpDir, `${Date.now()}.${ext}`);
      const out = `${tmp}.${ext2}`;
      
      await promises.writeFile(tmp, buffer);

      const ffmpegProcess = spawn('ffmpeg', ['-y', '-i', tmp, ...args, out]);

      ffmpegProcess.on('error', (err) => {
        console.error('❌ Error spawn ffmpeg:', err);
        // Hapus file temp input jika error spawn
        promises.unlink(tmp).catch(() => {}); 
        reject(err);
      });

      ffmpegProcess.on('close', async (code) => {
        try {
          // Hapus file input
          await promises.unlink(tmp); 
          
          if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));

          const exists = await promises.access(out).then(() => true).catch(() => false);

          if (!exists) return reject(new Error('Output file not found'));

          const data = await promises.readFile(out);
          
          resolve({
            data,
            filename: out,
            delete() {
              return promises.unlink(out);
            },
          });
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Konversi ke Audio (Playable di WA)
 * Format: OGG (Opus)
 */
function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-vn',                // Hapus video
      '-c:a', 'libopus',    // Codec audio Opus
      '-b:a', '128k',       // Bitrate
      '-vbr', 'on',         // Variable Bitrate
      '-compression_level', '10'
    ],
    ext,
    'opus' // Extensi output
  );
}

/**
 * Konversi ke PTT / Voice Note (Playable di WA)
 * Format: OGG (Opus), Mono, 48kHz (Standar WA PTT)
 */
function toPTT(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-vn',
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-vbr', 'on',
      '-compression_level', '10'
    ],
    ext,
    'opus'
  );
}

/**
 * Konversi ke Video (Playable di WA)
 * Format: MP4 (H.264 + AAC)
 */
function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-c:v', 'libx264',    // Codec Video H.264
      '-c:a', 'aac',        // Codec Audio AAC
      '-ab', '128k',        // Audio Bitrate
      '-ar', '44100',       // Audio Sample Rate
      '-crf', '32',         // Quality
      '-preset', 'slow',    // Preset encoding
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p'
    ],
    ext,
    'mp4'
  );
}

module.exports = {
  ffmpeg,
  toAudio,
  toPTT,
  toVideo,
};