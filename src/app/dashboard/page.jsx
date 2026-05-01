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
function getYouTubeThumbnail(url, quality = 'maxresdefault') {
  const id = getYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
}

function getLayoutLabel(layout) {
  const labels = {
    auto_magic: 'Auto Magic',
    gaussian: 'Gaussian Blur',
    reframe: 'Auto Reframe',
  };

  return labels[layout] || 'Auto Magic';
}

function getCaptionPresetMeta(preset, customBrand = null) {
  const presets = {
    viral_neon: {
      label: 'Viral Neon',
      accent: '#facc15',
      textColor: '#ffffff',
      shadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 6px 12px rgba(0,0,0,0.9)',
      stroke: '1px black',
      background: 'rgba(0,0,0,0.45)',
      chip: 'Caption tebal dengan emphasis agresif untuk hook cepat.'
    },
    clean_cinema: {
      label: 'Clean Cinema',
      accent: '#f8fafc',
      textColor: '#f8fafc',
      shadow: '0 10px 24px rgba(0,0,0,0.8)',
      stroke: '0.6px rgba(15,23,42,0.75)',
      background: 'rgba(15,23,42,0.3)',
      chip: 'Tampilan lebih clean dan premium untuk storytelling.'
    },
    creator_pop: {
      label: 'Creator Pop',
      accent: '#fb7185',
      textColor: '#ffffff',
      shadow: '0 0 0 #000, 0 10px 18px rgba(0,0,0,0.75)',
      stroke: '1px rgba(15,23,42,0.9)',
      background: 'rgba(30,41,59,0.55)',
      chip: 'Kontras tinggi dan playful untuk konten creator.'
    },
    custom_brand: {
      label: customBrand?.name || 'Custom Brand',
      accent: customBrand?.accent || '#22c55e',
      textColor: customBrand?.textColor || '#ffffff',
      shadow: '0 10px 24px rgba(0,0,0,0.75)',
      stroke: '1px rgba(15,23,42,0.88)',
      background: customBrand?.background || 'rgba(15,23,42,0.45)',
      chip: 'Preset warna subtitle yang mengikuti brand kamu sendiri.'
    },
  };

  return presets[preset] || presets.viral_neon;
}

function AnimatedSubtitle({ subtitles, subtitleTimeline = [], isActive, captionPreset = 'viral_neon', customBrand = null }) {
  const [subIndex, setSubIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [wordProgress, setWordProgress] = useState(0);
  const presetMeta = getCaptionPresetMeta(captionPreset, customBrand);
  const activeSubtitle = subtitles[subIndex] || { text: '' };
  const activeTimeline = subtitleTimeline[subIndex] || null;
  const words = typeof activeSubtitle === 'string'
    ? activeSubtitle.split(' ')
    : (activeSubtitle.text || '').split(' ');
  const emphasisWords = new Set(
    typeof activeSubtitle === 'string'
      ? []
      : (activeSubtitle.emphasis || []).map((word) => word.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase())
  );

  useEffect(() => {
    if (!isActive) return;
    setSubIndex(0);
    setVisible(true);
    setWordProgress(0);
    const durations = subtitleTimeline.length > 0
      ? subtitleTimeline.map((entry) => Math.max(1800, ((entry.totalDuration || 1.8) * 1000) + 900))
      : subtitles.map(() => 2800);
    let currentIndex = 0;
    let timeoutId = null;

    const advance = () => {
      const lineDuration = durations[currentIndex] || 2800;
      timeoutId = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          currentIndex = (currentIndex + 1) % Math.max(subtitles.length, 1);
          setSubIndex(currentIndex);
          setVisible(true);
          setWordProgress(0);
          advance();
        }, 220);
      }, lineDuration);
    };

    advance();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, subtitles, subtitleTimeline]);

  useEffect(() => {
    if (!isActive || words.length === 0) return;
    setWordProgress(0);
    if (activeTimeline?.wordTimings?.length) {
      const timers = activeTimeline.wordTimings.map((timing, index) => setTimeout(() => {
        setWordProgress(index);
      }, Math.max(0, timing.start * 1000)));
      return () => timers.forEach((timer) => clearTimeout(timer));
    }

    const step = Math.max(140, Math.floor(1500 / Math.max(words.length, 1)));
    const interval = setInterval(() => {
      setWordProgress((value) => {
        if (value >= words.length - 1) {
          clearInterval(interval);
          return value;
        }
        return value + 1;
      });
    }, step);

    return () => clearInterval(interval);
  }, [isActive, subIndex, words.length, activeTimeline]);

  return (
    <div className="absolute inset-x-0 bottom-[22%] flex justify-center pointer-events-none z-10 px-6">
      <div
        className="text-center transition-all duration-300 transform"
        style={{ 
          opacity: visible ? 1 : 0, 
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.95)',
          filter: visible ? 'drop-shadow(0 15px 15px rgba(0,0,0,0.6))' : 'none'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
          {words.map((word, wi) => {
            const normalizedWord = word.replace(/[^\p{L}\p{N}-]/gu, '').toLowerCase();
            const isHighlighted = emphasisWords.has(normalizedWord) || (word === word.toUpperCase() && word.length > 2 && !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(word));
            const isSpoken = wi <= wordProgress;
            return (
              <span 
                key={wi} 
                className="font-black text-[25px] md:text-[32px] tracking-tight uppercase px-[6px] py-[2px] rounded-lg"
                style={{
                  color: isHighlighted ? presetMeta.accent : presetMeta.textColor,
                  background: isHighlighted ? presetMeta.background : 'transparent',
                  textShadow: presetMeta.shadow,
                  WebkitTextStroke: presetMeta.stroke,
                  lineHeight: '1.2',
                  transform: isSpoken ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.92)',
                  opacity: isSpoken ? 1 : 0.35,
                  filter: isSpoken ? 'none' : 'blur(0.2px)',
                  transition: 'transform 180ms ease, opacity 180ms ease, filter 180ms ease, color 180ms ease'
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniWaveformTimeline({ subtitleTimeline = [], accentColor = '#facc15', activeIndex = 0 }) {
  const activeLine = subtitleTimeline[activeIndex] || null;
  const bars = activeLine?.wordTimings?.length
    ? activeLine.wordTimings.map((timing, index) => ({
        id: `${activeIndex}-${index}`,
        height: 28 + Math.round(((timing.end - timing.start) * 100) % 42),
        emphasized: timing.emphasized,
        label: timing.word
      }))
    : Array.from({ length: 14 }, (_, index) => ({
        id: `fallback-${index}`,
        height: 24 + ((index * 11) % 36),
        emphasized: index % 4 === 0,
        label: ''
      }));

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(2,6,23,0.82), rgba(15,23,42,0.92))',
      border: '1px solid rgba(148,163,184,0.18)',
      borderRadius: 18,
      padding: '14px 14px 12px',
      marginBottom: 16,
      boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ color: '#cbd5e1', fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Waveform Preview</div>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>Timing subtitle per kata dan emphasis aktif</div>
        </div>
        <div style={{ color: accentColor, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>
          {activeLine?.totalDuration ? `${activeLine.totalDuration.toFixed(2)}s` : 'LIVE'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 74, marginBottom: 10 }}>
        {bars.map((bar, index) => (
          <div
            key={bar.id}
            title={bar.label}
            style={{
              flex: 1,
              minWidth: 8,
              height: `${bar.height}px`,
              borderRadius: 999,
              background: bar.emphasized
                ? `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.16))`
                : 'linear-gradient(180deg, rgba(148,163,184,0.9), rgba(51,65,85,0.7))',
              boxShadow: bar.emphasized ? `0 0 0 1px ${accentColor}33, 0 8px 20px ${accentColor}22` : 'none',
              opacity: index <= Math.max(0, activeLine?.wordTimings?.length ? activeLine.wordTimings.length - 1 : 999) ? 1 : 0.65
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {subtitleTimeline.map((line, index) => (
          <div
            key={`line-${index}`}
            style={{
              padding: '5px 9px',
              borderRadius: 999,
              background: index === activeIndex ? `${accentColor}22` : 'rgba(255,255,255,0.06)',
              border: index === activeIndex ? `1px solid ${accentColor}55` : '1px solid rgba(148,163,184,0.14)',
              color: index === activeIndex ? '#f8fafc' : '#94a3b8',
              fontSize: 11,
              fontWeight: 700
            }}
          >
            Line {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClipViewerOverlay({ clip, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [downloadingIndex, setDownloadingIndex] = useState(null);

  async function downloadClip(videoUrl, title, index) {
    if (downloadingIndex !== null) return;
    setDownloadingIndex(index);
    try {
      const safeTitle = (title || 'youclip-klip').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-');
      const filename = `${safeTitle}-klip${index + 1}.mp4`;

      // Gunakan server proxy agar CORS tidak jadi masalah
      const proxyUrl = `http://localhost:5000/api/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Server error ' + response.status);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: buka di tab baru untuk download manual
      window.open(videoUrl, '_blank');
    } finally {
      setDownloadingIndex(null);
    }
  }


  const clipsData = (clip.sub_clips && clip.sub_clips.length > 0)
    ? clip.sub_clips
    : [{
        url: "https://youclip-production.s3.ap-southeast-2.amazonaws.com/renders/BARU%203%20HARI%20KERJA%20FANDI%20DI%20TUNTUT%20HUKUMAN%20M%EF%BC%8A-TI%E2%81%89%EF%B8%8F%20SEMUA%20INI%20HANYA%20JEBAKAN%E2%80%BC%EF%B8%8F%20%5Bd2zDV6lo9IU%5D_1248.84-1323.08_final.mp4",
        title: clip.title || "Klip siap upload",
        score: "9.2",
        category: "Highlight",
        platform: "TikTok, Reels, Shorts",
        editorialNote: "Klip fallback ini ditampilkan untuk menjaga preview tetap hidup sambil menunggu metadata lengkap dari proses backend.",
        subtitles: ["Preview hasil render final."],
        subtitleMode: "burned-in-pro",
        captionPreset: clip.caption_preset || 'viral_neon',
        captionPresetLabel: getCaptionPresetMeta(clip.caption_preset || 'viral_neon', clip.caption_brand).label,
        captionVibe: getCaptionPresetMeta(clip.caption_preset || 'viral_neon', clip.caption_brand).chip,
        captionBrand: clip.caption_brand || null,
        layoutLabel: getLayoutLabel(clip.layout),
        finishing: "Professional short-form finish",
        hook: "Potongan utama yang siap dipakai",
        durationLabel: "00:45"
      }];

  const videoId = getYouTubeId(clip.url);

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
          const currentSubtitles = data.subtitles && data.subtitles.length > 0
            ? data.subtitles
            : [data.hook || "Klip profesional siap tayang."];
          const category = data.category || 'Highlight';
          const platform = data.platform || 'TikTok, Reels, Shorts';
          const editorialNote = data.editorialNote || 'Klip ini dipilih karena punya tempo yang enak, hook kuat, dan aman untuk format vertikal.';
          const finishing = data.finishing || 'Professional short-form finish';
          const hook = data.hook || data.title;
          const durationLabel = data.durationLabel || '00:45';
          const subtitleMode = data.subtitleMode || 'burned-in-pro';
          const captionPreset = data.captionPreset || clip.caption_preset || 'viral_neon';
          const customBrand = data.captionBrand || clip.caption_brand || null;
          const captionPresetLabel = data.captionPresetLabel || getCaptionPresetMeta(captionPreset, customBrand).label;
          const captionVibe = data.captionVibe || getCaptionPresetMeta(captionPreset, customBrand).chip;
          const subtitleTimeline = data.subtitleTimeline || [];
          const accentColor = data.accentColor || getCaptionPresetMeta(captionPreset, customBrand).accent;

          return (
            <div key={index} style={{ position: 'relative', width: '100%', height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#000' }}>

              {/* ── VIDEO FINAL RESULT ── */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'radial-gradient(circle at top, rgba(79,70,229,0.35), transparent 40%), #000' }}>
                <video
                  key={`${data.url}-${isActive ? 'active' : 'idle'}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  src={data.url}
                  poster={clip.thumbnail || getYouTubeThumbnail(clip.url)}
                  autoPlay={isActive}
                  muted
                  playsInline
                  loop
                  controls={false}
                  preload={isActive ? 'auto' : 'metadata'}
                />
              </div>

              {/* ── GRADIENT OVERLAYS ── */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.05) 18%, rgba(2,6,23,0.25) 45%, rgba(2,6,23,0.96) 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), transparent 30%, transparent 70%, rgba(16,185,129,0.15))', pointerEvents: 'none' }} />

              {/* ── SCORE BADGE (top-right) ── */}
              <div style={{ position: 'absolute', top: 70, right: 16, background: 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(6,95,70,0.95) 100%)', border: '1px solid rgba(52,211,153,0.5)', boxShadow: '0 4px 15px rgba(16,185,129,0.4)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={14} color="#fef08a" fill="#fef08a" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                <span style={{ color: 'white', fontWeight: 900, fontSize: 15, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{cleanScore}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 12 }}>/10</span>
              </div>

              {/* ── KLIP NUMBER (top-left) ── */}
              <div style={{ position: 'absolute', top: 70, left: 16, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', borderRadius: 100, padding: '8px 16px' }}>
                <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 800, fontSize: 13, letterSpacing: '0.02em' }}>Klip #{index + 1} <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>dari {clipsData.length}</span></span>
              </div>

              <div style={{ position: 'absolute', top: 122, left: 16, display: 'flex', gap: 8, flexWrap: 'wrap', zIndex: 10 }}>
                <span style={{ background: 'rgba(15,23,42,0.65)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '7px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{data.layoutLabel || getLayoutLabel(clip.layout)}</span>
                <span style={{ background: 'rgba(79,70,229,0.28)', color: '#e0e7ff', border: '1px solid rgba(165,180,252,0.35)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: '7px 12px', fontSize: 11, fontWeight: 700 }}>{durationLabel}</span>
              </div>

              {/* ── ANIMATED SUBTITLE ── */}
              <AnimatedSubtitle
                subtitles={currentSubtitles}
                subtitleTimeline={subtitleTimeline}
                isActive={isActive}
                captionPreset={captionPreset}
                customBrand={customBrand}
              />

              {/* ── BOTTOM INFO + ACTIONS ── */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 20px', zIndex: 10 }}>

                {/* Title */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', padding: '7px 12px', borderRadius: 999, backdropFilter: 'blur(10px)' }}>
                  <Sparkles size={13} color="#c4b5fd" />
                  <span style={{ color: '#e9d5ff', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{finishing}</span>
                </div>

                <h3 style={{ color: 'white', fontWeight: 900, fontSize: 19, marginBottom: 10, lineHeight: 1.3, textShadow: '0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)', paddingRight: '40px' }}>{data.title}</h3>

                <p style={{ color: 'rgba(255,255,255,0.86)', fontSize: 13, lineHeight: 1.55, margin: '0 0 14px 0', maxWidth: 520 }}>
                  {hook}
                </p>

                <MiniWaveformTimeline
                  subtitleTimeline={subtitleTimeline}
                  accentColor={accentColor}
                  activeIndex={Math.min(currentIndex, Math.max(0, subtitleTimeline.length - 1))}
                />

                {/* Translation box */}
                <div style={{ background: 'linear-gradient(145deg, rgba(15,12,45,0.85), rgba(7,5,25,0.95))', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 16, padding: '14px', marginBottom: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Languages size={15} color="#a5b4fc" />
                    <span style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Analisis & Terjemahan AI</span>
                    <div style={{ marginLeft: 'auto', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 10px rgba(99,102,241,0.4)' }}>
                      <Sparkles size={11} color="#fff" />
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>PRO</span>
                    </div>
                  </div>
                  <p style={{ color: 'rgba(226,232,240,0.95)', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px 0', fontWeight: 500 }}>
                    {editorialNote}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: 8, fontSize: 11, color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{color: '#94a3b8', fontWeight: 500}}>Kategori:</span> {category}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: 8, fontSize: 11, color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{color: '#94a3b8', fontWeight: 500}}>Target:</span> {platform}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: 8, fontSize: 11, color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{color: '#94a3b8', fontWeight: 500}}>Subtitle:</span> {subtitleMode === 'burned-in-pro' ? 'Burned-in Pro' : 'Clean'}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: 8, fontSize: 11, color: '#e2e8f0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{color: '#94a3b8', fontWeight: 500}}>Preset:</span> {captionPresetLabel}
                    </div>
                  </div>
                  <p style={{ color: 'rgba(191,219,254,0.9)', fontSize: 11, lineHeight: 1.5, margin: '10px 0 0 0' }}>{captionVibe}</p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => downloadClip(data.url, data.title, index)}
                    disabled={downloadingIndex !== null}
                    style={{ flex: 1, height: 48, background: downloadingIndex === index ? 'linear-gradient(135deg, #047857, #065f46)' : 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: downloadingIndex !== null ? 'not-allowed' : 'pointer', boxShadow: '0 4px 20px rgba(16,185,129,0.4)', opacity: downloadingIndex !== null && downloadingIndex !== index ? 0.6 : 1, transition: 'all 0.2s' }}
                  >
                    {downloadingIndex === index ? (
                      <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Mengunduh...</>
                    ) : (
                      <><Download size={17} /> Unduh Klip</>
                    )}
                  </button>
                  <a
                    href={videoId ? `https://youtu.be/${videoId}` : clip.url}
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

  const pipelineStages = [
    { label: 'Ingest video YouTube', detail: 'Mengambil metadata, thumbnail, dan sumber video.', start: 0, end: 12 },
    { label: 'Transkripsi & diarization', detail: 'AI membaca ucapan, jeda, dan momen penekanan speaker.', start: 12, end: 34 },
    { label: 'Cari hook & highlight', detail: 'Model menilai retensi, punchline, dan momen paling tajam.', start: 34, end: 63 },
    { label: 'Sync subtitle per kata', detail: 'Caption disusun dengan timing kata, emphasis, dan pacing.', start: 63, end: 82 },
    { label: 'Render vertical final', detail: 'Auto-crop, styling, dan packaging hasil siap upload.', start: 82, end: 100 },
  ];

  const totalTime = 42000;
  const progressPercent = Math.min(99, Math.max(3, (elapsed / totalTime) * 100));
  const activeStage = pipelineStages.find((stage) => progressPercent >= stage.start && progressPercent < stage.end) || pipelineStages[pipelineStages.length - 1];

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', color: '#6366f1' }}>
        <span className="animate-pulse">{activeStage.label}</span>
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
      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '12px', background: 'linear-gradient(135deg, #eef2ff, #f8fafc)', border: '1px solid #dbeafe' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3730a3', marginBottom: '4px' }}>{activeStage.detail}</div>
        <div style={{ display: 'grid', gap: '6px' }}>
          {pipelineStages.map((stage, index) => {
            const done = progressPercent >= stage.end;
            const active = activeStage.label === stage.label;
            return (
              <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: active ? '#312e81' : done ? '#475569' : '#94a3b8', fontWeight: active ? 700 : 600 }}>
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done ? '#6366f1' : active ? '#c7d2fe' : '#e2e8f0',
                  color: done ? '#fff' : active ? '#4338ca' : '#64748b',
                  fontSize: '0.65rem'
                }}>{done ? '✓' : index + 1}</span>
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, fetchUser } = useUser();
  const lastSyncedBrandRef = useRef('');
  const [url, setUrl] = useState('');
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [autoSubtitle, setAutoSubtitle] = useState(true);
  const [selectedLayout, setSelectedLayout] = useState('auto_magic');
  const [selectedCaptionPreset, setSelectedCaptionPreset] = useState('viral_neon');
  const [customCaptionBrand, setCustomCaptionBrand] = useState({
    name: 'Brand Saya',
    accent: '#22c55e',
    textColor: '#ffffff',
    background: 'rgba(15,23,42,0.45)'
  });
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
    const savedCaptionBrand = localStorage.getItem('youclipCustomCaptionBrand');
    if (savedCaptionBrand) {
      try {
        setCustomCaptionBrand(JSON.parse(savedCaptionBrand));
      } catch (error) {
        console.error('Failed to parse custom caption brand:', error);
      }
    }

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

  useEffect(() => {
    if (user?.caption_brand) {
      const nextSerialized = JSON.stringify(user.caption_brand);
      if (nextSerialized !== JSON.stringify(customCaptionBrand)) {
        lastSyncedBrandRef.current = nextSerialized;
        setCustomCaptionBrand(user.caption_brand);
      }
    }
  }, [user?.caption_brand]);

  useEffect(() => {
    localStorage.setItem('youclipCustomCaptionBrand', JSON.stringify(customCaptionBrand));
  }, [customCaptionBrand]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId || !customCaptionBrand?.name) return;
    const serializedBrand = JSON.stringify(customCaptionBrand);
    if (serializedBrand === lastSyncedBrandRef.current) return;

    const timeoutId = setTimeout(async () => {
      try {
        await fetch('http://localhost:5000/api/user/caption-brand', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify({ captionBrand: customCaptionBrand })
        });
        lastSyncedBrandRef.current = serializedBrand;
        fetchUser();
      } catch (error) {
        console.error('Failed to save caption brand:', error);
      }
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [customCaptionBrand, fetchUser]);

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
        body: JSON.stringify({
          url,
          autoSubtitle,
          layout: selectedLayout,
          captionPreset: selectedCaptionPreset,
          captionBrand: selectedCaptionPreset === 'custom_brand' ? customCaptionBrand : null
        })
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

              <h4 className="advanced-section-title">Preset Caption Brand</h4>
              <p className="layout-subtitle">Atur rasa subtitle supaya hasil klip lebih punya identitas visual.</p>

              <div className="layout-options caption-preset-grid">
                <div className={`layout-card ${selectedCaptionPreset === 'viral_neon' ? 'selected' : ''}`} onClick={() => setSelectedCaptionPreset('viral_neon')}>
                  <div className="layout-badge">HOT</div>
                  <h5>Viral Neon</h5>
                  <p>Subtitle besar, kuning menyala, cocok buat hook cepat dan clip viral.</p>
                  <div className="caption-preview caption-preview-neon">
                    <span>STOP</span>
                    <small>scroll dulu</small>
                  </div>
                </div>

                <div className={`layout-card ${selectedCaptionPreset === 'clean_cinema' ? 'selected' : ''}`} onClick={() => setSelectedCaptionPreset('clean_cinema')}>
                  <h5>Clean Cinema</h5>
                  <p>Lebih minimal, tenang, dan terlihat premium untuk format storytelling.</p>
                  <div className="caption-preview caption-preview-cinema">
                    <span>ini bagian</span>
                    <small>paling penting</small>
                  </div>
                </div>

                <div className={`layout-card ${selectedCaptionPreset === 'creator_pop' ? 'selected' : ''}`} onClick={() => setSelectedCaptionPreset('creator_pop')}>
                  <div className="layout-badge beta-badge">FRESH</div>
                  <h5>Creator Pop</h5>
                  <p>Warna lebih playful dan kontras tinggi untuk creator yang enerjik.</p>
                  <div className="caption-preview caption-preview-pop">
                    <span>WAJIB</span>
                    <small>lihat ending-nya</small>
                  </div>
                </div>

                <div className={`layout-card ${selectedCaptionPreset === 'custom_brand' ? 'selected' : ''}`} onClick={() => setSelectedCaptionPreset('custom_brand')}>
                  <div className="layout-badge">BRAND</div>
                  <h5>{customCaptionBrand.name || 'Custom Brand'}</h5>
                  <p>Pakai palet warna sendiri supaya caption langsung terasa milik brand kamu.</p>
                  <div className="caption-preview caption-preview-custom" style={{ background: customCaptionBrand.background, borderColor: customCaptionBrand.accent }}>
                    <span style={{ color: customCaptionBrand.accent }}>BRAND</span>
                    <small style={{ color: customCaptionBrand.textColor }}>subtitle signature</small>
                  </div>
                </div>
              </div>

              {selectedCaptionPreset === 'custom_brand' && (
                <div className="custom-brand-panel">
                  <div className="custom-brand-header">
                    <h5>Atur Preset Brand Sendiri</h5>
                    <p>Nama dan warna ini dipakai untuk preview subtitle dan hasil mock clip berikutnya.</p>
                  </div>
                  <div className="custom-brand-grid">
                    <label className="custom-brand-field">
                      <span>Nama Brand</span>
                      <input
                        type="text"
                        value={customCaptionBrand.name}
                        onChange={(e) => setCustomCaptionBrand((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Contoh: Fandi Media"
                      />
                    </label>
                    <label className="custom-brand-field color-field">
                      <span>Warna Accent</span>
                      <input
                        type="color"
                        value={customCaptionBrand.accent}
                        onChange={(e) => setCustomCaptionBrand((prev) => ({ ...prev, accent: e.target.value }))}
                      />
                    </label>
                    <label className="custom-brand-field color-field">
                      <span>Warna Teks</span>
                      <input
                        type="color"
                        value={customCaptionBrand.textColor}
                        onChange={(e) => setCustomCaptionBrand((prev) => ({ ...prev, textColor: e.target.value }))}
                      />
                    </label>
                    <label className="custom-brand-field">
                      <span>Background Caption</span>
                      <input
                        type="text"
                        value={customCaptionBrand.background}
                        onChange={(e) => setCustomCaptionBrand((prev) => ({ ...prev, background: e.target.value }))}
                        placeholder="rgba(15,23,42,0.45)"
                      />
                    </label>
                  </div>
                </div>
              )}
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
                  <span className="badge badge-light">{getLayoutLabel(clip.layout)}</span>
                  <span className="badge badge-light badge-caption">{getCaptionPresetMeta(clip.caption_preset || 'viral_neon', clip.caption_brand).label}</span>
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
                  {new Date(clip.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace('pukul ', '')} &bull; {getLayoutLabel(clip.layout)} &bull; <span className="meta-subtitle">{clip.auto_subtitle === 0 ? 'Clean' : 'Subtitle Pro'}</span> &bull; {getCaptionPresetMeta(clip.caption_preset || 'viral_neon', clip.caption_brand).label}
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
