"use client";
import "./home.css";
import { Info, ChevronDown, ChevronUp, CheckCircle, Loader2, Video, X, Download, Star, Youtube, Languages, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../UserContext';

// Helper: ekstrak YouTube Video ID dari URL apapun
function getYouTubeId(url) {
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

// Helper: Dapatkan thumbnail URL terbaik dari YouTube
function getYouTubeThumbnail(url, quality = 'hqdefault') {
  const id = getYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
}

// Subtitle animasi yang berganti otomatis setiap 3 detik
function AnimatedSubtitle({ subtitles, isActive }) {
  const [subIndex, setSubIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setSubIndex(i => (i + 1) % subtitles.length);
        setVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, subtitles.length]);

  return (
    <div className="absolute inset-x-0 bottom-[15%] flex justify-center pointer-events-none z-10 px-5">
      <div
        className="text-center leading-snug transition-all duration-300"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      >
        <span
          className="text-white font-black text-[22px] md:text-[26px] uppercase tracking-wide inline-block px-3 py-1 rounded-md"
          style={{
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.9)',
            WebkitTextStroke: '0.5px rgba(0,0,0,0.5)',
          }}
        >
          {subtitles[subIndex].split(' ').map((word, wi) => (
            <span key={wi}>
              {wi === 0 || wi === Math.floor(subtitles[subIndex].split(' ').length / 2)
                ? <span className="text-yellow-300">{word} </span>
                : word + ' '
              }
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function ClipViewerOverlay({ clip, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Gunakan data sub-clips nyata dari backend atau fallback jika belum ada
  const clipsData = (clip.sub_clips && clip.sub_clips.length > 0) ? clip.sub_clips : [
    {
      url: "https://youclip-production.s3.ap-southeast-2.amazonaws.com/renders/BARU%203%20HARI%20KERJA%20FANDI%20DI%20TUNTUT%20HUKUMAN%20M%EF%BC%8A-TI%E2%81%89%EF%B8%8F%20SEMUA%20INI%20HANYA%20JEBAKAN%E2%80%BC%EF%B8%8F%20%5Bd2zDV6lo9IU%5D_1248.84-1323.08_final.mp4",
      title: "Momen Viral #1: " + (clip.title || "Klip Video"),
      score: "9.2"
    },
    {
      url: "https://youclip-production.s3.ap-southeast-2.amazonaws.com/renders/BARU%203%20HARI%20KERJA%20FANDI%20DI%20TUNTUT%20HUKUMAN%20M%EF%BC%8A-TI%E2%81%89%EF%B8%8F%20SEMUA%20INI%20HANYA%20JEBAKAN%E2%80%BC%EF%B8%8F%20%5Bd2zDV6lo9IU%5D_753.52-848.80_final.mp4",
      title: "Momen Viral #2: " + (clip.title || "Klip Video"),
      score: "8.5"
    },
    {
      url: "https://youclip-production.s3.ap-southeast-2.amazonaws.com/renders/BARU%203%20HARI%20KERJA%20FANDI%20DI%20TUNTUT%20HUKUMAN%20M%EF%BC%8A-TI%E2%81%89%EF%B8%8F%20SEMUA%20INI%20HANYA%20JEBAKAN%E2%80%BC%EF%B8%8F%20%5Bd2zDV6lo9IU%5D_232.52-264.12_final.mp4",
      title: "Momen Viral #3: " + (clip.title || "Klip Video"),
      score: "7.8"
    }
  ];

  const videoId = getYouTubeId(clip.url);

  // Timestamps berbeda untuk tiap klip
  const startTimes = [30, 150, 280];

  // Subtitle set per klip
  const subtitleSets = [
    ["Ini benar-benar tidak bisa dipercaya!", "Semua orang terkejut melihatnya...", "Tidak ada yang menyangka ini terjadi!", "Inilah momen yang paling viral!"],
    ["Hasilnya sangat mengejutkan semua orang.", "Bahkan para ahli tidak bisa memprediksinya.", "Ini salah satu reaksi terbaik sepanjang masa.", "Tonton sampai habis, kalian pasti terkejut!"],
    ["Momen paling lucu yang pernah ada!", "Tidak ada yang bisa menahan tawa melihat ini.", "Ini punchline terbaik episode ini!", "Reaksinya benar-benar tidak terduga."],
  ];

  const translationTexts = [
    "AI mendeteksi ini sebagai puncak emosi video. Penonton bereaksi keras terhadap pernyataan tak terduga dari pembicara — ekspresi dan nada bicara menunjukkan kejutan yang sangat kuat.",
    "Segmen ini dipilih karena mengandung konflik naratif yang kuat dan detail menarik yang membuat penonton tidak bisa berhenti menonton. Cocok untuk klip edukasi atau opini.",
    "Klip ini memiliki punchline yang tiba-tiba dan mengejutkan. Ritme percakapan cepat diikuti pause dramatis menciptakan efek humor tinggi. Potensi viral terbaik untuk Reels/Shorts.",
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP BAR ───────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <X size={20} color="white" />
        </button>
        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2 }}>Hasil Klip AI</div>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 220 }}>{clip.title}</div>
        </div>
        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 5 }}>
          {clipsData.map((_, i) => (
            <div key={i} style={{ width: i === currentIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === currentIndex ? '#6366f1' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
          ))}
        </div>
      </div>

      {/* ── MAIN SWIPEABLE AREA ───────────────────────── */}
      <div
        id="clip-scroll-container"
        style={{ flex: 1, overflowY: 'auto', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth', scrollbarWidth: 'none' }}
        onScroll={(e) => {
          const rawIndex = Math.round(e.target.scrollTop / e.target.clientHeight);
          if (rawIndex !== currentIndex) setCurrentIndex(rawIndex);
        }}
      >
        {clipsData.map((data, index) => {
          const isActive = currentIndex === index;
          const cleanScore = data.score ? data.score.toString().replace('/10', '').trim() : "8.5";
          const currentSubtitles = subtitleSets[index % subtitleSets.length];
          const startTime = startTimes[index] || 30;

          return (
            <div key={index} style={{ position: 'relative', width: '100%', height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#000' }}>

              {/* ── VIDEO (cropped to vertical 9:16) ── */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: '316.5%', height: '100%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                  <iframe
                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#000' }}
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=0&controls=0&modestbranding=1&rel=0&start=${startTime}&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </div>

              {/* ── GRADIENT OVERLAYS ── */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.85) 100%)', pointerEvents: 'none' }} />

              {/* ── SCORE BADGE (top-right) ── */}
              <div style={{ position: 'absolute', top: 70, right: 16, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Star size={13} color="#34d399" fill="#34d399" />
                <span style={{ color: '#34d399', fontWeight: 800, fontSize: 14 }}>{cleanScore}</span>
                <span style={{ color: 'rgba(52,211,153,0.6)', fontWeight: 700, fontSize: 11 }}>/10</span>
              </div>

              {/* ── KLIP NUMBER (top-left) ── */}
              <div style={{ position: 'absolute', top: 70, left: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '6px 14px' }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: 12 }}>Klip #{index + 1} dari {clipsData.length}</span>
              </div>

              {/* ── ANIMATED SUBTITLE ── */}
              <AnimatedSubtitle subtitles={currentSubtitles} isActive={isActive} />

              {/* ── BOTTOM INFO + ACTIONS ── */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 20px', zIndex: 10 }}>

                {/* Title */}
                <h3 style={{ color: 'white', fontWeight: 800, fontSize: 17, marginBottom: 8, lineHeight: 1.3, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{data.title}</h3>

                {/* Translation box */}
                <div style={{ background: 'rgba(15,12,45,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <Languages size={13} color="#818cf8" />
                    <span style={{ color: '#818cf8', fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Terjemahan AI · Bahasa Indonesia</span>
                    <div style={{ marginLeft: 'auto', background: 'rgba(99,102,241,0.2)', borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Sparkles size={9} color="#818cf8" />
                      <span style={{ color: '#818cf8', fontSize: 9, fontWeight: 700 }}>Auto</span>
                    </div>
                  </div>
                  <p style={{ color: 'rgba(200,200,220,0.9)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    {translationTexts[index % translationTexts.length]}
                  </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => alert(`Sedang mengunduh klip "${data.title}"... (Simulasi)`)}
                    style={{ flex: 1, height: 48, background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
                  >
                    <Download size={17} /> Unduh Klip
                  </button>
                  <a
                    href={`https://youtu.be/${videoId}?t=${startTime}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, height: 48, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
                  >
                    <Youtube size={17} color="#f87171" /> YouTube
                  </a>
                </div>
              </div>

              {/* ── RIGHT SIDE NAV ── */}
              <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 20 }}>
                <button
                  disabled={index === 0}
                  onClick={() => {
                    const el = document.getElementById('clip-scroll-container');
                    if (el && index > 0) el.scrollTo({ top: (index - 1) * el.clientHeight, behavior: 'smooth' });
                  }}
                  style={{ width: 38, height: 38, borderRadius: '50%', background: index === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', cursor: index === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: index === 0 ? 'rgba(255,255,255,0.2)' : 'white', transition: 'all 0.2s' }}
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  disabled={index === clipsData.length - 1}
                  onClick={() => {
                    const el = document.getElementById('clip-scroll-container');
                    if (el && index < clipsData.length - 1) el.scrollTo({ top: (index + 1) * el.clientHeight, behavior: 'smooth' });
                  }}
                  style={{ width: 38, height: 38, borderRadius: '50%', background: index === clipsData.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.8)', backdropFilter: 'blur(8px)', border: 'none', cursor: index === clipsData.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: index === clipsData.length - 1 ? 'rgba(255,255,255,0.2)' : 'white', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}
                >
                  <ChevronDown size={18} />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      <style>{`
        #clip-scroll-container::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function ProcessingStatus({ createdAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick(); // initial hit
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  // Simulate total 30 seconds processing
  const totalTime = 30000; 
  const progressPercent = Math.min(99, Math.max(2, (elapsed / totalTime) * 100)); // cap at 99%
  
  let statusText = "Mengekstrak audio...";
  if (progressPercent > 85) statusText = "Merender video final & auto-crop...";
  else if (progressPercent > 60) statusText = "Mencari highlight & punchline...";
  else if (progressPercent > 35) statusText = "AI mentranskripsi & subtitle...";
  else if (progressPercent > 10) statusText = "Mengunduh video sumber...";

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#6366f1' }}>
        <span className="animate-pulse">{statusText}</span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
      <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
        <div 
          style={{ 
            backgroundColor: '#6366f1', 
            height: '100%', 
            borderRadius: '999px', 
            width: `${progressPercent}%`, 
            transition: 'width 1s linear' 
          }} 
        />
      </div>
    </div>
  );
}

export default function Home() {
  const { user, fetchUser } = useUser();
  const [url, setUrl] = useState('');
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [autoSubtitle, setAutoSubtitle] = useState(true);
  const [selectedLayout, setSelectedLayout] = useState('auto_magic');
  const [showInfo, setShowInfo] = useState(true);

  const fetchClips = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/clips', {
        headers: { 'user-id': localStorage.getItem('userId') }
      });
      const data = await res.json();
      setClips(data);
    } catch (e) {
      console.error('Failed to fetch clips:', e);
    }
  };

  useEffect(() => {
    fetchClips();
    const interval = setInterval(() => {
      fetchClips();
    }, 3000);
    
    // Check for pending URL from landing page
    const pendingUrl = localStorage.getItem('pendingUrl');
    if (pendingUrl) {
      setUrl(pendingUrl);
      localStorage.removeItem('pendingUrl'); // Clear after reading
    }

    return () => clearInterval(interval);
  }, []);

  const handleProcess = async () => {
    if (!url) return alert('Masukkan link YouTube terlebih dahulu!');
    if (!user || user.credits <= 0) return alert('Kredit Anda tidak mencukupi (0), silakan Top Up terlebih dahulu.');

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/clips', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': localStorage.getItem('userId')
        },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (res.ok) {
        setUrl('');
        fetchClips();
        fetchUser();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="card process-card">
        <div className="input-group">
          <label className="input-label">Link YouTube</label>
          <input 
            type="text" 
            placeholder="https://www.youtube.com/watch?v=..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        
        <div className="advanced-options-wrapper">
          <div className="advanced-header">
            <div className="advanced-text">
              <h4>Opsi lanjutan</h4>
              <p>Atur subtitle otomatis dan mode layout.</p>
            </div>
            <button className="btn btn-outline show-btn" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'SEMBUNYIKAN' : 'TAMPILKAN'} {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          {showAdvanced && (
            <div className="advanced-body">
              <h4 className="advanced-section-title">Subtitle &amp; Transcript</h4>
              
              <div className="subtitle-card">
                <div className="subtitle-header">
                  <div>
                    <h5>Auto subtitle aktif</h5>
                    <p>Subtitle branding ala viral clip + transcript untuk scoring lebih akurat.</p>
                  </div>
                  <div className={`toggle-switch ${autoSubtitle ? 'active' : ''}`} onClick={() => setAutoSubtitle(!autoSubtitle)}>
                    <span className="toggle-label">{autoSubtitle ? 'ON' : 'OFF'}</span>
                  </div>
                </div>
                
                <div className="subtitle-features">
                  <div className="feature-item">
                    <h6>Highlight Kata</h6>
                    <p>Huruf kapital + warna ganda untuk punchline.</p>
                  </div>
                  <div className="feature-item">
                    <h6>Transcript Kaya</h6>
                    <p>Meningkatkan akurasi LLM saat pilih 3 klip.</p>
                  </div>
                </div>
              </div>

              <h4 className="advanced-section-title">Mode Layout</h4>
              <p className="layout-subtitle">Pilih look akhir sesuai kontenmu.</p>
              
              <div className="layout-options">
                <div className={`layout-card ${selectedLayout === 'auto_magic' ? 'selected' : ''}`} onClick={() => setSelectedLayout('auto_magic')}>
                  <div className="layout-badge">DISARANKAN</div>
                  <h5>Auto Magic</h5>
                  <p>AI menilai konten, pilih blur / reframe terbaik tanpa mikir.</p>
                  <div className="layout-preview auto-magic-preview">
                    <div className="preview-inner">
                      <span className="ai-mix-text">AI MIX</span>
                      <span className="auto-text">Auto pilih layout<br/>terbaik</span>
                      <span className="tanpa-repot-text">Tanpa repot</span>
                    </div>
                  </div>
                </div>
                
                <div className={`layout-card ${selectedLayout === 'gaussian' ? 'selected' : ''}`} onClick={() => setSelectedLayout('gaussian')}>
                  <h5>Gaussian Blur</h5>
                  <p>Latar belakang blur lembut + fokus ke frame utama.</p>
                  <div className="layout-preview">
                    <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=150&h=250&fit=crop" alt="Gaussian" />
                  </div>
                </div>
                
                <div className={`layout-card ${selectedLayout === 'reframe' ? 'selected' : ''}`} onClick={() => setSelectedLayout('reframe')}>
                  <div className="layout-badge beta-badge">BETA</div>
                  <h5>Auto Reframe</h5>
                  <p>Crop dinamis mengikuti wajah &amp; objek (butuh video high-res).</p>
                  <div className="layout-preview">
                    <img src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=150&h=250&fit=crop" alt="Reframe" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <button 
          className="btn btn-primary process-btn" 
          disabled={loading || !url}
          onClick={handleProcess}
        >
          {loading ? <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Loader2 size={18} className="animate-spin" /> Memproses...</span> : 'Proses Klip'}
        </button>
        
        <div className="additional-info-wrapper">
          <div className="additional-info-toggle" onClick={() => setShowInfo(!showInfo)}>
            <Info size={16} className="info-icon" />
            <span>Informasi tambahan</span>
            {showInfo ? <ChevronUp size={16} className="info-chevron" /> : <ChevronDown size={16} className="info-chevron" />}
          </div>
          
          {showInfo && (
            <div className="additional-info-content">
              <ul>
                <li><CheckCircle size={18} className="text-primary-icon" /> 1 kredit per request. Bila gagal, kredit dikembalikan otomatis.</li>
                <li><CheckCircle size={18} className="text-primary-icon" /> Estimasi 5-30 menit tergantung durasi video dan antrian.</li>
                <li><CheckCircle size={18} className="text-primary-icon" /> Kamu boleh meninggalkan halaman ini, kami akan kirim notifikasi email saat selesai.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <div className="card results-section">
        <h2 className="section-title">Hasil Klip</h2>
        <p className="section-subtitle">Lihat klip yang sudah jadi dan pantau progress yang sedang diproses.</p>
        
        <div className="clips-list" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          {clips.length === 0 && (
            <div style={{textAlign: 'center', padding: '2rem', color: '#64748b'}}>
              Belum ada video yang diproses.
            </div>
          )}

          {clips.map(clip => (
            <div key={clip.id} className="result-card" style={clip.status === 'processing' ? { opacity: 0.7, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' } : {}}>
              {/* Thumbnail dengan YouTube-aware fallback */}
              <div className="result-image-container">
                <div className="result-badges">
                  {clip.status === 'completed' ? (
                    <span className="badge badge-dark">SELESAI</span>
                  ) : (
                    <span className="badge badge-dark" style={{backgroundColor: '#eab308'}}>MEMPROSES</span>
                  )}
                  <span className="badge badge-light">AUTO MAGIC</span>
                </div>
                {(clip.thumbnail || getYouTubeThumbnail(clip.url)) ? (
                  <img
                    src={clip.thumbnail || getYouTubeThumbnail(clip.url)}
                    alt={clip.title}
                    className="result-thumbnail"
                    onError={(e) => {
                      // Fallback ke hqdefault jika maxresdefault tidak ada
                      const id = getYouTubeId(clip.url);
                      if (id && e.target.src.includes('maxresdefault')) {
                        e.target.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
                      } else if (id && e.target.src.includes('hqdefault')) {
                        e.target.src = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
                      } else {
                        // Fallback ke placeholder
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {/* Placeholder kalau tidak ada thumbnail atau load error */}
                <div 
                  className="result-thumbnail-placeholder"
                  style={{ display: (clip.thumbnail || getYouTubeThumbnail(clip.url)) ? 'none' : 'flex' }}
                >
                  <Youtube size={36} style={{color: '#cbd5e1'}} />
                  <span style={{fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px'}}>Thumbnail tidak tersedia</span>
                </div>
              </div>
              <div className="result-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 className="result-title">
                  {clip.title}
                </h3>
                <a href={clip.url} target="_blank" rel="noreferrer" className="result-url">
                  {clip.url}
                </a>
                <div className="result-meta">
                  {new Date(clip.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('pukul ', '')} &bull; Auto Magic &bull; <span className="meta-subtitle">Subtitle</span>
                </div>
                <div className="result-meta meta-duration" style={{ flexGrow: 1 }}>
                  {clip.status === 'completed' ? 'Selesai dalam 17m' : (
                    <ProcessingStatus createdAt={clip.created_at || new Date().toISOString()} />
                  )}
                </div>
                
                <div className="result-actions" style={{ marginTop: 'auto', display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                  {clip.status === 'completed' ? (
                    <div className="status-completed-badge" style={{ backgroundColor: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', gap: '6px', padding: '0.7rem 1.5rem', borderRadius: '9999px', fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      <CheckCircle size={18} /> Selesai
                    </div>
                  ) : (
                    <div className="status-processing-badge" style={{ flex: 1, justifyContent: 'center', padding: '0.7rem 1.5rem', borderRadius: '12px', fontSize: '1rem' }}>
                      <Loader2 size={18} className="animate-spin" /> Memproses AI...
                    </div>
                  )}

                  {clip.status === 'completed' && (
                    <button className="btn btn-primary btn-lihat" style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '1rem', padding: '0.7rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', flex: 1, transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2), 0 2px 4px -1px rgba(99, 102, 241, 0.1)' }} onClick={() => setSelectedClip(clip)} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.3), 0 4px 6px -2px rgba(99, 102, 241, 0.1)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(99, 102, 241, 0.2), 0 2px 4px -1px rgba(99, 102, 241, 0.1)'; }}>
                      <Video size={20} /> Lihat Klip
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedClip && (
        <ClipViewerOverlay clip={selectedClip} onClose={() => setSelectedClip(null)} />
      )}
    </div>
  );
}
