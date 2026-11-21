window.radioNowPlaying = function (item, playerMedia) {
  const station = item?.media_item || item;
  if (station?.media_type !== 'radio') return null;

  const clean = value => typeof value === 'string' ? value.trim() : '';
  const details = item.streamdetails;
  const metadata = details?.stream_metadata;
  // A player's metadata may lag behind the queue after an output or station change.
  const player = item.queue_item_id && playerMedia?.queue_item_id === item.queue_item_id ? playerMedia : null;
  const playerTitle = clean(player?.title);
  const streamTitle = clean(details?.stream_title);
  const separator = streamTitle.indexOf(' - ');
  const metadataTitle = clean(metadata?.title);
  const title = metadataTitle || (separator > 0 ? streamTitle.slice(separator + 3).trim() : streamTitle);
  const artist = metadataTitle ? clean(metadata.artist) : (separator > 0 ? streamTitle.slice(0, separator).trim() : '');
  if (title) {
    const playerArtist = clean(player?.artist);
    const sameTrack = title === playerTitle && (!artist || !playerArtist || artist === playerArtist);
    return {
      title,
      artist: artist || (sameTrack ? playerArtist : ''),
      album: clean(metadata?.album) || (sameTrack ? clean(player.album) : ''),
      imageUrl: clean(metadata?.image_url) || (sameTrack ? clean(player.image_url) : '')
    };
  }

  if (playerTitle && playerTitle !== clean(station.name || item.name)) {
    return { title: playerTitle, artist: clean(player.artist), album: clean(player.album), imageUrl: clean(player.image_url) };
  }

  return null;
};

window.radioArtworkUrl = function (value, serverUrl) {
  if (!value) return '';
  try {
    const url = new URL(value, serverUrl || undefined);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
};

window.loadRadioArtwork = async function (url) {
  if (!url) return '';
  const image = new Image();
  image.referrerPolicy = 'no-referrer';
  image.src = url;
  try {
    await image.decode();
    return url;
  } catch {
    return '';
  }
};

window.installRadioLibrary = function ({ command, play }) {
  const get = id => document.getElementById(id);
  const dialog = get('radioDialog');
  const form = get('radioForm');
  const list = get('radioStations');
  const status = get('radioStatus');
  const error = get('radioError');
  const save = get('radioSave');
  const close = get('radioClose');
  let stations = [];
  let loadRevision = 0;

  function showError(message = '') {
    error.textContent = message.replace(/^Error invoking remote method 'api:command': Error: /, '');
    error.hidden = !message;
  }

  function renderStations() {
    list.replaceChildren(...stations.map(station => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = station.name;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'PLAY';
      button.setAttribute('aria-label', `Play ${station.name}`);
      button.disabled = !station.uri || station.available === false;
      button.addEventListener('click', () => {
        dialog.close();
        play(station);
      });
      row.append(name, button);
      return row;
    }));
    status.textContent = stations.length ? '' : 'No saved radio stations yet.';
  }

  get('radioOpen').addEventListener('click', async () => {
    const revision = ++loadRevision;
    stations = [];
    list.replaceChildren();
    showError();
    status.textContent = 'Loading radio stations…';
    save.disabled = true;
    dialog.showModal();
    try {
      const pageSize = 100;
      const saved = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await command('radioStations', { limit: pageSize, offset });
        if (revision !== loadRevision || !dialog.open) return;
        saved.push(...page);
        if (page.length < pageSize) break;
      }
      stations = saved;
      renderStations();
    } catch (failure) {
      if (revision !== loadRevision || !dialog.open) return;
      status.textContent = 'Could not load saved stations.';
      showError(failure.message);
    } finally {
      if (revision === loadRevision) save.disabled = false;
    }
  });

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    if (close.disabled) event.preventDefault();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.disabled) return;
    showError();
    const name = get('radioName').value.trim();
    const url = get('radioUrl').value.trim();
    if (!name || !/^https?:\/\//i.test(url)) {
      showError('Enter a station name and a direct http:// or https:// stream URL.');
      return;
    }
    save.disabled = close.disabled = list.inert = true;
    save.textContent = 'ADDING…';
    try {
      const station = await command('addRadio', { name, url });
      stations = [station, ...stations.filter(item => item.uri !== station.uri &&
        !item.provider_mappings?.some(mapping => mapping.provider_domain === 'builtin' && mapping.item_id === url))];
      renderStations();
      status.textContent = `${station.name} added.`;
      form.reset();
      list.inert = false;
      list.querySelector('button')?.focus();
    } catch (failure) {
      showError(failure.message);
    } finally {
      save.disabled = close.disabled = list.inert = false;
      save.textContent = 'ADD STATION';
    }
  });
};
