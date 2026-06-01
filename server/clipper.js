const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Ensure ffmpeg/ffprobe are configured
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

// Ensure directories exist
const tmpDir = path.join(__dirname, 'tmp');
const rendersDir = path.join(__dirname, 'public', 'renders');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

function downloadYoutubeToFile(videoId, outPath) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const videoStream = ytdl(url, { quality: 'highestvideo' });
    const fileStream = fs.createWriteStream(outPath);

    videoStream.pipe(fileStream);

    videoStream.on('error', (err) => {
      fileStream.destroy();
      reject(new Error(`YouTube download failed: ${err.message}`));
    });

    fileStream.on('error', (err) => {
      videoStream.destroy();
      reject(err);
    });

    fileStream.on('finish', () => resolve(outPath));
  });
}

function ffprobeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const dur = metadata && metadata.format && metadata.format.duration ? Number(metadata.format.duration) : 0;
      resolve(dur);
    });
  });
}

function renderSegment(inputPath, start, duration, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(start)
      .setDuration(duration)
      .outputOptions(['-c:v libx264', '-c:a aac', '-movflags +faststart'])
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

async function renderYouTubeSubclips(mainClipId, videoId, opts = {}) {
  const count = opts.count || 5;
  const results = [];

  if (!videoId) return results;

  const inputFile = path.join(tmpDir, `${mainClipId}.mp4`);
  try {
    // download (may throw)
    await downloadYoutubeToFile(videoId, inputFile);

    // probe duration
    const duration = await ffprobeDuration(inputFile);
    if (!duration || duration <= 0) throw new Error('Unable to determine video duration');

    // choose clip length (approx)
    const clipLen = Math.min(12, Math.max(4, Math.floor(duration / (count * 0.9))));

    for (let i = 0; i < count; i++) {
      const start = Math.min(Math.max(0, Math.floor((duration - clipLen) * i / Math.max(1, count - 1))), Math.max(0, Math.floor(duration - clipLen - 0.5)));
      const outName = `${mainClipId}-${i + 1}.mp4`;
      const outPath = path.join(rendersDir, outName);
      try {
        await renderSegment(inputFile, start, clipLen, outPath);
        results.push({ file: outName, url: `/renders/${outName}` });
      } catch (e) {
        console.error('[Clipper] segment render failed', e.message);
        // stop further rendering on error
        break;
      }
    }
  } catch (err) {
    console.error('[Clipper] render failed:', err.message);
    // cleanup partial files
  } finally {
    // cleanup input file if exists
    try { if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile); } catch(e){}
  }

  return results;
}

module.exports = { renderYouTubeSubclips };
