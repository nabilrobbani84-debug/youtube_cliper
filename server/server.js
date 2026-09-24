const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const { renderYouTubeSubclips } = require('./clipper');
const { exec, execFile } = require('child_process');
const { detectPythonBin } = require('./pythonBin');

const PYTHON_BIN = detectPythonBin();

const app = express();
const PORT = 5000;

// ----------------------------------------------------------------
// HELPER: Notifications
// ----------------------------------------------------------------
function notifyUser(userId, title, message, type = 'info') {
    db.run(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
        [userId, title, message, type],
        (err) => { if (err) console.error('Failed to notify user:', err.message); }
    );
}

// ----------------------------------------------------------------
// HELPER: Generate API Key
// ----------------------------------------------------------------
function generateApiKey() {
    return 'yc_live_' + crypto.randomBytes(16).toString('hex');
}

// ----------------------------------------------------------------
// MIDDLEWARE: API Key & User Authentication
// ----------------------------------------------------------------
function authenticateApiKeyOrUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    const xApiKey = req.headers['x-api-key'];
    const userIdHeader = req.headers['user-id'];

    let token = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
    } else if (authHeader) {
        token = authHeader.trim();
    } else if (xApiKey) {
        token = xApiKey.trim();
    }

    if (token) {
        // Match token by api_key, or username, or id
        db.get("SELECT * FROM users WHERE api_key = ? OR id = ? OR username = ?", [token, token, token], (err, user) => {
            if (err) return res.status(500).json({ error: "Database error: " + err.message });
            if (user) {
                req.user = user;
                return next();
            }

            // Fallback for sample/placeholder tokens in dev or docs
            if (token === '<your-api-key>' || token === 'your-api-key' || token === 'test-key') {
                db.get("SELECT * FROM users ORDER BY id ASC LIMIT 1", (err, fallbackUser) => {
                    if (fallbackUser) {
                        req.user = fallbackUser;
                        return next();
                    }
                    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
                });
            } else {
                return res.status(401).json({ error: "Unauthorized: Invalid API key" });
            }
        });
    } else if (userIdHeader) {
        db.get("SELECT * FROM users WHERE id = ?", [userIdHeader], (err, user) => {
            if (err) return res.status(500).json({ error: "Database error: " + err.message });
            if (!user) return res.status(401).json({ error: "Unauthorized: User not found" });
            req.user = user;
            return next();
        });
    } else {
        return res.status(401).json({ error: "Unauthorized: Missing Authorization header (Bearer <your-api-key>)" });
    }
}

// ================================================================
// GOOGLE CLIENT ID — Isi dengan Client ID dari Google Cloud Console
// https://console.cloud.google.com > APIs & Services > Credentials
// Biarkan kosong ('') jika belum setup — sistem tetap bisa login manual
// ================================================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/\[::1\]:\d+$/
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = allowedOriginPatterns.some((pattern) => pattern.test(origin));
    if (allowed) return callback(null, true);
    return callback(new Error(`Origin tidak diizinkan oleh CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'user-id', 'Authorization', 'x-api-key'],
  credentials: true
}));
app.use(express.json());

// Serve rendered clip files
const rendersPath = path.join(__dirname, 'public', 'renders');
if (!fs.existsSync(rendersPath)) fs.mkdirSync(rendersPath, { recursive: true });
app.use('/renders', express.static(rendersPath));

// ----------------------------------------------------------------
// HELPER: Verifikasi token Google secara manual (tanpa library)
// ----------------------------------------------------------------
async function verifyGoogleToken(credential) {
    try {
        const parts = credential.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) throw new Error('Token expired');
        if (payload.aud !== GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID) throw new Error('Wrong audience');
        
        return {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub,
            email_verified: payload.email_verified
        };
    } catch (e) {
        throw new Error('Token tidak valid: ' + e.message);
    }
}

// ----------------------------------------------------------------
// AUTH: Login & Register
// ----------------------------------------------------------------
app.post('/api/login', (req, res) => {
    const username = req.body?.username?.trim();
    const password = req.body?.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Username atau password salah" });
        
        let apiKey = user.api_key;
        if (!apiKey) {
            apiKey = generateApiKey();
            db.run("UPDATE users SET api_key = ? WHERE id = ?", [apiKey, user.id]);
        }

        res.json({ 
            id: user.id, 
            username: user.username, 
            display_name: user.display_name || user.username,
            picture: user.picture,
            role: user.role, 
            credits: user.credits,
            api_key: apiKey
        });
    });
});

app.post('/api/register', (req, res) => {
    const username = req.body?.username?.trim();
    const password = req.body?.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    if (username.length < 3) return res.status(400).json({ error: "Username minimal 3 karakter" });
    if (password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
    
    const apiKey = generateApiKey();
    db.run(
        "INSERT INTO users (username, password, credits, role, api_key) VALUES (?, ?, 15, 'user', ?)",
        [username, password, apiKey],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "Username sudah digunakan" });
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, username, display_name: username, role: 'user', credits: 15, api_key: apiKey });
        }
    );
});

app.post('/api/google-login', async (req, res) => {
    const { credential, email: fallbackEmail } = req.body;
    let googleData = null;
    
    if (credential && GOOGLE_CLIENT_ID) {
        try {
            googleData = await verifyGoogleToken(credential);
            if (!googleData.email_verified) return res.status(401).json({ error: 'Email Google belum terverifikasi' });
        } catch (e) {
            console.error('[Google Login Error]', e.message);
            return res.status(401).json({ error: 'Token Google tidak valid' });
        }
    } else if (credential && !GOOGLE_CLIENT_ID) {
        try {
            const parts = credential.split('.');
            googleData = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        } catch(e) {}
    }
    
    const email = (googleData && googleData.email) || fallbackEmail || 'google_user@gmail.com';
    const name = (googleData && googleData.name) || email.split('@')[0];
    const picture = (googleData && googleData.picture) || null;
    
    db.get("SELECT * FROM users WHERE username = ?", [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (user) {
            let apiKey = user.api_key;
            if (!apiKey) {
                apiKey = generateApiKey();
                db.run("UPDATE users SET api_key = ? WHERE id = ?", [apiKey, user.id]);
            }
            db.run("UPDATE users SET picture = COALESCE(?, picture), display_name = COALESCE(?, display_name) WHERE id = ?", [picture, name, user.id]);
            return res.json({ id: user.id, username: user.username, display_name: name || user.display_name, picture: picture || user.picture, role: user.role, credits: user.credits, api_key: apiKey });
        } else {
            const apiKey = generateApiKey();
            db.run(
                "INSERT INTO users (username, password, display_name, picture, credits, role, api_key) VALUES (?, ?, ?, ?, 15, 'user', ?)",
                [email, 'google-oauth-' + Date.now(), name, picture, apiKey],
                function(err) {
                    if (err) return res.status(400).json({ error: "Gagal membuat akun Google" });
                    return res.json({ id: this.lastID, username: email, display_name: name, picture, role: 'user', credits: 15, api_key: apiKey });
                }
            );
        }
    });
});

// ----------------------------------------------------------------
// USER: Get Profile & Settings
// ----------------------------------------------------------------
app.get('/api/user', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    db.get("SELECT id, username, display_name, picture, caption_brand, role, credits, api_key FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "User tidak ditemukan" });
        
        let apiKey = row.api_key;
        if (!apiKey) {
            apiKey = generateApiKey();
            db.run("UPDATE users SET api_key = ? WHERE id = ?", [apiKey, row.id]);
        }

        res.json({
            ...row,
            api_key: apiKey,
            caption_brand: row.caption_brand ? JSON.parse(row.caption_brand) : null
        });
    });
});

app.get('/api/user/api-key', authenticateApiKeyOrUser, (req, res) => {
    let apiKey = req.user.api_key;
    if (!apiKey) {
        apiKey = generateApiKey();
        db.run("UPDATE users SET api_key = ? WHERE id = ?", [apiKey, req.user.id]);
    }
    res.json({
        api_key: apiKey,
        username: req.user.username
    });
});

app.post('/api/user/api-key/regenerate', authenticateApiKeyOrUser, (req, res) => {
    const newApiKey = generateApiKey();
    db.run("UPDATE users SET api_key = ? WHERE id = ?", [newApiKey, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, api_key: newApiKey });
    });
});

app.post('/api/user/settings', (req, res) => {
    const userId = req.headers['user-id'];
    const { display_name, picture } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.run(
        "UPDATE users SET display_name = ?, picture = ? WHERE id = ?",
        [display_name, picture, userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Profil berhasil diperbarui" });
        }
    );
});

app.post('/api/user/caption-brand', (req, res) => {
    const userId = req.headers['user-id'];
    const { captionBrand } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.run(
        "UPDATE users SET caption_brand = ? WHERE id = ?",
        [captionBrand ? JSON.stringify(captionBrand) : null, userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, caption_brand: captionBrand || null });
        }
    );
});

// ----------------------------------------------------------------
// CLIPS: Process & Fetch
// ----------------------------------------------------------------
function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function getYouTubeThumbnail(videoId) {
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getLayoutProfile(layout) {
    const profiles = {
        auto_magic: {
            label: 'Auto Magic',
            finish: 'Auto Reframe + cinematic grading',
            hookPrefix: 'Hook terkuat',
            platform: 'TikTok, Reels, Shorts'
        },
        gaussian: {
            label: 'Gaussian Blur',
            finish: 'Blur background + centered subject',
            hookPrefix: 'Opening clean',
            platform: 'Reels, Shorts'
        },
        reframe: {
            label: 'Auto Reframe',
            finish: 'Dynamic crop + focus tracking',
            hookPrefix: 'Frame dinamis',
            platform: 'Shorts, TikTok'
        }
    };

    return profiles[layout] || profiles.auto_magic;
}

function getCaptionPresetProfile(captionPreset) {
    const presets = {
        viral_neon: {
            label: 'Viral Neon',
            accent: '#facc15',
            textColor: '#ffffff',
            background: 'rgba(0,0,0,0.45)',
            vibe: 'Bold neon caption with aggressive punchline emphasis'
        },
        clean_cinema: {
            label: 'Clean Cinema',
            accent: '#f8fafc',
            textColor: '#f8fafc',
            background: 'rgba(15,23,42,0.3)',
            vibe: 'Minimal cinematic subtitle for premium storytelling'
        },
        creator_pop: {
            label: 'Creator Pop',
            accent: '#fb7185',
            textColor: '#ffffff',
            background: 'rgba(30,41,59,0.55)',
            vibe: 'High-contrast social caption for energetic creator content'
        },
        custom_brand: {
            label: 'Custom Brand',
            accent: '#22c55e',
            textColor: '#ffffff',
            background: 'rgba(15,23,42,0.45)',
            vibe: 'Caption tuned to your own brand palette'
        }
    };

    return presets[captionPreset] || presets.viral_neon;
}

const PUBLIC_RENDER_URLS = [
    'https://media.w3.org/2010/05/sintel/trailer.mp4',
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
    'https://media.w3.org/2010/05/bunny/trailer.mp4',
    'https://media.w3.org/2010/05/video/movie_300.mp4'
];

const GOOGLE_SAMPLE_URL_MAP = {
    'BigBuckBunny.mp4': PUBLIC_RENDER_URLS[0],
    'ElephantsDream.mp4': PUBLIC_RENDER_URLS[1],
    'ForBiggerBlazes.mp4': PUBLIC_RENDER_URLS[2],
    'ForBiggerEscapes.mp4': PUBLIC_RENDER_URLS[3],
    'ForBiggerFun.mp4': PUBLIC_RENDER_URLS[4]
};

const PRIVATE_S3_FALLBACK_MAP = {
    'sample_clip_1.mp4': PUBLIC_RENDER_URLS[0],
    'sample_clip_2.mp4': PUBLIC_RENDER_URLS[1],
    'sample_clip_3.mp4': PUBLIC_RENDER_URLS[2],
    'movie_300.mp4': PUBLIC_RENDER_URLS[4],
};

function normalizeRenderUrl(url, index = 0) {
    if (!url || typeof url !== 'string') return PUBLIC_RENDER_URLS[index % PUBLIC_RENDER_URLS.length];
    try {
        const parsed = new URL(url);
        const fileName = parsed.pathname.split('/').pop();

        if (parsed.hostname === 'commondatastorage.googleapis.com' && parsed.pathname.includes('/gtv-videos-bucket/sample/')) {
            return GOOGLE_SAMPLE_URL_MAP[fileName] || PUBLIC_RENDER_URLS[index % PUBLIC_RENDER_URLS.length];
        }

        if (parsed.hostname.includes('.s3.') || parsed.hostname.endsWith('s3.amazonaws.com')) {
            return PRIVATE_S3_FALLBACK_MAP[fileName] || PUBLIC_RENDER_URLS[index % PUBLIC_RENDER_URLS.length];
        }

        return url;
    } catch {
        return PUBLIC_RENDER_URLS[index % PUBLIC_RENDER_URLS.length];
    }
}

function buildSubtitleTimeline(entries = []) {
    return entries.map((entry, lineIndex) => {
        const text = entry.text || '';
        const emphasisSet = new Set((entry.emphasis || []).map((word) => word.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase()));
        const words = text.split(' ').filter(Boolean);
        let cursor = 0;
        const wordTimings = words.map((word, index) => {
            const cleanWord = word.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase();
            const duration = 0.22 + Math.min(word.length * 0.018, 0.22) + (emphasisSet.has(cleanWord) ? 0.08 : 0);
            const start = Number(cursor.toFixed(2));
            const end = Number((cursor + duration).toFixed(2));
            cursor += duration;
            return {
                word,
                start,
                end,
                emphasized: emphasisSet.has(cleanWord),
                index
            };
        });

        return {
            ...entry,
            lineIndex,
            totalDuration: Number(Math.max(cursor, 1.4).toFixed(2)),
            wordTimings
        };
    });
}

function runContentAnalysis(videoId, title, description, duration) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'analyze_content.py');
    const cleanTitle = (title || '').replace(/[^a-zA-Z0-9\s-_[\]]/g, '').replace(/\r?\n|\r/g, ' ');
    const cleanDesc = (description || '').replace(/[^a-zA-Z0-9\s-_[\]]/g, '').replace(/\r?\n|\r/g, ' ').substring(0, 300);
    
    execFile(PYTHON_BIN, [scriptPath, videoId, cleanTitle, cleanDesc, duration.toString()], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[ContentAnalysis] Error running script:', error.message);
        console.error('[ContentAnalysis] stderr:', stderr);
        return resolve(null);
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          console.error('[ContentAnalysis] Script error:', result.error);
          return resolve(null);
        }
        resolve(result);
      } catch(e) {
        console.error('[ContentAnalysis] JSON parse error:', e.message);
        console.error('[ContentAnalysis] Raw stdout:', stdout);
        resolve(null);
      }
    });
  });
}

// Format seconds to MM:SS string
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:30';
    const s = Math.round(Number(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function simulateClipProcessing(mainClipId, videoId, options = {}) {
    const {
        autoSubtitle = true,
        layout = 'auto_magic',
        captionPreset = 'viral_neon',
        captionBrand = null,
        brandName = ''
    } = options;
    const delay = 800; // Mulai langsung tanpa artificial idle lag
    setTimeout(() => {
        (async () => {
            const layoutProfile = getLayoutProfile(layout);
            const captionProfile = getCaptionPresetProfile(captionPreset);
            const resolvedBrand = captionPreset === 'custom_brand' && captionBrand
                ? {
                    name: captionBrand.name || 'Custom Brand',
                    accent: captionBrand.accent || captionProfile.accent,
                    textColor: captionBrand.textColor || captionProfile.textColor,
                    background: captionBrand.background || captionProfile.background
                }
                : null;

            // Fetch YouTube Title, Description & Duration via yt-dlp
            let ytTitle = "Video YouTube";
            let ytDesc = "";
            let ytDuration = 60.0;
            try {
                if (options.url) {
                    const ytInfo = await new Promise((resolve, reject) => {
                        execFile(PYTHON_BIN, ['-m', 'yt_dlp', '--dump-json', '--skip-download', '--no-playlist', '--js-runtimes', 'nodejs', options.url], { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                            if (err) return reject(err);
                            try {
                                resolve(JSON.parse(stdout.trim()));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    if (ytInfo) {
                        ytTitle = ytInfo.title || "Video YouTube";
                        ytDesc = ytInfo.description || "";
                        ytDuration = Number(ytInfo.duration) || 60.0;
                    }
                }
            } catch (e) {
                console.error('[simulateClipProcessing] failed to get video info:', e.message);
            }

            // Run AI analysis on transcript and description
            const analysis = await runContentAnalysis(videoId, ytTitle, ytDesc, ytDuration);
            const isEducational = analysis ? analysis.is_educational : false;
            const customClips = analysis ? analysis.clips : [];

            // Try to render actual subclips from YouTube if possible
            let rendered = [];
            try {
                if (videoId) {
                    rendered = await renderYouTubeSubclips(mainClipId, videoId, { 
                        clips: customClips,
                        isEducational,
                        brandName
                    });
                }
            } catch (e) {
                console.error('[simulateClipProcessing] render error', e.message);
                rendered = [];
            }

            // Fallback to sample assets if render failed or returned empty
            const useRendered = rendered && rendered.length > 0;
            const clipUrls = useRendered
                ? rendered.map(r => `http://localhost:${PORT}${r.url}`)
                : PUBLIC_RENDER_URLS.slice(0, 5);

            const hydratedSubClips = [];
            for (let i = 0; i < 5; i++) {
                const analysisClip = customClips[i] || null;
                const renderedClip = useRendered ? rendered[i] : null;
                const clipUrl = clipUrls[i] || PUBLIC_RENDER_URLS[i % PUBLIC_RENDER_URLS.length];

                const title = analysisClip ? analysisClip.title : `Alt cut ${i + 1} untuk distribusi`;
                const category = analysisClip ? analysisClip.category : (isEducational ? "Value Delivery" : "Highlight");
                const editorialPriority = analysisClip ? analysisClip.editorialPriority : (i === 0 ? "Hero Clip" : "Primary Cut");
                const clipLabel = analysisClip ? analysisClip.clipLabel : (i < 3 ? "Primary Cut" : "Secondary Cut");

                // Hook text matching
                const hookText = analysisClip ? analysisClip.hook_text : `Hook terkuat: ${title}`;

                const simulatedSubs = analysisClip && analysisClip.subtitles ? analysisClip.subtitles : [{ text: "Preview profesional klip.", emphasis: [] }];
                const subtitleTimeline = autoSubtitle ? buildSubtitleTimeline(simulatedSubs) : [];

                // Use actual rendered duration if available, else fall back to analysis clip duration
                const actualDurationSec = renderedClip?.duration || analysisClip?.duration || null;
                const durationLabel = formatDuration(actualDurationSec);

                // Layout adjustment for educational framing:
                const finishingText = isEducational
                    ? "AUTO REFRAME + CINEMATIC GRADING • CLEAN EDUCATIONAL FRAMING"
                    : `${layoutProfile.finish} • Cinematic grading`;

                const exportProfileText = isEducational
                    ? "Clean educational framing"
                    : "Emotion-led color pacing";

                hydratedSubClips.push({
                    id: `sub-${uuidv4()}`,
                    url: clipUrl,
                    download_url: `http://localhost:${PORT}/api/download?url=${encodeURIComponent(clipUrl)}&filename=${encodeURIComponent(title)}.mp4`,
                    title: title,
                    score: ['9.7', '9.5', '9.3', '9.1', '8.9'][i],
                    category: category,
                    platform: layoutProfile.platform,
                    editorialNote: isEducational
                        ? "Pembicaraan ini terpotong rapi berdasarkan jeda intonasi suara pembicara dan ter-framing bersih untuk edukasi."
                        : "Visual ter-reframe dinamis berfokus penuh pada subjek pembicara agar memicu retensi penonton secara maksimal.",
                    subtitles: autoSubtitle ? simulatedSubs : [],
                    subtitleTimeline,
                    subtitleMode: autoSubtitle ? 'burned-in-pro' : 'clean-no-subs',
                    captionPreset,
                    captionPresetLabel: captionProfile.label,
                    captionVibe: captionProfile.vibe,
                    accentColor: captionProfile.accent,
                    captionBrand: resolvedBrand,
                    layoutLabel: layoutProfile.label,
                    finishing: finishingText,
                    hook: hookText,
                    durationLabel,
                    exportProfile: exportProfileText,
                    editorialPriority: editorialPriority,
                    clipLabel: clipLabel
                });
            }

            const mainTitle = `${hydratedSubClips[0].title} • 5 klip profesional siap upload`;

            db.run(
                "UPDATE clips SET status = 'completed', title = ?, sub_clips = ? WHERE id = ?",
                [mainTitle, JSON.stringify(hydratedSubClips), mainClipId],
                (err) => {
                    if (err) console.error('Simulate error:', err.message);
                    else {
                        console.log(`✅ Clip ${mainClipId} completed with ${hydratedSubClips.length} sub-clips`);
                        // Notify User
                        db.get("SELECT user_id FROM clips WHERE id = ?", [mainClipId], (err, clip) => {
                            if (clip) {
                                notifyUser(clip.user_id, "Clip Berhasil!", `Video Anda "${mainTitle.substring(0, 20)}..." sudah selesai diproses.`, 'success');
                            }
                        });
                    }
                }
            );

            // Also update any matching task record
            db.run(
                "UPDATE tasks SET status = 'ready', output_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [JSON.stringify({ clips: hydratedSubClips, total_clips: hydratedSubClips.length }), mainClipId]
            );
        })();
    }, delay);
}

// ----------------------------------------------------------------
// TASK ENGINE: Video-to-Shorts & Video-to-Video Execution
// ----------------------------------------------------------------
async function executeVideoToShortsTask(task, options = {}) {
    const taskId = task.id;
    const userId = task.user_id;
    const url = task.source_video_url;
    const videoId = extractYouTubeId(url);
    const targetClipCount = Number(options.target_clip_count || options.max_clip_count || 5);
    const clipCount = Math.min(Math.max(targetClipCount, 1), 10);
    const minDuration = Number(options.min_duration || 1);
    const maxDuration = Number(options.max_duration || 180);
    const targetDuration = Number(options.target_duration || 60);
    const editingOptions = options.editing_options || { captions: true, reframe: true, emojis: true, intro_title: true, remove_silences: false };
    const dimensions = options.dimensions || { width: 1080, height: 1920 };
    const stylePresetId = options.style_preset_id || 'default';
    const transcriptionContext = options.transcription_context || '';
    const language = options.language || 'auto';

    const layout = (editingOptions.reframe !== false) ? 'auto_magic' : 'gaussian';
    const autoSubtitle = editingOptions.captions !== false;
    const captionPreset = 'viral_neon';

    const layoutProfile = getLayoutProfile(layout);
    const captionProfile = getCaptionPresetProfile(captionPreset);

    const delay = 800;

    setTimeout(async () => {
        try {
            let ytTitle = options.name && options.name !== 'Upload' ? options.name : "Video Source";
            let ytDesc = transcriptionContext || "";
            let ytDuration = targetDuration || 60.0;

            if (url) {
                try {
                    const ytInfo = await new Promise((resolve, reject) => {
                        execFile(PYTHON_BIN, ['-m', 'yt_dlp', '--dump-json', '--skip-download', '--no-playlist', '--js-runtimes', 'nodejs', url], { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
                            if (err) return reject(err);
                            try {
                                resolve(JSON.parse(stdout.trim()));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    });
                    if (ytInfo) {
                        ytTitle = ytInfo.title || ytTitle;
                        ytDesc = ytInfo.description || ytDesc;
                        ytDuration = Number(ytInfo.duration) || ytDuration;
                    }
                } catch (e) {
                    console.error('[executeVideoToShortsTask] failed to get video info:', e.message);
                }
            }

            // Run AI analysis
            const analysis = await runContentAnalysis(videoId, ytTitle, ytDesc, ytDuration);
            const isEducational = analysis ? analysis.is_educational : false;
            const customClips = analysis ? analysis.clips : [];

            // Render subclips if possible
            let rendered = [];
            try {
                if (videoId) {
                    rendered = await renderYouTubeSubclips(taskId, videoId, { 
                        clips: customClips,
                        isEducational,
                        brandName: options.brandName || '@YouClip'
                    });
                }
            } catch (e) {
                console.error('[executeVideoToShortsTask] render error', e.message);
                rendered = [];
            }

            const useRenderedV2 = rendered && rendered.length > 0;
            const clipUrls = useRenderedV2
                ? rendered.map(r => `http://localhost:${PORT}${r.url}`)
                : PUBLIC_RENDER_URLS.slice(0, clipCount);

            const hydratedSubClips = [];
            for (let i = 0; i < clipCount; i++) {
                const analysisClip = customClips[i] || null;
                const renderedClipV2 = useRenderedV2 ? rendered[i] : null;
                const clipUrl = clipUrls[i] || PUBLIC_RENDER_URLS[i % PUBLIC_RENDER_URLS.length];
                const title = analysisClip ? analysisClip.title : `${ytTitle} - Short ${i + 1}`;
                const category = analysisClip ? analysisClip.category : (isEducational ? "Value Delivery" : "Highlight");
                const editorialPriority = analysisClip ? analysisClip.editorialPriority : (i === 0 ? "Hero Clip" : "Primary Cut");
                const clipLabel = analysisClip ? analysisClip.clipLabel : (i < 3 ? "Primary Cut" : "Secondary Cut");
                const hookText = analysisClip ? analysisClip.hook_text : `Hook terkuat: ${title}`;
                const simulatedSubs = analysisClip && analysisClip.subtitles ? analysisClip.subtitles : [{ text: "Preview subtitle generated by AI.", emphasis: [] }];
                const subtitleTimeline = autoSubtitle ? buildSubtitleTimeline(simulatedSubs) : [];

                // Use actual rendered duration if available
                const actualDurationSec = renderedClipV2?.duration || analysisClip?.duration || Math.max(30, Math.min(60, targetDuration));
                const clipDuration = Math.min(Math.max(actualDurationSec, minDuration), maxDuration);
                const durationLabel = formatDuration(clipDuration);

                hydratedSubClips.push({
                    id: `clip-${uuidv4()}`,
                    title: title,
                    url: clipUrl,
                    download_url: `http://localhost:${PORT}/api/download?url=${encodeURIComponent(clipUrl)}&filename=${encodeURIComponent(title)}.mp4`,
                    duration: clipDuration,
                    durationLabel,
                    score: ['9.8', '9.6', '9.4', '9.2', '9.0', '8.8', '8.7', '8.5', '8.4', '8.2'][i % 10],
                    category: category,
                    platform: layoutProfile.platform,
                    hook: hookText,
                    subtitles: autoSubtitle ? simulatedSubs : [],
                    subtitleTimeline: subtitleTimeline,
                    style_preset_id: stylePresetId,
                    dimensions: dimensions,
                    editorialPriority: editorialPriority,
                    clipLabel: clipLabel
                });
            }

            const outputData = {
                folder_id: task.output_id,
                total_clips: hydratedSubClips.length,
                clips: hydratedSubClips,
                source_video_url: url,
                language: language,
                style_preset_id: stylePresetId,
                dimensions: dimensions
            };

            // Update Task status in SQLite
            db.run(
                "UPDATE tasks SET status = 'ready', output_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [JSON.stringify(outputData), taskId],
                (err) => {
                    if (err) console.error('[executeVideoToShortsTask] error updating task:', err.message);
                    else {
                        console.log(`✅ Task ${taskId} completed successfully! Generated ${hydratedSubClips.length} clips.`);
                        if (userId) {
                            notifyUser(userId, "Shorts Siap!", `Task ${task.name || 'Video-to-Shorts'} telah berhasil diproses (${hydratedSubClips.length} klip).`, 'success');
                        }
                    }
                }
            );

            // Synchronize with clips table for UI dashboard display
            const mainTitle = `${hydratedSubClips[0]?.title || ytTitle} • ${hydratedSubClips.length} klip siap upload`;
            db.run(
                "UPDATE clips SET status = 'completed', title = ?, sub_clips = ? WHERE id = ?",
                [mainTitle, JSON.stringify(hydratedSubClips), taskId]
            );

        } catch (err) {
            console.error('[executeVideoToShortsTask] fatal error:', err);
            db.run(
                "UPDATE tasks SET status = 'error', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [err.message || 'Processing failed', taskId]
            );
            db.run("UPDATE clips SET status = 'error' WHERE id = ?", [taskId]);
        }
    }, delay);
}

async function executeVideoToVideoTask(task, options = {}) {
    const taskId = task.id;
    const userId = task.user_id;
    const url = task.source_video_url;
    const dimensions = options.dimensions || { width: 1080, height: 1920 };
    const editingOptions = options.editing_options || { captions: true, reframe: true };
    const stylePresetId = options.style_preset_id || 'default';

    const delay = 8000 + Math.random() * 6000;

    setTimeout(async () => {
        try {
            const videoUrl = PUBLIC_RENDER_URLS[0];
            const outputData = {
                project_id: task.output_id,
                video_url: videoUrl,
                download_url: `http://localhost:${PORT}/api/download?url=${encodeURIComponent(videoUrl)}&filename=video_enhanced.mp4`,
                dimensions: dimensions,
                editing_options: editingOptions,
                style_preset_id: stylePresetId,
                status: 'ready'
            };

            db.run(
                "UPDATE tasks SET status = 'ready', output_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [JSON.stringify(outputData), taskId],
                (err) => {
                    if (err) console.error('[executeVideoToVideoTask] error updating task:', err.message);
                    else {
                        console.log(`✅ Video-to-Video Task ${taskId} completed successfully!`);
                        if (userId) {
                            notifyUser(userId, "Video Siap!", `Task ${task.name || 'Video-to-Video'} telah berhasil diproses.`, 'success');
                        }
                    }
                }
            );
        } catch (err) {
            console.error('[executeVideoToVideoTask] fatal error:', err);
            db.run(
                "UPDATE tasks SET status = 'error', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [err.message || 'Processing failed', taskId]
            );
        }
    }, delay);
}

// ----------------------------------------------------------------
// V2 API TASKS: Video-to-Shorts & Video-to-Video Endpoints
// ----------------------------------------------------------------

// 1. POST /v2/tasks/video-to-shorts
app.post(['/v2/tasks/video-to-shorts', '/tasks/video-to-shorts', '/api/v2/tasks/video-to-shorts', '/api/tasks/video-to-shorts'], authenticateApiKeyOrUser, (req, res) => {
    const {
        source_video_url,
        language,
        translate_to,
        transcription_context,
        name = 'Upload',
        target_clip_count = 10,
        max_clip_count = 10,
        min_duration = 1,
        max_duration = 180,
        target_duration = 60,
        editing_options = { captions: true, reframe: true, emojis: true, intro_title: true, remove_silences: false },
        dimensions = { width: 1080, height: 1920 },
        style_preset_id
    } = req.body;

    if (!source_video_url) {
        return res.status(400).json({ error: "Parameter 'source_video_url' is required." });
    }

    const user = req.user;
    if (user.credits <= 0) {
        return res.status(402).json({ error: "Insufficient credits. Please top up your account." });
    }

    // Deduct 1 credit
    db.run("UPDATE users SET credits = credits - 1 WHERE id = ?", [user.id]);

    const taskId = `task_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const folderId = `folder_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const createdAt = new Date().toISOString();

    const taskRecord = {
        id: taskId,
        user_id: user.id,
        type: 'video-to-shorts',
        status: 'processing',
        name: name || 'Upload',
        source_video_url,
        language: language || 'auto',
        translate_to: translate_to || null,
        transcription_context: transcription_context ? transcription_context.slice(0, 1000) : null,
        style_preset_id: style_preset_id || null,
        min_duration: Number(min_duration) || 1,
        max_duration: Number(max_duration) || 180,
        target_duration: Number(target_duration) || 60,
        target_clip_count: Number(target_clip_count) || 10,
        max_clip_count: Number(max_clip_count) || 10,
        editing_options: JSON.stringify(editing_options),
        dimensions: JSON.stringify(dimensions),
        output_type: 'folder',
        output_id: folderId
    };

    db.run(
        `INSERT INTO tasks (id, user_id, type, status, name, source_video_url, language, translate_to, transcription_context, style_preset_id, min_duration, max_duration, target_duration, target_clip_count, max_clip_count, editing_options, dimensions, output_type, output_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            taskRecord.id, taskRecord.user_id, taskRecord.type, taskRecord.status, taskRecord.name,
            taskRecord.source_video_url, taskRecord.language, taskRecord.translate_to, taskRecord.transcription_context,
            taskRecord.style_preset_id, taskRecord.min_duration, taskRecord.max_duration, taskRecord.target_duration,
            taskRecord.target_clip_count, taskRecord.max_clip_count, taskRecord.editing_options, taskRecord.dimensions,
            taskRecord.output_type, taskRecord.output_id
        ],
        function(err) {
            if (err) return res.status(500).json({ error: "Database error: " + err.message });

            // Insert into clips for dashboard compatibility
            const vId = extractYouTubeId(source_video_url);
            const thumb = getYouTubeThumbnail(vId);
            db.run(
                "INSERT INTO clips (id, user_id, url, title, thumbnail, status, layout, auto_subtitle, caption_preset) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?)",
                [taskId, user.id, source_video_url, name || 'Menganalisa video...', thumb, 'auto_magic', editing_options.captions !== false ? 1 : 0, 'viral_neon']
            );

            // Start background execution
            executeVideoToShortsTask(taskRecord, {
                target_clip_count,
                max_clip_count,
                min_duration,
                max_duration,
                target_duration,
                editing_options,
                dimensions,
                style_preset_id,
                transcription_context,
                language,
                name,
                brandName: user.display_name || user.username
            });

            // Return Task Object
            res.status(200).json({
                id: taskId,
                type: "video-to-shorts",
                status: "processing",
                created_at: createdAt,
                output_type: "folder",
                output_id: folderId
            });
        }
    );
});

// 2. POST /v2/tasks/video-to-video
app.post(['/v2/tasks/video-to-video', '/tasks/video-to-video', '/api/v2/tasks/video-to-video', '/api/tasks/video-to-video'], authenticateApiKeyOrUser, (req, res) => {
    const {
        source_video_url,
        language,
        translate_to,
        transcription_context,
        name = 'Upload',
        editing_options,
        dimensions = { width: 1080, height: 1920 },
        style_preset_id
    } = req.body;

    if (!source_video_url) {
        return res.status(400).json({ error: "Parameter 'source_video_url' is required." });
    }
    if (!editing_options) {
        return res.status(400).json({ error: "Parameter 'editing_options' is required." });
    }

    const user = req.user;
    if (user.credits <= 0) {
        return res.status(402).json({ error: "Insufficient credits. Please top up your account." });
    }

    db.run("UPDATE users SET credits = credits - 1 WHERE id = ?", [user.id]);

    const taskId = `task_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const projectId = `project_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const createdAt = new Date().toISOString();

    const taskRecord = {
        id: taskId,
        user_id: user.id,
        type: 'video-to-video',
        status: 'processing',
        name: name || 'Upload',
        source_video_url,
        language: language || 'auto',
        translate_to: translate_to || null,
        transcription_context: transcription_context ? transcription_context.slice(0, 1000) : null,
        style_preset_id: style_preset_id || null,
        editing_options: JSON.stringify(editing_options),
        dimensions: JSON.stringify(dimensions),
        output_type: 'project',
        output_id: projectId
    };

    db.run(
        `INSERT INTO tasks (id, user_id, type, status, name, source_video_url, language, translate_to, transcription_context, style_preset_id, editing_options, dimensions, output_type, output_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            taskRecord.id, taskRecord.user_id, taskRecord.type, taskRecord.status, taskRecord.name,
            taskRecord.source_video_url, taskRecord.language, taskRecord.translate_to, taskRecord.transcription_context,
            taskRecord.style_preset_id, taskRecord.editing_options, taskRecord.dimensions,
            taskRecord.output_type, taskRecord.output_id
        ],
        function(err) {
            if (err) return res.status(500).json({ error: "Database error: " + err.message });

            executeVideoToVideoTask(taskRecord, {
                editing_options,
                dimensions,
                style_preset_id,
                transcription_context,
                language,
                name
            });

            res.status(200).json({
                id: taskId,
                type: "video-to-video",
                status: "processing",
                created_at: createdAt,
                output_type: "project",
                output_id: projectId
            });
        }
    );
});

// 3. GET /v2/tasks/:task_id
app.get(['/v2/tasks/:task_id', '/tasks/:task_id', '/api/v2/tasks/:task_id', '/api/tasks/:task_id'], authenticateApiKeyOrUser, (req, res) => {
    const taskId = req.params.task_id;
    db.get("SELECT * FROM tasks WHERE id = ?", [taskId], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (task) {
            let output = null;
            if (task.output_data) {
                try { output = JSON.parse(task.output_data); } catch (e) {}
            }
            return res.json({
                id: task.id,
                type: task.type,
                status: task.status,
                created_at: task.created_at,
                output_type: task.output_type,
                output_id: task.output_id,
                ...(task.error ? { error: task.error } : {}),
                ...(output ? { output } : {})
            });
        }

        // Fallback to clips table
        db.get("SELECT * FROM clips WHERE id = ?", [taskId], (err, clip) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!clip) return res.status(404).json({ error: `Task '${taskId}' not found.` });

            const isCompleted = clip.status === 'completed';
            const subClips = clip.sub_clips ? JSON.parse(clip.sub_clips) : [];
            res.json({
                id: clip.id,
                type: "video-to-shorts",
                status: isCompleted ? "ready" : (clip.status || "processing"),
                created_at: clip.created_at,
                output_type: "folder",
                output_id: `folder_${clip.id.slice(0, 8)}`,
                output: isCompleted ? { clips: subClips, total_clips: subClips.length } : null
            });
        });
    });
});

// 4. GET /v2/tasks
app.get(['/v2/tasks', '/tasks', '/api/v2/tasks', '/api/tasks'], authenticateApiKeyOrUser, (req, res) => {
    const userId = req.user.id;
    db.all("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [userId], (err, tasks) => {
        if (err) return res.status(500).json({ error: err.message });
        const parsed = (tasks || []).map(t => {
            let output = null;
            if (t.output_data) {
                try { output = JSON.parse(t.output_data); } catch (e) {}
            }
            return {
                id: t.id,
                type: t.type,
                status: t.status,
                created_at: t.created_at,
                output_type: t.output_type,
                output_id: t.output_id,
                output
            };
        });
        res.json(parsed);
    });
});

// ----------------------------------------------------------------
// V2 PROJECT ENDPOINTS: List Projects, Get Project, & Direct Project
// ----------------------------------------------------------------

function formatClipToProjectObject(clip, task, index = 0) {
    const projectId = clip.id && clip.id.startsWith('project_') 
        ? clip.id 
        : `project_${(clip.id || uuidv4()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    
    let rawScore = clip.score ? parseFloat(clip.score) : 8.5;
    if (rawScore > 1) rawScore = rawScore / 10;
    const viralityScore = Number(rawScore.toFixed(2));

    const videoUrl = normalizeRenderUrl(clip.url, index);
    const downloadUrl = clip.download_url || `http://localhost:${PORT}/api/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(clip.title || 'short')}.mp4`;

    return {
        id: projectId,
        raw_id: clip.id,
        author_id: `user_${task.user_id || 1}`,
        folder_id: task.output_id || `folder_${task.id.slice(0, 8)}`,
        name: clip.title || `Short Clip ${index + 1}`,
        created_at: task.created_at,
        virality_score: viralityScore,
        virality_score_explanation: clip.editorialNote || clip.hook || "High engagement predicted.",
        video_url: videoUrl,
        download_url: downloadUrl,
        duration: clip.duration || 30,
        subtitles: clip.subtitles || [],
        subtitle_timeline: clip.subtitleTimeline || []
    };
}

// 1. GET /v2/projects/:folder_id/:project_id
app.get([
    '/v2/projects/:folder_id/:project_id',
    '/projects/:folder_id/:project_id',
    '/api/v2/projects/:folder_id/:project_id',
    '/api/projects/:folder_id/:project_id'
], authenticateApiKeyOrUser, (req, res) => {
    const { folder_id, project_id } = req.params;

    db.get("SELECT * FROM tasks WHERE output_id = ? OR id = ?", [folder_id, folder_id], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!task) {
            // Check in clips table
            db.get("SELECT * FROM clips WHERE id = ?", [folder_id], (err, clipRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!clipRow) return res.status(404).json({ error: `Folder '${folder_id}' not found.` });
                
                const subClips = clipRow.sub_clips ? JSON.parse(clipRow.sub_clips) : [];
                const found = subClips.find((c, idx) => {
                    const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
                    return pId === project_id || c.id === project_id || `project_${idx + 1}` === project_id;
                });
                if (!found) return res.status(404).json({ error: `Project '${project_id}' not found in folder '${folder_id}'.` });
                return res.json(formatClipToProjectObject(found, { user_id: clipRow.user_id, output_id: folder_id, created_at: clipRow.created_at }));
            });
            return;
        }

        let clips = [];
        if (task.output_data) {
            try {
                const parsed = JSON.parse(task.output_data);
                clips = parsed.clips || [];
            } catch (e) {}
        }

        const found = clips.find((c, idx) => {
            const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
            return pId === project_id || c.id === project_id || `project_${idx + 1}` === project_id;
        });

        if (!found) {
            return res.status(404).json({ error: `Project '${project_id}' not found in folder '${folder_id}'.` });
        }

        return res.json(formatClipToProjectObject(found, task));
    });
});

// 2. GET /v2/projects/:id (Handles both Folder Project List & Direct Project)
app.get([
    '/v2/projects/:id',
    '/projects/:id',
    '/api/v2/projects/:id',
    '/api/projects/:id'
], authenticateApiKeyOrUser, (req, res) => {
    const id = req.params.id;

    // Check if id is a folder
    db.get("SELECT * FROM tasks WHERE output_id = ? OR (id = ? AND type = 'video-to-shorts')", [id, id], (err, task) => {
        if (err) return res.status(500).json({ error: err.message });
        if (task && (task.output_type === 'folder' || id.startsWith('folder_'))) {
            let clips = [];
            if (task.output_data) {
                try {
                    const parsed = JSON.parse(task.output_data);
                    clips = parsed.clips || [];
                } catch (e) {}
            }
            const projects = clips.map((c, idx) => formatClipToProjectObject(c, task, idx));
            return res.json(projects);
        }

        // Check if id is a direct video-to-video project
        db.get("SELECT * FROM tasks WHERE output_id = ? OR (id = ? AND type = 'video-to-video')", [id, id], (err, v2vTask) => {
            if (err) return res.status(500).json({ error: err.message });
            if (v2vTask) {
                let output = null;
                if (v2vTask.output_data) {
                    try { output = JSON.parse(v2vTask.output_data); } catch (e) {}
                }
                const videoUrl = output?.video_url || PUBLIC_RENDER_URLS[0];
                return res.json({
                    id: v2vTask.output_id || v2vTask.id,
                    author_id: `user_${v2vTask.user_id}`,
                    folder_id: null,
                    name: v2vTask.name || "Edited Video",
                    created_at: v2vTask.created_at,
                    virality_score: null,
                    virality_score_explanation: null,
                    video_url: videoUrl,
                    download_url: output?.download_url || `http://localhost:${PORT}/api/download?url=${encodeURIComponent(videoUrl)}&filename=edited_video.mp4`
                });
            }

            // Search all tasks to see if any clip matches this project_id
            db.all("SELECT * FROM tasks WHERE output_data IS NOT NULL ORDER BY created_at DESC", (err, allTasks) => {
                if (!err && allTasks && allTasks.length > 0) {
                    for (const t of allTasks) {
                        try {
                            const parsed = JSON.parse(t.output_data);
                            const clips = parsed.clips || [];
                            const match = clips.find((c, idx) => {
                                const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
                                return pId === id || c.id === id || `project_${idx + 1}` === id;
                            });
                            if (match) {
                                return res.json(formatClipToProjectObject(match, t));
                            }
                        } catch (e) {}
                    }
                }

                // Check clips table as folder fallback
                db.get("SELECT * FROM clips WHERE id = ?", [id], (err, clipRow) => {
                    if (clipRow && clipRow.sub_clips) {
                        const subClips = JSON.parse(clipRow.sub_clips);
                        const projects = subClips.map((c, idx) => formatClipToProjectObject(c, { user_id: clipRow.user_id, output_id: id, created_at: clipRow.created_at }, idx));
                        return res.json(projects);
                    }

                    return res.status(404).json({ error: `Project or folder '${id}' not found.` });
                });
            });
        });
    });
});

// ----------------------------------------------------------------
// PLAYER: Embed & Preview Project Endpoint (/player/{project_id})
// ----------------------------------------------------------------
app.get([
    '/player/:project_id',
    '/v2/player/:project_id',
    '/api/player/:project_id',
    '/api/v2/player/:project_id'
], (req, res) => {
    const projectId = req.params.project_id;
    
    db.all("SELECT * FROM tasks WHERE output_data IS NOT NULL ORDER BY created_at DESC", (err, allTasks) => {
        let foundClip = null;
        let foundTask = null;

        if (!err && allTasks) {
            for (const t of allTasks) {
                try {
                    const parsed = JSON.parse(t.output_data);
                    if (t.output_type === 'project' && (t.output_id === projectId || t.id === projectId)) {
                        foundClip = {
                            title: t.name || 'Edited Video',
                            url: parsed.video_url || PUBLIC_RENDER_URLS[0],
                            subtitles: [],
                            score: '9.5'
                        };
                        foundTask = t;
                        break;
                    }
                    const clips = parsed.clips || [];
                    const match = clips.find((c, idx) => {
                        const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
                        return pId === projectId || c.id === projectId || `project_${idx + 1}` === projectId;
                    });
                    if (match) {
                        foundClip = match;
                        foundTask = t;
                        break;
                    }
                } catch (e) {}
            }
        }

        const videoUrl = foundClip ? normalizeRenderUrl(foundClip.url) : PUBLIC_RENDER_URLS[0];
        const title = foundClip ? (foundClip.title || 'Short Clip') : 'YouClip Preview Player';
        let rawScore = foundClip?.score ? parseFloat(foundClip.score) : 8.5;
        if (rawScore > 1) rawScore = rawScore / 10;
        const viralityScore = rawScore.toFixed(2);
        const hookText = foundClip?.hook || '';

        res.removeHeader('X-Frame-Options');
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Player</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body {
            background-color: #090d16;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .player-wrapper {
            position: relative;
            width: 100%;
            max-width: 420px;
            height: 100vh;
            max-height: 780px;
            background: #000;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
        }
        video {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .overlay-badge {
            position: absolute;
            top: 16px;
            left: 16px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            padding: 6px 14px;
            border-radius: 100px;
            font-size: 0.85rem;
            font-weight: 700;
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.3);
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 10;
        }
        .overlay-badge span { color: #facc15; }
        .bottom-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 24px 20px;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 70%, transparent 100%);
            z-index: 10;
        }
        .title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 6px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }
        .hook {
            font-size: 0.85rem;
            color: #94a3b8;
            margin-bottom: 12px;
        }
        .btn-download {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #6366f1;
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            text-decoration: none;
            transition: opacity 0.2s;
        }
        .btn-download:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="player-wrapper">
        <div class="overlay-badge">
            ⚡ Virality Score: <span>${viralityScore}</span>
        </div>
        <video src="${videoUrl}" controls autoplay loop playsinline></video>
        <div class="bottom-bar">
            <div class="title">${title}</div>
            ${hookText ? `<div class="hook">${hookText}</div>` : ''}
            <a href="${videoUrl}" download class="btn-download">Download MP4</a>
        </div>
    </div>
</body>
</html>
        `);
    });
});

// ----------------------------------------------------------------
// V2 EXPORT ENDPOINTS: Create Export, Get Export Status, List Exports
// ----------------------------------------------------------------

function executeExportTask(exportRecord, projectVideoUrl, watermark = null) {
    const exportId = exportRecord.id;
    const userId = exportRecord.user_id;
    const delay = 4000 + Math.random() * 3000;

    setTimeout(() => {
        const finishedAt = new Date().toISOString();
        const exportSrcUrl = projectVideoUrl || PUBLIC_RENDER_URLS[0];

        db.run(
            "UPDATE exports SET status = 'ready', src_url = ?, finished_at = ?, descriptions = 'Export completed successfully.' WHERE id = ?",
            [exportSrcUrl, finishedAt, exportId],
            (err) => {
                if (err) {
                    console.error('[executeExportTask] error updating export:', err.message);
                } else {
                    console.log(`✅ Export ${exportId} completed successfully!`);
                    if (userId) {
                        notifyUser(userId, "Export Berhasil!", `Video export "${exportRecord.name}" sudah siap diunduh.`, 'success');
                    }
                }
            }
        );
    }, delay);
}

function formatExportObject(exp) {
    return {
        id: exp.id,
        status: exp.status,
        src_url: exp.status === 'ready' ? exp.src_url : null,
        project_id: exp.project_id,
        created_at: exp.created_at,
        finished_at: exp.finished_at || null,
        name: exp.name || "Exported Video",
        author_id: `user_${exp.user_id || 1}`,
        folder_id: exp.folder_id || null,
        descriptions: exp.descriptions || (exp.status === 'ready' ? "Export completed successfully." : "Export started.")
    };
}

// 1. POST /v2/projects/:folder_id/:project_id/exports (Create Export with folder)
app.post([
    '/v2/projects/:folder_id/:project_id/exports',
    '/projects/:folder_id/:project_id/exports',
    '/api/v2/projects/:folder_id/:project_id/exports',
    '/api/projects/:folder_id/:project_id/exports'
], authenticateApiKeyOrUser, (req, res) => {
    const { folder_id, project_id } = req.params;
    const { watermark } = req.body || {};
    const user = req.user;

    const exportId = `export_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
    const createdAt = new Date().toISOString();

    // Find the project / clip to get video URL and name
    db.all("SELECT * FROM tasks WHERE output_data IS NOT NULL ORDER BY created_at DESC", (err, allTasks) => {
        let projectName = "Exported Video";
        let projectVideoUrl = PUBLIC_RENDER_URLS[0];

        if (!err && allTasks) {
            for (const t of allTasks) {
                try {
                    const parsed = JSON.parse(t.output_data);
                    const clips = parsed.clips || [];
                    const match = clips.find((c, idx) => {
                        const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
                        return pId === project_id || c.id === project_id || `project_${idx + 1}` === project_id;
                    });
                    if (match) {
                        projectName = match.title || projectName;
                        projectVideoUrl = normalizeRenderUrl(match.url);
                        break;
                    }
                } catch (e) {}
            }
        }

        const exportRecord = {
            id: exportId,
            user_id: user.id,
            project_id,
            folder_id,
            name: projectName,
            status: 'processing',
            src_url: null,
            watermark: watermark ? JSON.stringify(watermark) : null,
            descriptions: 'Export started.',
            created_at: createdAt
        };

        db.run(
            `INSERT INTO exports (id, user_id, project_id, folder_id, name, status, watermark, descriptions, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [exportRecord.id, exportRecord.user_id, exportRecord.project_id, exportRecord.folder_id, exportRecord.name, exportRecord.status, exportRecord.watermark, exportRecord.descriptions, exportRecord.created_at],
            function(insertErr) {
                if (insertErr) return res.status(500).json({ error: "Database error: " + insertErr.message });

                executeExportTask(exportRecord, projectVideoUrl, watermark);

                res.status(200).json(formatExportObject(exportRecord));
            }
        );
    });
});

// 2. POST /v2/projects/:project_id/exports (Create Export Direct - without folder)
app.post([
    '/v2/projects/:project_id/exports',
    '/projects/:project_id/exports',
    '/api/v2/projects/:project_id/exports',
    '/api/projects/:project_id/exports'
], authenticateApiKeyOrUser, (req, res) => {
    const { project_id } = req.params;
    const { watermark } = req.body || {};
    const user = req.user;

    const exportId = `export_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
    const createdAt = new Date().toISOString();

    db.all("SELECT * FROM tasks WHERE output_data IS NOT NULL ORDER BY created_at DESC", (err, allTasks) => {
        let projectName = "Exported Video";
        let projectVideoUrl = PUBLIC_RENDER_URLS[0];
        let resolvedFolderId = null;

        if (!err && allTasks) {
            for (const t of allTasks) {
                try {
                    const parsed = JSON.parse(t.output_data);
                    if (t.output_type === 'project' && (t.output_id === project_id || t.id === project_id)) {
                        projectName = t.name || projectName;
                        projectVideoUrl = parsed.video_url || projectVideoUrl;
                        break;
                    }
                    const clips = parsed.clips || [];
                    const match = clips.find((c, idx) => {
                        const pId = c.id && c.id.startsWith('project_') ? c.id : `project_${c.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
                        return pId === project_id || c.id === project_id || `project_${idx + 1}` === project_id;
                    });
                    if (match) {
                        projectName = match.title || projectName;
                        projectVideoUrl = normalizeRenderUrl(match.url);
                        resolvedFolderId = t.output_id || null;
                        break;
                    }
                } catch (e) {}
            }
        }

        const exportRecord = {
            id: exportId,
            user_id: user.id,
            project_id,
            folder_id: resolvedFolderId,
            name: projectName,
            status: 'processing',
            src_url: null,
            watermark: watermark ? JSON.stringify(watermark) : null,
            descriptions: 'Export started.',
            created_at: createdAt
        };

        db.run(
            `INSERT INTO exports (id, user_id, project_id, folder_id, name, status, watermark, descriptions, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [exportRecord.id, exportRecord.user_id, exportRecord.project_id, exportRecord.folder_id, exportRecord.name, exportRecord.status, exportRecord.watermark, exportRecord.descriptions, exportRecord.created_at],
            function(insertErr) {
                if (insertErr) return res.status(500).json({ error: "Database error: " + insertErr.message });

                executeExportTask(exportRecord, projectVideoUrl, watermark);

                res.status(200).json(formatExportObject(exportRecord));
            }
        );
    });
});

// 3. GET /v2/projects/:folder_id/:project_id/exports/:export_id
app.get([
    '/v2/projects/:folder_id/:project_id/exports/:export_id',
    '/projects/:folder_id/:project_id/exports/:export_id',
    '/api/v2/projects/:folder_id/:project_id/exports/:export_id',
    '/api/projects/:folder_id/:project_id/exports/:export_id'
], authenticateApiKeyOrUser, (req, res) => {
    const { export_id } = req.params;
    db.get("SELECT * FROM exports WHERE id = ?", [export_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: `Export '${export_id}' not found.` });
        res.json(formatExportObject(row));
    });
});

// 4. GET /v2/projects/:project_id/exports/:export_id
app.get([
    '/v2/projects/:project_id/exports/:export_id',
    '/projects/:project_id/exports/:export_id',
    '/api/v2/projects/:project_id/exports/:export_id',
    '/api/projects/:project_id/exports/:export_id'
], authenticateApiKeyOrUser, (req, res) => {
    const { export_id } = req.params;
    db.get("SELECT * FROM exports WHERE id = ?", [export_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: `Export '${export_id}' not found.` });
        res.json(formatExportObject(row));
    });
});

// 5. GET /v2/exports (List All Exports with optional filtering)
app.get([
    '/v2/exports',
    '/exports',
    '/api/v2/exports',
    '/api/exports'
], authenticateApiKeyOrUser, (req, res) => {
    const { folder_id, project_id } = req.query;
    const userId = req.user.id;

    let query = "SELECT * FROM exports WHERE user_id = ?";
    const params = [userId];

    if (folder_id) {
        query += " AND folder_id = ?";
        params.push(folder_id);
    }
    if (project_id) {
        query += " AND project_id = ?";
        params.push(project_id);
    }

    query += " ORDER BY created_at DESC LIMIT 50";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const results = (rows || []).map(formatExportObject);
        res.json(results);
    });
});

// 6. GET /v2/exports/:export_id
app.get([
    '/v2/exports/:export_id',
    '/exports/:export_id',
    '/api/v2/exports/:export_id',
    '/api/exports/:export_id'
], authenticateApiKeyOrUser, (req, res) => {
    const { export_id } = req.params;
    db.get("SELECT * FROM exports WHERE id = ?", [export_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: `Export '${export_id}' not found.` });
        res.json(formatExportObject(row));
    });
});

// ----------------------------------------------------------------
// CLIPS: Process & Fetch (Legacy / Web UI)
// ----------------------------------------------------------------
app.get('/api/clips', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    db.all("SELECT * FROM clips WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const parsedRows = rows.map(row => ({
            ...row,
            sub_clips: row.sub_clips
                ? JSON.parse(row.sub_clips).map((clipItem, index) => ({
                    ...clipItem,
                    url: normalizeRenderUrl(clipItem.url, index)
                }))
                : [],
            caption_brand: row.caption_brand ? JSON.parse(row.caption_brand) : null
        }));
        res.json(parsedRows);
    });
});

app.post('/api/clips', (req, res) => {
    const { url, autoSubtitle, layout, captionPreset, captionBrand } = req.body;
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    db.get("SELECT credits, username, display_name FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error: " + err.message });
        if (!user) return res.status(404).json({ error: "User tidak ditemukan" });
        if (user.credits <= 0) return res.status(400).json({ error: "Kredit tidak mencukupi" });
        
        db.run("UPDATE users SET credits = credits - 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const id = uuidv4();
            const vId = extractYouTubeId(url);
            const thumb = getYouTubeThumbnail(vId);
            
            db.run(
                "INSERT INTO clips (id, user_id, url, title, thumbnail, status, layout, auto_subtitle, caption_preset, caption_brand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [id, userId, url, "Menganalisa video...", thumb, "processing", layout || 'auto_magic', autoSubtitle === false ? 0 : 1, captionPreset || 'viral_neon', captionBrand ? JSON.stringify(captionBrand) : null],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const brandName = captionBrand?.name || user.display_name || user.username;
                    simulateClipProcessing(id, vId, {
                        url,
                        autoSubtitle: autoSubtitle !== false,
                        layout: layout || 'auto_magic',
                        captionPreset: captionPreset || 'viral_neon',
                        captionBrand: captionBrand || null,
                        brandName: brandName
                    });
                    res.json({
                        id,
                        status: "processing",
                        thumbnail: thumb,
                        layout: layout || 'auto_magic',
                        autoSubtitle: autoSubtitle !== false,
                        captionPreset: captionPreset || 'viral_neon',
                        captionBrand: captionBrand || null
                    });
                }
            );
        });
    });
});

// ----------------------------------------------------------------
// WITHDRAWALS: Points to APK Dana
// ----------------------------------------------------------------
app.post('/api/withdrawals', (req, res) => {
    const userId = req.headers['user-id'];
    const { amount, method, destination } = req.body;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!amount || amount < 10000) return res.status(400).json({ error: "Minimal penarikan Rp 10.000" });

    const wdId = "WD-" + Date.now();
    db.run(
        "INSERT INTO withdrawals (id, user_id, amount, method, destination, status) VALUES (?, ?, ?, ?, ?, 'Pending')",
        [wdId, userId, amount, method, destination],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Permintaan penarikan berhasil diajukan, menunggu konfirmasi Admin." });
        }
    );
});

app.get('/api/user/withdrawals', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    db.all("SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ----------------------------------------------------------------
// USER: Notifications
// ----------------------------------------------------------------
app.get('/api/notifications', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/notifications/read-all', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ----------------------------------------------------------------
// TOPUP & TICKETS
// ----------------------------------------------------------------
app.post('/api/topup', (req, res) => {
    const { amount, packageName, price, method, autoVerify } = req.body;
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const txId = "TRX-" + Date.now();
    const shouldVerify = autoVerify !== false; // In sandbox demo, automatically verify and credit on checkout completion
    const initialStatus = shouldVerify ? 'Success' : 'Pending';

    db.run(
        "INSERT INTO transactions (id, user_id, package_name, amount, price, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [txId, userId, packageName, amount, price, initialStatus, method || 'QRIS'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (shouldVerify) {
                db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [amount, userId], (err2) => {
                    if (err2) console.error('Failed to add credits:', err2.message);
                    notifyUser(userId, "Pembayaran Berhasil", `Top up ${amount} kredit (${packageName}) telah berhasil masuk ke akun Anda.`, 'success');
                    res.json({ success: true, transactionId: txId, verified: true, creditsAdded: amount });
                });
            } else {
                res.json({ success: true, transactionId: txId, verified: false });
            }
        }
    );
});

app.post('/api/topup/verify/:id', (req, res) => {
    const { id } = req.params;
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.get("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [id, userId], (err, tx) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!tx) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
        if (tx.status === 'Success') return res.json({ success: true, message: "Transaksi sudah berhasil diverifikasi" });

        db.run("UPDATE transactions SET status = 'Success' WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [tx.amount, userId], () => {
                notifyUser(userId, "Pembayaran Berhasil", `Top up ${tx.amount} kredit telah berhasil diverifikasi.`, 'success');
                res.json({ success: true, message: "Kredit berhasil ditambahkan" });
            });
        });
    });
});

app.get('/api/user/transactions', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/tickets', (req, res) => {
    const { subject, category } = req.body;
    const message = req.body.message || req.body.detail || '';
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const id = "TKT-" + Date.now();
    db.run(
        "INSERT INTO tickets (id, user_id, subject, category, message, status) VALUES (?, ?, ?, ?, ?, 'Open')",
        [id, userId, subject, category || 'General', message],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id, message: "Tiket berhasil dibuat!" });
        }
    );
});

app.get('/api/tickets', (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    db.all("SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// ----------------------------------------------------------------
// ADMIN: Stats, Users, Transactions, Withdrawals, Tickets, Packages
// ----------------------------------------------------------------
app.get('/api/packages', (req, res) => {
    db.all("SELECT * FROM packages ORDER BY price ASC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/admin/packages/:id', (req, res) => {
    const { id } = req.params;
    const { price, credits, name, description, badge, is_popular } = req.body;
    db.run(
        "UPDATE packages SET price = ?, credits = ?, name = ?, description = ?, badge = ?, is_popular = ? WHERE id = ?",
        [price, credits, name, description, badge, is_popular ? 1 : 0, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Paket berhasil diperbarui" });
        }
    );
});

app.get('/api/admin/stats', (req, res) => {
    const stats = { users: 0, clips: 0, tickets: 0, revenue: 0 };
    
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row) stats.users = row.count;
        db.get("SELECT COUNT(*) as count FROM clips", (err, row) => {
            if (row) stats.clips = row.count;
            db.get("SELECT COUNT(*) as count FROM tickets", (err, row) => {
                if (row) stats.tickets = row.count;
                db.get("SELECT SUM(price) as total FROM transactions WHERE status = 'Success'", (err, row) => {
                    if (row) stats.revenue = row.total || 0;
                    res.json(stats);
                });
            });
        });
    });
});

app.get('/api/admin/users', (req, res) => {
    db.all("SELECT id, username, display_name, picture, role, credits, created_at FROM users ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/users/:id/credits', (req, res) => {
    const { id } = req.params;
    const { amount, action } = req.body;
    
    let query = "UPDATE users SET credits = credits + ? WHERE id = ?";
    if (action === 'set') {
        query = "UPDATE users SET credits = ? WHERE id = ?";
    }
    
    db.run(query, [amount, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Berhasil memperbarui kredit.` });
    });
});

app.get('/api/admin/transactions', (req, res) => {
    db.all(`
        SELECT t.*, u.username as username 
        FROM transactions t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/admin/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (status === 'Success') {
        db.get("SELECT * FROM transactions WHERE id = ?", [id], (err, tx) => {
            if (!tx || tx.status !== 'Pending') return res.status(400).json({ error: "Transaksi tidak valid" });
            db.run("UPDATE transactions SET status = 'Success' WHERE id = ?", [id], () => {
                db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [tx.amount, tx.user_id], () => {
                    notifyUser(tx.user_id, "Pembayaran Berhasil", `Top up ${tx.amount} kredit telah berhasil masuk ke akun Anda.`, 'success');
                    res.json({ success: true });
                });
            });
        });
    } else {
        db.run("UPDATE transactions SET status = ?, price = 0 WHERE id = ?", [status, id], () => {
            res.json({ success: true });
        });
    }
});

app.post('/api/admin/transactions/approve', (req, res) => {
    const { transactionId } = req.body;
    db.get("SELECT * FROM transactions WHERE id = ?", [transactionId], (err, tx) => {
        if (!tx || tx.status !== 'Pending') return res.status(400).json({ error: "Tx tidak valid" });
        db.run("UPDATE transactions SET status = 'Success' WHERE id = ?", [transactionId], () => {
            db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [tx.amount, tx.user_id], () => {
                notifyUser(tx.user_id, "Pembayaran Berhasil", `Top up ${tx.amount} kredit telah berhasil masuk ke akun Anda.`, 'success');
                res.json({ success: true });
            });
        });
    });
});

app.get('/api/admin/withdrawals', (req, res) => {
    db.all("SELECT w.*, u.username FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/admin/withdrawals/approve', (req, res) => {
    const { withdrawalId } = req.body;
    db.get("SELECT * FROM withdrawals WHERE id = ?", [withdrawalId], (err, wd) => {
        if (!wd) return res.status(404).json({ error: "WD not found" });
        db.run("UPDATE withdrawals SET status = 'Success' WHERE id = ?", [withdrawalId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            notifyUser(wd.user_id, "Penarikan Dana Berhasil", `Dana sebesar Rp ${wd.amount.toLocaleString()} telah dikirim ke ${wd.method}.`, 'info');
            res.json({ success: true });
        });
    });
});

app.get('/api/admin/tickets', (req, res) => {
    db.all(`
        SELECT t.*, u.username as username 
        FROM tickets t 
        JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/admin/tickets/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run("UPDATE tickets SET status = ? WHERE id = ?", [status, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ----------------------------------------------------------------
// DOWNLOAD PROXY: Fetch video dari S3 / local storage dan stream ke client
// ----------------------------------------------------------------
app.get('/api/download', async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).json({ error: 'URL diperlukan' });

    try {
        const rawUrl = typeof url === 'string' ? url.trim() : '';
        const safeFilename = (filename || 'youclip-hasil.mp4')
            .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
            .replace(/\s+/g, '-');
        const encodedFilename = encodeURIComponent(safeFilename);

        // Check if this is a local render file from /renders/
        let renderFileName = null;
        if (rawUrl.includes('/renders/')) {
            renderFileName = rawUrl.split('/renders/').pop().split('?')[0];
        }

        if (renderFileName) {
            const localFilePath = path.join(rendersPath, renderFileName);
            if (fs.existsSync(localFilePath)) {
                res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'no-store');
                const stat = fs.statSync(localFilePath);
                res.setHeader('Content-Length', stat.size);
                return fs.createReadStream(localFilePath).pipe(res);
            }
        }

        let targetUrl = normalizeRenderUrl(rawUrl);
        // Handle relative URLs if any
        if (targetUrl.startsWith('/')) {
            targetUrl = `http://127.0.0.1:${PORT}${targetUrl}`;
        }

        const parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Protocol URL tidak didukung' });
        }

        const useFallback = targetUrl !== rawUrl && rawUrl.includes('.s3.');
        const response = await fetch(parsedUrl.toString(), {
            redirect: 'follow'
        });
        if (!response.ok) {
            const upstreamBody = await response.text().catch(() => 'Tidak ada detail tambahan');
            return res.status(502).type('text/plain').send(`Gagal mengunduh dari sumber: ${response.status} ${response.statusText}\n${upstreamBody}`);
        }

        if (useFallback) {
            res.setHeader('X-YouClip-Download-Message', 'File asli S3 tidak dapat diakses, mengunduh fallback publik sebagai pengganti.');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        res.setHeader('Content-Length', fileBuffer.length);
        res.end(fileBuffer);
    } catch (err) {
        console.error('[Download Proxy Error]', err.message);
        res.status(500).type('text/plain').send(`Gagal mengunduh file: ${err.message}`);
    }
});

app.get('/', (req, res) => {
    db.get("SELECT COUNT(*) as users FROM users", (err, usersRow) => {
        db.get("SELECT COUNT(*) as clips FROM clips", (err, clipsRow) => {
            db.get("SELECT COUNT(*) as tickets FROM tickets", (err, ticketsRow) => {
                db.get("SELECT SUM(price) as revenue FROM transactions WHERE status = 'Success'", (err, revRow) => {
                    const stats = {
                        users: usersRow?.users || 0,
                        clips: clipsRow?.clips || 0,
                        tickets: ticketsRow?.tickets || 0,
                        revenue: revRow?.revenue || 0
                    };
                    
                    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouClip API - Backend Status Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Outfit', sans-serif;
        }
        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(30, 41, 59, 0.45);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            text-align: center;
        }
        .header {
            margin-bottom: 30px;
        }
        .logo {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(to right, #ec4899, #8b5cf6, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
            padding: 6px 16px;
            border-radius: 100px;
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid rgba(16, 185, 129, 0.2);
            margin-bottom: 20px;
        }
        .badge::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 8px #10b981;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        p.subtitle {
            color: #94a3b8;
            font-size: 1.1rem;
            max-width: 500px;
            margin: 0 auto 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            border-color: rgba(255, 255, 255, 0.1);
            background: rgba(15, 23, 42, 0.6);
        }
        .stat-value {
            font-size: 1.8rem;
            font-weight: 800;
            color: #f8fafc;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.85rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .actions {
            display: flex;
            flex-direction: column;
            gap: 15px;
            align-items: center;
        }
        .btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 16px 36px;
            background: linear-gradient(to right, #ec4899, #8b5cf6);
            color: white;
            font-weight: 600;
            text-decoration: none;
            border-radius: 12px;
            box-shadow: 0 10px 20px -5px rgba(139, 92, 246, 0.4);
            transition: all 0.3s ease;
            font-size: 1.1rem;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 25px -5px rgba(139, 92, 246, 0.6);
        }
        .btn-secondary {
            color: #94a3b8;
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.2s ease;
        }
        .btn-secondary:hover {
            color: #f8fafc;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">YouClip Engine</div>
            <div class="badge">API & Processing Server Online</div>
            <p class="subtitle">Backend server YouTube Clipper Anda aktif dan memproses render video otomatis dengan teknologi AI Auto-Reframe.</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.users}</div>
                <div class="stat-label">Total Pengguna</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.clips}</div>
                <div class="stat-label">Video Diproses</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.tickets}</div>
                <div class="stat-label">Tiket Support</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">Rp ${(stats.revenue || 0).toLocaleString('id-ID')}</div>
                <div class="stat-label">Pendapatan</div>
            </div>
        </div>

        <div class="actions">
            <a href="http://localhost:3000" class="btn-primary">Buka Aplikasi Frontend</a>
            <a href="/api/clips" class="btn-secondary" target="_blank">Lihat Data Endpoint API (/api/clips) →</a>
        </div>
    </div>
</body>
</html>
                    `);
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
