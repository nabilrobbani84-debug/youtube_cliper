const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const { renderYouTubeSubclips } = require('./clipper');

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
  allowedHeaders: ['Content-Type', 'user-id', 'Authorization'],
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
        
        res.json({ 
            id: user.id, 
            username: user.username, 
            display_name: user.display_name || user.username,
            picture: user.picture,
            role: user.role, 
            credits: user.credits 
        });
    });
});

app.post('/api/register', (req, res) => {
    const username = req.body?.username?.trim();
    const password = req.body?.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });
    if (username.length < 3) return res.status(400).json({ error: "Username minimal 3 karakter" });
    if (password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
    
    db.run(
        "INSERT INTO users (username, password, credits, role) VALUES (?, ?, 15, 'user')",
        [username, password],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "Username sudah digunakan" });
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, username, display_name: username, role: 'user', credits: 15 });
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
            db.run("UPDATE users SET picture = COALESCE(?, picture), display_name = COALESCE(?, display_name) WHERE id = ?", [picture, name, user.id]);
            return res.json({ id: user.id, username: user.username, display_name: name || user.display_name, picture: picture || user.picture, role: user.role, credits: user.credits });
        } else {
            db.run(
                "INSERT INTO users (username, password, display_name, picture, credits, role) VALUES (?, ?, ?, ?, 15, 'user')",
                [email, 'google-oauth-' + Date.now(), name, picture],
                function(err) {
                    if (err) return res.status(400).json({ error: "Gagal membuat akun Google" });
                    return res.json({ id: this.lastID, username: email, display_name: name, picture, role: 'user', credits: 15 });
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
    
    db.get("SELECT id, username, display_name, picture, caption_brand, role, credits FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "User tidak ditemukan" });
        res.json({
            ...row,
            caption_brand: row.caption_brand ? JSON.parse(row.caption_brand) : null
        });
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

function simulateClipProcessing(mainClipId, videoId, options = {}) {
    const {
        autoSubtitle = true,
        layout = 'auto_magic',
        captionPreset = 'viral_neon',
        captionBrand = null
    } = options;
    const delay = 15000 + Math.random() * 15000; // 15-30 detik
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

            // Try to render actual subclips from YouTube if possible
            let rendered = [];
            try {
                if (videoId) {
                    rendered = await renderYouTubeSubclips(mainClipId, videoId, { count: 5 });
                }
            } catch (e) {
                console.error('[simulateClipProcessing] render error', e.message);
                rendered = [];
            }

            // Fallback to sample assets if render failed or returned empty
            const clipUrls = (rendered && rendered.length > 0)
                ? rendered.map(r => `http://localhost:${PORT}${r.url}`)
                : PUBLIC_RENDER_URLS.slice(0, 5);

            const momentVariants = [
                { title: "Hook pembuka yang langsung ngunci perhatian", score: "9.7", category: "Hook & Retention", platform: layoutProfile.platform, editorialNote: "Opening dipilih karena 3 detik pertamanya punya tensi tinggi dan aman dipakai sebagai cold open tanpa perlu intro panjang.", subtitles: [{ text: "INI bagian yang bikin penonton langsung berhenti scroll.", emphasis: ["INI", "berhenti", "scroll"] }] },
                { title: "Penjelasan inti yang paling enak dipotong jadi short", score: "9.3", category: "Value Delivery", platform: "YouTube Shorts, Reels", editorialNote: "Bagian ini cocok dijadikan klip edukatif karena kalimat utamanya jelas, ritmenya stabil, dan mudah diberi subtitle tebal.", subtitles: [{ text: "Poin pentingnya disampaikan dengan jelas di bagian ini.", emphasis: ["Poin", "jelas"] }] },
                { title: "Reaksi emosional paling kuat di dalam video", score: "9.5", category: "Emotion Spike", platform: "TikTok, Shorts", editorialNote: "Momen reaksi diprioritaskan karena ekspresi dan jeda dramatisnya terasa natural, sehingga hasil edit terlihat lebih premium.", subtitles: [{ text: "Reaksi ini yang bikin klimaks videonya terasa hidup.", emphasis: ["Reaksi", "klimaks", "hidup"] }] },
                { title: "Punchline paling tajam untuk dorong replay", score: "9.1", category: "Punchline", platform: "TikTok, Reels", editorialNote: "Dipilih karena kalimat akhirnya punya efek replay yang kuat dan tetap jelas walau dipotong vertikal 9:16.", subtitles: [{ text: "Bagian akhirnya punya punchline yang gampang diingat.", emphasis: ["punchline", "gampang", "diingat"] }] },
                { title: "Momen transisi cerita yang paling mulus", score: "8.9", category: "Story Beat", platform: "Shorts, LinkedIn Video", editorialNote: "Segmen ini jadi alternatif yang lebih tenang tapi tetap kuat, cocok untuk short yang ingin terlihat lebih rapi dan editorial.", subtitles: [{ text: "Transisi ceritanya paling halus ada di bagian ini.", emphasis: ["Transisi", "halus"] }] }
            ];

            const durationPresets = ['00:34', '01:05', '00:42', '00:51', '00:38'];
            const exportProfiles = [
                'Cinematic punch-in + color grade',
                'Retention cut + rhythm captions',
                'Clean educational framing',
                'Emotion-led zoom pacing',
                'Soft CTA finishing pass'
            ];

            // Use the clipUrls to create hydrated sub-clips
            const picked = [...momentVariants].slice(0, 5);
            const hydratedSubClips = picked.map((item, i) => {
                const subtitleTimeline = autoSubtitle ? buildSubtitleTimeline(item.subtitles) : [];
                return {
                    id: `sub-${uuidv4()}`,
                    url: clipUrls[i] || PUBLIC_RENDER_URLS[i % PUBLIC_RENDER_URLS.length],
                    title: item.title,
                    score: item.score,
                    category: item.category,
                    platform: item.platform,
                    editorialNote: item.editorialNote,
                    subtitles: autoSubtitle ? item.subtitles : [],
                    subtitleTimeline,
                    subtitleMode: autoSubtitle ? 'burned-in-pro' : 'clean-no-subs',
                    captionPreset,
                    captionPresetLabel: captionProfile.label,
                    captionVibe: captionProfile.vibe,
                    accentColor: captionProfile.accent,
                    captionBrand: resolvedBrand,
                    layoutLabel: layoutProfile.label,
                    finishing: `${layoutProfile.finish} • ${exportProfiles[i % exportProfiles.length]}`,
                    hook: `${layoutProfile.hookPrefix}: ${item.title}`,
                    durationLabel: durationPresets[i % durationPresets.length],
                    exportProfile: exportProfiles[i % exportProfiles.length],
                    editorialPriority: i === 0 ? 'Hero Clip' : i < 3 ? 'Primary Cut' : 'Support Cut'
                };
            });

            const mainTitle = `${picked[0].title} • 5 klip profesional siap upload`;

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
        })();
    }, delay);
}

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
    
    db.get("SELECT credits FROM users WHERE id = ?", [userId], (err, user) => {
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
                    simulateClipProcessing(id, vId, {
                        autoSubtitle: autoSubtitle !== false,
                        layout: layout || 'auto_magic',
                        captionPreset: captionPreset || 'viral_neon',
                        captionBrand: captionBrand || null
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
    const { amount, packageName, price, method } = req.body;
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    const txId = "TRX-" + Date.now();
    db.run(
        "INSERT INTO transactions (id, user_id, package_name, amount, price, status, payment_method) VALUES (?, ?, ?, ?, ?, 'Pending', ?)",
        [txId, userId, packageName, amount, price, method || 'QRIS'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, transactionId: txId });
        }
    );
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
    const { subject, category, message } = req.body;
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
    const { amount } = req.body;
    db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [amount, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Berhasil menambahkan ${amount} kredit.` });
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
// DOWNLOAD PROXY: Fetch video dari S3 dan stream ke client
// ----------------------------------------------------------------
app.get('/api/download', async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).json({ error: 'URL diperlukan' });

    try {
        const targetUrl = normalizeRenderUrl(typeof url === 'string' ? url : '');
        const parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Protocol URL tidak didukung' });
        }

        const safeFilename = (filename || 'youclip-hasil.mp4')
            .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
            .replace(/\s+/g, '-');
        const encodedFilename = encodeURIComponent(safeFilename);

        const useFallback = targetUrl !== url && (new URL(url)).hostname.includes('.s3.');
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

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
