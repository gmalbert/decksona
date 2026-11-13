// Generates a review image from the same presets used by the in-app skin picker.
const fs = require('node:fs');
const path = require('node:path');
const { THEMES } = require('./themes');

const width = 1200;
const height = 860;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".35"/><stop offset=".45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".08"/></linearGradient>`,
  `<pattern id="scanline" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 3.5H4" stroke="#fff" stroke-opacity=".22"/></pattern>`,
  `<pattern id="circuit" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 10H18V28M11 0V18H28" fill="none" stroke="#fff" stroke-opacity=".18"/></pattern>`,
  `<pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#fff" stroke-opacity=".16"/></pattern>`,
  `<pattern id="diagonal" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V12" stroke="#fff" stroke-opacity=".19"/></pattern>`,
  `<pattern id="carbon" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0L12 12M12 0L0 12" stroke="#fff" stroke-opacity=".14"/></pattern></defs>`,
  `<rect width="${width}" height="${height}" fill="#0b1014"/><text x="28" y="36" fill="#e8f3f3" font-family="Arial" font-size="23" font-weight="bold">MA/PLAYER · 36 SKINS</text><text x="28" y="57" fill="#94aab0" font-family="Arial" font-size="12">Six palettes × six surface overlays</text>`];

THEMES.forEach((theme, index) => {
  const col = index % 6;
  const row = Math.floor(index / 6);
  const x = 28 + col * 193;
  const y = 76 + row * 129;
  parts.push(`<rect x="${x}" y="${y}" width="179" height="116" fill="${theme.panel}" stroke="${theme.border}"/>`);
  parts.push(`<rect x="${x + 8}" y="${y + 8}" width="163" height="70" fill="${theme.screen}"/>`);
  parts.push(`<rect x="${x + 8}" y="${y + 8}" width="163" height="70" fill="url(#${theme.pattern})"/>`);
  parts.push(`<text x="${x + 17}" y="${y + 34}" fill="${theme.accent}" font-family="Consolas,monospace" font-size="14" font-weight="bold">MIDNIGHT CITY</text>`);
  parts.push(`<text x="${x + 17}" y="${y + 55}" fill="${theme.secondary}" font-family="Consolas,monospace" font-size="11">01:12  ▰▰▰▰▰  04:05</text>`);
  parts.push(`<text x="${x + 9}" y="${y + 99}" fill="#e6eeee" font-family="Arial" font-size="11">${escape(theme.name)}</text>`);
});
parts.push('</svg>');
fs.writeFileSync(path.join(__dirname, 'skins-preview.svg'), parts.join(''));
