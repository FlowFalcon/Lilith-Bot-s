const { promises } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');

async function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      const tmp = join(__dirname, '../../tmp', `${Date.now()}.${ext}`);
      const out = `${tmp}.${ext2}`;
      await promises.writeFile(tmp, buffer);

      const ffmpegProcess = spawn('ffmpeg', ['-y', '-i', tmp, ...args, out]);

      ffmpegProcess.on('error', (err) => {
        console.error('❌ Error spawn ffmpeg:', err);
        reject(err);
      });

      ffmpegProcess.on('close', async (code) => {
        try {
          await promises.unlink(tmp);
          if (code !== 0) return reject(new Error(`FFmpeg exited with code ${code}`));

          const exists = await promises
            .access(out)
            .then(() => true)
            .catch(() => false);

          if (!exists) return reject(new Error('Output file not found'));

          resolve({
            data: await promises.readFile(out),
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

function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    [
     '-vn',
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-ac', '1',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'opus'
    ],
    ext,
    'ogg'
  );
}


function toPTT(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '64k',
      '-ac', '2',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'opus'
    ],
    ext,
    'opus'
  );
}

function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-ab', '128k',
      '-ar', '44100',
      '-crf', '32',
      '-preset', 'slow',
      '-movflags', '+faststart',
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
