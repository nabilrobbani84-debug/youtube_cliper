"use client";
import { Zap, Wrench } from 'lucide-react';
import './updates.css';

export default function Updates() {
  const updates = [
    {
      id: 1,
      date: '05 Maret 2026',
      title: 'Uji Coba Kualitas 4K & Perbaikan Subtitle (CC)',
      description: 'Kami terus memastikan YouClip berjalan mulus. Hari ini kami memperbaiki kendala subtitle (CC) yang sering gagal ditarik, memperbaiki video yang sulit diproses, sekaligus melakukan uji coba peningkatan visual.',
      changes: [
        {
          type: 'feature',
          label: 'PENINGKATAN',
          icon: Zap,
          text: 'Kualitas hasil video sedang diuji coba untuk ditingkatkan hingga 4K (Tahap Eksperimen).'
        },
        {
          type: 'bug',
          label: 'PERBAIKAN BUG',
          icon: Wrench,
          text: 'Mengatasi kendala terkadang gagal memuat teks (Subtitle/CC) pada saat deteksi video.'
        },
        {
          type: 'bug',
          label: 'PERBAIKAN BUG',
          icon: Wrench,
          text: 'Memperbaiki masalah pada video yang sebelumnya sering gagal diproses.'
        }
      ]
    }
  ];

  return (
    <div className="updates-container">
      <div className="updates-header">
        <h1 className="updates-title">Catatan Pembaruan</h1>
        <p className="updates-subtitle">
          Ikuti terus perkembangan terbaru YouClip. Halaman ini merekam semua fitur baru, peningkatan performa, dan perbaikan sistem yang baru saja kami rilis.
        </p>
      </div>

      <div className="timeline-section">

        {updates.map((update) => (
          <div key={update.id} className="timeline-item">
            <div className="timeline-meta">
              <div className="timeline-date">{update.date}</div>
              <div className="timeline-dot"></div>
              <div className="timeline-line"></div>
            </div>
            
            <div className="timeline-content">
              <div className="update-card">
                <h3 className="update-title">{update.title}</h3>
                <p className="update-desc">{update.description}</p>
                
                <div className="change-list">
                  {update.changes.map((change, index) => {
                    const Icon = change.icon;
                    return (
                      <div key={index} className="change-item">
                        <div className={`change-badge ${change.type === 'feature' ? 'badge-feature' : 'badge-bug'}`}>
                          <Icon size={14} className="change-icon" />
                          <span className="badge-label">{change.label}</span>
                        </div>
                        <div className="change-text">{change.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Example Empty Timeline Ending */}
        <div className="timeline-item end-timeline">
           <div className="timeline-meta">
              <div className="timeline-dot end-dot"></div>
            </div>
            <div className="timeline-content">
              <span className="end-text">Pembaruan sebelumnya belum dicatat.</span>
            </div>
        </div>
      </div>
    </div>
  );
}
