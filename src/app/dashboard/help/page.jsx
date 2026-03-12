"use client";
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import './help.css';

export default function Help() {
  const [activeTab, setActiveTab] = useState('new');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');

  const fetchTickets = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: { 'user-id': localStorage.getItem('userId') }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject) return alert('Masukkan subjek tiket');

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': localStorage.getItem('userId')
        },
        body: JSON.stringify({ subject, category, detail })
      });
      if (res.ok) {
        setSubject('');
        setCategory('');
        setDetail('');
        setActiveTab('tickets');
        fetchTickets();
      }
    } catch (e) {
      alert('Gagal membuat tiket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="help-container">
      <p className="page-subtitle">Kami siap membantu! Kirim tiket baru atau pantau status tiket Anda.</p>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          Tiket Saya
        </button>
        <button 
          className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          Buat Tiket Baru
        </button>
      </div>

      {activeTab === 'tickets' ? (
        tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <MessageSquare className="empty-icon" size={28} />
            </div>
            <h3 className="empty-title">Belum ada tiket</h3>
            <p className="empty-desc">
              Anda belum mengirimkan tiket bantuan apapun. Jika butuh
              <br />
              bantuan, silakan buat tiket baru.
            </p>
            <button className="btn btn-outline new-ticket-btn" onClick={() => setActiveTab('new')}>
              Buat Tiket Baru
            </button>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {tickets.map(ticket => (
              <div key={ticket.id} style={{padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--card-bg)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                  <h4 style={{fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)'}}>{ticket.subject}</h4>
                  <span className="badge badge-outline" style={{backgroundColor: '#f1f5f9', fontSize: '0.75rem'}}>
                    {ticket.status || 'Pending'}
                  </span>
                </div>
                <div style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                  ID: {ticket.id} &bull; Dibuat pada: {new Date(ticket.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <form onSubmit={handleSubmit} className="ticket-card">
          <div className="ticket-card-header">
            <div className="ticket-icon-bg">
              <MessageSquare size={22} />
            </div>
            <div className="ticket-header-text">
              <h2>Buat Tiket Baru</h2>
              <p>Ceritakan masalah Anda, tim kami akan segera membalas.</p>
            </div>
          </div>
          
          <div className="ticket-form-body">
            <div className="form-group">
              <label className="form-label">Subjek</label>
              <input 
                type="text" 
                placeholder="Contoh: Gagal melakukan pembayaran..." 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select 
                className="form-select form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>Pilih kategori masalah</option>
                <option value="billing">Penagihan & Pembayaran</option>
                <option value="technical">Masalah Teknis</option>
                <option value="account">Akun & Keamanan</option>
                <option value="feature">Permintaan Fitur</option>
                <option value="other">Lainnya</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Detail Pesan</label>
              <textarea 
                placeholder="Jelaskan masalah Anda sedetail mungkin..." 
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                Kirim Tiket
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
