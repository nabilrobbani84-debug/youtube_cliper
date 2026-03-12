"use client";
import { Users, Video, Ticket, Zap, LogOut, CheckCircle, XCircle, DollarSign, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './admin.css';

export default function Admin() {
  const [stats, setStats] = useState({ users: 0, clips: 0, tickets: 0, revenue: 0 });
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [packages, setPackages] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useRouter();

  const fetchData = async () => {
    try {
      const statsRes = await fetch('http://localhost:5000/api/admin/stats');
      if (statsRes.ok) setStats(await statsRes.json());
      
      const usersRes = await fetch('http://localhost:5000/api/admin/users');
      if (usersRes.ok) setUsers(await usersRes.json());
      
      const ticketsRes = await fetch('http://localhost:5000/api/admin/tickets');
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      
      const txRes = await fetch('http://localhost:5000/api/admin/transactions');
      if (txRes.ok) setTransactions(await txRes.json());

      const wdRes = await fetch('http://localhost:5000/api/admin/withdrawals');
      if (wdRes.ok) setWithdrawals(await wdRes.json());

      const pkgRes = await fetch('http://localhost:5000/api/packages');
      if (pkgRes.ok) setPackages(await pkgRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateTicketStatus = async (id, status) => {
    try {
      await fetch(`http://localhost:5000/api/admin/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const updateTxStatus = async (id, status) => {
    try {
      await fetch(`http://localhost:5000/api/admin/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const approveWithdrawal = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/admin/withdrawals/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: id })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const addCredits = async (userId, amount) => {
    try {
      await fetch(`http://localhost:5000/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    navigate.push('/login');
  };

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Zap className="admin-logo-icon" size={24} />
          <span>YouClip Admin</span>
        </div>
        <nav className="admin-nav">
          <button className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard Overview</button>
          <button className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Management Users</button>
          <button className={`admin-nav-item ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Payment Proofs</button>
          <button className={`admin-nav-item ${activeTab === 'withdrawals' ? 'active' : ''}`} onClick={() => setActiveTab('withdrawals')}>Affiliate Payouts</button>
          <button className={`admin-nav-item ${activeTab === 'packages' ? 'active' : ''}`} onClick={() => setActiveTab('packages')}>Package Pricing</button>
          <button className={`admin-nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Support Center</button>
        </nav>
        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="logout-btn-admin">
            <LogOut size={18} /> Logout Session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-header">
          <h1 className="admin-title">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Control</h1>
          <p className="admin-subtitle">Selamat datang kembali, Admin. Pantau performa aplikasi hari ini.</p>
          {message && <div className="admin-toast">{message}</div>}
        </div>

        {activeTab === 'dashboard' && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrapper bg-blue"><Users size={24} color="#2563eb" /></div>
              <div><p className="stat-label">Total Users</p><h3 className="stat-value">{stats.users}</h3></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrapper bg-indigo"><Video size={24} color="#4f46e5" /></div>
              <div><p className="stat-label">Videos Analysed</p><h3 className="stat-value">{stats.clips}</h3></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrapper bg-rose"><Ticket size={24} color="#e11d48" /></div>
              <div><p className="stat-label">Pending Tickets</p><h3 className="stat-value">{stats.tickets}</h3></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ backgroundColor: '#dcfce7' }}>
                <DollarSign size={24} color="#16a34a" />
              </div>
              <div><p className="stat-label">Total Revenue</p><h3 className="stat-value">Rp {stats.revenue.toLocaleString('id-ID')}</h3></div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-card">
            <div className="admin-card-header"><h2>Database Users</h2></div>
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>Username</th><th>Credits</th><th>Join Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {u.picture && <img src={u.picture} style={{width: '24px', height: '24px', borderRadius: '50%'}} />}
                        <span className="font-medium">{u.display_name || u.username}</span>
                      </div>
                    </td>
                    <td className="font-bold text-primary">{u.credits}</td>
                    <td style={{fontSize: '0.8rem', color: '#64748b'}}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="credit-btn" onClick={() => addCredits(u.id, 10)}>+10 Creds</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="admin-card">
            <div className="admin-card-header"><h2>Verification of Payments</h2></div>
            <table className="admin-table">
              <thead>
                <tr><th>Trx ID</th><th>User</th><th>Package</th><th>Price</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td className="font-mono" style={{fontSize: '0.75rem'}}>{t.id}</td>
                    <td>{t.username}</td>
                    <td>{t.package_name} ({t.amount} creds)</td>
                    <td className="font-bold">Rp {t.price.toLocaleString('id-ID')}</td>
                    <td><span className={`status-badge badge-${t.status.toLowerCase()}`}>{t.status}</span></td>
                    <td>
                      {t.status === 'Pending' && (
                        <div className="btn-group-admin">
                          <button onClick={() => updateTxStatus(t.id, 'Success')} className="btn-icon-approve"><CheckCircle size={18} /></button>
                          <button onClick={() => updateTxStatus(t.id, 'Failed')} className="btn-icon-reject"><XCircle size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="admin-card">
            <div className="admin-card-header"><h2>Payout Requests</h2></div>
            <table className="admin-table">
              <thead>
                <tr><th>ID</th><th>User</th><th>Amount</th><th>Method/Destination</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id}>
                    <td style={{fontSize: '0.75rem'}}>{w.id}</td>
                    <td>{w.username}</td>
                    <td className="font-bold">Rp {w.amount.toLocaleString('id-ID')}</td>
                    <td>{w.method}: {w.destination}</td>
                    <td><span className={`status-badge badge-${w.status.toLowerCase()}`}>{w.status}</span></td>
                    <td>
                      {w.status === 'Pending' && (
                        <button onClick={() => approveWithdrawal(w.id)} className="btn-resolve" style={{padding: '4px 12px'}}>Send Payout</button>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={6} style={{padding: '32px', textAlign: 'center', color: '#64748b'}}>No payout requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'packages' && (
          <div className="admin-card">
            <div className="admin-card-header"><h2>Pricing Package Manager</h2></div>
            <div style={{padding: '1.5rem'}}>
              <div className="packages-admin-grid">
                {packages.map(pkg => (
                  <div key={pkg.id} className="pkg-admin-item">
                    <div className="pkg-field">
                      <label>Package Name</label>
                      <input 
                        type="text" 
                        defaultValue={pkg.name} 
                        onChange={(e) => {
                          const newPackages = packages.map(p => p.id === pkg.id ? {...p, name: e.target.value} : p);
                          setPackages(newPackages);
                        }}
                      />
                    </div>
                    <div className="pkg-field">
                      <label>Price (Rp)</label>
                      <input 
                        type="number" 
                        defaultValue={pkg.price} 
                        onChange={(e) => {
                          const newPackages = packages.map(p => p.id === pkg.id ? {...p, price: parseInt(e.target.value)} : p);
                          setPackages(newPackages);
                        }}
                      />
                    </div>
                    <div className="pkg-field">
                      <label>Credits</label>
                      <input 
                        type="number" 
                        defaultValue={pkg.credits} 
                        onChange={(e) => {
                          const newPackages = packages.map(p => p.id === pkg.id ? {...p, credits: parseInt(e.target.value)} : p);
                          setPackages(newPackages);
                        }}
                      />
                    </div>
                    <button 
                      className="btn-resolve" 
                      style={{width: '100%', marginTop: 'auto'}}
                      onClick={async () => {
                        try {
                          const res = await fetch(`http://localhost:5000/api/admin/packages/${pkg.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(pkg)
                          });
                          if (res.ok) {
                            setMessage('Paket berhasil diperbarui!');
                            setTimeout(() => setMessage(''), 3000);
                            fetchData();
                          }
                        } catch (e) { console.error(e); }
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="admin-card">
             <div className="admin-card-header"><h2>Support Inbox</h2></div>
             <div className="tickets-list-admin">
                {tickets.map(t => (
                  <div key={t.id} className="ticket-item-admin">
                    <div className="ticket-info">
                      <div className="ticket-subject-row">
                        <span className="font-bold text-lg">{t.subject}</span>
                        <span className={`status-badge badge-${t.status.toLowerCase()}`}>{t.status}</span>
                      </div>
                      <p className="ticket-msg">{t.message}</p>
                      <div className="ticket-meta-admin">Dari: <b>{t.username}</b> &bull; Kategori: {t.category} &bull; {new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div className="ticket-actions">
                      <button onClick={() => updateTicketStatus(t.id, t.status === 'Open' ? 'Resolved' : 'Open')} className={t.status === 'Open' ? 'btn-resolve' : 'btn-reopen'}>
                        {t.status === 'Open' ? 'Mark Resolved' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                ))}
                {tickets.length === 0 && <div className="no-tickets">Inbox is empty.</div>}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
