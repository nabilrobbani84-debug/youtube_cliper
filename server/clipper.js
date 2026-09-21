const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { exec, execFile } = require('child_process');

// Ensure ffmpeg/ffprobe are configured
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

// Ensure directories exist
const tmpDir = path.join(__dirname, 'tmp');
const rendersDir = path.join(__dirname, 'public', 'renders');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

/**
 * Download a YouTube video using yt-dlp.
 * Retries up to 3 times, timeout 5 minutes.
 */
function downloadYoutubeToFile(videoId, outPath, attempt = 1) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const ffmpegDir = path.dirname(ffmpegStatic);

    const args = [
      '-m', 'yt_dlp',
      // Best quality video+audio, prefer mp4 container
      '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegDir,
      // Reliability options
      '--retries', '3',
      '--fragment-retries', '3',
      '--retry-sleep', '3',
      '--no-part',                    // Don't use .part temp files
      '--no-playlist',                // Never accidentally grab a playlist
      '--js-runtimes', 'nodejs',
      // Output
      '-o', outPath,
      url
    ];

    console.log(`[Clipper] Downloading ${url} (attempt ${attempt})...`);

    execFile('python', args, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Clipper] Download attempt ${attempt} failed:`, error.message);
        // Retry once more on failure
        if (attempt < 2) {
          return resolve(downloadYoutubeToFile(videoId, outPath, attempt + 1));
        }
        return reject(new Error(`YouTube download failed after ${attempt} attempts: ${error.message}`));
      }
      if (!fs.existsSync(outPath)) {
        if (attempt < 2) {
          return resolve(downloadYoutubeToFile(videoId, outPath, attempt + 1));
        }
        return reject(new Error('Download appeared to succeed but output file not found.'));
      }
      console.log(`[Clipper] Download complete: ${outPath}`);
      resolve(outPath);
    });
  });
}

function ffprobeVideoDetails(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata && metadata.streams
        ? metadata.streams.find(s => s.codec_type === 'video')
        : null;
      const audioStream = metadata && metadata.streams
        ? metadata.streams.find(s => s.codec_type === 'audio')
        : null;
      const width = videoStream ? Number(videoStream.width) : 1920;
      const height = videoStream ? Number(videoStream.height) : 1080;
      const duration = metadata && metadata.format && metadata.format.duration
        ? Number(metadata.format.duration)
        : 0;
      const hasAudio = !!audioStream;
      resolve({ width, height, duration, hasAudio });
    });
  });
}

function getAutoReframeCoords(inputPath, start, duration) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'auto_reframe.py');

    execFile('python', [scriptPath, inputPath, start.toString(), duration.toString()], 
      { timeout: 60000, maxBuffer: 5 * 1024 * 1024 },
      (error, stdout, stderr) => {
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
      }
    );
  });
}

/**
 * Render a single clip segment to a 9:16 vertical MP4.
 *
 * Pipeline (correct order):
 *   1. crop          — cut to 9:16 region (with face-aware reframe if available)
 *   2. scale         — resize to exactly 1080×1920
 *   3. eq            — color grading (contrast/saturation)
 *   4. drawtext      — watermark/brand overlay
 *   5. fade in/out   — smooth transitions
 *   Audio: loudnorm  — normalize output loudness to -14 LUFS (broadcast standard)
 */
async function renderSegment(inputPath, start, duration, outPath, options = {}) {
  const reframe = await getAutoReframeCoords(inputPath, start, duration);
  const isEducational = options.isEducational || false;
  const srcWidth  = options.width  || 1920;
  const srcHeight = options.height || 1080;
  const brandName = options.brandName || '';
  const hasAudio  = options.hasAudio !== false;

  return new Promise((resolve, reject) => {
    // ----------------------------------------------------------------
    // Step 1: Calculate 9:16 crop from source dimensions
    // ----------------------------------------------------------------
    const targetCropW = Math.round(srcHeight * 9 / 16);
    let cropX = Math.round((srcWidth - targetCropW) / 2); // default: center

    if (reframe && typeof reframe.crop_x === 'number') {
      // Use face-detected position, clamped to valid range
      cropX = Math.max(0, Math.min(reframe.crop_x, srcWidth - targetCropW));
    }

    // Ensure targetCropW doesn't exceed source width
    const safeCropW = Math.min(targetCropW, srcWidth);
    const safeCropH = srcHeight;

    // ----------------------------------------------------------------
    // Step 2: Build video filter chain
    // ----------------------------------------------------------------
    const videoFilters = [];

    // 2a. Crop to 9:16 aspect ratio
    videoFilters.push(`crop=${safeCropW}:${safeCropH}:${cropX}:0`);

    // 2b. Scale to final output resolution (1080×1920 for 9:16 Shorts)
    videoFilters.push(`scale=1080:1920:flags=lanczos`);

    // 2c. Color grading — educational gets subtle, viral gets punchy
    if (isEducational) {
      videoFilters.push(`eq=contrast=1.02:saturation=1.05:gamma=0.98:brightness=0.01`);
    } else {
      videoFilters.push(`eq=contrast=1.08:saturation=1.20:gamma=0.93:brightness=0.02`);
    }

    // 2d. Sharpen slightly for crisp output at 1080p
    videoFilters.push(`unsharp=5:5:0.8:5:5:0.0`);

    // 2e. Watermark / brand text
    const brandText = brandName
      ? (brandName.startsWith('@') ? brandName : `@${brandName}`)
      : '@YouClip';
    // Use a safe cross-platform font fallback
    const fontPath = 'C\\\\:/Windows/Fonts/arial.ttf';
    videoFilters.push(
      `drawtext=text='${brandText}':fontfile='${fontPath}':fontsize=38:fontcolor=white@0.75:shadowcolor=black@0.55:shadowx=2:shadowy=2:x=60:y=h-80`
    );

    // 2f. Fade transitions
    const fadeInDuration  = 0.4;
    const fadeOutDuration = 0.5;
    const fadeOutStart    = Math.max(0, duration - fadeOutDuration);
    videoFilters.push(`fade=t=in:st=0:d=${fadeInDuration}`);
    videoFilters.push(`fade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOutDuration}`);

    // ----------------------------------------------------------------
    // Step 3: Build audio filter chain
    // ----------------------------------------------------------------
    const audioFilters = hasAudio
      ? ['loudnorm=I=-14:TP=-2:LRA=11']  // EBU R128 broadcast standard
      : [];

    // ----------------------------------------------------------------
    // Step 4: Run ffmpeg
    // ----------------------------------------------------------------
    const cmd = ffmpeg(inputPath)
      .setStartTime(start)
      .setDuration(duration)
      .videoFilters(videoFilters.join(','))
      .outputOptions([
        '-c:v libx264',
        '-preset fast',           // faster than 'slow' with near same quality
        '-crf 20',                // high quality (lower = better, 18-23 is good range)
        '-profile:v high',
        '-level 4.1',
        '-pix_fmt yuv420p',
        '-threads 0',             // auto-detect optimal thread count
        '-movflags +faststart'    // allows streaming before full download
      ]);

    if (hasAudio && audioFilters.length > 0) {
      cmd
        .audioFilters(audioFilters.join(','))
        .outputOptions(['-c:a aac', '-b:a 192k', '-ar 48000']);
    } else if (hasAudio) {
      cmd.outputOptions(['-c:a aac', '-b:a 192k', '-ar 48000']);
    } else {
      cmd.outputOptions(['-an']); // no audio
    }

    cmd
      .output(outPath)
      .on('start', (cmdLine) => console.log(`[Clipper] FFmpeg started for segment ${start}s`))
      .on('progress', (p) => {
        if (p.percent) process.stdout.write(`\r[Clipper] Encoding ${Math.round(p.percent)}%`);
      })
      .on('end', () => {
        process.stdout.write('\n');
        console.log(`[Clipper] Segment rendered: ${outPath}`);
        resolve(outPath);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('[Clipper] FFmpeg error:', err.message);
        if (stderr) console.error('[Clipper] FFmpeg stderr:', stderr.slice(-500));
        reject(err);
      })
      .run();
  });
}

/**
 * Download a YouTube video and render multiple vertical subclips.
 */
async function renderYouTubeSubclips(mainClipId, videoId, opts = {}) {
  const count       = opts.count || 5;
  const clips       = opts.clips || [];
  const isEducational = opts.isEducational || false;
  const brandName   = opts.brandName || '';
  const results     = [];

  if (!videoId) return results;

  const inputFile = path.join(tmpDir, `${mainClipId}.mp4`);

  try {
    await downloadYoutubeToFile(videoId, inputFile);

    // Probe source video details
    const { width, height, duration, hasAudio } = await ffprobeVideoDetails(inputFile);
    if (!duration || duration <= 0) throw new Error('Unable to determine video duration');

    console.log(`[Clipper] Source: ${width}x${height}, ${duration.toFixed(1)}s, audio=${hasAudio}`);

    const clipsToRender = [...clips];

    // If no AI-analysed clips provided, fall back to even time-based distribution
    if (clipsToRender.length === 0) {
      // Target 30-60s clips, spread evenly
      const idealClipLen = Math.min(55, Math.max(25, Math.floor(duration / (count * 0.7))));
      const clipLen = Math.min(idealClipLen, duration / count);
      for (let i = 0; i < count; i++) {
        const maxStart = Math.max(0, duration - clipLen - 0.5);
        const start = Math.round((maxStart * i) / Math.max(1, count - 1));
        clipsToRender.push({ start, duration: Math.floor(clipLen) });
      }
    }

    for (let i = 0; i < clipsToRender.length; i++) {
      const clipInfo = clipsToRender[i];
      const outName  = `${mainClipId}-${i + 1}.mp4`;
      const outPath  = path.join(rendersDir, outName);

      // Safety: ensure start/duration are within source bounds
      const safeStart    = Math.max(0, Math.min(clipInfo.start, duration - 5));
      const safeDuration = Math.min(clipInfo.duration, duration - safeStart);

      if (safeDuration < 3) {
        console.warn(`[Clipper] Skipping clip ${i + 1}: duration too short (${safeDuration}s)`);
        continue;
      }

      console.log(`[Clipper] Rendering clip ${i + 1}/${clipsToRender.length}: start=${safeStart}s duration=${safeDuration}s`);

      try {
        await renderSegment(inputFile, safeStart, safeDuration, outPath, {
          isEducational,
          width,
          height,
          hasAudio,
          brandName
        });
        results.push({ file: outName, url: `/renders/${outName}`, duration: safeDuration });
      } catch (e) {
        console.error(`[Clipper] Segment ${i + 1} render failed:`, e.message);
        // Continue to next clip instead of aborting all
      }
    }
  } catch (err) {
    console.error('[Clipper] render pipeline failed:', err.message);
  } finally {
    // Clean up the large source file
    try {
      if (fs.existsSync(inputFile)) {
        fs.unlinkSync(inputFile);
        console.log(`[Clipper] Cleaned up temp file: ${inputFile}`);
      }
    } catch(e) {
      console.warn('[Clipper] Failed to clean temp file:', e.message);
    }
  }

  return results;
}

module.exports = { renderYouTubeSubclips };
