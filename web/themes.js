const PALETTES = [
  { id: 'phosphor', name: 'Phosphor', background: '#0b1715', panel: '#17302b', screen: '#05110c', accent: '#a5f5b8', secondary: '#f4be70', border: '#578b72' },
  { id: 'ocean', name: 'Deep Ocean', background: '#071923', panel: '#123747', screen: '#03131d', accent: '#7ce3ea', secondary: '#91b8ff', border: '#4a8499' },
  { id: 'ember', name: 'Copper Ember', background: '#21120c', panel: '#463026', screen: '#140b08', accent: '#ffbd79', secondary: '#f47751', border: '#a06b4b' },
  { id: 'violet', name: 'Ultraviolet', background: '#171022', panel: '#312441', screen: '#0c0817', accent: '#dda8ff', secondary: '#86b6ff', border: '#785f9b' },
  { id: 'rose', name: 'Rose Neon', background: '#241018', panel: '#472438', screen: '#150810', accent: '#ffa6cf', secondary: '#ffdd83', border: '#a25f81' },
  { id: 'frost', name: 'Arctic Frost', background: '#101b22', panel: '#30404a', screen: '#09131a', accent: '#c1f4ff', secondary: '#f4e6b5', border: '#849da7' }
];
const OVERLAYS = [
  { id: 'glass', name: 'Glass' }, { id: 'scanline', name: 'CRT' }, { id: 'circuit', name: 'Circuit' },
  { id: 'grid', name: 'Grid' }, { id: 'diagonal', name: 'Stripes' }, { id: 'carbon', name: 'Carbon' }
];
const THEMES = PALETTES.flatMap(palette => OVERLAYS.map(overlay => Object.freeze({
  ...palette, id: `${palette.id}-${overlay.id}`, name: `${palette.name} ${overlay.name}`, pattern: overlay.id
})));
window.DECKSONA_THEMES = THEMES;
