const fs = require('fs');
let html = fs.readFileSync('convert.html', 'utf8');

// Basic replacements for JSX
html = html.replace(/class=/g, 'className=');
html = html.replace(/bis_skin_checked=\"1\"/g, '');
html = html.replace(/fdprocessedid=\"[a-zA-Z0-9]+\"/g, '');
html = html.replace(/stroke-width/g, 'strokeWidth');
html = html.replace(/stroke-linecap/g, 'strokeLinecap');
html = html.replace(/stroke-linejoin/g, 'strokeLinejoin');
html = html.replace(/playsinline=\"\"/g, 'playsInline');
html = html.replace(/webkit-playsinline=\"true\"/g, 'webkitPlaysInline={true}');
html = html.replace(/<source(.*?)>/g, '<source$1 />');
html = html.replace(/disabled=\"\"/g, 'disabled={true}');
html = html.replace(/loop=\"\"/g, 'loop={true}');
html = html.replace(/style=\"([^\"]+)\"/g, (match, p1) => {
    const parts = p1.split(';').filter(Boolean);
    const obj = {};
    parts.forEach(part => {
        const [k, v] = part.split(':');
        if (k && v) {
            const key = k.trim().replace(/-([a-z])/g, (m, g1) => g1.toUpperCase());
            obj[key] = v.trim();
        }
    });
    return 'style={{ ' + Object.keys(obj).map(k => k + ': \"' + obj[k] + '\"').join(', ') + ' }}';
});
// Replace SVG tags with lucide icons
html = html.replace(/<svg[^>]*>.*?<\/svg>/gs, (match) => {
    if (match.includes('lucide-star')) return '<Star className=\"h-4 w-4 text-white\" />';
    if (match.includes('lucide-download')) return '<Download className=\"h-4 w-4 mr-2\" />';
    if (match.includes('lucide-chevron-up')) return '<ChevronUp className=\"h-6 w-6\" />';
    if (match.includes('lucide-chevron-down')) return '<ChevronDown className=\"h-6 w-6\" />';
    return match;
});

// Write it
fs.writeFileSync('convert2.jsx', html);
console.log('Done convert2!');
