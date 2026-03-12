"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from "next/navigation";
import { Scissors, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

// ================================================================
// Isi GOOGLE_CLIENT_ID dengan Client ID dari Google Cloud Console
// https://console.cloud.google.com > APIs & Services > Credentials
// Biarkan kosong ('') jika belum setup — sistem tetap bisa login manual
// ================================================================
const GOOGLE_CLIENT_ID = '';

const API_URL = 'http://localhost:5000';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useRouter();

  // Setelah login berhasil
  const onLoginSuccess = useCallback((data) => {
    localStorage.setItem('userId', data.id);
    localStorage.setItem('userRole', data.role);
    if (data.picture) localStorage.setItem('userPicture', data.picture);
    if (data.display_name) localStorage.setItem('userName', data.display_name);
    navigate.push(data.role === 'admin' ? '/admin' : '/dashboard');
  }, [navigate]);

  // Callback dari Google setelah user pilih akun
  const handleGoogleResponse = useCallback(async (response) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data);
      } else {
        setError(data.error || 'Login Google gagal');
      }
    } catch (e) {
      setError('Gagal terhubung ke server. Pastikan backend berjalan.');
    } finally {
      setLoading(false);
    }
  }, [onLoginSuccess]);

  // Load Google SDK & inisialisasi tombol
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const existing = document.getElementById('gsi-script');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      } else {
        existing.onload = initGoogle;
      }
    }
  }, [handleGoogleResponse]);

  // Render tombol Google saat ready
  useEffect(() => {
    if (!googleReady) return;
    const container = document.getElementById('google-btn-container');
    if (container && window.google?.accounts?.id) {
      container.innerHTML = ''; // Clear dulu
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: isLoginMode ? 'signin_with' : 'signup_with',
        width: 380,
        locale: 'id',
      });
    }
  }, [googleReady, isLoginMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Harap isi username dan password');
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const endpoint = isLoginMode ? '/api/login' : '/api/register';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (!isLoginMode) {
          setSuccess('Akun berhasil dibuat! Sedang masuk...');
        }
        setTimeout(() => onLoginSuccess(data), isLoginMode ? 0 : 800);
      } else {
        setError(data.error || 'Terjadi kesalahan');
      }
    } catch (e) {
      setError('Gagal terhubung ke server. Pastikan backend berjalan di port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex bg-[#fafbfe] font-sans">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#5340ff] via-[#6d4ffe] to-[#8b5cf6] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-white/5"></div>
        <div className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-white/5"></div>
        
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-[24px] mb-8 backdrop-blur-sm">
            <Scissors size={40} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">YouClip</h1>
          <p className="text-white/80 text-xl font-medium leading-relaxed mb-8">
            Ubah video YouTube panjang jadi <strong className="text-white">klip viral</strong> untuk TikTok, Reels & Shorts secara otomatis dengan AI.
          </p>
          
          <div className="space-y-4 text-left">
            {[
              { icon: '🎬', text: 'Generate 3 klip terbaik dari 1 video' },
              { icon: '📝', text: 'Subtitle otomatis Bahasa Indonesia' },
              { icon: '⚡', text: 'Proses dalam 5-15 menit' },
              { icon: '🎁', text: 'Daftar gratis & dapatkan 15 kredit' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-white font-semibold">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#5340ff] rounded-xl flex items-center justify-center">
                <Scissors size={22} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-black text-[#1e1b4b]">YouClip</span>
            </div>
          </div>

          <h2 className="text-[2rem] font-black text-[#1e1b4b] tracking-tight mb-1">
            {isLoginMode ? 'Selamat Datang 👋' : 'Buat Akun Baru'}
          </h2>
          <p className="text-[#64748b] text-[0.95rem] font-medium mb-8">
            {isLoginMode 
              ? 'Masuk ke dashboard YouClip kamu.' 
              : 'Daftar gratis dan dapatkan 15 kredit!'}
          </p>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 text-red-700 text-sm font-semibold p-4 rounded-2xl border border-red-100">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-5 bg-emerald-50 text-emerald-700 text-sm font-semibold p-4 rounded-2xl border border-emerald-100 text-center">
              ✅ {success}
            </div>
          )}

          {/* Google Button */}
          {GOOGLE_CLIENT_ID ? (
            <div className="mb-5 relative">
              <div id="google-btn-container" className="w-full [&>div]:w-full flex justify-center"></div>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <Loader2 size={24} className="animate-spin text-[#5340ff]" />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-[0.8rem] font-medium leading-relaxed">
              <div className="font-bold text-sm mb-2 flex items-center gap-2">
                <span>⚠️</span> Google Login Belum Dikonfigurasi
              </div>
              <p className="text-[0.78rem] text-amber-700">
                Untuk mengaktifkan login Google, isi <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">GOOGLE_CLIENT_ID</code> di file <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">src/app/login/page.jsx</code>.
              </p>
              <a 
                href="https://console.cloud.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block mt-2 text-blue-600 font-bold hover:underline text-[0.78rem]"
              >
                Buka Google Cloud Console →
              </a>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[0.7rem] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
              {GOOGLE_CLIENT_ID ? 'Atau dengan Email' : 'Masuk dengan Email'}
            </span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#1e1b4b] mb-1.5">Username</label>
              <input 
                type="text" 
                placeholder={isLoginMode ? "Masukkan username Anda" : "Pilih username (min. 3 karakter)"}
                autoComplete={isLoginMode ? "username" : "new-username"}
                className="w-full bg-[#f8fafc] border border-gray-200 text-[#1e1b4b] text-[0.95rem] rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-[#5340ff] focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400 font-medium"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#1e1b4b] mb-1.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder={isLoginMode ? "Masukkan password Anda" : "Buat password (min. 6 karakter)"}
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  className="w-full bg-[#f8fafc] border border-gray-200 text-[#1e1b4b] text-[0.95rem] rounded-xl px-4 py-3.5 pr-12 outline-none focus:bg-white focus:border-[#5340ff] focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400 font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5340ff] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#5340ff] hover:bg-[#4330df] text-white font-bold text-[1rem] py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none mt-2" 
              disabled={loading}
            >
              {loading 
                ? <><Loader2 size={20} className="animate-spin" /> Memproses...</>
                : (isLoginMode ? 'Masuk ke Dashboard' : 'Daftar Sekarang')}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[0.9rem] font-medium text-[#64748b]">
              {isLoginMode ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <button 
                type="button" 
                className="font-bold text-[#5340ff] hover:text-[#4330df] transition-colors"
                onClick={switchMode}
              >
                {isLoginMode ? 'Daftar gratis →' : '← Masuk di sini'}
              </button>
            </p>
          </div>

          {/* Test accounts info */}
          {isLoginMode && (
            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[0.78rem] text-slate-500">
              <div className="font-bold text-slate-600 mb-2">Akun untuk testing:</div>
              <div className="space-y-1 font-mono">
                <div>👤 <span className="text-slate-700">admin</span> / <span className="text-slate-700">admin123</span> <span className="text-slate-400">(Admin)</span></div>
                <div>👤 <span className="text-slate-700">nabil</span> / <span className="text-slate-700">user123</span> <span className="text-slate-400">(User)</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
