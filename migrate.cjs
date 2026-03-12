const fs = require('fs');
const path = require('path');
const pagesDir = './src/pages';
const compDir = './src/components';
const files = [
  ...fs.readdirSync(pagesDir).map(f => path.join(pagesDir, f)),
  ...fs.readdirSync(compDir).map(f => path.join(compDir, f))
].filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (!content.includes('"use client"') && !content.includes("'use client'")) {
    content = '"use client";\n' + content;
  }
  // Replace imports
  content = content.replace(/import\s+\{([^}]*)\}\s+from\s+['"]react-router-dom['"];?/g, (match, p1) => {
    const imports = p1.split(',').map(s => s.trim());
    let nextImports = [];
    let navImports = [];
    let reactContext = false;
    
    if(imports.includes('Link') || imports.includes('NavLink')) nextImports.push('Link');
    if(imports.includes('useNavigate')) navImports.push('useRouter');
    if(imports.includes('useOutletContext')) reactContext = true;
    
    let res = '';
    if(nextImports.length) res += 'import Link from "next/link";\n';
    if(navImports.length) res += 'import { useRouter } from "next/navigation";\n';
    if(reactContext) res += 'import { useUser } from "../../UserContext";\n';
    
    return res;
  });
  
  // Replace hooks
  content = content.replace(/useNavigate\(\)/g, 'useRouter()');
  content = content.replace(/useOutletContext\(\)/g, 'useUser()');
  
  // Replace <NavLink to=... and <Link to=... with <Link href=...
  content = content.replace(/<(NavLink|Link)\s+to=/g, '<Link href=');
  content = content.replace(/<\/(NavLink)\s*>/g, '</Link>');
  // Replace <NavLink className={({isActive}) => ...}> with just <Link className=...>
  content = content.replace(/className=\{[^\}]*\bisActive\b[^\}]*\}/g, 'className="nav-link"');
  
  fs.writeFileSync(f, content);
});
console.log('Migrated basic react-router hooks to next hooks');
