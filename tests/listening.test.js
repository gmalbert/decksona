const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { firstMovable, reference, quality, searchArgs } = require('../listening-core');

test('queue edits exclude all played, playing and buffered entries, including stopped queues', () => {
  assert.equal(firstMovable(null), 0);
  assert.equal(firstMovable({current_item: {queue_item_id:'one'},current_index:0}), 1);
  assert.equal(firstMovable({current_item: {},current_index:4,index_in_buffer:7}), 8);
  assert.equal(firstMovable({current_item: {},current_index:7,index_in_buffer:4}), 8);
});
test('media references retain provider ids and item paths', () => {
  assert.deepEqual(reference({uri:'spotify://playlist/folder/list'}),{item_id:'folder/list',provider_instance_id_or_domain:'spotify'});
  assert.deepEqual(reference({media_item:{item_id:0,provider:'library'}}),{item_id:'0',provider_instance_id_or_domain:'library'});
});
test('quality uses active stream details without guessing from an alternative provider mapping', () => {
  assert.equal(quality({media_item:{provider_mappings:[{audio_format:{content_type:'flac'}}]}}),'Audio quality unavailable');
  assert.equal(quality({streamdetails:{provider:'files',audio_format:{content_type:'flac',sample_rate:44100,bit_depth:16}}}),'files · FLAC · 44.1 kHz · 16-bit');
});
test('library-only searches cannot leak to the selected streaming provider', () => {
  assert.deepEqual(searchArgs('jazz',new Set(['album']),60,true,'spotify'),{search_query:'jazz',media_types:['album'],limit:60,library_only:true,providers:['library']});
  assert.deepEqual(searchArgs('jazz',['track'],30,false,'files').providers,['files']);
  assert.equal(searchArgs('jazz',['track'],30,false,'').providers,undefined);
});
test('both editions ship identical listening features and packaging includes their dependencies', () => {
  for(const file of ['listening-core.js','listening.js','listening.css']) {
    assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync(`web/${file}`,'utf8'),file);
    assert.ok(require('../package.json').build.files.includes(file),file);
  }
  for(const file of ['index.html','web/index.html']) {
    const html=fs.readFileSync(file,'utf8');
    assert.ok(html.indexOf('listening-core.js')<html.indexOf('listening.js'));
    assert.ok(html.includes('listening.css'));
  }
});

test('the desktop package and web edition load the shared Radio module', () => {
  const desktop = fs.readFileSync('index.html', 'utf8');
  const web = fs.readFileSync('web/index.html', 'utf8');
  assert.ok(require('../package.json').build.files.includes('web/radio.js'));
  assert.match(desktop, /src="web\/radio\.js[^"]*"[\s\S]*src="renderer\.js/);
  assert.match(web, /src="radio\.js[^"]*"[\s\S]*src="app\.js/);
});
