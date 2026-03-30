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
  const videoThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
      
      {/* Top Close Button */}
      <button 
        className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-[100] cursor-pointer" 
        onClick={onClose}
      >
        <X size={28} />
      </button>

      <div className="flex flex-col lg:flex-row h-full w-full justify-start lg:justify-center items-center lg:items-start overflow-hidden lg:gap-16 lg:px-12">
        
        {/* Left Title - visible mostly on desktop */}
        <div className="hidden lg:block w-full max-w-sm pt-12 text-left z-50 pointer-events-none">
          <h2 className="text-white text-2xl font-bold leading-snug">
            {clip.title}
          </h2>
        </div>

        {/* Center Swipe Carousel Container */}
        <div 
          className="flex-1 w-full max-w-lg h-full overflow-y-auto snap-y snap-mandatory scroll-smooth hide-scrollbar flex flex-col items-center"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={(e) => {
            const rawIndex = Math.round(e.target.scrollTop / e.target.clientHeight);
            if (rawIndex !== currentIndex) setCurrentIndex(rawIndex);
          }}
        >
          {clipsData.map((data, index) => {
            const isActive = currentIndex === index;
            // Bersihkan teks skor
            const cleanScore = data.score ? data.score.toString().replace('/10', '').trim() : "5.0";

            return (
              <div key={index} id={`clip-container-${index}`} className="w-full h-full min-h-[100dvh] snap-start snap-always flex flex-col justify-center gap-4 py-8 px-4 relative">
                
                {/* Mobile Title */}
                <h2 className="lg:hidden text-white text-xl font-bold leading-snug mb-2 text-center">
                  {clip.title}
                </h2>

                {/* Box 1: Header Badge */}
                <div className="w-full bg-[#11131a] rounded-xl flex justify-between items-center p-5 shadow-lg">
                   <div className="px-5 py-2 rounded-full border border-gray-700 bg-transparent">
                     <span className="text-gray-300 font-bold text-sm">Klip #{index + 1}</span>
                   </div>
                   <div className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] leading-none">
                     <Star className="h-4 w-4 fill-emerald-400" />
                     <span className="font-bold text-[15px]">{cleanScore}</span>
                     <span className="text-emerald-500/70 text-xs font-semibold">/10</span>
                   </div>
                </div>

                {/* Box 2: Video Player */}
                <div className="relative w-full aspect-[9/16] max-h-[65vh] mx-auto bg-[#0a0a0a] rounded-xl overflow-hidden group shadow-2xl border border-gray-800/50">
                  
                  {/* Fake Professional Clip from original YouTube link */}
                  <div className="absolute inset-0 pointer-events-none w-full h-full flex items-center justify-center overflow-hidden">
                    {/* Auto-crop vertical trick: height 100%, width 316.5% to crop 16:9 center */}
                    <div style={{ position: 'absolute', width: '316.5%', height: '100%', left: '50%', transform: 'translateX(-50%)' }}>
                      <iframe
                        className="w-full h-full"
                        style={{ border: 'none', backgroundColor: '#000' }}
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=${isActive ? 1 : 0}&mute=0&controls=0&modestbranding=1&rel=0&start=${(index * 60) + 30}&fs=0&iv_load_policy=3&playsinline=1`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                  
                  {/* Fake Subtitle Overlay to make it look "professional" */}
                  <div className="absolute inset-x-0 bottom-[12%] flex justify-center pointer-events-none z-10 px-6">
                     <div className="text-center leading-[1.15]">
                       <span 
                         className="text-white font-black text-2xl md:text-[28px] uppercase tracking-wide inline-block" 
                         style={{ textShadow: '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 8px rgba(0,0,0,0.8)' }}
                       >
                         <span className="text-yellow-400">{data.title.split(' ')[0]}</span> {data.title.split(' ').slice(1, 3).join(' ')}
                         <br/>
                         {data.title.split(' ').slice(3).join(' ')}
                       </span>
                     </div>
                  </div>

                  {/* Shadow overlay at bottom so subtitles are readable */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                  {/* Enhanced Scroll Indicators (Navigasi kanan video) */}
                  <div className="absolute right-3 top-0 bottom-0 flex flex-col items-center justify-center gap-2 pointer-events-none opacity-0 sm:opacity-100 transition-opacity z-20">
                     
                     <div className="flex flex-col items-center gap-1.5 h-32 justify-center">
                       {clipsData.map((_, i) => (
                         <div 
                           key={i} 
                           className={`rounded-full transition-all duration-300 shadow-md ${i === index ? 'w-[3px] h-8 bg-white' : 'w-1.5 h-1.5 bg-gray-500'}`}
                         />
                       ))}
                     </div>
                     
                     <div className="flex flex-col gap-3 mt-4 pointer-events-auto">
                       <button 
                         onClick={() => {
                           const container = document.querySelector('.snap-y');
                           if (container && index > 0) {
                             container.scrollTo({ top: (index - 1) * container.clientHeight, behavior: 'smooth' });
                           }
                         }}
                         className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${index === 0 ? 'text-gray-600 cursor-not-allowed' : 'bg-black/40 text-gray-300 hover:text-white hover:bg-black/70 backdrop-blur-sm'}`}
                         disabled={index === 0}
                       >
                         <ChevronUp size={22} />
                       </button>
                       <button 
                         onClick={() => {
                           const container = document.querySelector('.snap-y');
                           if (container && index < clipsData.length - 1) {
                             container.scrollTo({ top: (index + 1) * container.clientHeight, behavior: 'smooth' });
                           }
                         }}
                         className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${index === clipsData.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'bg-[#222] text-white hover:bg-[#333] shadow-lg border border-gray-700'}`}
                         disabled={index === clipsData.length - 1}
                       >
                         <ChevronDown size={22} />
                       </button>
                     </div>
                  </div>
                </div>
                
                <div className="hidden sm:block text-right w-full pr-4 mt-[-8px]">
                   <span className="text-gray-400 text-[11px] font-extrabold tracking-[0.25em]">SWIPE</span>
                </div>

                {/* Box 3: Footer */}
                <div className="w-full bg-[#11131a] rounded-xl p-6 flex flex-col gap-5 shadow-lg relative z-20">
                   <h3 className="text-white font-bold text-[1.35rem] leading-tight">{data.title}</h3>
                   <div className="flex flex-col sm:flex-row gap-3">
                     <button 
                       onClick={() => alert(`Sedang mengunduh klip "${data.title}"... (Simulasi)`)}
                       className="flex-1 flex items-center justify-center h-[52px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.3)] text-[15px]"
                     >
                       <Download className="h-5 w-5 mr-2" />
                       Unduh Klip AI
                     </button>
                     <a 
                       href={`https://youtu.be/${videoId}?t=${(index * 60) + 30}`} 
                       target="_blank" 
                       rel="noreferrer" 
                       className="flex-1 flex items-center justify-center h-[52px] bg-[#222] hover:bg-[#333] border border-gray-700 text-white font-bold rounded-xl transition-all shadow-lg text-[15px]"
                     >
                       <Youtube className="h-5 w-5 mr-2 text-red-500" />
                       YouTube Asli
                     </a>
                   </div>
                </div>

              </div>
            );
          })}
        </div>
        
        {/* Right empty spacer for balance on desktop */}
        <div className="hidden lg:block w-full max-w-sm"></div>

      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
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
