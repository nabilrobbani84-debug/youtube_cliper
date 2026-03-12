"use client";
import { CheckCircle2, Scissors, Youtube, Instagram, Wand2, Zap, Clock, MessageSquare, PlayCircle, ChevronRight, Menu, X, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Landing() {
  const navigate = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [url, setUrl] = useState('');
  const [activeFaq, setActiveFaq] = useState(null);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('userId'));
  }, []);

  const handleStart = (e) => {
    e.preventDefault();
    if (url) {
      localStorage.setItem('pendingUrl', url);
    }
    
    if (isLoggedIn) {
      navigate.push('/dashboard');
    } else {
      navigate.push('/login');
    }
  };

  const faqs = [
    {
      q: "Apakah kredit bisa hangus atau expired?",
      a: "Tidak. Kredit yang Anda beli adalah permanen dan berlaku seumur hidup. Tidak ada batasan waktu penggunaan."
    },
    {
      q: "Berapa lama proses pembuatan klip?",
      a: "Rata-rata 5-30 menit tergantung durasi video asli. Anda akan mendapat notifikasi email ketika klip sudah siap didownload."
    },
    {
      q: "Video apa saja yang cocok untuk YouClip?",
      a: "Video berbentuk podcast, webinar, tutorial edukasi, atau konten berbicara (talking head) memberikan hasil terbaik. Video dengan musik dominan atau tanpa dialog kurang optimal."
    },
    {
      q: "Apakah ada biaya bulanan atau langganan?",
      a: "Tidak ada biaya bulanan atau biaya tersembunyi. Sekali beli kredit, bisa dipakai kapan saja tanpa batas waktu."
    },
    {
      q: "Apakah saya bisa request fitur tertentu?",
      a: "Tentu! Kami menerima feedback dan request fitur dari semua pengguna. Silakan hubungi kami melalui halaman Bantuan."
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafbfe] font-sans">
      {/* Navigation */}
      <nav className="w-full z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-[72px]">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate.push('/')}>
               <div className="w-8 h-8 rounded-lg bg-[#5340ff] flex items-center justify-center">
                 <Scissors className="text-white" size={18} />
               </div>
               <span className="font-bold text-[1.35rem] text-[#1e1b4b] tracking-tight">YouClip</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#fitur" className="text-sm font-semibold text-[#64748b] hover:text-[#5340ff] transition-colors">Fitur AI</a>
              <a href="#cara-kerja" className="text-sm font-semibold text-[#64748b] hover:text-[#5340ff] transition-colors">Cara Kerja</a>
              <a href="#faq" className="text-sm font-semibold text-[#64748b] hover:text-[#5340ff] transition-colors">FAQ</a>
              
              <div className="h-6 w-px bg-gray-200"></div>

              <div className="flex items-center gap-4">
                {isLoggedIn ? (
                  <Link href="/dashboard" className="bg-[#5340ff] hover:bg-[#4330df] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg shadow-indigo-500/20">
                    Masuk Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm font-semibold text-[#475569] hover:text-[#1e1b4b] transition-colors px-2">
                      Masuk
                    </Link>
                    <Link href="/login" className="bg-[#5340ff] hover:bg-[#4330df] text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 shadow-indigo-500/20">
                      Coba Gratis
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 focus:outline-none">
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-4 space-y-2 absolute w-full left-0 shadow-lg">
            <a href="#fitur" className="block px-3 py-3 rounded-md text-base font-semibold text-gray-700 hover:text-[#5340ff] hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>Fitur AI</a>
            <a href="#cara-kerja" className="block px-3 py-3 rounded-md text-base font-semibold text-gray-700 hover:text-[#5340ff] hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>Cara Kerja</a>
            <a href="#faq" className="block px-3 py-3 rounded-md text-base font-semibold text-gray-700 hover:text-[#5340ff] hover:bg-gray-50" onClick={() => setIsMenuOpen(false)}>FAQ</a>
            <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col gap-3">
              <Link href="/login" className="w-full text-center bg-gray-100 text-[#1e1b4b] px-4 py-3 rounded-xl font-bold">Masuk</Link>
              <Link href="/login" className="w-full text-center bg-[#5340ff] text-white px-4 py-3 rounded-xl font-bold shadow-md shadow-indigo-500/20">Coba Gratis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#eaeaff] text-[#5340ff] text-[0.85rem] font-semibold mb-8 shadow-sm">
          <SparklesIcon className="w-3.5 h-3.5" />
          <span>AI Video Clipper No. 1 di Indonesia</span>
        </div>
        
        <h1 className="text-[3.25rem] sm:text-[4.5rem] lg:text-[5.5rem] font-black text-[#1e1b4b] tracking-[-0.03em] leading-[1.05] mb-8">
          Ubah Video YouTube Panjang<br className="hidden md:block" />
          Jadi <span className="text-[#6e56ff]">Klip Viral</span> Otomatis
        </h1>
        
        <p className="text-[#64748b] text-[1.1rem] sm:text-[1.25rem] max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
          Hemat waktu editing hingga 90%. AI kami otomatis mendeteksi momen terbaik, memotong format vertikal, dan menambahkan subtitle Bahasa Indonesia untuk TikTok, Reels & Shorts.
        </p>

        <form onSubmit={handleStart} className="max-w-2xl mx-auto bg-white p-2.5 rounded-full shadow-[0_10px_40px_-10px_rgba(83,64,255,0.15)] flex flex-col sm:flex-row items-center gap-3 border border-gray-100">
          <div className="flex-grow flex items-center pl-4 w-full h-[52px]">
             <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mr-3 border border-red-100 shrink-0">
               <Youtube className="text-[#ff0000]" size={18} strokeWidth={2.5} />
             </div>
             <input 
               type="url" 
               placeholder="https://youtu.be/FIXQQ7X7tZE?si=1IidZeDoDRVLsKjd" 
               className="w-full h-full outline-none text-[#1e1b4b] text-[1.05rem] font-medium placeholder:text-gray-400 placeholder:font-normal bg-transparent"
               value={url}
               onChange={(e) => setUrl(e.target.value)}
               required
             />
          </div>
          <button type="submit" className="w-full sm:w-auto bg-[#5340ff] hover:bg-[#4330df] text-white h-[52px] px-8 rounded-full font-bold text-[1.05rem] flex items-center justify-center gap-2 transition-all shrink-0">
             Generate Klip <Wand2 size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>

      {/* Feature Section */}
      <section id="fitur" className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-[#fafbfe] border border-gray-100">
               <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                 <Zap className="text-[#5340ff]" size={24} />
               </div>
               <h4 className="text-xl font-bold text-[#1e1b4b] mb-3">AI Moment Detection</h4>
               <p className="text-[#64748b] leading-relaxed font-medium">Dari presentasi 1 jam, AI YouClip menemukan punchline 30 detik terbaik.</p>
            </div>
            
            <div className="p-8 rounded-3xl bg-[#fafbfe] border border-gray-100">
               <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                 <MessageSquare className="text-[#5340ff]" size={24} />
               </div>
               <h4 className="text-xl font-bold text-[#1e1b4b] mb-3">Auto Subtitle</h4>
               <p className="text-[#64748b] leading-relaxed font-medium">Subtitle otomatis dengan akurasi tinggi dan highlight kata layaknya pro.</p>
            </div>
            
            <div className="p-8 rounded-3xl bg-[#fafbfe] border border-gray-100">
               <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                 <PlayCircle className="text-[#5340ff]" size={24} />
               </div>
               <h4 className="text-xl font-bold text-[#1e1b4b] mb-3">Siap Upload MedSos</h4>
               <p className="text-[#64748b] leading-relaxed font-medium">Pemotongan vertikal cerdas untuk TikTok, Reels, dan YouTube Shorts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1e1b4b] tracking-tight mb-4">FAQ</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <button 
                  className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                >
                  <span className="font-bold text-[#1e1b4b]">{faq.q}</span>
                  <ChevronRight className={`text-[#64748b] transition-transform duration-200 ${activeFaq === index ? 'rotate-90' : ''}`} size={20} />
                </button>
                <div className={`px-6 overflow-hidden transition-all duration-300 ${activeFaq === index ? 'max-h-48 pb-5' : 'max-h-0'}`}>
                  <p className="text-[#64748b] font-medium leading-relaxed pt-2 border-t border-gray-100">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SparklesIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  );
}
