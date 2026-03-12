import '../index.css';

export const metadata = {
  title: 'Beranda | YouClip',
  description: 'YouClip adalah AI video clipper yang otomatis memotong video YouTube panjang jadi 3 klip viral untuk TikTok, Reels & Shorts. Hemat waktu editing hingga 90%. Coba gratis sekarang!',
  authors: [{ name: 'Surya Elidanto', url: 'https://www.linkedin.com/in/cintarasuryaelidanto/' }],
  keywords: 'YouClip,YouClip Indonesia,AI video clipper Indonesia,potong video YouTube otomatis,video to clips AI Indonesia,YouTube to TikTok converter,YouTube to Instagram Reels,YouTube to Shorts,repurpose video YouTube,tools konten kreator Indonesia,auto subtitle Indonesia,video podcast to clips,webinar to clips,cara bikin konten viral,hemat waktu editing video,video clipper otomatis,AI video editor Indonesia,content creator tools,video editing AI',
  creator: 'YouClip',
  publisher: 'YouClip',
  openGraph: {
    title: 'YouClip - Ubah Video YouTube Jadi Klip Viral Otomatis',
    description: 'AI video clipper yang otomatis memotong video YouTube panjang jadi klip viral untuk TikTok, Reels & Shorts. Hemat waktu editing hingga 90%!',
    url: 'https://youclip.id',
    siteName: 'YouClip',
    locale: 'id_ID',
    type: 'website',
    images: [
      {
        url: 'https://youclip.id/og-image.png',
        width: 1200,
        height: 630,
        alt: 'YouClip - AI Video Clipper Indonesia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YouClip - Ubah Video YouTube Jadi Klip Viral Otomatis',
    description: 'AI video clipper yang otomatis memotong video YouTube panjang jadi klip viral. Hemat waktu editing hingga 90%!',
    images: ['https://youclip.id/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "YouClip",
          "url": "https://youclip.id",
          "description": "AI video clipper yang otomatis memotong video YouTube panjang jadi klip viral untuk TikTok, Reels & Shorts. Hemat waktu editing hingga 90%.",
          "inLanguage": "id-ID",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://youclip.id/search?q={search_term_string}"
            },
            "query-input": "required name=search_term_string"
          }
        })}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "YouClip",
          "url": "https://youclip.id",
          "logo": "https://youclip.id/icon.png",
          "description": "YouClip adalah AI video clipper Indonesia yang membantu konten kreator mengubah video YouTube panjang menjadi klip viral untuk social media.",
          "founder": {
            "@type": "Person",
            "name": "Surya Elidanto",
            "url": "https://www.linkedin.com/in/cintarasuryaelidanto/"
          },
          "foundingDate": "2025",
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Service",
            "availableLanguage": ["Indonesian", "English"]
          }
        })}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "YouClip",
          "applicationCategory": "MultimediaApplication",
          "operatingSystem": "Web Browser",
          "description": "AI video clipper yang otomatis memotong video YouTube panjang jadi 3 klip viral untuk TikTok, Instagram Reels, dan YouTube Shorts.",
          "offers": {
            "@type": "AggregateOffer",
            "lowPrice": "25000",
            "highPrice": "99000",
            "priceCurrency": "IDR",
            "availability": "https://schema.org/InStock",
            "offerCount": "3",
            "description": "Paket kredit top-up: Starter (10 kredit), Creator (22 kredit), Pro (60 kredit)"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "127",
            "bestRating": "5",
            "worstRating": "1"
          },
          "featureList": [
            "Otomatis potong video YouTube jadi klip viral",
            "Generate 3 klip dari 1 video panjang",
            "Subtitle otomatis dalam Bahasa Indonesia",
            "Support TikTok, Reels, dan YouTube Shorts",
            "AI-powered moment detection"
          ]
        })}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Apakah kredit bisa hangus atau expired?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Tidak. Kredit yang Anda beli adalah permanen dan berlaku seumur hidup. Tidak ada batasan waktu penggunaan."
              }
            },
            {
              "@type": "Question",
              "name": "Berapa lama proses pembuatan klip?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Rata-rata 5-30 menit tergantung durasi video asli. Anda akan mendapat notifikasi email ketika klip sudah siap didownload."
              }
            },
            {
              "@type": "Question",
              "name": "Video apa saja yang cocok untuk YouClip?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Video berbentuk podcast, webinar, tutorial edukasi, atau konten berbicara (talking head) memberikan hasil terbaik. Video dengan musik dominan atau tanpa dialog kurang optimal."
              }
            },
            {
              "@type": "Question",
              "name": "Apakah ada biaya bulanan atau langganan?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Tidak ada biaya bulanan atau biaya tersembunyi. Sekali beli kredit, bisa dipakai kapan saja tanpa batas waktu."
              }
            },
            {
              "@type": "Question",
              "name": "Apakah saya bisa request fitur tertentu?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Tentu! Kami menerima feedback dan request fitur dari semua pengguna. Silakan hubungi kami melalui halaman kontak."
              }
            }
          ]
        })}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
