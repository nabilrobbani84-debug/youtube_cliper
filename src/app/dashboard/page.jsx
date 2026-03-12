"use client";
import "./home.css";
import { Info, ChevronDown, ChevronUp, CheckCircle, Loader2, Video, X, Download, Star, Youtube } from 'lucide-react';
import { useState, useEffect } from 'react';
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

function ClipViewerOverlay({ clip, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Gunakan data sub-clips nyata dari backend
  // Jika tidak ada, gunakan data dummy agar UI tidak kosong (fallback)
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
  const videoThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111111] flex flex-col" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999 }}>
      <div className="flex justify-between items-center p-4 bg-black/80 text-white z-50 absolute top-0 left-0 w-full backdrop-blur-md">
        <h3 className="font-bold text-lg">{clip.title}</h3>
        <button className="text-white hover:text-gray-300" onClick={onClose}>
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 w-full h-full overflow-y-auto" style={{ paddingTop: '64px' }}>
        <div className="px-4 pb-6 flex items-center justify-center overflow-hidden" style={{ minHeight: "1272px", paddingTop: "0px", overscrollBehaviorY: "contain" }}>
          <div className="relative w-full max-w-5xl" style={{ height: "760px" }}>
            <div className="relative h-full">
              {clipsData.map((data, index) => {
                const isActive = currentIndex === index;
                const offset = (index - currentIndex) * 760;
                return (
                  <div key={index} className={`absolute inset-0 transition-all duration-300 ease-out z-${isActive ? '10' : '0'}`} style={{ transform: `translateY(${offset}px)`, opacity: isActive ? 1 : 0 }}>
                    <div className="flex h-full w-full items-center justify-center px-4">
                      <div className="relative w-full max-w-sm bg-black cursor-pointer slide-transition" style={{ height: "760px" }}>
                        <div className="relative h-full w-full rounded-2xl overflow-hidden">
                          <video preload={isActive ? "auto" : "metadata"} className="h-full w-full object-cover" poster={videoThumbnail} playsInline webkitPlaysInline={true} loop={true} autoPlay={isActive} src={data.url} type="video/mp4" muted={!isActive}>Browser Anda tidak mendukung pemutaran video.</video>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60">
                          <div className="absolute top-6 left-6 z-20">
                            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2"><span className="text-white font-bold text-lg">#{index + 1}</span></div>
                          </div>
                          <div className="absolute top-6 right-6 z-20">
                            <div className="bg-emerald-500/90 text-white rounded-full px-4 py-2 font-semibold flex items-center gap-2">
                              <Star className="h-4 w-4 text-white" />
                              <span className="text-sm tabular-nums">{data.score}<span className="text-white/70 text-xs"> / 10.0</span></span>
                            </div>
                          </div>
                          <div className="absolute bottom-24 left-6 right-6 z-20">
                            <p className="text-white font-semibold text-lg mb-2 line-clamp-3 drop-shadow-lg">{data.title}</p>
                          </div>
                          <div className="absolute bottom-8 left-6 right-6 z-20">
                            <a href={data.url} download={`klip-viral-${index+1}.mp4`} target="_blank" rel="noreferrer" data-slot="button" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none h-8 rounded-md gap-1.5 px-3 w-full bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm cursor-pointer border" style={{border: '1px solid rgba(255,255,255,0.3)'}}>
                              <Download className="h-4 w-4 mr-2" />
                              <span className="text-sm">Download HD (.mp4)</span>
                            </a>
                          </div>
                          <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-4 z-30">
                            <button className={`bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full p-3 transition-all backdrop-blur-sm cursor-pointer`} disabled={index === 0} onClick={() => setCurrentIndex(index - 1)}>
                              <ChevronUp className="h-6 w-6" />
                            </button>
                            <button className={`bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full p-3 transition-all backdrop-blur-sm cursor-pointer`} disabled={index === clipsData.length - 1} onClick={() => setCurrentIndex(index + 1)}>
                              <ChevronDown className="h-6 w-6" />
                            </button>
                          </div>
                          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex gap-1 z-20">
                            {clipsData.map((_, dotIndex) => (
                              <div key={dotIndex} className={`h-1 rounded-full transition-all duration-300 ${dotIndex === index ? 'bg-white w-6' : 'bg-white/40 w-1'}`}></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
                  {new Date(clip.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('pukul ', '')} &bull; Auto Magic &bull; <span className="meta-subtitle">&bull; Subtitle</span>
                </div>
                <div className="result-meta meta-duration" style={{ flexGrow: 1 }}>
                  {clip.status === 'completed' ? 'Selesai dalam 17m' : 'Sedang mencari momen AI...'}
                </div>
                
                <div className="result-actions" style={{ marginTop: 'auto' }}>
                  {clip.status === 'completed' ? (
                    <div className="status-completed-badge" style={{ backgroundColor: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }}>
                      <CheckCircle size={14} /> Selesai
                    </div>
                  ) : (
                    <div className="status-processing-badge">
                      <Loader2 size={14} className="animate-spin" /> Memproses
                    </div>
                  )}

                  {clip.status === 'completed' && (
                    <button className="btn btn-primary btn-lihat" style={{ backgroundColor: '#6366f1', borderRadius: '8px', fontWeight: 600 }} onClick={() => setSelectedClip(clip)}>
                      <Video size={16} /> Lihat Klip
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
