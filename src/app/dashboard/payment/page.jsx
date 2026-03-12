"use client";
import { CreditCard, Star, CheckCircle, Zap, Loader2, ArrowLeft, X, User, Phone, Mail, ShieldCheck, Check, Copy, ImageIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '../../UserContext';
import './payment.css';

export default function Payment() {
  const { user, fetchUser } = useUser();
  const [loading, setLoading] = useState(null);
  const [view, setView] = useState('packages');
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);
  
  // Checkout States
  const [checkoutData, setCheckoutData] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState('form');
  const [isProtected, setIsProtected] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/user/transactions', {
        headers: { 'user-id': localStorage.getItem('userId') }
      });
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/packages');
      if (res.ok) setPackages(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchTransactions();
    fetchPackages();
  }, []);

  const handleTopup = (amount, pkgName, price) => {
    setCheckoutData({ amount, pkgName, price });
    setCheckoutStep('form');
    setIsProtected(false);
    setTermsAccepted(false);
  };

  const cancelCheckout = () => {
    setCheckoutData(null);
  };

  const confirmPayment = async (method) => {
    if (!checkoutData) return;
    setLoading('payment');
    
    // Calculate final price including protection if checked
    const finalPrice = checkoutData.price + (isProtected ? 2500 : 0);
    
    try {
      const res = await fetch('http://localhost:5000/api/topup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': localStorage.getItem('userId')
        },
        body: JSON.stringify({ 
          amount: checkoutData.amount, 
          packageName: checkoutData.pkgName, 
          price: finalPrice,
          method 
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Only fetch transaction if request completes
        fetchTransactions();
        fetchUser(); 
        setCheckoutData(null);
        setView('history');
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Gagal melakukan pembayaran');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="payment-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Top Up Kredit</h1>
          <p className="page-subtitle">Beli paket kredit untuk pemrosesan video</p>
        </div>
        <div className="header-actions">
          {view === 'history' ? (
            <button className="btn btn-outline" onClick={() => setView('packages')} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <ArrowLeft size={16} /> Kembali ke Paket
            </button>
          ) : (
             <button className="btn btn-outline" onClick={() => setView('history')}>Riwayat Pembayaran</button>
          )}
        </div>
      </div>

      {view === 'history' ? (
        <div className="history-section">
          <h2 className="section-title">Riwayat Pembayaran</h2>
          <p className="section-subtitle">Daftar transaksi dan pembelian paket kredit Anda.</p>
          
          <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
             {transactions.length === 0 ? (
               <div style={{padding: '2rem', textAlign: 'center', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)'}}>
                 Belum ada riwayat pembayaran.
               </div>
             ) : (
                transactions.map(t => (
                  <div key={t.id} style={{padding: '1.5rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <h4 style={{fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem'}}>
                        Paket {t.package_name} <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400}}>({t.amount} kredit)</span>
                      </h4>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                        ID: {t.id} &bull; {new Date(t.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div style={{textAlign: 'right'}}>
                       <div style={{fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem'}}>
                         Rp {t.price.toLocaleString('id-ID')}
                       </div>
                       <span className="badge badge-outline" style={{
                         backgroundColor: t.status === 'Pending' ? '#fef3c7' : t.status === 'Success' ? '#dcfce7' : '#fee2e2',
                         color: t.status === 'Pending' ? '#b45309' : t.status === 'Success' ? '#16a34a' : '#b91c1c',
                         borderColor: 'transparent'
                       }}>
                         {t.status === 'Pending' ? 'Menunggu' : t.status === 'Success' ? 'Berhasil' : 'Gagal'}
                       </span>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>
      ) : (
        <>
          <div className="balance-card">
            <div className="balance-header">
              <CreditCard size={20} />
              <h3>Saldo Kredit</h3>
            </div>
            <p className="balance-desc">Saldo kredit Anda saat ini</p>
            <div className="balance-amount">{user.credits} kredit</div>
            <p className="balance-info">1 kredit = 1 pemrosesan video</p>
          </div>

          <div className="package-section">
            <h2 className="section-title">Pilih Paket Kredit</h2>
            <p className="section-subtitle">Pilih paket yang sesuai dengan kebutuhan Anda</p>

            <div className="packages-grid">
              {packages.map(pkg => (
                <div key={pkg.id} className={`package-card ${pkg.badge ? 'pro-card' : ''}`}>
                  {pkg.badge && (
                    <div className="best-value-badge">
                      <Star size={12} fill="currentColor" /> {pkg.badge}
                    </div>
                  )}
                  <div className="package-card-header">
                    <div className={`package-icon ${pkg.badge ? 'pro-icon' : ''}`}>
                      {pkg.name === 'Starter' ? <Zap size={20} color="#64748b" /> : 
                       pkg.name === 'Pro' ? <Star size={20} color="#8b5cf6" /> : 
                       <CheckCircle size={20} color="#64748b" />}
                    </div>
                    <div className="package-details">
                      <h3>{pkg.name}</h3>
                      <p>{pkg.description}</p>
                    </div>
                  </div>

                  <div className="package-price-section">
                    <div className="package-price">Rp{pkg.price.toLocaleString('id-ID')}</div>
                    <div className="package-price-sub">{pkg.credits} kredit &middot; Rp{(pkg.price / pkg.credits).toLocaleString('id-ID', {maximumFractionDigits: 0})}/kredit</div>
                  </div>

                  <ul className="package-features">
                    <li><CheckCircle size={16} color="#8b5cf6" className="feature-icon" /> {pkg.credits} kredit proses video</li>
                  </ul>

                  <button 
                    className={`btn ${pkg.badge ? 'btn-primary' : 'btn-outline'} package-btn`}
                    onClick={() => handleTopup(pkg.credits, pkg.name, pkg.price)}
                  >
                    Beli {pkg.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Checkout Overlay Match Images */}
      {checkoutData && (
        <div className="checkout-overlay">
          <div className="checkout-card">
            
            {/* Left Side */}
            <div className="checkout-left">
              <div className="summary-title" style={{ marginTop: '0', color: '#64748b' }}>Pembayaran untuk</div>
              
              <div className="item-row">
                <div className="item-image">
                  <ImageIcon size={32} />
                </div>
                <div className="item-details">
                  <h4>{checkoutData.pkgName}</h4>
                  <p>1 x Rp. {checkoutData.price.toLocaleString('id-ID')}</p>
                </div>
                <div className="item-price">
                  <span>Rp.</span> {checkoutData.price.toLocaleString('id-ID')}
                </div>
              </div>

              {isProtected && (
                <div className="protection-row">
                  <div className="protection-icon">
                    <CheckCircle size={22} fill="#10b981" color="#fff" />
                  </div>
                  <div className="protection-details">
                    Biaya proteksi transaksi
                  </div>
                  <div className="protection-price">
                    <span>Rp.</span> 2.500
                  </div>
                </div>
              )}

              <div className="total-row">
                <div className="total-label">Total</div>
                <div className="total-amount">
                  <span>Rp.</span> {(checkoutData.price + (isProtected ? 2500 : 0)).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
            
            {/* Right Side */}
            <div className="checkout-right">
               <div className="right-header">
                 <h2>Metode Pembayaran</h2>
                 <button className="close-button" onClick={cancelCheckout}><X size={16} /></button>
               </div>
               
               <div className="payment-card">
                 {checkoutStep === 'form' ? (
                   <>
                     <div className="pay-method-btn">
                       <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="qris-logo" />
                     </div>
                     
                     <div className="dashed-divider"></div>
                     
                     <div className="section-label">Data Pembeli</div>
                     
                     <div className="input-group">
                       <User className="input-icon" size={18} />
                       <input type="text" className="custom-input" defaultValue={user.username || "Tamu"} />
                     </div>
                     
                     <div className="input-row">
                       <div className="input-group" style={{marginBottom: 0, flex: 1}}>
                         <Phone className="input-icon" size={18} />
                         <input type="text" className="custom-input" placeholder="No Handphone" defaultValue="" />
                       </div>
                       <div className="input-group" style={{marginBottom: 0, flex: 1}}>
                         <Mail className="input-icon" size={18} />
                         <input type="text" className="custom-input" placeholder="Email" defaultValue={user.username.replace(/\s+/g, '').toLowerCase() + "@gmail.com"} />
                       </div>
                     </div>
                     
                     <div className="info-box">
                        <ShieldCheck className="info-icon" size={24} />
                        <div className="info-text">
                          Cukup dengan <strong>Rp. 2500</strong>, Anda dapat mengamankan transaksi ini dengan proses claim yang mudah dan berlaku 12 bulan.
                        </div>
                     </div>
                     
                     <div className="checkbox-group" onClick={() => setIsProtected(!isProtected)}>
                       <div className={`custom-checkbox ${isProtected ? 'checked' : ''}`}>
                         {isProtected && <Check size={14} />}
                       </div>
                       <div className="checkbox-text">
                         Baik, amankan transaksi saya dan saya menyetujui <a href="#" onClick={(e) => e.preventDefault()}>Syarat & Ketentuan</a> yang berlaku.
                       </div>
                     </div>
                     
                     <div className="checkbox-group" onClick={() => setTermsAccepted(!termsAccepted)}>
                       <div className={`custom-checkbox ${termsAccepted ? 'checked' : ''}`}>
                         {termsAccepted && <Check size={14} />}
                       </div>
                       <div className="checkbox-text">
                         Saya menyetujui <a href="#" onClick={(e) => e.preventDefault()}>Syarat & Ketentuan</a> yang berlaku.
                       </div>
                     </div>
                     
                     <button 
                       className="pay-action-btn" 
                       disabled={!termsAccepted}
                       onClick={() => setCheckoutStep('qris')}
                     >
                       BAYAR SEKARANG
                     </button>
                   </>
                 ) : (
                   <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                     <div className="qris-header">
                       <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" style={{height: '24px', marginRight: '8px'}} />
                       <span style={{fontSize: '0.65rem', fontWeight: 'bold', color: '#1e293b', lineHeight: 1}}>QR Code Standar<br/>Pembayaran Nasional</span>
                       <div style={{flexGrow: 1}}></div>
                       <div style={{height: '40px', width: '40px', backgroundColor: '#f8fafc', borderRadius: '4px', overflow: 'hidden'}}>
                         {/* Placeholder for GPN */}
                         <img src="https://upload.wikimedia.org/wikipedia/commons/6/69/GPN_Indonesia_Logo.svg" alt="GPN" style={{width: '100%', height: '100%', objectFit: 'contain', padding: '4px'}}/>
                       </div>
                     </div>
                     
                     <div className="merchant-info">
                        <div className="merchant-name">IPAYMU</div>
                        <div className="merchant-nmid">NMID: ID2022173022171<br/>A01</div>
                     </div>
                     
                     <div className="qr-code-container">
                        <div className="corner-red top-left"></div>
                        <div className="corner-red bottom-right"></div>
                        <img 
                          src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://youclip.id/pay/dummy" 
                          alt="QR Code" 
                          className="qr-image" 
                        />
                     </div>
                     
                     <div className="payment-nominal">
                       <div className="nominal-label">Nominal</div>
                       <div className="nominal-amount">
                         Rp. {(checkoutData.price + (isProtected ? 2500 : 0)).toLocaleString('id-ID')}
                         <Copy className="copy-icon" size={18} title="Salin Nominal" />
                       </div>
                       <button 
                         className="btn btn-primary"
                         style={{marginTop: '1.5rem', width: '100%'}}
                         onClick={() => confirmPayment('QRIS iPaymu')}
                         disabled={loading === 'payment'}
                       >
                         {loading === 'payment' ? <Loader2 size={16} className="animate-spin" /> : 'Selesai Pembayaran'}
                       </button>
                     </div>
                   </div>
                 )}
               </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
