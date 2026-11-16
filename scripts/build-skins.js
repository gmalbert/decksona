// Build local decorative surfaces; the standalone web folder needs no CDN or build step.
const fs = require('node:fs');
const path = require('node:path');
const { SIGNATURE_THEMES } = require('../themes');
const root = path.resolve(__dirname, '..');
const wave = (color, y, width = 3, opacity = .5) => `<path d="M-80 ${y} C180 ${y-190} 310 ${y+170} 570 ${y-30} S860 ${y-150} 1080 ${y+20}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
const circle = (x,y,r,color,width=2,opacity=.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
function leaves(color) {
  return `<g fill="${color}" opacity=".25"><path d="M0 650 Q190 370 70 0" fill="none" stroke="${color}" stroke-width="4"/>${Array.from({length:9},(_,i)=>{const y=50+i*68;return `<path d="M${70+i*3} ${y} q-90 -65 -125 0 q65 62 125 0 M${70+i*3} ${y+25} q100 -76 145 -43 q-14 69 -145 43"/>`;}).join('')}</g>`;
}
function gear(x,y,r,color) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" opacity=".4">${circle(0,0,r,color,12,1)}${circle(0,0,r*.7,color,2,1)}${circle(0,0,r*.22,color,5,1)}${Array.from({length:16},(_,i)=>`<path transform="rotate(${i*22.5})" d="M0 ${r*.9} v${r*.23} M0 ${r*.25} V${r*.66}" stroke-width="9"/>`).join('')}</g>`;
}
function decoration(t) {
  const a=t.border, b=t.secondary;
  switch(t.id) {
    case 'vinyl-lounge': return `<g opacity=".4">${Array.from({length:30},(_,i)=>wave('#cb9253',i*24,1,.26)).join('')}</g>${circle(65,325,220,b,2,.18)}${circle(65,325,205,b,1,.18)}<ellipse cx="950" cy="650" rx="220" ry="190" fill="#180b07" opacity=".4"/>`;
    case 'liquid-chrome': return `<path d="M-20 220 C190 -90 370 390 600 130 S930 170 1040 10 V-20 H-20Z" fill="url(#shine)"/>${wave('#ffffff',160,6,.8)}${wave('#6685bb',180,18,.2)}${wave('#ffffff',550,7,.6)}`;
    case 'moss-mist': return `${leaves('#47623c')}<path d="M0 570 Q270 260 480 500 T1050 340 V700 H0Z" fill="#728d61" opacity=".16"/>${wave('#fffef2',500,50,.22)}`;
    case 'cosmic-drift': return `<ellipse cx="860" cy="540" rx="340" ry="200" fill="url(#glow)"/>${[185,210,245].map(r=>circle(45,310,r,'#dba5ff',1,.3)).join('')}${Array.from({length:65},(_,i)=>`<circle cx="${(i*173+17)%1000}" cy="${(i*97+21)%650}" r="${i%7===0?2:1}" fill="#f6d9ff" opacity="${.2+(i%4)*.15}"/>`).join('')}`;
    case 'jellybean': return `<path d="M-30 0 H380 Q570 100 280 210 T-30 430Z" fill="#4741cf"/><path d="M740 -40 Q540 170 800 250 T1040 520 V-40Z" fill="#ffbd8e"/><path d="M-20 560 Q150 390 300 600 T730 700 H-20Z" fill="#f9ca61"/>${circle(930,580,100,'#9b6fdf',55,.6)}`;
    case 'porcelain': return `${[460,485,515,550,590,640].map(y=>wave('#bea78e',y,3,.3)+wave('#fffaf0',y-4,4,.8)).join('')}${circle(40,170,160,'#fffdf7',12,.3)}`;
    case 'tape-archive': return `<rect x="24" y="30" width="952" height="590" rx="22" fill="none" stroke="${a}" stroke-width="2"/>${[40,960].map(x=>[47,604].map(y=>circle(x,y,7,a,2,.8)).join('')).join('')}${[180,820].map(x=>circle(x,270,150,a,2,.22)+circle(x,270,120,a,20,.08)).join('')}<path d="M100 610 H900" stroke="${b}" stroke-width="8" opacity=".5"/>`;
    case 'space-age': return `<path d="M-20 -10 H1020 V165 Q500 90 -20 180Z" fill="#7c411e" opacity=".7"/>${wave('#fff8de',170,10,.8)}<ellipse cx="930" cy="650" rx="300" ry="155" fill="#b4672d" opacity=".14"/>`;
    case 'jazz-after-hours': return `<path d="M0 0 H130 Q15 250 100 650 H0Z M1000 0 H870 Q985 250 900 650 H1000Z" fill="#7a1935" opacity=".6"/>${wave('#e0b467',590,2,.5)}${[15,985].map(x=>`<path d="M${x} 25 V625" stroke="${a}" stroke-width="2"/>`).join('')}`;
    case 'tidepool': return `${[90,150,450,540].map((y,i)=>wave(i%2?'#f9ffeb':'#3e9b8e',y,18,.18)+wave('#f1ffeb',y-10,3,.65)).join('')}${circle(950,500,180,'#509f90',3,.2)}`;
    case 'art-nouveau': return `${leaves('#caa35a')}<g transform="translate(1000 650) rotate(180)">${leaves('#caa35a')}</g>${[20,35].map(n=>`<rect x="${n}" y="${n}" width="${1000-2*n}" height="${650-2*n}" rx="80" fill="none" stroke="#caa35a" stroke-width="2" opacity=".55"/>`).join('')}${wave('#e5c17a',570,3,.6)}`;
    case 'kyoto': return `${wave('#a48455',60,60,.2)}${wave('#fff8de',90,8,.6)}<circle cx="910" cy="130" r="62" fill="#b13a24" opacity=".75"/>${leaves('#71664f')}`;
    case 'stained-glass': return `<g stroke="#bd924c" stroke-width="3" opacity=".75"><path d="M0 0 H450 Q170 160 0 290Z" fill="#256e71"/><path d="M1000 0 H710 Q710 140 1000 250Z" fill="#b55128"/><path d="M0 650 V390 Q160 360 230 650Z" fill="#9a3455"/><path d="M1000 650 H650 Q800 420 1000 380Z" fill="#296b5e"/></g>${[50,105,580].map(y=>wave('#ebc478',y,3,.6)).join('')}`;
    case 'midnight-diner': return `<rect x="18" y="18" width="964" height="614" rx="95" fill="none" stroke="#ffedcb" stroke-width="9" opacity=".65"/><rect x="31" y="31" width="938" height="588" rx="85" fill="none" stroke="#3b2527" stroke-width="3" opacity=".8"/>${wave('#ff6d59',125,40,.18)}`;
    case 'field-notes': return `<path d="M0 0 H95 V650 H0Z" fill="#53543a"/><path d="M83 0 V650" stroke="#9d412b" stroke-width="5"/><path d="M120 590 Q420 520 600 615" fill="none" stroke="#b8835c" stroke-width="2" stroke-dasharray="5 8"/>${circle(900,560,62,'#a75d3b',2,.35)}${circle(900,560,48,'#a75d3b',1,.35)}`;
    case 'obsidian-gold': return `${[70,570].map(y=>wave('#cda45a',y,2,.8)).join('')}<path d="M-20 200 Q180 80 410 130 T1040 30 L1040 -10 H-20Z" fill="#080b0a" opacity=".45"/>${wave('#b18c42',180,2,.6)}`;
    case 'aurora-glass': return `${wave('#80ffd5',180,80,.12)}${wave('#81ead5',205,12,.27)}${wave('#efa5cd',520,65,.13)}${wave('#ffb9e0',560,2,.4)}`;
    case 'arcade-candy': return `<path d="M-20 0 H1020 V125 Q690 10 420 150 T-20 180Z" fill="#f7685c"/><path d="M-20 650 V480 Q190 330 430 590 T1020 470 V650Z" fill="#66c9bf"/>${[50,950].map(x=>`<circle cx="${x}" cy="340" r="55" fill="#ffd380"/>`).join('')}`;
    case 'saddle-sound': return `${[15,24].map(n=>`<rect x="${n}" y="${n}" width="${1000-2*n}" height="${650-2*n}" rx="65" fill="none" stroke="#f2c789" stroke-width="2" stroke-dasharray="${n===15?'0':'5 5'}" opacity=".65"/>`).join('')}<path d="M0 130 Q200 0 420 85 T1000 10" fill="none" stroke="#e8b777" stroke-width="3" stroke-dasharray="5 5" opacity=".6"/>`;
    case 'clockwork': return `${gear(970,70,130,'#d4ac65')}${gear(30,635,150,'#d4ac65')}${gear(865,40,60,'#d4ac65')}${wave('#bd9855',80,2,.4)}${wave('#bd9855',590,2,.4)}`;
    case 'desert-modern': return `<circle cx="880" cy="150" r="82" fill="#d98a37" opacity=".7"/><path d="M-20 640 V450 Q130 210 350 480 T1020 400 V660Z" fill="#b76042" opacity=".3"/>${wave('#f8d4b4',570,40,.6)}${wave('#b96f50',620,20,.35)}`;
  }
}
for (const dir of ['skins','web/skins']) fs.mkdirSync(path.join(root,dir),{recursive:true});
for (const t of SIGNATURE_THEMES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="shine" x2=".7" y2="1"><stop stop-color="#f8fbff"/><stop offset=".4" stop-color="#8291b4"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#98a8c6"/></linearGradient><radialGradient id="glow"><stop stop-color="#aa62cb" stop-opacity=".7"/><stop offset="1" stop-color="#713fc4" stop-opacity="0"/></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>${decoration(t)}<rect width="1000" height="650" filter="url(#grain)" opacity="${['liquid-chrome','tidepool','aurora-glass','arcade-candy','jellybean'].includes(t.id)?'.035':'.09'}"/></svg>`;
  for(const dir of ['skins','web/skins']) fs.writeFileSync(path.join(root,dir,`${t.id}.svg`),svg);
}
for(const file of ['themes.js','themes.css','player-session.js']) fs.copyFileSync(path.join(root,file),path.join(root,'web',file));
console.log(`Synced ${SIGNATURE_THEMES.length} signature surfaces and shared theme files to web/.`);
