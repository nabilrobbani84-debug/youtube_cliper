const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { exec, execFile } = require('child_process');
const { detectPythonBin } = require('./pythonBin');

const PYTHON_BIN = detectPythonBin();

// Ensure ffmpeg/ffprobe are configured
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

// ----------------------------------------------------------------
// Cross-platform font resolver for the ffmpeg drawtext watermark.
// Hardcoding a Windows font path caused drawtext to fail on Linux/macOS,
// which aborted the entire render. We probe common locations and cache
// the first font that exists.
// ----------------------------------------------------------------
let cachedFontFile = null;
function resolveWatermarkFont() {
  if (cachedFontFile !== null) return cachedFontFile;

  const envFont = process.env.WATERMARK_FONT_FILE;
  const candidates = [
    envFont,
    // Linux (common)
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf',
    // Noto (present on this sandbox and many modern distros)
    '/usr/share/fonts/google-noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
    // macOS
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    // Windows
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/arial.ttf'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        cachedFontFile = candidate;
        return cachedFontFile;
      }
    } catch (e) { /* ignore */ }
  }

  // Empty string => let drawtext fall back to its built-in default font.
  cachedFontFile = '';
  return cachedFontFile;
}

// Escape a path so it is safe inside an ffmpeg filter argument (drawtext).
function escapeFontPathForFilter(p) {
  if (!p) return '';
  // On Windows the drive-letter colon must be escaped for the filtergraph parser.
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

// ----------------------------------------------------------------
// Burned-in subtitles (.ass) generation
// ----------------------------------------------------------------
// Preset -> primary/emphasis colours. ASS colours are &HAABBGGRR (BGR!).
const CAPTION_PRESET_COLORS = {
  viral_neon:  { primary: '&H00FFFFFF', accent: '&H0015C0FA' }, // white + amber
  clean_cinema:{ primary: '&H00FAFAF8', accent: '&H00FAFAF8' },
  creator_pop: { primary: '&H00FFFFFF', accent: '&H007E5FFB' }, // white + rose
  custom_brand:{ primary: '&H00FFFFFF', accent: '&H0022C55E' }
};

function formatAssTime(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.round((clamped - Math.floor(clamped)) * 100);
  const safeCs = cs === 100 ? 99 : cs;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(safeCs).padStart(2, '0')}`;
}

function escapeAssText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Distribute subtitle lines across [0, clipDuration] weighted by text length,
 * then emit a styled ASS file. Emphasis words are recoloured inline.
 * Returns the written file path, or null when there is nothing to render.
 */
function buildAssFile(subtitles, clipDuration, outPath, options = {}) {
  const lines = Array.isArray(subtitles) ? subtitles.filter(Boolean) : [];
  if (lines.length === 0 || !clipDuration || clipDuration <= 0) return null;

  const preset = options.captionPreset || 'viral_neon';
  const colors = CAPTION_PRESET_COLORS[preset] || CAPTION_PRESET_COLORS.viral_neon;
  const primary = options.primaryColor || colors.primary;
  const accent = options.accentColor || colors.accent;

  // Weight each line's screen time by its character count (min weight 1).
  const weights = lines.map((l) => {
    const t = typeof l === 'string' ? l : (l && l.text) || '';
    return Math.max(1, t.trim().length);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || lines.length;

  // Video is scaled to 1080x1920, so author the ASS in that space.
  const PLAY_W = 1080;
  const PLAY_H = 1920;
  const fontSize = Math.round(PLAY_H * 0.045); // ~86px, bold social caption

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${PLAY_W}`,
    `PlayResY: ${PLAY_H}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Alignment 2 = bottom-center; MarginV lifts captions off the very bottom.
    `Style: Default,Sans,${fontSize},${primary},&H000000FF,&H00101010,&H64000000,-1,0,0,0,100,100,0,0,1,4,3,2,90,90,320,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text'
  ];

  const emphasisAll = new Set();
  lines.forEach((l) => {
    if (l && Array.isArray(l.emphasis)) {
      l.emphasis.forEach((w) => emphasisAll.add(String(w).replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase()));
    }
  });

  const events = [];
  let cursor = 0;
  lines.forEach((line, idx) => {
    const raw = typeof line === 'string' ? line : (line && line.text) || '';
    const share = (weights[idx] / totalWeight) * clipDuration;
    const start = cursor;
    const end = Math.min(clipDuration, cursor + share);
    cursor = end;

    // Recolour emphasised words inline.
    const rendered = escapeAssText(raw)
      .split(' ')
      .filter(Boolean)
      .map((word) => {
        const clean = word.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase();
        const isCaps = word === word.toUpperCase() && word.replace(/[^\p{L}]/gu, '').length > 2;
        if (emphasisAll.has(clean) || isCaps) {
          return `{\\c${accent}\\b1}${word}{\\c${primary}}`;
        }
        return word;
      })
      .join(' ');

    // Pop-in scale animation for a lively, modern caption feel.
    const anim = '{\\fad(120,120)\\t(0,180,\\fscx112\\fscy112)\\t(180,320,\\fscx100\\fscy100)}';
    events.push(
      `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${anim}${rendered}`
    );
  });

  const content = header.join('\n') + '\n' + events.join('\n') + '\n';
  fs.writeFileSync(outPath, content, 'utf8');
  return outPath;
}

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

    execFile(PYTHON_BIN, args, { timeout: 300000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
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

    execFile(PYTHON_BIN, [scriptPath, inputPath, start.toString(), duration.toString()], 
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

  const OUT_W = 1080;
  const OUT_H = 1920;
  const OUT_AR = OUT_W / OUT_H; // 0.5625 (9:16)
  const srcAR = srcWidth / srcHeight;

  return new Promise((resolve, reject) => {
    // ----------------------------------------------------------------
    // Step 1: Compute a 9:16 crop window that always fits inside the
    // source, regardless of the source aspect ratio.
    //
    //   - Landscape / square source: full height, crop width = h*9/16
    //   - Source already narrower than 9:16 (portrait phone footage):
    //     keep full width and crop the height instead so we never ask
    //     ffmpeg for a crop wider than the frame (which errors out).
    // ----------------------------------------------------------------
    let cropW;
    let cropH;
    let cropX;
    let cropY = 0;

    if (srcAR >= OUT_AR) {
      // Wide enough — crop horizontally, keep full height.
      cropH = srcHeight;
      cropW = Math.round(srcHeight * OUT_AR);
      cropW = Math.min(cropW, srcWidth);
      // Even dimensions keep libx264 happy.
      if (cropW % 2 !== 0) cropW -= 1;

      // Default to a centered crop.
      cropX = Math.round((srcWidth - cropW) / 2);

      // Face-aware reframe with clamping.
      if (reframe && typeof reframe.crop_x === 'number' && Number.isFinite(reframe.crop_x)) {
        cropX = Math.round(reframe.crop_x);
      }
      cropX = Math.max(0, Math.min(cropX, srcWidth - cropW));
    } else {
      // Taller than 9:16 — crop vertically, keep full width.
      cropW = srcWidth;
      cropH = Math.round(srcWidth / OUT_AR);
      cropH = Math.min(cropH, srcHeight);
      if (cropH % 2 !== 0) cropH -= 1;
      cropX = 0;
      // Bias slightly toward the top third where faces usually sit.
      cropY = Math.round((srcHeight - cropH) * 0.35);
      cropY = Math.max(0, Math.min(cropY, srcHeight - cropH));
    }

    // ----------------------------------------------------------------
    // Step 2: Build video filter chain
    // ----------------------------------------------------------------
    const videoFilters = [];

    // 2a. Crop to a valid 9:16 region.
    videoFilters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);

    // 2b. Scale to final output resolution (1080×1920 for 9:16 Shorts).
    videoFilters.push(`scale=${OUT_W}:${OUT_H}:flags=lanczos`);

    // 2c. Color grading — educational gets subtle, viral gets punchy.
    if (isEducational) {
      videoFilters.push(`eq=contrast=1.03:saturation=1.06:gamma=0.98:brightness=0.01`);
    } else {
      videoFilters.push(`eq=contrast=1.08:saturation=1.18:gamma=0.94:brightness=0.02`);
    }

    // 2d. Sharpen slightly for crisp output at 1080p.
    videoFilters.push(`unsharp=5:5:0.8:5:5:0.0`);

    // 2e. Optional burned-in subtitles (ASS/SRT file path supplied by caller).
    if (options.subtitlePath && fs.existsSync(options.subtitlePath)) {
      const subEsc = escapeFontPathForFilter(options.subtitlePath);
      videoFilters.push(`subtitles='${subEsc}'`);
    }

    // 2f. Watermark / brand text — cross-platform font resolution.
    const brandText = (brandName
      ? (brandName.startsWith('@') ? brandName : `@${brandName}`)
      : '@YouClip')
      // Escape characters that would break the drawtext argument.
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\u2019")
      .replace(/:/g, '\\:')
      .replace(/%/g, '\\%');

    const fontFile = resolveWatermarkFont();
    const fontArg = fontFile ? `fontfile='${escapeFontPathForFilter(fontFile)}':` : '';
    videoFilters.push(
      `drawtext=text='${brandText}':${fontArg}fontsize=40:fontcolor=white@0.82:box=1:boxcolor=black@0.28:boxborderw=10:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=48:y=h-96`
    );

    // 2g. Fade transitions.
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
        '-preset medium',         // better quality/size tradeoff than 'fast'
        '-crf 19',                // visually lossless-ish for short-form
        '-profile:v high',
        '-level 4.1',
        '-pix_fmt yuv420p',
        '-r 30',                  // consistent 30fps for social platforms
        '-g 60',                  // 2s keyframe interval — good for scrubbing/streaming
        '-threads 0',             // auto-detect optimal thread count
        '-movflags +faststart'    // allows streaming before full download
      ]);

    if (hasAudio && audioFilters.length > 0) {
      cmd
        .audioFilters(audioFilters.join(','))
        .outputOptions(['-c:a aac', '-b:a 192k', '-ar 48000', '-ac 2']);
    } else if (hasAudio) {
      cmd.outputOptions(['-c:a aac', '-b:a 192k', '-ar 48000', '-ac 2']);
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
  const captions    = opts.captions !== false; // burn-in subtitles by default
  const captionPreset = opts.captionPreset || 'viral_neon';
  // Optional pre-resolved source (direct/uploaded video) — skips YouTube download.
  const providedInput = opts.inputFile || null;
  const results     = [];

  if (!videoId && !providedInput) return results;

  const inputFile = providedInput || path.join(tmpDir, `${mainClipId}.mp4`);
  const ownsInputFile = !providedInput; // only delete files we downloaded ourselves

  try {
    if (!providedInput) {
      await downloadYoutubeToFile(videoId, inputFile);
    }

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

      // Build a per-clip burned-in subtitle track when captions are enabled.
      let subtitlePath = null;
      if (captions && clipInfo && Array.isArray(clipInfo.subtitles) && clipInfo.subtitles.length > 0) {
        try {
          const assPath = path.join(tmpDir, `${mainClipId}-${i + 1}.ass`);
          subtitlePath = buildAssFile(clipInfo.subtitles, safeDuration, assPath, {
            captionPreset,
            accentColor: clipInfo.accentColor,
            primaryColor: clipInfo.primaryColor
          });
        } catch (e) {
          console.warn(`[Clipper] Failed to build subtitles for clip ${i + 1}:`, e.message);
          subtitlePath = null;
        }
      }

      try {
        await renderSegment(inputFile, safeStart, safeDuration, outPath, {
          isEducational,
          width,
          height,
          hasAudio,
          brandName,
          subtitlePath
        });
        results.push({ file: outName, url: `/renders/${outName}`, duration: safeDuration });
      } catch (e) {
        console.error(`[Clipper] Segment ${i + 1} render failed:`, e.message);
        // Continue to next clip instead of aborting all
      } finally {
        // Remove the temporary .ass file.
        if (subtitlePath) {
          try { if (fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath); } catch (e) { /* ignore */ }
        }
      }
    }
  } catch (err) {
    console.error('[Clipper] render pipeline failed:', err.message);
  } finally {
    // Clean up the large source file (only if we downloaded it ourselves).
    if (ownsInputFile) {
      try {
        if (fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
          console.log(`[Clipper] Cleaned up temp file: ${inputFile}`);
        }
      } catch (e) {
        console.warn('[Clipper] Failed to clean temp file:', e.message);
      }
    }
  }

  return results;
}

/**
 * Download a direct (non-YouTube) video URL to a temp file using ffmpeg,
 * then run the same subclip render pipeline. Supports uploaded assets and
 * any http(s) media URL. Local file paths are used in place directly.
 */
function downloadDirectVideoToFile(sourceUrl, outPath) {
  return new Promise((resolve, reject) => {
    // Already a local file on disk — use as-is.
    if (!/^https?:\/\//i.test(sourceUrl)) {
      if (fs.existsSync(sourceUrl)) return resolve(sourceUrl);
      return reject(new Error(`Local source file not found: ${sourceUrl}`));
    }

    console.log(`[Clipper] Fetching direct video: ${sourceUrl}`);
    ffmpeg(sourceUrl)
      .outputOptions(['-c copy']) // fast remux; no re-encode of the master
      .output(outPath)
      .on('end', () => resolve(outPath))
      .on('error', (err) => {
        // Some sources can't be stream-copied; retry with a re-encode.
        console.warn('[Clipper] Direct copy failed, retrying with re-encode:', err.message);
        ffmpeg(sourceUrl)
          .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 20', '-c:a aac'])
          .output(outPath)
          .on('end', () => resolve(outPath))
          .on('error', (err2) => reject(err2))
          .run();
      })
      .run();
  });
}

/**
 * Render vertical subclips from a direct/uploaded video source URL (not
 * a YouTube ID). Mirrors renderYouTubeSubclips but skips yt-dlp.
 */
async function renderDirectSubclips(mainClipId, sourceUrl, opts = {}) {
  const results = [];
  if (!sourceUrl) return results;

  const isRemote = /^https?:\/\//i.test(sourceUrl);
  const inputFile = isRemote ? path.join(tmpDir, `${mainClipId}-src.mp4`) : sourceUrl;

  try {
    if (isRemote) {
      await downloadDirectVideoToFile(sourceUrl, inputFile);
    } else if (!fs.existsSync(inputFile)) {
      throw new Error(`Source file not found: ${inputFile}`);
    }

    // Reuse the shared pipeline by passing the resolved local file.
    const rendered = await renderYouTubeSubclips(mainClipId, null, {
      ...opts,
      inputFile
    });
    results.push(...rendered);
  } catch (err) {
    console.error('[Clipper] direct render pipeline failed:', err.message);
  } finally {
    if (isRemote) {
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
      } catch (e) { /* ignore */ }
    }
  }

  return results;
}

module.exports = { renderYouTubeSubclips, renderDirectSubclips };
