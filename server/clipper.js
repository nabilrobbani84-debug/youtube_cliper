const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { exec } = require('child_process');

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
    const ffmpegDir = path.dirname(ffmpegStatic);
    const cmd = `python -m yt_dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --ffmpeg-location "${ffmpegDir}" "${url}" -o "${outPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`YouTube download failed: ${error.message}`));
      }
      resolve(outPath);
    });
  });
}

function ffprobeVideoDetails(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata && metadata.streams ? metadata.streams.find(s => s.codec_type === 'video') : null;
      const width = videoStream ? Number(videoStream.width) : 1920;
      const height = videoStream ? Number(videoStream.height) : 1080;
      const duration = metadata && metadata.format && metadata.format.duration ? Number(metadata.format.duration) : 0;
      resolve({ width, height, duration });
    });
  });
}

function getAutoReframeCoords(inputPath, start, duration) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'auto_reframe.py');
    const cmd = `python "${scriptPath}" "${inputPath}" ${start} ${duration}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[AutoReframe] Error running script:', error.message);
        return resolve(null);
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          console.error('[AutoReframe] Script error:', result.error);
          return resolve(null);
        }
        resolve(result);
      } catch(e) {
        console.error('[AutoReframe] JSON parse error:', e.message);
        resolve(null);
      }
    });
  });
}

async function renderSegment(inputPath, start, duration, outPath, options = {}) {
  const reframe = await getAutoReframeCoords(inputPath, start, duration);
  const isEducational = options.isEducational || false;
  const width = options.width || 1920;
  const height = options.height || 1080;
  const brandName = options.brandName || '';
  
  return new Promise((resolve, reject) => {
    // Intelligent crop calculation to keep vertical 9:16 ratio perfectly balanced
    let cropFilter = '';
    const targetW = Math.round(height * 9 / 16);
    if (width > targetW) {
      let cropX = Math.round((width - targetW) / 2);
      if (reframe && typeof reframe.crop_x === 'number') {
        cropX = reframe.crop_x;
      }
      cropFilter = `crop=${targetW}:${height}:${cropX}:0`;
    } else {
      const targetH = Math.round(width * 16 / 9);
      if (height > targetH) {
        const cropY = Math.round((height - targetH) / 2);
        cropFilter = `crop=${width}:${targetH}:0:${cropY}`;
      } else {
        cropFilter = `scale=${width}:${height}`;
      }
    }

    const brandText = brandName ? (brandName.startsWith('@') ? brandName : `@${brandName}`) : '@YouClip';
    const watermarkFilter = `drawtext=text='${brandText}':fontfile='C\\\\:/Windows/Fonts/georgiai.ttf':fontsize=34:fontcolor=white@0.65:shadowcolor=black@0.4:shadowx=2:shadowy=2:x=60:y=h/2-30`;

    const filterGraph = [];
    if (isEducational) {
      filterGraph.push(
        cropFilter,
        `scale=1080:1920`,
        `eq=contrast=1.02:saturation=1.05:gamma=0.98`,
        watermarkFilter,
        `fade=t=in:st=0:d=0.3`,
        `fade=t=out:st=${Math.max(0, duration - 0.3)}:d=0.3`
      );
    } else {
      filterGraph.push(
        cropFilter,
        `eq=contrast=1.05:saturation=1.15:gamma=0.95`,
        `zoompan=z='min(zoom+0.0005,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
        watermarkFilter,
        `fade=t=in:st=0:d=0.3`,
        `fade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5`
      );
    }

    ffmpeg(inputPath)
      .setStartTime(start)
      .setDuration(duration)
      .videoFilters(filterGraph.join(','))
      .outputOptions([
        '-c:v libx264', 
        '-preset slow',
        '-crf 18',
        '-profile:v high',
        '-level 4.1',
        '-pix_fmt yuv420p',
        '-c:a aac', 
        '-b:a 192k',
        '-ar 48000',
        '-movflags +faststart'
      ])
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

async function renderYouTubeSubclips(mainClipId, videoId, opts = {}) {
  const count = opts.count || 5;
  const clips = opts.clips || [];
  const isEducational = opts.isEducational || false;
  const brandName = opts.brandName || '';
  const results = [];

  if (!videoId) return results;

  const inputFile = path.join(tmpDir, `${mainClipId}.mp4`);
  try {
    await downloadYoutubeToFile(videoId, inputFile);

    // Probe video details (duration, width, height)
    const { width, height, duration } = await ffprobeVideoDetails(inputFile);
    if (!duration || duration <= 0) throw new Error('Unable to determine video duration');

    const clipsToRender = [...clips];
    if (clipsToRender.length === 0) {
      const clipLen = Math.min(12, Math.max(4, Math.floor(duration / (count * 0.9))));
      for (let i = 0; i < count; i++) {
        const start = Math.min(Math.max(0, Math.floor((duration - clipLen) * i / Math.max(1, count - 1))), Math.max(0, Math.floor(duration - clipLen - 0.5)));
        clipsToRender.push({ start, duration: clipLen });
      }
    }

    for (let i = 0; i < clipsToRender.length; i++) {
      const clipInfo = clipsToRender[i];
      const outName = `${mainClipId}-${i + 1}.mp4`;
      const outPath = path.join(rendersDir, outName);
      try {
        await renderSegment(inputFile, clipInfo.start, clipInfo.duration, outPath, { 
          isEducational,
          width,
          height,
          brandName
        });
        results.push({ file: outName, url: `/renders/${outName}` });
      } catch (e) {
        console.error('[Clipper] segment render failed', e.message);
        break;
      }
    }
  } catch (err) {
    console.error('[Clipper] render failed:', err.message);
  } finally {
    try { if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile); } catch(e){}
  }

  return results;
}

module.exports = { renderYouTubeSubclips };
