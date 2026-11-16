const PALETTES = [
  { id: 'phosphor', name: 'Phosphor', background: '#0b1715', panel: '#17302b', screen: '#05110c', accent: '#a5f5b8', secondary: '#f4be70', border: '#578b72' },
  { id: 'ocean', name: 'Deep Ocean', background: '#071923', panel: '#123747', screen: '#03131d', accent: '#7ce3ea', secondary: '#91b8ff', border: '#4a8499' },
  { id: 'ember', name: 'Copper Ember', background: '#21120c', panel: '#463026', screen: '#140b08', accent: '#ffbd79', secondary: '#f47751', border: '#a06b4b' },
  { id: 'violet', name: 'Ultraviolet', background: '#171022', panel: '#312441', screen: '#0c0817', accent: '#dda8ff', secondary: '#86b6ff', border: '#785f9b' },
  { id: 'rose', name: 'Rose Neon', background: '#241018', panel: '#472438', screen: '#150810', accent: '#ffa6cf', secondary: '#ffdd83', border: '#a25f81' },
  { id: 'frost', name: 'Arctic Frost', background: '#101b22', panel: '#30404a', screen: '#09131a', accent: '#c1f4ff', secondary: '#f4e6b5', border: '#849da7' }
];

const OVERLAYS = [
  { id: 'glass', name: 'Glass', description: 'soft reflective sheen' },
  { id: 'scanline', name: 'CRT', description: 'horizontal scanlines' },
  { id: 'circuit', name: 'Circuit', description: 'fine electronic traces' },
  { id: 'grid', name: 'Grid', description: 'graph-paper lattice' },
  { id: 'diagonal', name: 'Stripes', description: 'angled brushed texture' },
  { id: 'carbon', name: 'Carbon', description: 'woven dark texture' }
];

const CLASSIC_THEMES = PALETTES.flatMap(palette => OVERLAYS.map(overlay => Object.freeze({
  ...palette,
  id: `${palette.id}-${overlay.id}`,
  name: `${palette.name} ${overlay.name}`,
  pattern: overlay.id,
  description: overlay.description
})));

// These listening rooms share a renderer across the standalone web and desktop apps.
const SIGNATURE_THEMES = [
  ['vinyl-lounge', 'Vinyl Lounge', 'Walnut, amber light & a record on the turntable', '#21130e', '#533020', '#2c1b13', '#ffd59a', '#ed9b36', '#956538', '#fff0d6', '#cfb48f', 'dark', '50%', 'Georgia, serif'],
  ['liquid-chrome', 'Liquid Chrome', 'Sculpted silver & fluid blue reflections', '#b5bdcf', '#d2d8e8', '#e6eaf3', '#203960', '#335fbb', '#8796b0', '#182d50', '#4a5a75', 'light', '42% 58% 61% 39% / 49% 38% 62% 51%', 'system-ui, sans-serif'],
  ['moss-mist', 'Moss & Mist', 'Sage, botanical silhouettes & soft pebble forms', '#d3d9c5', '#e6e8d6', '#f1f1e3', '#324d33', '#a34929', '#93a17c', '#30432d', '#57664b', 'light', '44% 56% 39% 61% / 59% 43% 57% 41%', 'Georgia, serif'],
  ['cosmic-drift', 'Cosmic Drift', 'Nebula clouds, orbit rings & violet light', '#141023', '#302044', '#20162f', '#ecd7ff', '#e1a8fa', '#8762a1', '#f4e8ff', '#c4add9', 'dark', '50%', 'system-ui, sans-serif'],
  ['jellybean', 'Jellybean', 'Cobalt, peach & unapologetically playful shapes', '#c4abe9', '#f6d0c6', '#ffe5d5', '#292b84', '#a32a44', '#9a749f', '#292359', '#665179', 'light', '46% 54% 58% 42% / 61% 43% 57% 39%', 'system-ui, sans-serif'],
  ['porcelain', 'Porcelain', 'Warm ivory ceramic & terracotta relief', '#e4d9ca', '#f4eadb', '#fff5e8', '#773d27', '#a44928', '#b9a18b', '#56382a', '#7e6452', 'light', '50%', 'Georgia, serif'],
  ['tape-archive', 'Tape Archive', 'Smoked cassette glass, cream keys & orange labels', '#201e1c', '#3c3830', '#282725', '#f7dfb3', '#ffb06a', '#827362', '#f4e7d1', '#c3b59e', 'dark', '12px', 'ui-monospace, monospace'],
  ['space-age', 'Space Age Stereo', 'Ivory enamel, teak & burnt-orange hi-fi', '#e3d2b7', '#f1e4c9', '#f9eed6', '#57351e', '#ad3d12', '#ad8b5d', '#4c301f', '#765d40', 'light', '50%', 'Georgia, serif'],
  ['jazz-after-hours', 'Jazz After Hours', 'Burgundy velvet, black lacquer & brass', '#160e12', '#321b24', '#201419', '#edce8a', '#e5b865', '#977343', '#f7e9cb', '#c7ad96', 'dark', '48% 48% 6% 6%', 'Georgia, serif'],
  ['tidepool', 'Tidepool', 'Sea glass, water-worn edges & sandy cream', '#b8d4cb', '#d6e7d8', '#e9f1e3', '#204c43', '#247164', '#729c8c', '#23473e', '#46665b', 'light', '58% 42% 52% 48% / 45% 57% 43% 55%', 'Georgia, serif'],
  ['art-nouveau', 'Art Nouveau', 'Emerald, champagne gold & curling floral metalwork', '#101d16', '#203d2b', '#14281c', '#f5d38b', '#e6b65c', '#a0834b', '#faeace', '#c4c19a', 'dark', '48% 48% 8% 8%', 'Georgia, serif'],
  ['kyoto', 'Kyoto Listening Room', 'Ash wood, washi paper & a vermilion seal', '#e3d4b9', '#f0e4c9', '#fbf1da', '#4a3b2e', '#a03420', '#b69b77', '#45382b', '#726048', 'light', '50%', 'Georgia, serif'],
  ['stained-glass', 'Stained Glass', 'Jewel glass, luminous curves & plum framing', '#241022', '#461e3a', '#2c1428', '#ffe3b1', '#f5bc63', '#b08061', '#fff0d8', '#d7b7ce', 'dark', '48% 48% 7% 7%', 'Georgia, serif'],
  ['midnight-diner', 'Midnight Diner', 'Cherry enamel, chrome rims & ivory jukebox keys', '#4b1014', '#8d2025', '#57181c', '#fff0c7', '#ffd37e', '#c7a880', '#fff0d8', '#edc6ae', 'dark', '48% 48% 8% 8%', 'Georgia, serif'],
  ['field-notes', 'Field Notes', 'Bookcloth, kraft paper & a well-traveled journal', '#c9b28c', '#e6d3ac', '#f5e7c9', '#4e432e', '#963d27', '#a38a61', '#443a29', '#66573e', 'light', '5px', 'Georgia, serif'],
  ['obsidian-gold', 'Obsidian & Gold', 'Volcanic stone with flowing gold inlays', '#111212', '#232524', '#191b1a', '#f1d18b', '#dfb457', '#9b8148', '#f6e9ce', '#bdb59d', 'dark', '62% 38% 55% 45% / 46% 54% 46% 54%', 'Georgia, serif'],
  ['aurora-glass', 'Aurora Glass', 'Frosted teal glass & ribbons of northern light', '#0c2325', '#1b4142', '#112e30', '#b8fae4', '#f4bdd5', '#5e9c95', '#e1fff4', '#aacfc8', 'dark', '50%', 'system-ui, sans-serif'],
  ['arcade-candy', 'Arcade Candy', 'Coral enamel, aqua bubbles & chunky candy keys', '#edbba7', '#ffddd0', '#fff0d9', '#15575d', '#b52c2b', '#b87560', '#553330', '#795852', 'light', '50%', 'system-ui, sans-serif'],
  ['saddle-sound', 'Saddle & Sound', 'Cognac leather, stitched contours & warm brass', '#301a10', '#6d3920', '#3d2418', '#ffdda0', '#edb65a', '#b8834a', '#fff0d5', '#e1bf97', 'dark', '50%', 'Georgia, serif'],
  ['clockwork', 'Clockwork', 'Bronze, smoky glass & a mechanical escapement', '#211d18', '#40372a', '#2b261e', '#f6d79a', '#dfad59', '#a48a59', '#fff0d2', '#cabc9e', 'dark', '50%', 'Georgia, serif'],
  ['desert-modern', 'Desert Modern', 'Sunbaked plaster, terracotta arches & ochre', '#d9ac91', '#ecc3a8', '#f8ddc4', '#6b3225', '#963c23', '#b87e60', '#5d3025', '#754633', 'light', '48% 48% 5% 5%', 'Georgia, serif']
].map(([id, name, description, background, panel, screen, accent, secondary, border, text, muted, mode, artRadius, font]) => Object.freeze({
  id, name, description, background, panel, screen, accent, secondary, border, text, muted, mode, artRadius, font, pattern: 'signature', signature: true
}));
const THEMES = [...SIGNATURE_THEMES, ...CLASSIC_THEMES];

function applyDecksonaTheme(root, theme) {
  const values = { background: theme.background, panel: theme.panel, screen: theme.screen, accent: theme.accent, secondary: theme.secondary, border: theme.border };
  for (const [key, value] of Object.entries(values)) {
    root.style.setProperty(`--skin-${key}`, value);
    root.style.setProperty(`--${key === 'background' ? 'bg' : key}`, value);
  }
  root.dataset.pattern = theme.pattern;
  root.dataset.skin = theme.signature ? theme.id : '';
  root.dataset.skinMode = theme.mode || 'dark';
  for (const [key, value] of Object.entries({ text: theme.text || '#e2eaea', muted: theme.muted || '#a2b9b1', 'art-radius': theme.artRadius || '0px', 'theme-font': theme.font || 'system-ui, sans-serif' })) root.style.setProperty(`--${key}`, value);
  const meta = root.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme.background;
  const preview = root.querySelector('#selectedThemePreview');
  if (preview) {
    preview.src = `skin-previews/${root.dataset.edition}/${theme.id}.jpg`;
    preview.alt = `${theme.name} player with sample album art, playback controls, and output selection`;
    root.querySelector('#selectedThemeLabel').textContent = `${theme.name} · enlarge preview`;
  }
}

function createDecksonaThemeCard(doc, theme, onSelect) {
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'theme-card';
  button.dataset.themeId = theme.id; button.dataset.pattern = theme.pattern;
  button.dataset.skin = theme.signature ? theme.id : '';
  button.title = theme.description; button.setAttribute('aria-pressed', 'false');
  for (const [key, value] of Object.entries({ panel: theme.panel, screen: theme.screen, accent: theme.accent, border: theme.border, secondary: theme.secondary })) button.style.setProperty(`--swatch-${key}`, value);
  button.style.setProperty('--preview-radius', theme.artRadius || '4px');
  const swatch = doc.createElement('img'); swatch.className = 'theme-player-preview';
  swatch.src = `skin-previews/${doc.documentElement.dataset.edition}/${theme.id}.jpg`;
  swatch.alt = `${theme.name} player preview`; swatch.loading = 'lazy'; swatch.decoding = 'async';
  swatch.width = 900; swatch.height = doc.documentElement.dataset.edition === 'web' ? 570 : 390;
  const name = doc.createElement('span'); name.className = 'theme-name'; name.textContent = theme.name;
  const detail = doc.createElement('span'); detail.className = 'theme-detail'; detail.textContent = theme.description;
  button.append(swatch, name, detail); button.addEventListener('click', () => onSelect(theme));
  return button;
}

if (typeof module !== 'undefined') module.exports = { PALETTES, OVERLAYS, CLASSIC_THEMES, SIGNATURE_THEMES, THEMES, applyDecksonaTheme };
if (typeof window !== 'undefined') {
  window.DECKSONA_THEMES = THEMES;
  window.DECKSONA_SKINS = { apply: applyDecksonaTheme, createCard: createDecksonaThemeCard };
}
