"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserProvider } from "../UserContext";

import { Home, CreditCard, LifeBuoy, Sparkles, BellRing, Scissors, ChevronDown, LogOut, CheckCheck, Key, Copy, Check, Terminal, RefreshCw, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../../lib/api';
import '../../components/Layout.css';

const navItems = [
  { path: '/dashboard', label: 'Beranda', icon: Home, end: true },
  { path: '/dashboard/payment', label: 'Pembayaran', icon: CreditCard },
  { path: '/dashboard/help', label: 'Bantuan', icon: LifeBuoy },
  { path: '/dashboard/updates', label: 'Pembaruan', icon: Sparkles },
];

export default function Layout({ children }) {
  const [user, setUser] = useState({ username: 'Loading...', credits: 0, initial: '', apiKey: '' });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useRouter();
  const pathname = usePathname();
  const notifRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchUser = async (userId) => {
    try {
      const res = await fetch(apiUrl('/api/user'), {
        headers: { 'user-id': userId }
      });
      const data = await res.json();
      if (res.ok) {
        setUser({
          username: data.username,
          credits: data.credits,
          initial: data.username ? data.username[0].toUpperCase() : 'U',
          apiKey: data.api_key || ''
        });
      }
    } catch (e) { console.error(e); }
  };

  const regenerateApiKey = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    setRegenerating(true);
    try {
      const res = await fetch(apiUrl('/api/user/api-key/regenerate'), {
        method: 'POST',
        headers: { 'user-id': userId }
      });
      const data = await res.json();
      if (res.ok && data.api_key) {
        setUser(prev => ({ ...prev, apiKey: data.api_key }));
      }
    } catch (e) { console.error(e); }
    finally { setRegenerating(false); }
  };

  const fetchNotifications = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { 'user-id': userId }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const userId = localStorage.getItem('userId');
    try {
      const res = await fetch(apiUrl('/api/notifications/read-all'), {
        method: 'POST',
        headers: { 'user-id': userId }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      navigate.push('/login');
      return;
    }

    let interval;
    const initSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/user'), {
          headers: { 'user-id': userId }
        });

        if (!res.ok) {
          localStorage.removeItem('userId');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userPicture');
          localStorage.removeItem('userName');
          navigate.replace('/login');
          return;
        }

        fetchUser(userId);
        fetchNotifications();
        interval = setInterval(() => {
          fetchNotifications();
          fetchUser(userId);
        }, 15000);
      } catch (error) {
        console.error(error);
        navigate.replace('/login');
      }
    };

    initSession();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    navigate.push('/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <UserProvider>
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-brand">
            <Scissors className="logo-icon" size={24} color="#6366f1" />
            <span className="logo-text">YouClip</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = item.end ? pathname === item.path : pathname.startsWith(item.path);
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`nav-link nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon className="nav-icon" size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Top Navbar */}
        <header className="topbar">
          <div className="spacer"></div>
          <div className="topbar-actions">
            
            <div style={{position: 'relative'}} ref={notifRef}>
                <button className="icon-btn" onClick={() => setShowNotif(!showNotif)}>
                <BellRing size={20} color={unreadCount > 0 ? "#6366f1" : "#64748b"} />
                {unreadCount > 0 && <div className="indicator has-notif"></div>}
                </button>

                {showNotif && (
                    <div className="notif-dropdown">
                        <div className="notif-header">
                            <h3>Notifikasi</h3>
                            {unreadCount > 0 && <button onClick={markAllRead}>Tandai semua dibaca</button>}
                        </div>
                        <div className="notif-list">
                            {notifications.length > 0 ? (
                                notifications.map(n => (
                                    <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                                        <div className="notif-item-title">{n.title}</div>
                                        <div className="notif-item-msg">{n.message}</div>
                                        <div className="notif-item-time">{new Date(n.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="notif-empty">Belum ada notifikasi baru.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="badge badge-outline credit-badge">
              Kredit <span className="credit-value">{user.credits}</span>
            </div>
            
            <div className="user-profile" onClick={() => setShowDropdown(!showDropdown)} style={{position: 'relative'}} ref={dropdownRef}>
              <div className="avatar">{user.initial}</div>
              <span className="username">{user.username} <ChevronDown size={14} className="chevron-down" /></span>
              
              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
                  backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0', minWidth: '200px', zIndex: 1001, padding: '0.5rem'
                }}>
                  <button 
                    onClick={() => { setShowApiKeyModal(true); setShowDropdown(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', 
                      padding: '0.75rem 1rem', color: '#4f46e5', backgroundColor: 'transparent', 
                      border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#eef2ff'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <Key size={16} /> API Key &amp; Developers
                  </button>
                  <button 
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', 
                      padding: '0.75rem 1rem', color: '#ef4444', backgroundColor: 'transparent', 
                      border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#fef2f2'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* API Key & Documentation Modal */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '20px', maxWidth: '640px', width: '100%',
            padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#eef2ff', padding: '10px', borderRadius: '12px', color: '#6366f1' }}>
                  <Key size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>API Key &amp; Integrasi Developers</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Gunakan API Key ini untuk mengakses endpoint video-to-shorts &amp; tasks.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowApiKeyModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                API Secret Key Anda (Bearer Token)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={user.apiKey || 'Memuat API Key...'} 
                  style={{
                    flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1',
                    fontFamily: 'monospace', fontSize: '0.9rem', backgroundColor: '#f8fafc', color: '#0f172a'
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.apiKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.25rem',
                    backgroundColor: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '10px',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                  {copiedKey ? 'Disalin!' : 'Copy'}
                </button>
                <button
                  onClick={regenerateApiKey}
                  disabled={regenerating}
                  title="Generate API Key Baru"
                  style={{
                    display: 'flex', alignItems: 'center', padding: '0.75rem',
                    backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
                </button>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginTop: '0.35rem' }}>
                Jangan bagikan API key Anda kepada publik. Token ini digunakan untuk mengautentikasi request API.
              </span>
            </div>

            <div style={{ backgroundColor: '#0f172a', borderRadius: '14px', padding: '1.25rem', color: '#f8fafc', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                  <Terminal size={16} color="#38bdf8" />
                  <span>Contoh Request cURL (Video to Shorts)</span>
                </div>
                <button
                  onClick={() => {
                    const curlCmd = `curl -X POST http://localhost:5000/v2/tasks/video-to-shorts \\\n  -H "Authorization: Bearer ${user.apiKey || 'YOUR_API_KEY'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "source_video_url": "https://www.youtube.com/watch?v=sample",\n    "language": "en",\n    "target_clip_count": 5,\n    "max_duration": 60\n  }'`;
                    navigator.clipboard.writeText(curlCmd);
                    setCopiedCurl(true);
                    setTimeout(() => setCopiedCurl(false), 2000);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#e2e8f0', borderRadius: '6px',
                    padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                  {copiedCurl ? 'Tersalin' : 'Copy cURL'}
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto', lineHeight: '1.5', color: '#e2e8f0' }}>
{`POST /v2/tasks/video-to-shorts
Authorization: Bearer ${user.apiKey ? user.apiKey.slice(0, 14) + '...' : '<your-api-key>'}
Content-Type: application/json

{
  "source_video_url": "https://www.youtube.com/watch?v=...",
  "language": "en",
  "target_clip_count": 5,
  "max_duration": 60,
  "editing_options": {
    "captions": true,
    "reframe": true
  }
}`}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  padding: '0.65rem 1.5rem', backgroundColor: '#f1f5f9', color: '#334155', border: 'none',
                  borderRadius: '10px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UserProvider>
  );
}
