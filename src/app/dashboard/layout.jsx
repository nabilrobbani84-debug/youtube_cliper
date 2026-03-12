"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserProvider } from "../UserContext";

import { Home, CreditCard, LifeBuoy, Sparkles, BellRing, Scissors, ChevronDown, LogOut, CheckCheck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import '../../components/Layout.css';

const navItems = [
  { path: '/dashboard', label: 'Beranda', icon: Home, end: true },
  { path: '/dashboard/payment', label: 'Pembayaran', icon: CreditCard },
  { path: '/dashboard/help', label: 'Bantuan', icon: LifeBuoy },
  { path: '/dashboard/updates', label: 'Pembaruan', icon: Sparkles },
];

export default function Layout({ children }) {
  const [user, setUser] = useState({ username: 'Loading...', credits: 0, initial: '' });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useRouter();
  const pathname = usePathname();
  const notifRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchUser = async (userId) => {
    try {
      const res = await fetch('http://localhost:5000/api/user', {
        headers: { 'user-id': userId }
      });
      const data = await res.json();
      if (res.ok) {
        setUser({
          username: data.username,
          credits: data.credits,
          initial: data.username ? data.username[0].toUpperCase() : 'U'
        });
      }
    } catch (e) { console.error(e); }
  };

  const fetchNotifications = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
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
      const res = await fetch('http://localhost:5000/api/notifications/read-all', {
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
    fetchUser(userId);
    fetchNotifications();

    const interval = setInterval(() => {
        fetchNotifications();
        fetchUser(userId);
    }, 15000);

    return () => clearInterval(interval);
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
                  border: '1px solid #e2e8f0', minWidth: '180px', zIndex: 1001, padding: '0.5rem'
                }}>
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
    </div>
    </UserProvider>
  );
}
