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

function ffprobeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const dur = metadata && metadata.format && metadata.format.duration ? Number(metadata.format.duration) : 0;
      resolve(dur);
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
  
  return new Promise((resolve, reject) => {
    let cropFilter = 'crop=ih*9/16:ih'; // fallback center crop
    if (reframe && reframe.crop_w) {
      cropFilter = `crop=${reframe.crop_w}:${reframe.crop_h}:${reframe.crop_x}:${reframe.crop_y}`;
    }

    const filterGraph = [];
    if (isEducational) {
      // Clean Educational Framing:
      // - 9:16 Crop
      // - scale to 1080x1920
      // - subtle grade for clarity
      // - clean fades
      filterGraph.push(
        cropFilter,
        `scale=1080:1920`,
        `eq=contrast=1.02:saturation=1.05:gamma=0.98`,
        `fade=t=in:st=0:d=0.3`,
        `fade=t=out:st=${Math.max(0, duration - 0.3)}:d=0.3`
      );
    } else {
      // Standard Cinematic Zoompan
      filterGraph.push(
        cropFilter,
        `eq=contrast=1.05:saturation=1.15:gamma=0.95`, // color grading
        `zoompan=z='min(zoom+0.0005,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
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
  const results = [];

  if (!videoId) return results;

  const inputFile = path.join(tmpDir, `${mainClipId}.mp4`);
  try {
    // download (may throw)
    await downloadYoutubeToFile(videoId, inputFile);

    // probe duration
    const duration = await ffprobeDuration(inputFile);
    if (!duration || duration <= 0) throw new Error('Unable to determine video duration');

    // determine subclips list to render
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
        await renderSegment(inputFile, clipInfo.start, clipInfo.duration, outPath, { isEducational });
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
