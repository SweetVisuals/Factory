import fs from 'fs';
import path from 'path';

const inputDir = path.join('c:\\Users\\Shadow\\Desktop\\Factory\\companies\\Relay\\src\\stitch_html');
const outputDir = path.join('c:\\Users\\Shadow\\Desktop\\Factory\\companies\\Relay\\src\\components\\mobile');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const map = {
  'dashboard_00af4b7ebe2f479fb8ea83e1874999e2.html': 'MobileDashboardView.tsx',
  'inbox_c059151b1c454a8e9ab1ef348be7c68b.html': 'MobileInboxView.tsx',
  'discover_1bf877def8544b229cf2016651dc6961.html': 'MobileDiscoverView.tsx',
  'campaigns_a08cdc762bbd43a29e4791a924e53e86.html': 'MobileCampaignsView.tsx',
  'profile_52b5408fbab645138cad0db527e9a345.html': 'MobileProfileView.tsx',
  'accounts_8759049ec82040b69c99b2a5230bf5df.html': 'MobileAccountsView.tsx'
};

for (const [file, compName] of Object.entries(map)) {
  const filePath = path.join(inputDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  let bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Remove any floating bottom navigation docks from Stitch since we have ObsidianBottomNav globally in Layout
  bodyContent = bodyContent.replace(/<nav[^>]*aria-label=["']?(Mobile Navigation Dock|Bottom navigation)["']?[^>]*>[\s\S]*?<\/nav>/gi, '');
  bodyContent = bodyContent.replace(/<nav[^>]*class=["'][^"']*fixed bottom-0[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, '');

  // Strip inline style and script tags to prevent JSX parser syntax errors
  bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Convert attributes to JSX
  let jsx = bodyContent
    .replace(/ class="/g, ' className="')
    .replace(/ class='/g, " className='")
    .replace(/ for="/g, ' htmlFor="')
    .replace(/ tabindex="/gi, ' tabIndex="')
    .replace(/ readonly/gi, ' readOnly')
    .replace(/ autocomplete=/gi, ' autoComplete=')
    .replace(/ autofocus/gi, ' autoFocus')
    .replace(/ stroke-width=/gi, ' strokeWidth=')
    .replace(/ stroke-linecap=/gi, ' strokeLinecap=')
    .replace(/ stroke-linejoin=/gi, ' strokeLinejoin=')
    .replace(/ clip-rule=/gi, ' clipRule=')
    .replace(/ fill-rule=/gi, ' fillRule=')
    .replace(/ stroke-dasharray=/gi, ' strokeDasharray=')
    .replace(/ stroke-dashoffset=/gi, ' strokeDashoffset=')
    .replace(/ preserveAspectRatio=/gi, ' preserveAspectRatio=');

  // Self-close void elements
  const voidTags = ['img', 'input', 'br', 'hr', 'path', 'circle', 'line', 'polygon', 'polyline', 'rect'];
  for (const tag of voidTags) {
    const reg = new RegExp(`(<${tag}\\b[^>]*)(?<!/)>`, 'gi');
    jsx = jsx.replace(reg, '$1 />');
  }

  // Handle simple style="width: 50%" or similar
  jsx = jsx.replace(/style="([^"]*)"/g, (match, styleStr) => {
    const rules = styleStr.split(';').filter(Boolean);
    const obj = {};
    for (let r of rules) {
      let [k, v] = r.split(':').map(s => s.trim());
      if (k && v) {
        k = k.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        obj[k] = v;
      }
    }
    return `style={${JSON.stringify(obj)}}`;
  });

  // Remove HTML comments or convert them
  jsx = jsx.replace(/<!--[\s\S]*?-->/g, '');

  const compCode = `import React from 'react';
import { cn } from '../../lib/utils';

export const ${compName.replace('.tsx', '')}: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-background text-on-background font-body-md pb-24 md:hidden">
      ${jsx}
    </div>
  );
};

export default ${compName.replace('.tsx', '')};
`;

  const outPath = path.join(outputDir, compName);
  fs.writeFileSync(outPath, compCode, 'utf8');
  console.log(`Generated ${outPath}`);
}
