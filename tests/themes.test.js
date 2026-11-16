const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { THEMES, SIGNATURE_THEMES, CLASSIC_THEMES, applyDecksonaTheme } = require('../themes');
const root = path.resolve(__dirname,'..');
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b) { const values=[luminance(a),luminance(b)].sort((a,b)=>b-a); return (values[0]+.05)/(values[1]+.05); }
test('all 21 named listening rooms ship locally in both editions',()=>{
  assert.equal(SIGNATURE_THEMES.length,21); assert.equal(THEMES.length,57);
  for(const theme of SIGNATURE_THEMES) {
    for(const prefix of ['','web/']) assert.ok(fs.existsSync(path.join(root,prefix,'skins',`${theme.id}.svg`)),theme.id);
    assert.ok(fs.readFileSync(path.join(root,'themes.css'),'utf8').includes(`data-skin="${theme.id}"`),theme.id);
    for(const surface of [theme.panel,theme.screen]) {
      assert.ok(contrast(theme.text,surface)>=4.5,`${theme.name}: text contrast`);
      assert.ok(contrast(theme.muted,surface)>=4.5,`${theme.name}: secondary text contrast`);
      assert.ok(contrast(theme.accent,surface)>=4.5,`${theme.name}: title contrast`);
    }
  }
});
test('web is self-contained and shared theme files cannot silently diverge',()=>{
  for(const name of ['themes.js','themes.css',...SIGNATURE_THEMES.map(t=>`skins/${t.id}.svg`)]) {
    assert.deepEqual(fs.readFileSync(path.join(root,name)),fs.readFileSync(path.join(root,'web',name)),name);
  }
});
test('every skin has real player screenshots bundled for each edition',()=>{
  for(const theme of THEMES) for(const [base,edition] of [['','desktop'],['web/','web']]) {
    const file=path.join(root,base,'skin-previews',edition,`${theme.id}.jpg`);
    const data=fs.readFileSync(file);
    assert.equal(data.readUInt16BE(0),0xffd8,`${theme.name}: ${edition} JPEG`);
    assert.ok(data.length>5000,`${theme.name}: ${edition} full player preview`);
  }
});
test('switching from light organic themes back to classics resets shape and text tokens',()=>{
  const values=new Map(); const meta={content:''};
  const doc={style:{setProperty:(k,v)=>values.set(k,v)},dataset:{},querySelector:selector=>selector.startsWith('meta')?meta:null};
  applyDecksonaTheme(doc,SIGNATURE_THEMES.find(t=>t.id==='moss-mist'));
  assert.equal(doc.dataset.skinMode,'light');
  applyDecksonaTheme(doc,CLASSIC_THEMES[0]);
  assert.equal(doc.dataset.skin,''); assert.equal(doc.dataset.pattern,'glass'); assert.equal(doc.dataset.skinMode,'dark');
  assert.equal(values.get('--art-radius'),'0px'); assert.equal(values.get('--text'),'#e2eaea');
  assert.equal(values.get('--skin-background'),values.get('--bg')); assert.equal(meta.content,CLASSIC_THEMES[0].background);
});
