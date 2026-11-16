(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod3) => function __require2() {
    try {
      return mod3 || (0, cb[__getOwnPropNames(cb)[0]])((mod3 = { exports: {} }).exports, mod3), mod3.exports;
    } catch (e) {
      throw mod3 = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod3, isNodeMode, target) => (target = mod3 != null ? __create(__getProtoOf(mod3)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod3 || !mod3.__esModule ? __defProp(target, "default", { value: mod3, enumerable: true }) : target,
    mod3
  ));

  // local-audio-config.js
  var require_local_audio_config = __commonJS({
    "local-audio-config.js"(exports, module) {
      function sendspinUrl2(serverUrl, override = "") {
        const custom = String(override || "").trim();
        const url = new URL(custom || serverUrl);
        if (!custom) {
          url.protocol = "ws:";
          url.port = "8927";
          url.pathname = "/sendspin";
        }
        if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
          throw new Error("Enter a Sendspin address such as ws://192.168.1.100:8927/sendspin, without credentials or query parameters.");
        }
        return url.href;
      }
      if (typeof module !== "undefined") module.exports = { sendspinUrl: sendspinUrl2 };
    }
  });

  // node_modules/@sendspin/sendspin-js/dist/audio/decoder.js
  var SendspinDecoder = class {
    constructor(onDecodedChunk, currentGeneration) {
      this.webCodecsDecoder = null;
      this.webCodecsDecoderReady = null;
      this.webCodecsFormat = null;
      this.useNativeOpus = true;
      this.nativeDecoderQueue = [];
      this.opusDecoder = null;
      this.opusDecoderModule = null;
      this.opusDecoderReady = null;
      this.flacDecodingContext = null;
      this.flacDecodingContextSampleRate = 0;
      this.flacDecodingContextChannels = 0;
      this.onDecodedChunk = onDecodedChunk;
      this.currentGeneration = currentGeneration;
    }
    /**
     * Handle a binary audio message from the WebSocket.
     * Parses the message, decodes the audio, and emits a DecodedAudioChunk.
     */
    async handleBinaryMessage(data, format, generation) {
      const firstByte = new Uint8Array(data)[0];
      if (firstByte === 4) {
        const timestampView = new DataView(data, 1, 8);
        const serverTimeUs = Number(timestampView.getBigInt64(0, false));
        const audioData = data.slice(13);
        if (format.codec === "opus" && this.useNativeOpus) {
          await this.initWebCodecsDecoder(format);
          if (this.useNativeOpus && this.webCodecsDecoder) {
            if (this.queueToNativeOpusDecoder(audioData, serverTimeUs, generation)) {
              return;
            }
          }
        }
        try {
          const decoded = await this.decode(audioData, format);
          if (decoded && generation === this.currentGeneration()) {
            this.onDecodedChunk({
              samples: decoded.samples,
              sampleRate: decoded.sampleRate,
              serverTimeUs,
              generation
            });
          }
        } catch (error) {
          console.error("Sendspin: Failed to decode audio buffer:", error);
        }
      }
    }
    async decode(audioData, format) {
      if (format.codec === "opus") {
        return this.decodeOpusWithEncdec(audioData, format);
      } else if (format.codec === "flac") {
        return this.decodeFLAC(audioData, format);
      } else if (format.codec === "pcm") {
        return this.decodePCM(audioData, format);
      }
      return null;
    }
    // ========================================
    // PCM Decoder
    // ========================================
    decodePCM(audioData, format) {
      const bitDepth = format.bit_depth;
      if (bitDepth !== 16 && bitDepth !== 24 && bitDepth !== 32) {
        console.warn(`Sendspin: unsupported PCM bit_depth ${bitDepth}`);
        return null;
      }
      const bytesPerSample = bitDepth / 8;
      const dataView = new DataView(audioData);
      const numSamples = audioData.byteLength / (bytesPerSample * format.channels);
      const samples = [];
      for (let ch = 0; ch < format.channels; ch++) {
        samples.push(new Float32Array(numSamples));
      }
      for (let channel = 0; channel < format.channels; channel++) {
        const channelData = samples[channel];
        for (let i = 0; i < numSamples; i++) {
          const offset = (i * format.channels + channel) * bytesPerSample;
          let sample = 0;
          if (bitDepth === 16) {
            sample = dataView.getInt16(offset, true) / 32768;
          } else if (bitDepth === 24) {
            const byte1 = dataView.getUint8(offset);
            const byte2 = dataView.getUint8(offset + 1);
            const byte3 = dataView.getUint8(offset + 2);
            let int24 = byte3 << 16 | byte2 << 8 | byte1;
            if (int24 & 8388608) {
              int24 |= 4278190080;
            }
            sample = int24 / 8388608;
          } else if (bitDepth === 32) {
            sample = dataView.getInt32(offset, true) / 2147483648;
          }
          channelData[i] = sample;
        }
      }
      return { samples, sampleRate: format.sample_rate };
    }
    // ========================================
    // FLAC Decoder (uses OfflineAudioContext)
    // ========================================
    getFlacDecodingContext(sampleRate, channels) {
      if (!this.flacDecodingContext || this.flacDecodingContextSampleRate !== sampleRate || this.flacDecodingContextChannels !== channels) {
        this.flacDecodingContext = new OfflineAudioContext(channels, 1, sampleRate);
        this.flacDecodingContextSampleRate = sampleRate;
        this.flacDecodingContextChannels = channels;
      }
      return this.flacDecodingContext;
    }
    async decodeFLAC(audioData, format) {
      try {
        let dataToEncode = audioData;
        if (format.codec_header) {
          const headerBytes = Uint8Array.from(atob(format.codec_header), (c) => c.charCodeAt(0));
          const combined = new Uint8Array(headerBytes.length + audioData.byteLength);
          combined.set(headerBytes, 0);
          combined.set(new Uint8Array(audioData), headerBytes.length);
          dataToEncode = combined.buffer;
        }
        const ctx = this.getFlacDecodingContext(format.sample_rate, format.channels);
        const audioBuffer = await ctx.decodeAudioData(dataToEncode);
        const samples = [];
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          samples.push(new Float32Array(audioBuffer.getChannelData(ch)));
        }
        return { samples, sampleRate: audioBuffer.sampleRate };
      } catch (error) {
        console.error("Error decoding FLAC data:", error);
        return null;
      }
    }
    // ========================================
    // Opus - Native WebCodecs Decoder
    // ========================================
    async initWebCodecsDecoder(format) {
      const tryConfigureExistingDecoder = () => {
        if (!this.webCodecsDecoder)
          return false;
        const matchesFormat = !!this.webCodecsFormat && this.webCodecsFormat.sample_rate === format.sample_rate && this.webCodecsFormat.channels === format.channels;
        if (this.webCodecsDecoder.state === "configured" && matchesFormat) {
          return true;
        }
        if (this.webCodecsDecoder.state === "closed") {
          return false;
        }
        try {
          this.webCodecsDecoder.configure({
            codec: "opus",
            sampleRate: format.sample_rate,
            numberOfChannels: format.channels
          });
          this.webCodecsFormat = format;
          return true;
        } catch {
          return false;
        }
      };
      if (tryConfigureExistingDecoder()) {
        return;
      }
      if (this.webCodecsDecoderReady) {
        await this.webCodecsDecoderReady;
        if (tryConfigureExistingDecoder()) {
          return;
        }
        try {
          this.webCodecsDecoder?.close();
        } catch {
        }
        this.webCodecsDecoder = null;
        this.webCodecsDecoderReady = null;
        this.webCodecsFormat = null;
      }
      if (this.webCodecsDecoderReady) {
        await this.webCodecsDecoderReady;
        return;
      }
      this.webCodecsDecoderReady = this.createWebCodecsDecoder(format);
      await this.webCodecsDecoderReady;
    }
    async createWebCodecsDecoder(format) {
      if (typeof AudioDecoder === "undefined") {
        this.useNativeOpus = false;
        return;
      }
      try {
        const support = await AudioDecoder.isConfigSupported({
          codec: "opus",
          sampleRate: format.sample_rate,
          numberOfChannels: format.channels
        });
        if (!support.supported) {
          console.log("[NativeOpus] WebCodecs Opus not supported, will use fallback");
          this.useNativeOpus = false;
          return;
        }
        this.webCodecsDecoder = new AudioDecoder({
          output: (audioData) => this.handleAudioData(audioData),
          error: (error) => {
            console.error("[NativeOpus] WebCodecs decoder error:", error);
          }
        });
        this.webCodecsDecoder.configure({
          codec: "opus",
          sampleRate: format.sample_rate,
          numberOfChannels: format.channels
        });
        this.webCodecsFormat = format;
        console.log(`[NativeOpus] Using WebCodecs AudioDecoder: ${format.sample_rate}Hz, ${format.channels}ch`);
      } catch (error) {
        console.warn("[NativeOpus] WebCodecs init failed, will use fallback:", error);
        this.useNativeOpus = false;
      }
    }
    // Handle decoded audio data from native Opus decoder
    handleAudioData(audioData) {
      try {
        const outputTimestampUs = Number(audioData.timestamp);
        const metadata = this.nativeDecoderQueue.shift();
        if (!metadata) {
          console.warn(`[NativeOpus] Dropping frame with empty decode queue (out ts=${outputTimestampUs})`);
          audioData.close();
          return;
        }
        const { serverTimeUs, generation } = metadata;
        const format = this.webCodecsFormat;
        if (!format) {
          audioData.close();
          return;
        }
        if (generation !== this.currentGeneration()) {
          console.warn(`[NativeOpus] Dropping old-stream frame (ts=${serverTimeUs}, gen=${generation} != current=${this.currentGeneration()})`);
          audioData.close();
          return;
        }
        const channels = audioData.numberOfChannels;
        const frames = audioData.numberOfFrames;
        const fmt = audioData.format;
        const samples = [];
        for (let ch = 0; ch < channels; ch++) {
          samples.push(new Float32Array(frames));
        }
        if (fmt === "f32-planar") {
          for (let ch = 0; ch < channels; ch++) {
            audioData.copyTo(samples[ch], { planeIndex: ch });
          }
        } else if (fmt === "s16-planar") {
          const plane = new Int16Array(frames);
          for (let ch = 0; ch < channels; ch++) {
            audioData.copyTo(plane, { planeIndex: ch });
            const out = samples[ch];
            for (let i = 0; i < frames; i++)
              out[i] = plane[i] / 32768;
          }
        } else if (fmt === "f32") {
          const interleaved = new Float32Array(frames * channels);
          audioData.copyTo(interleaved, { planeIndex: 0 });
          for (let ch = 0; ch < channels; ch++) {
            const out = samples[ch];
            for (let i = 0; i < frames; i++)
              out[i] = interleaved[i * channels + ch];
          }
        } else if (fmt === "s16") {
          const interleaved = new Int16Array(frames * channels);
          audioData.copyTo(interleaved, { planeIndex: 0 });
          for (let ch = 0; ch < channels; ch++) {
            const out = samples[ch];
            for (let i = 0; i < frames; i++)
              out[i] = interleaved[i * channels + ch] / 32768;
          }
        } else {
          console.warn(`[NativeOpus] Unsupported AudioData format: ${fmt}`);
          audioData.close();
          return;
        }
        audioData.close();
        this.onDecodedChunk({
          samples,
          sampleRate: format.sample_rate,
          serverTimeUs,
          generation
        });
      } catch (e) {
        console.error("[NativeOpus] Error in output callback:", e);
        audioData.close();
      }
    }
    queueToNativeOpusDecoder(audioData, serverTimeUs, generation) {
      if (!this.webCodecsDecoder || this.webCodecsDecoder.state !== "configured") {
        return false;
      }
      try {
        this.nativeDecoderQueue.push({
          serverTimeUs,
          generation
        });
        const chunk = new EncodedAudioChunk({
          type: "key",
          timestamp: serverTimeUs,
          data: audioData
        });
        this.webCodecsDecoder.decode(chunk);
        return true;
      } catch (error) {
        if (this.nativeDecoderQueue.length > 0) {
          this.nativeDecoderQueue.pop();
        }
        console.error("[NativeOpus] WebCodecs queue error:", error);
        return false;
      }
    }
    // ========================================
    // Opus - Fallback (opus-encdec library)
    // ========================================
    resolveOpusDecoderModule(moduleExport) {
      const maybeDefault = moduleExport?.default;
      const maybeCommonJs = moduleExport?.["module.exports"];
      const resolved = maybeDefault ?? maybeCommonJs ?? moduleExport;
      if (!resolved || typeof resolved !== "object") {
        throw new Error("[Opus] Invalid libopus decoder module export");
      }
      return resolved;
    }
    resolveOggOpusDecoderClass(wrapperExport) {
      const maybeDefault = wrapperExport?.default;
      const maybeCommonJs = wrapperExport?.["module.exports"];
      const wrapper = maybeDefault ?? maybeCommonJs ?? wrapperExport;
      const resolved = wrapper?.OggOpusDecoder ?? wrapper;
      if (typeof resolved !== "function") {
        throw new Error("[Opus] OggOpusDecoder class export not found");
      }
      return resolved;
    }
    async waitForOpusReady(target) {
      if (target.isReady)
        return;
      if (Object.isExtensible(target)) {
        await new Promise((resolve) => {
          target.onready = () => resolve();
        });
        return;
      }
      while (!target.isReady) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    async initOpusEncdecDecoder(format) {
      if (this.opusDecoderReady) {
        await this.opusDecoderReady;
        return;
      }
      this.opusDecoderReady = (async () => {
        console.log("[Opus] Initializing decoder (opus-encdec)...");
        const [DecoderModuleExport, DecoderWrapperExport] = await Promise.all([
          import("opus-encdec/dist/libopus-decoder.js"),
          import("opus-encdec/src/oggOpusDecoder.js")
        ]);
        this.opusDecoderModule = this.resolveOpusDecoderModule(DecoderModuleExport);
        const OggOpusDecoderClass = this.resolveOggOpusDecoderClass(DecoderWrapperExport);
        await this.waitForOpusReady(this.opusDecoderModule);
        this.opusDecoder = new OggOpusDecoderClass({
          rawOpus: true,
          decoderSampleRate: format.sample_rate,
          outputBufferSampleRate: format.sample_rate,
          numberOfChannels: format.channels
        }, this.opusDecoderModule);
        await this.waitForOpusReady(this.opusDecoder);
        console.log("[Opus] Decoder ready");
      })();
      await this.opusDecoderReady;
    }
    async decodeOpusWithEncdec(audioData, format) {
      try {
        await this.initOpusEncdecDecoder(format);
        const uint8Array = new Uint8Array(audioData);
        const decodedSamples = [];
        this.opusDecoder.decodeRaw(uint8Array, (samples2) => {
          decodedSamples.push(new Float32Array(samples2));
        });
        if (decodedSamples.length === 0) {
          console.warn("[Opus] Fallback decoder produced no samples");
          return null;
        }
        const interleavedSamples = decodedSamples[0];
        const numFrames = interleavedSamples.length / format.channels;
        const samples = [];
        for (let ch = 0; ch < format.channels; ch++) {
          const channelData = new Float32Array(numFrames);
          for (let i = 0; i < numFrames; i++) {
            channelData[i] = interleavedSamples[i * format.channels + ch];
          }
          samples.push(channelData);
        }
        return { samples, sampleRate: format.sample_rate };
      } catch (error) {
        console.error("[Opus] Decode error:", error);
        return null;
      }
    }
    // ========================================
    // Lifecycle
    // ========================================
    /** Clear decoder state (on stream change/clear). Drops in-flight async decodes. */
    clearState() {
      this.nativeDecoderQueue = [];
      try {
        this.webCodecsDecoder?.close();
      } catch {
      }
      this.webCodecsDecoder = null;
      this.webCodecsDecoderReady = null;
      this.webCodecsFormat = null;
    }
    /** Full cleanup (on disconnect). Releases all decoder resources. */
    close() {
      this.clearState();
      if (this.opusDecoder) {
        this.opusDecoder = null;
        this.opusDecoderModule = null;
        this.opusDecoderReady = null;
      }
      this.useNativeOpus = true;
      this.flacDecodingContext = null;
      this.flacDecodingContextSampleRate = 0;
      this.flacDecodingContextChannels = 0;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/state-manager.js
  function clampVolume(volume) {
    return Math.max(0, Math.min(100, Math.round(volume)));
  }
  function applyDiff(existing, diff) {
    const result = { ...existing };
    for (const key of Object.keys(diff)) {
      const value = diff[key];
      if (value === null) {
        delete result[key];
      } else if (value !== void 0) {
        const existingValue = result[key];
        if (typeof value === "object" && !Array.isArray(value) && typeof existingValue === "object" && existingValue !== null && !Array.isArray(existingValue)) {
          result[key] = applyDiff(existingValue, value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
  var StateManager = class {
    constructor(onStateChange, volumeStore) {
      this.volumeStore = volumeStore;
      this._volume = 100;
      this._muted = false;
      this._playerState = "synchronized";
      this._isPlaying = false;
      this._currentStreamFormat = null;
      this._streamStartServerTime = 0;
      this._streamStartAudioTime = 0;
      this._streamGeneration = 0;
      this._serverState = {};
      this.pendingMetadataTimer = null;
      this.heldMetadata = [];
      this._groupState = {};
      this.timeSyncInterval = null;
      this.stateUpdateInterval = null;
      this.onStateChangeCallback = onStateChange;
      const stored = volumeStore?.load();
      if (stored?.volume != null)
        this._volume = clampVolume(stored.volume);
      if (stored?.muted != null)
        this._muted = stored.muted;
    }
    // Volume & Mute
    get volume() {
      return this._volume;
    }
    set volume(value) {
      this._volume = clampVolume(value);
      this.volumeStore?.saveVolume(this._volume);
      this.notifyStateChange();
    }
    get muted() {
      return this._muted;
    }
    set muted(value) {
      this._muted = value;
      this.volumeStore?.saveMuted(value);
      this.notifyStateChange();
    }
    // Player State
    get playerState() {
      return this._playerState;
    }
    set playerState(value) {
      this._playerState = value;
      this.notifyStateChange();
    }
    // Playing State
    get isPlaying() {
      return this._isPlaying;
    }
    set isPlaying(value) {
      this._isPlaying = value;
      this.notifyStateChange();
    }
    // Stream Format
    get currentStreamFormat() {
      return this._currentStreamFormat;
    }
    set currentStreamFormat(value) {
      this._currentStreamFormat = value;
    }
    // Stream Anchoring (for timestamp-based scheduling)
    get streamStartServerTime() {
      return this._streamStartServerTime;
    }
    set streamStartServerTime(value) {
      this._streamStartServerTime = value;
    }
    get streamStartAudioTime() {
      return this._streamStartAudioTime;
    }
    set streamStartAudioTime(value) {
      this._streamStartAudioTime = value;
    }
    // Reset stream anchors (called on stream start)
    resetStreamAnchors() {
      this._streamStartServerTime = 0;
      this._streamStartAudioTime = 0;
      this._streamGeneration++;
    }
    // Get current stream generation
    get streamGeneration() {
      return this._streamGeneration;
    }
    // Interval management
    setTimeSyncInterval(interval) {
      this.clearTimeSyncInterval();
      this.timeSyncInterval = interval;
    }
    clearTimeSyncInterval() {
      if (this.timeSyncInterval !== null) {
        clearTimeout(this.timeSyncInterval);
        this.timeSyncInterval = null;
      }
    }
    setStateUpdateInterval(interval) {
      this.clearStateUpdateInterval();
      this.stateUpdateInterval = interval;
    }
    clearStateUpdateInterval() {
      if (this.stateUpdateInterval !== null) {
        clearInterval(this.stateUpdateInterval);
        this.stateUpdateInterval = null;
      }
    }
    clearAllIntervals() {
      this.clearTimeSyncInterval();
      this.clearStateUpdateInterval();
    }
    // Reset all state except volume and mute (called on disconnect)
    reset() {
      this._playerState = "synchronized";
      this._isPlaying = false;
      this._currentStreamFormat = null;
      this._streamStartServerTime = 0;
      this._streamStartAudioTime = 0;
      this.clearPendingMetadata();
      this._serverState = {};
      this._groupState = {};
      this.clearAllIntervals();
    }
    // Notify callback of state changes
    notifyStateChange() {
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback({
          isPlaying: this._isPlaying,
          volume: this._volume,
          muted: this._muted,
          playerState: this._playerState,
          serverState: this._serverState,
          groupState: this._groupState
        });
      }
    }
    // Replace each included role object, holding delayed metadata as the single pending update.
    // A null delay holds the metadata until applyHeldMetadata.
    updateServerState(update, metadataDelayMs = 0) {
      let applied = update;
      if (update.metadata !== void 0) {
        const { metadata, ...rest } = update;
        if (metadataDelayMs === null) {
          this.heldMetadata.push(metadata);
          applied = rest;
        } else {
          this.clearPendingMetadata();
          if (metadataDelayMs > 0) {
            this.schedulePendingMetadata(metadata, metadataDelayMs);
            applied = rest;
          }
        }
      }
      if (Object.keys(applied).length === 0)
        return;
      this._serverState = { ...this._serverState, ...applied };
      this.notifyStateChange();
    }
    // Apply held metadata as if each update arrived now in order, notifying once.
    applyHeldMetadata(delayMs) {
      let due;
      let pending;
      for (const metadata of this.heldMetadata) {
        const delay = delayMs(metadata.timestamp);
        if (delay > 0) {
          pending = { metadata, delayMs: delay };
        } else {
          due = metadata;
          pending = void 0;
        }
      }
      this.heldMetadata = [];
      if (pending)
        this.schedulePendingMetadata(pending.metadata, pending.delayMs);
      if (!due)
        return;
      this._serverState = { ...this._serverState, metadata: due };
      this.notifyStateChange();
    }
    schedulePendingMetadata(metadata, delayMs) {
      this.pendingMetadataTimer = setTimeout(() => {
        this.pendingMetadataTimer = null;
        this._serverState = { ...this._serverState, metadata };
        this.notifyStateChange();
      }, delayMs);
    }
    discardRoleState(families) {
      if (families.includes("metadata"))
        this.clearPendingMetadata();
      if (!families.some((family) => family in this._serverState))
        return;
      this._serverState = Object.fromEntries(Object.entries(this._serverState).filter(([key]) => !families.includes(key)));
      this.notifyStateChange();
    }
    clearConnectionState() {
      this.clearPendingMetadata();
      if (Object.keys(this._serverState).length === 0 && Object.keys(this._groupState).length === 0)
        return;
      this._serverState = {};
      this._groupState = {};
      this.notifyStateChange();
    }
    clearPendingMetadata() {
      this.heldMetadata = [];
      if (this.pendingMetadataTimer !== null) {
        clearTimeout(this.pendingMetadataTimer);
        this.pendingMetadataTimer = null;
      }
    }
    // Update group state (merges delta, null clears fields)
    updateGroupState(update) {
      this._groupState = applyDiff(this._groupState, update);
      this.notifyStateChange();
    }
    // Getters for cached state
    get serverState() {
      return this._serverState;
    }
    get groupState() {
      return this._groupState;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/time-sync-manager.js
  var TIME_SYNC_BURST_SIZE = 8;
  var TIME_SYNC_BURST_INTERVAL_MS = 9e3;
  var TIME_SYNC_REQUEST_TIMEOUT_MS = 2e3;
  var TimeSyncManager = class {
    constructor(sender, stateManager, timeFilter, onSynchronized) {
      this.sender = sender;
      this.stateManager = stateManager;
      this.timeFilter = timeFilter;
      this.onSynchronized = onSynchronized;
      this.timeSyncBurstActive = false;
      this.timeSyncBurstSentCount = 0;
      this.timeSyncInFlightClientTransmitted = null;
      this.timeSyncInFlightTimeout = null;
      this.timeSyncBurstSamples = [];
    }
    // Start an initial burst and schedule recurring bursts.
    startAndSchedule() {
      this.stop();
      this.startTimeSyncBurstIfIdle();
      this.scheduleNextTimeSyncBurstTick();
    }
    // Schedule the next burst tick.
    scheduleNextTimeSyncBurstTick() {
      const timeSyncTimeout = globalThis.setTimeout(() => {
        this.startTimeSyncBurstIfIdle();
        this.scheduleNextTimeSyncBurstTick();
      }, TIME_SYNC_BURST_INTERVAL_MS);
      this.stateManager.setTimeSyncInterval(timeSyncTimeout);
    }
    startTimeSyncBurstIfIdle() {
      if (this.timeSyncBurstActive) {
        return;
      }
      this.timeSyncBurstActive = true;
      this.timeSyncBurstSentCount = 0;
      this.timeSyncBurstSamples = [];
      this.timeSyncInFlightClientTransmitted = null;
      this.sendNextTimeSyncBurstProbe();
    }
    sendNextTimeSyncBurstProbe() {
      if (!this.timeSyncBurstActive || this.timeSyncInFlightClientTransmitted !== null) {
        return;
      }
      if (this.timeSyncBurstSentCount >= TIME_SYNC_BURST_SIZE) {
        this.finalizeTimeSyncBurst();
        return;
      }
      const clientTransmitted = this.sendTimeSync();
      this.timeSyncBurstSentCount += 1;
      this.timeSyncInFlightClientTransmitted = clientTransmitted;
      this.armTimeSyncProbeTimeout(clientTransmitted);
    }
    armTimeSyncProbeTimeout(expectedClientTransmitted) {
      this.clearTimeSyncProbeTimeout();
      this.timeSyncInFlightTimeout = globalThis.setTimeout(() => {
        this.handleTimeSyncProbeTimeout(expectedClientTransmitted);
      }, TIME_SYNC_REQUEST_TIMEOUT_MS);
    }
    clearTimeSyncProbeTimeout() {
      if (this.timeSyncInFlightTimeout !== null) {
        clearTimeout(this.timeSyncInFlightTimeout);
        this.timeSyncInFlightTimeout = null;
      }
    }
    handleTimeSyncProbeTimeout(expectedClientTransmitted) {
      if (!this.timeSyncBurstActive || this.timeSyncInFlightClientTransmitted !== expectedClientTransmitted) {
        return;
      }
      console.warn("Sendspin: Time sync probe timed out, aborting current burst");
      this.abortTimeSyncBurst();
    }
    finalizeTimeSyncBurst() {
      this.clearTimeSyncProbeTimeout();
      const wasSynchronized = this.timeFilter.is_synchronized;
      const candidate = this.selectTimeSyncBurstCandidate();
      if (candidate) {
        const maxError = Math.max(1e3, Math.trunc(candidate.rttTerm / 2));
        this.timeFilter.update(candidate.measurement, maxError, candidate.t4);
      }
      this.timeSyncBurstActive = false;
      this.timeSyncBurstSentCount = 0;
      this.timeSyncInFlightClientTransmitted = null;
      this.timeSyncBurstSamples = [];
      if (!wasSynchronized && this.timeFilter.is_synchronized) {
        this.onSynchronized();
      }
    }
    selectTimeSyncBurstCandidate() {
      if (this.timeSyncBurstSamples.length === 0) {
        return null;
      }
      return this.timeSyncBurstSamples.reduce((best, sample) => sample.rttTerm < best.rttTerm ? sample : best);
    }
    abortTimeSyncBurst() {
      this.clearTimeSyncProbeTimeout();
      this.timeSyncBurstActive = false;
      this.timeSyncBurstSentCount = 0;
      this.timeSyncInFlightClientTransmitted = null;
      this.timeSyncBurstSamples = [];
    }
    // Stop all time sync activity (interval + in-flight burst).
    stop() {
      this.stateManager.clearTimeSyncInterval();
      this.abortTimeSyncBurst();
    }
    // Handle server/time response
    handleServerTime(message, receivedAtUs) {
      if (!this.timeSyncBurstActive || this.timeSyncInFlightClientTransmitted === null) {
        return;
      }
      const T1 = message.payload.client_transmitted;
      if (T1 !== this.timeSyncInFlightClientTransmitted) {
        console.warn("Sendspin: Ignoring out-of-order time response", T1, this.timeSyncInFlightClientTransmitted);
        return;
      }
      const T4 = receivedAtUs;
      const T2 = message.payload.server_received;
      const T3 = message.payload.server_transmitted;
      const measurement = Math.trunc((T2 - T1 + (T3 - T4)) / 2);
      const rttTerm = Math.max(0, T4 - T1 - (T3 - T2));
      this.timeSyncBurstSamples.push({
        measurement,
        t4: T4,
        rttTerm
      });
      this.clearTimeSyncProbeTimeout();
      this.timeSyncInFlightClientTransmitted = null;
      if (this.timeSyncBurstSentCount >= TIME_SYNC_BURST_SIZE) {
        this.finalizeTimeSyncBurst();
        return;
      }
      this.sendNextTimeSyncBurstProbe();
    }
    // Send time synchronization message
    sendTimeSync(clientTimeUs = Math.floor(performance.now() * 1e3)) {
      const message = {
        type: "client/time",
        payload: {
          client_transmitted: clientTimeUs
        }
      };
      this.sender.sendControl(message);
      return clientTimeUs;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/codec-support.js
  var BUFFER_DEPTH_SECONDS = 30;
  var FLAC_WORST_CASE_EXPANSION = 1.02;
  var OPUS_MAX_BYTES_PER_SECOND = 64e3;
  function getBrowserSupportedCodecs() {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isFirefox = /firefox/i.test(userAgent);
    const hasNativeOpus = typeof AudioDecoder !== "undefined";
    if (!hasNativeOpus) {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        console.warn("[Opus] Running in insecure context, falling back to FLAC/PCM");
      } else {
        console.warn("[Opus] Native decoder not available, falling back to FLAC/PCM");
      }
    }
    if (isSafari) {
      return /* @__PURE__ */ new Set(["pcm", "opus"]);
    }
    if (isFirefox) {
      return /* @__PURE__ */ new Set(["pcm", "flac"]);
    }
    if (hasNativeOpus) {
      return /* @__PURE__ */ new Set(["pcm", "opus", "flac"]);
    }
    return /* @__PURE__ */ new Set(["pcm", "flac"]);
  }
  function getSupportedFormats(codecs) {
    const browserSupported = getBrowserSupportedCodecs();
    const selected = codecs.filter((codec) => browserSupported.has(codec));
    if (!selected.includes("flac") && !selected.includes("pcm")) {
      const fallback = ["flac", "pcm"].filter((codec) => browserSupported.has(codec));
      console.warn(`[Codec] No flac or pcm in usable codecs [${selected.join(", ")}] (requested [${codecs.join(", ")}]), advertising [${fallback.join(", ")}] as fallback`);
      selected.push(...fallback);
    }
    const formats = [];
    for (const codec of selected) {
      if (codec === "opus") {
        formats.push({
          codec: "opus",
          sample_rate: 48e3,
          channels: 2,
          bit_depth: 16
        });
      } else {
        formats.push({ codec, sample_rate: 48e3, channels: 2, bit_depth: 16 });
        formats.push({ codec, sample_rate: 44100, channels: 2, bit_depth: 16 });
      }
    }
    return formats;
  }
  function getWireByteRate(format) {
    const pcmByteRate = format.sample_rate * format.channels * Math.ceil(format.bit_depth / 8);
    switch (format.codec) {
      case "opus":
        return OPUS_MAX_BYTES_PER_SECOND;
      case "flac":
        return pcmByteRate * FLAC_WORST_CASE_EXPANSION;
      default:
        return pcmByteRate;
    }
  }
  function getDefaultBufferCapacity(formats) {
    const worstByteRate = Math.max(...formats.map(getWireByteRate));
    return Math.ceil(worstByteRate * BUFFER_DEPTH_SECONDS);
  }

  // node_modules/@sendspin/sendspin-js/dist/sync-delay.js
  var SYNC_DELAY_MAX_MS = 5e3;
  function clampSyncDelayMs(delayMs) {
    if (!isFinite(delayMs))
      return 0;
    return Math.max(0, Math.min(SYNC_DELAY_MAX_MS, Math.round(delayMs)));
  }

  // node_modules/@sendspin/sendspin-js/dist/core/protocol-handler.js
  var STATE_UPDATE_INTERVAL = 5e3;
  var DEFAULT_REQUIRED_LEAD_TIME_MS = 250;
  var DEFAULT_MIN_BUFFER_MS = 250;
  var PLAYER_COMMANDS = ["volume", "mute", "set_output_delay"];
  function toBufferMs(value, name) {
    if (!isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative finite number`);
    }
    return Math.round(value);
  }
  var ProtocolHandler = class {
    constructor(sender, helloContext, streamHandler, stateManager, timeFilter, config = {}) {
      this.sender = sender;
      this.helloContext = helloContext;
      this.streamHandler = streamHandler;
      this.stateManager = stateManager;
      this.timeFilter = timeFilter;
      this.activated = false;
      this.activeRoles = null;
      this.lastSentState = null;
      this.clientName = config.clientName ?? "Sendspin Player";
      this.productName = config.productName;
      this.manufacturer = config.manufacturer;
      this.softwareVersion = config.softwareVersion;
      this.codecs = config.codecs ?? ["opus", "flac", "pcm"];
      this.bufferCapacity = config.bufferCapacity === void 0 ? void 0 : Math.round(config.bufferCapacity);
      this.requiredLeadTimeMs = toBufferMs(config.requiredLeadTimeMs ?? DEFAULT_REQUIRED_LEAD_TIME_MS, "requiredLeadTimeMs");
      this.minBufferMs = toBufferMs(config.minBufferMs ?? DEFAULT_MIN_BUFFER_MS, "minBufferMs");
      this.useHardwareVolume = config.useHardwareVolume ?? false;
      this.onVolumeCommand = config.onVolumeCommand;
      this.onDelayCommand = config.onDelayCommand;
      this.getExternalVolume = config.getExternalVolume;
      this.applicationRoles = config.applicationRoles;
      this.timeSyncManager = new TimeSyncManager(sender, stateManager, timeFilter, () => {
        this.stateManager.applyHeldMetadata((timestampUs) => this.metadataDelayMs(timestampUs));
        this.sendStateUpdate();
      });
    }
    // Handle server messages
    handleServerMessage(message, receivedAtUs) {
      switch (message.type) {
        case "server/hello":
          this.handleServerHello();
          break;
        case "server/activate":
          this.handleServerActivate(message);
          break;
        case "server/time":
          this.timeSyncManager.handleServerTime(message, receivedAtUs);
          break;
        case "stream/start":
          this.handleStreamStart(message);
          break;
        case "stream/clear":
          this.handleStreamClear(message);
          break;
        case "stream/end":
          this.handleStreamEnd(message);
          break;
        case "server/command":
          this.handleServerCommand(message);
          break;
        case "server/state":
          this.handleServerState(message);
          break;
        case "group/update":
          this.stateManager.updateGroupState(message.payload);
          break;
      }
    }
    // Handle server hello: reply with client/hello. client/state and time-sync
    // are deferred to server/activate.
    handleServerHello() {
      console.log("Sendspin: Connected to server");
      this.sendClientHello();
    }
    // Handle server/activate: start the initial client/state (held for a player
    // until the clock syncs), time-sync, and periodic state updates. A repeat
    // activate only applies role changes.
    handleServerActivate(message) {
      this.applyActivation(message.payload.active_roles);
    }
    /** Resume after a server/activate the client refused, under the roles still in effect. */
    resumeActivation(activeRoles) {
      this.applyActivation(activeRoles);
    }
    applyActivation(activeRoles) {
      if (this.activeRoles === null && this.stateManager.currentStreamFormat !== null) {
        this.endPlayerStream();
      }
      let rolesChanged = false;
      if (activeRoles !== void 0) {
        const nextRoles = new Set(activeRoles);
        const removedRoles = [...this.activeRoles ?? []].filter((role) => !nextRoles.has(role));
        rolesChanged = this.activeRoles === null || removedRoles.length > 0 || nextRoles.size !== this.activeRoles.size;
        this.activeRoles = nextRoles;
        if (removedRoles.includes("player@v1") && this.stateManager.currentStreamFormat !== null) {
          this.endPlayerStream();
        }
        this.stateManager.discardRoleState(removedRoles.map((role) => role.split("@")[0]));
        if (this.applicationRoles?.applyActivation(nextRoles)) {
          this.lastSentState = null;
        }
        if (this.activeRoles !== nextRoles)
          return;
      }
      if (this.activated) {
        if (rolesChanged)
          this.sendStateUpdate();
        return;
      }
      this.activated = true;
      this.lastSentState = null;
      this.sendStateUpdate();
      this.timeSyncManager.startAndSchedule();
      const stateInterval = globalThis.setInterval(() => this.sendStateUpdate(), STATE_UPDATE_INTERVAL);
      this.stateManager.setStateUpdateInterval(stateInterval);
    }
    // Restart the periodic state update interval.
    // Called after volume commands to prevent a pending periodic update
    // from sending stale hardware volume shortly after the command response.
    restartStateUpdateInterval() {
      const newInterval = globalThis.setInterval(() => this.sendStateUpdate(), STATE_UPDATE_INTERVAL);
      this.stateManager.setStateUpdateInterval(newInterval);
    }
    stopTimeSync() {
      this.timeSyncManager.stop();
    }
    /**
     * Clear the activate guard so the next server/activate (e.g. after a reconnect on a
     * reused handler) restarts time-sync and state updates.
     * @internal called by SendspinCore on transport close, not part of the public API.
     */
    resetActivation(preserveActiveRoles = false) {
      this.activated = false;
      if (!preserveActiveRoles) {
        this.activeRoles = null;
        this.applicationRoles?.deactivateAll();
      }
      this.timeSyncManager.stop();
      this.stateManager.clearStateUpdateInterval();
    }
    // Until the clock syncs, the filter has no estimate to translate the
    // metadata timestamp with, so the update is held until then.
    handleServerState(message) {
      const { metadata } = message.payload;
      let metadataDelayMs = 0;
      if (metadata) {
        metadataDelayMs = this.timeFilter.is_synchronized ? this.metadataDelayMs(metadata.timestamp) : null;
      }
      this.stateManager.updateServerState(message.payload, metadataDelayMs);
    }
    metadataDelayMs(timestampUs) {
      const localUs = this.timeFilter.computeClientTime(timestampUs);
      return (localUs - performance.now() * 1e3) / 1e3;
    }
    handleStreamStart(message) {
      const format = message.payload.player;
      if (!format)
        return;
      const isFormatUpdate = this.stateManager.currentStreamFormat !== null;
      this.stateManager.currentStreamFormat = format;
      console.log(isFormatUpdate ? "Sendspin: Stream format updated" : "Sendspin: Stream started", format);
      console.log(`Sendspin: Codec=${format.codec.toUpperCase()}, SampleRate=${format.sample_rate}Hz, Channels=${format.channels}, BitDepth=${format.bit_depth}bit`);
      this.streamHandler.handleStreamStart(format, isFormatUpdate);
      this.stateManager.isPlaying = true;
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "playing";
      }
    }
    handleStreamClear(message) {
      const roles = message.payload.roles;
      if (!roles || roles.includes("player")) {
        console.log("Sendspin: Stream clear (seek)");
        this.streamHandler.handleStreamClear();
      }
    }
    handleStreamEnd(message) {
      const roles = message.payload?.roles;
      if (!roles || roles.includes("player")) {
        console.log("Sendspin: Stream ended");
        this.endPlayerStream();
      }
    }
    endPlayerStream() {
      this.streamHandler.handleStreamEnd();
      this.stateManager.currentStreamFormat = null;
      this.stateManager.isPlaying = false;
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "paused";
      }
    }
    // Handle server commands
    handleServerCommand(message) {
      const playerCommand = message.payload.player;
      if (!playerCommand)
        return;
      switch (playerCommand.command) {
        case "volume":
          if (playerCommand.volume !== void 0) {
            this.stateManager.volume = playerCommand.volume;
            this.streamHandler.handleVolumeUpdate();
            if (this.useHardwareVolume && this.onVolumeCommand) {
              this.onVolumeCommand(playerCommand.volume, this.stateManager.muted);
            }
          }
          break;
        case "mute":
          if (playerCommand.mute !== void 0) {
            this.stateManager.muted = playerCommand.mute;
            this.streamHandler.handleVolumeUpdate();
            if (this.useHardwareVolume && this.onVolumeCommand) {
              this.onVolumeCommand(this.stateManager.volume, playerCommand.mute);
            }
          }
          break;
        case "set_output_delay": {
          const delay = playerCommand.output_delay_ms;
          if (typeof delay === "number" && isFinite(delay)) {
            const clamped = clampSyncDelayMs(delay);
            this.streamHandler.handleSyncDelayChange(clamped);
            this.onDelayCommand?.(clamped);
          }
          break;
        }
        default:
          return;
      }
      this.restartStateUpdateInterval();
      this.sendStateUpdate(true);
    }
    // client_id and version live in client/init, not the hello.
    sendClientHello() {
      const supportedFormats = getSupportedFormats(this.codecs);
      const hello = {
        type: "client/hello",
        payload: {
          name: this.clientName,
          supported_roles: [
            "player@v1",
            "controller@v1",
            "metadata@v1",
            ...this.applicationRoles?.supportedRoles ?? []
          ],
          supported_pair_methods: this.helloContext.pairMethods(),
          unpaired_access: { enabled: this.helloContext.unpairedAccess },
          device_info: {
            product_name: this.productName,
            manufacturer: this.manufacturer,
            software_version: this.softwareVersion
          },
          "player@v1_support": {
            supported_formats: supportedFormats,
            buffer_capacity: this.bufferCapacity ?? getDefaultBufferCapacity(supportedFormats)
          },
          ...this.applicationRoles?.helloSupport
        }
      };
      this.sender.sendControl(hello);
    }
    setRequiredLeadTimeMs(leadTimeMs) {
      this.requiredLeadTimeMs = toBufferMs(leadTimeMs, "requiredLeadTimeMs");
      this.sendStateUpdate();
    }
    setMinBufferMs(minBufferMs) {
      this.minBufferMs = toBufferMs(minBufferMs, "minBufferMs");
      this.sendStateUpdate();
    }
    // Send the full state, skipped when identical to the last one sent.
    // When skipHardwareRead is true, use stateManager values instead of reading from hardware.
    // This avoids race conditions when responding to volume commands.
    sendStateUpdate(skipHardwareRead = false) {
      if (!this.activated)
        return;
      if (this.activeRoles?.has("player@v1") && !this.timeFilter.is_synchronized)
        return;
      let volume = this.stateManager.volume;
      let muted = this.stateManager.muted;
      if (!skipHardwareRead && this.useHardwareVolume && this.getExternalVolume) {
        const externalVol = this.getExternalVolume();
        if (!Number.isNaN(externalVol.volume))
          volume = clampVolume(externalVol.volume);
        muted = externalVol.muted;
      }
      const payload = {
        available: true
      };
      if (this.activeRoles?.has("player@v1")) {
        payload.player = {
          volume,
          muted,
          output_delay_ms: clampSyncDelayMs(this.streamHandler.getSyncDelayMs()),
          required_lead_time_ms: this.requiredLeadTimeMs,
          min_buffer_ms: this.minBufferMs,
          supported_commands: [...PLAYER_COMMANDS]
        };
      }
      Object.assign(payload, this.applicationRoles?.clientStateObjects());
      const serialized = JSON.stringify(payload);
      if (serialized === this.lastSentState)
        return;
      this.lastSentState = serialized;
      const message = {
        type: "client/state",
        payload
      };
      this.sender.sendControl(message);
    }
    // Send goodbye message before disconnecting
    sendGoodbye(reason) {
      this.sender.sendControl({
        type: "client/goodbye",
        payload: {
          reason
        }
      });
    }
    sendLeave() {
      if (!this.activated)
        return;
      this.sender.sendControl({
        type: "client/leave",
        payload: {}
      });
    }
    // Send controller command to server
    sendCommand(command, params) {
      if (!this.activeRoles?.has("controller@v1"))
        return;
      let fields = params;
      if (command === "volume") {
        const { volume } = params;
        fields = { volume: clampVolume(volume) };
      } else if (command === "seek") {
        const { position_ms } = params;
        const max = this.stateManager.serverState.controller?.seek_max_ms ?? Infinity;
        fields = {
          position_ms: Math.min(max, Math.max(0, Math.round(position_ms)))
        };
      } else if (command === "seek_relative") {
        const { offset_ms } = params;
        fields = { offset_ms: Math.round(offset_ms) };
      }
      this.sender.sendControl({
        type: "client/command",
        payload: {
          controller: {
            command,
            ...fields
          }
        }
      }, "controller@v1");
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/websocket-manager.js
  var WebSocketManager = class {
    constructor(config) {
      this.ws = null;
      this.reconnectTimeout = null;
      this.shouldReconnect = false;
      this.isReconnecting = false;
      this.reconnectAttempt = 0;
      this.baseDelayMs = Math.max(0, config?.baseDelayMs ?? 1e3);
      this.maxDelayMs = Math.max(this.baseDelayMs, config?.maxDelayMs ?? 15e3);
      this.maxAttempts = config?.maxAttempts === void 0 ? Infinity : Math.max(0, config.maxAttempts);
      this.onReconnecting = config?.onReconnecting;
      this.onReconnected = config?.onReconnected;
      this.onExhausted = config?.onExhausted;
    }
    /**
     * Adopt an existing WebSocket connection.
     * The caller is responsible for having already opened the socket.
     * Reconnection is disabled for adopted sockets.
     *
     * Returns a Promise that resolves once the adopted socket is open. Throws
     * synchronously if the socket is already CLOSING or CLOSED.
     */
    adopt(ws, onOpen, onMessage, onError, onClose) {
      if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
        throw new Error(`Sendspin: Cannot adopt WebSocket in readyState ${ws.readyState} (must be OPEN or CONNECTING)`);
      }
      this.onOpenHandler = onOpen;
      this.onMessageHandler = onMessage;
      this.onErrorHandler = onError;
      this.onCloseHandler = onClose;
      if (this.ws) {
        const old = this.ws;
        old.onopen = null;
        old.onmessage = null;
        old.onerror = null;
        old.onclose = null;
        old.close();
        this.ws = null;
      }
      this.ws = ws;
      this.ws.binaryType = "arraybuffer";
      this.shouldReconnect = false;
      this.clearReconnectState();
      this.ws.onmessage = (event) => {
        if (this.onMessageHandler) {
          this.onMessageHandler(event);
        }
      };
      this.ws.onerror = (error) => {
        console.error("Sendspin: WebSocket error", error);
        if (this.onErrorHandler) {
          this.onErrorHandler(error);
        }
      };
      this.ws.onclose = () => {
        console.log("Sendspin: WebSocket disconnected");
        if (this.onCloseHandler) {
          this.onCloseHandler();
        }
      };
      return new Promise((resolve, reject) => {
        const fireOpen = () => {
          if (this.onOpenHandler) {
            this.onOpenHandler();
          }
          resolve();
        };
        if (ws.readyState === WebSocket.OPEN) {
          console.log("Sendspin: Adopted open WebSocket");
          fireOpen();
          return;
        }
        const prevOnClose = this.ws.onclose;
        this.ws.onopen = () => {
          console.log("Sendspin: Adopted WebSocket connected");
          fireOpen();
        };
        this.ws.onclose = (event) => {
          if (prevOnClose) {
            prevOnClose.call(this.ws, event);
          }
          reject(new Error("Sendspin: Adopted WebSocket closed before opening"));
        };
      });
    }
    // Connect to WebSocket server
    async connect(url, onOpen, onMessage, onError, onClose) {
      this.onOpenHandler = onOpen;
      this.onMessageHandler = onMessage;
      this.onErrorHandler = onError;
      this.onCloseHandler = onClose;
      this.shouldReconnect = false;
      this.clearReconnectState();
      if (this.ws) {
        const old = this.ws;
        old.onopen = null;
        old.onmessage = null;
        old.onerror = null;
        old.onclose = null;
        old.close();
        this.ws = null;
      }
      return this.openSocket(url);
    }
    openSocket(url) {
      return new Promise((resolve, reject) => {
        try {
          console.log("Sendspin: Connecting to", url);
          const ws = new WebSocket(url);
          this.ws = ws;
          this.ws.binaryType = "arraybuffer";
          this.shouldReconnect = true;
          let opened = false;
          this.ws.onopen = () => {
            console.log("Sendspin: WebSocket connected");
            opened = true;
            const wasReconnecting = this.isReconnecting;
            this.isReconnecting = false;
            this.reconnectAttempt = 0;
            if (this.onOpenHandler) {
              this.onOpenHandler();
            }
            if (wasReconnecting) {
              this.onReconnected?.();
            }
            resolve();
          };
          this.ws.onmessage = (event) => {
            if (this.onMessageHandler) {
              this.onMessageHandler(event);
            }
          };
          this.ws.onerror = (error) => {
            console.error("Sendspin: WebSocket error", error);
            if (this.onErrorHandler) {
              this.onErrorHandler(error);
            }
            reject(error);
          };
          this.ws.onclose = () => {
            if (this.ws !== null && this.ws !== ws)
              return;
            console.log("Sendspin: WebSocket disconnected");
            if (opened && this.onCloseHandler) {
              this.onCloseHandler();
            }
            if (this.shouldReconnect) {
              this.scheduleReconnect(url);
            }
          };
        } catch (error) {
          console.error("Sendspin: Failed to connect", error);
          reject(error);
        }
      });
    }
    getReconnectDelayMs(attempt) {
      const exponential = this.baseDelayMs * 2 ** (attempt - 1);
      return Math.min(exponential, this.maxDelayMs);
    }
    // Schedule reconnection attempt
    scheduleReconnect(url) {
      if (this.reconnectTimeout !== null) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      const attempt = this.reconnectAttempt + 1;
      if (attempt > this.maxAttempts) {
        console.warn(`Sendspin: Reconnect exhausted after ${this.maxAttempts} attempt(s)`);
        this.shouldReconnect = false;
        this.isReconnecting = false;
        this.reconnectAttempt = 0;
        this.onExhausted?.();
        return;
      }
      this.reconnectAttempt = attempt;
      this.isReconnecting = true;
      const delayMs = this.getReconnectDelayMs(attempt);
      this.reconnectTimeout = globalThis.setTimeout(() => {
        this.reconnectTimeout = null;
        if (!this.shouldReconnect) {
          return;
        }
        this.onReconnecting?.(attempt);
        console.log(`Sendspin: Attempting to reconnect (attempt ${attempt}${this.maxAttempts === Infinity ? "" : `/${this.maxAttempts}`})...`);
        this.openSocket(url).catch((error) => {
          console.error("Sendspin: Reconnection failed", error);
        });
      }, delayMs);
    }
    clearReconnectState() {
      if (this.reconnectTimeout !== null) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.isReconnecting = false;
      this.reconnectAttempt = 0;
    }
    // Disconnect from WebSocket server
    disconnect() {
      this.shouldReconnect = false;
      this.clearReconnectState();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
    // Send a cleartext text frame (handshake only).
    sendText(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      } else {
        console.warn("Sendspin: Cannot send text, WebSocket not connected");
      }
    }
    // Send a binary frame (Noise transport ciphertext).
    sendBinary(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      } else {
        console.warn("Sendspin: Cannot send binary, WebSocket not connected");
      }
    }
    // Check if WebSocket is connected
    isConnected() {
      return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    // Get current ready state
    getReadyState() {
      return this.ws ? this.ws.readyState : WebSocket.CLOSED;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/time-filter.js
  var ADAPTIVE_FORGETTING_CUTOFF = 3;
  var MAX_ERROR_SCALE = 0.5;
  function roundHalfAwayFromZero(value) {
    return value < 0 ? -Math.round(-value) : Math.round(value);
  }
  var SendspinTimeFilter = class {
    constructor(offset_process_std_dev = 0, forget_factor = 2, drift_significance_threshold = 2, drift_process_std_dev = 1e-11) {
      this._last_update = 0;
      this._count = 0;
      this._measurements_processed = 0;
      this._offset = 0;
      this._drift = 0;
      this._offset_covariance = Infinity;
      this._offset_drift_covariance = 0;
      this._drift_covariance = 0;
      this._use_drift = false;
      this._offset_process_variance = offset_process_std_dev * offset_process_std_dev;
      this._drift_process_variance = drift_process_std_dev * drift_process_std_dev;
      this._forget_variance_factor = forget_factor * forget_factor;
      this._drift_significance_threshold_squared = drift_significance_threshold * drift_significance_threshold;
      this._current_time_element = this._createDefaultTimeElement();
    }
    /**
     * Create a default TimeElement with zero values.
     * Single source of truth for default initialization.
     */
    _createDefaultTimeElement() {
      return {
        last_update: 0,
        offset: 0,
        drift: 0
      };
    }
    /**
     * Process a new time synchronization measurement through the Kalman filter.
     *
     * Updates the filter's offset and drift estimates using a two-stage Kalman filter
     * algorithm: predict based on the drift model then correct using the new
     * measurement. The measurement uncertainty is derived from the network round-trip
     * delay.
     *
     * @param measurement - Computed offset from NTP-style exchange: ((T2-T1)+(T3-T4))/2 in microseconds
     * @param max_error - Half the round-trip delay: ((T4-T1)-(T3-T2))/2, representing maximum measurement uncertainty in microseconds
     * @param time_added - Client timestamp when this measurement was taken in microseconds
     */
    update(measurement, max_error, time_added) {
      if (time_added <= this._last_update || max_error <= 0) {
        return;
      }
      const dt = time_added - this._last_update;
      this._last_update = time_added;
      this._measurements_processed += 1;
      const update_std_dev = max_error * MAX_ERROR_SCALE;
      const measurement_variance = update_std_dev * update_std_dev;
      if (this._count <= 0) {
        this._count += 1;
        this._offset = measurement;
        this._offset_covariance = measurement_variance;
        this._drift = 0;
        this._current_time_element = {
          last_update: this._last_update,
          offset: this._offset,
          drift: this._drift
        };
        this._use_drift = false;
        return;
      }
      if (this._count === 1) {
        this._count += 1;
        this._drift = (measurement - this._offset) / dt;
        this._offset = measurement;
        this._drift_covariance = (this._offset_covariance + measurement_variance) / (dt * dt);
        this._offset_covariance = measurement_variance;
        this._current_time_element = {
          last_update: this._last_update,
          offset: this._offset,
          drift: this._drift
        };
        this._use_drift = false;
        return;
      }
      const offset = this._offset + this._drift * dt;
      const dt_squared = dt * dt;
      const drift_process_variance = dt * this._drift_process_variance;
      let new_drift_covariance = this._drift_covariance + drift_process_variance;
      const offset_drift_process_variance = 0;
      let new_offset_drift_covariance = this._offset_drift_covariance + this._drift_covariance * dt + offset_drift_process_variance;
      const offset_process_variance = dt * this._offset_process_variance;
      let new_offset_covariance = this._offset_covariance + 2 * this._offset_drift_covariance * dt + this._drift_covariance * dt_squared + offset_process_variance;
      const residual = measurement - offset;
      const max_residual_cutoff = max_error * ADAPTIVE_FORGETTING_CUTOFF;
      if (this._count < 100) {
        this._count += 1;
      } else if (Math.abs(residual) > max_residual_cutoff) {
        new_drift_covariance *= this._forget_variance_factor;
        new_offset_drift_covariance *= this._forget_variance_factor;
        new_offset_covariance *= this._forget_variance_factor;
      }
      const uncertainty = 1 / (new_offset_covariance + measurement_variance);
      const offset_gain = new_offset_covariance * uncertainty;
      const drift_gain = new_offset_drift_covariance * uncertainty;
      this._offset = offset + offset_gain * residual;
      this._drift += drift_gain * residual;
      this._drift_covariance = new_drift_covariance - drift_gain * new_offset_drift_covariance;
      this._offset_drift_covariance = new_offset_drift_covariance - drift_gain * new_offset_covariance;
      this._offset_covariance = new_offset_covariance - offset_gain * new_offset_covariance;
      const drift_squared = this._drift * this._drift;
      this._use_drift = drift_squared > this._drift_significance_threshold_squared * this._drift_covariance;
      this._current_time_element = {
        last_update: this._last_update,
        offset: this._offset,
        drift: this._drift
      };
    }
    /**
     * Convert a client timestamp to the equivalent server timestamp.
     *
     * Applies the current offset and drift compensation to transform from client time
     * domain to server time domain. The transformation accounts for both static offset
     * and dynamic drift accumulated since the last filter update.
     *
     * @param client_time - Client timestamp in microseconds
     * @returns Equivalent server timestamp in microseconds
     */
    computeServerTime(client_time) {
      const dt = client_time - this._current_time_element.last_update;
      const effective_drift = this._use_drift ? this._current_time_element.drift : 0;
      const offset = roundHalfAwayFromZero(this._current_time_element.offset + effective_drift * dt);
      return client_time + offset;
    }
    /**
     * Convert a server timestamp to the equivalent client timestamp.
     *
     * Inverts the time transformation to convert from server time domain to client
     * time domain. Accounts for both offset and drift effects in the inverse
     * transformation.
     *
     * @param server_time - Server timestamp in microseconds
     * @returns Equivalent client timestamp in microseconds
     */
    computeClientTime(server_time) {
      const effective_drift = this._use_drift ? this._current_time_element.drift : 0;
      return roundHalfAwayFromZero((server_time - this._current_time_element.offset + effective_drift * this._current_time_element.last_update) / (1 + effective_drift));
    }
    /**
     * Reset the filter state.
     */
    reset() {
      this._count = 0;
      this._measurements_processed = 0;
      this._last_update = 0;
      this._offset = 0;
      this._drift = 0;
      this._offset_covariance = Infinity;
      this._offset_drift_covariance = 0;
      this._drift_covariance = 0;
      this._use_drift = false;
      this._current_time_element = this._createDefaultTimeElement();
    }
    /**
     * Get the number of time sync measurements processed.
     */
    get count() {
      return this._measurements_processed;
    }
    /**
     * Check if time synchronization is ready for use.
     *
     * Time sync is considered ready when at least 1 measurement has been
     * collected and the offset covariance is finite (not infinite).
     */
    get is_synchronized() {
      return this._count >= 1 && isFinite(this._offset_covariance);
    }
    /**
     * Get the standard deviation estimate in microseconds.
     */
    get error() {
      return Math.round(Math.sqrt(this._offset_covariance));
    }
    /**
     * Get the covariance (variance) estimate for the offset.
     */
    get covariance() {
      return Math.round(this._offset_covariance);
    }
    /**
     * Get the current filtered offset estimate in microseconds.
     */
    get offset() {
      return this._offset;
    }
    /**
     * Get the current clock drift rate estimate.
     * Returns the drift as a ratio (e.g., 0.04 means server clock is 4% faster).
     */
    get drift() {
      return this._drift;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/static-delay-store.js
  var STATIC_DELAY_STORAGE_KEY = "sendspin-static-delay-ms-v2";
  var StaticDelayStore = class {
    constructor(storage) {
      this.storage = storage;
    }
    load() {
      if (!this.storage)
        return null;
      try {
        const stored = this.storage.getItem(STATIC_DELAY_STORAGE_KEY);
        if (stored === null)
          return null;
        const value = parseFloat(stored);
        if (isNaN(value))
          return null;
        return clampSyncDelayMs(value);
      } catch {
        return null;
      }
    }
    save(delayMs) {
      if (!this.storage)
        return;
      try {
        this.storage.setItem(STATIC_DELAY_STORAGE_KEY, delayMs.toString());
      } catch {
      }
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/volume-store.js
  var VOLUME_STORAGE_KEY = "sendspin-volume";
  var MUTED_STORAGE_KEY = "sendspin-muted";
  var VolumeStore = class {
    constructor(storage) {
      this.storage = storage;
    }
    load() {
      if (!this.storage)
        return { volume: null, muted: null };
      try {
        const volume = parseFloat(this.storage.getItem(VOLUME_STORAGE_KEY) ?? "");
        const muted = this.storage.getItem(MUTED_STORAGE_KEY);
        return {
          volume: isNaN(volume) ? null : volume,
          muted: muted === "true" ? true : muted === "false" ? false : null
        };
      } catch {
        return { volume: null, muted: null };
      }
    }
    saveVolume(volume) {
      this.save(VOLUME_STORAGE_KEY, volume.toString());
    }
    saveMuted(muted) {
      this.save(MUTED_STORAGE_KEY, muted.toString());
    }
    save(key, value) {
      if (!this.storage)
        return;
      try {
        this.storage.setItem(key, value);
      } catch {
      }
    }
  };

  // node_modules/@noble/curves/node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }

  // node_modules/@noble/curves/utils.js
  function aarray(item, title, inner = () => {
  }) {
    if (!Array.isArray(item))
      throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
    for (let i = 0; i < item.length; i++)
      inner(item[i], `${title}[${i}]`);
    return item;
  }
  var abytes2 = (value, length, title) => abytes(value, length, title);
  var anumber2 = anumber;
  function aobject(value, title = "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
    return value;
  }
  function afunction(value, title) {
    if (typeof value !== "function")
      throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
    return value;
  }
  var bytesToHex2 = bytesToHex;
  var hexToBytes2 = (hex) => hexToBytes(hex);
  var isBytes2 = isBytes;
  var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
  var _0n = /* @__PURE__ */ BigInt(0);
  var _1n = /* @__PURE__ */ BigInt(1);
  var atitle2 = (title) => title ? `"${title}" ` : "";
  function abool(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abignumber(n) {
    if (typeof n === "bigint") {
      if (!isPosBig(n))
        throw new RangeError("positive bigint expected, got " + n);
    } else
      anumber2(n);
    return n;
  }
  function asafenumber(value, title = "") {
    if (typeof value !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected number, got type=" + typeof value);
    }
    if (!Number.isSafeInteger(value)) {
      const prefix = title && `"${title}" `;
      throw new RangeError(prefix + "expected safe integer, got " + value);
    }
  }
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    return hex === "" ? _0n : BigInt("0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function bytesToNumberLE(bytes) {
    return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
  }
  function numberToBytesBE(n, len) {
    anumber(len);
    if (len === 0)
      throw new Error("zero output length is invalid");
    n = abignumber(n);
    const expectedLen = len * 2;
    const hex = n.toString(16);
    if (hex.length > expectedLen)
      throw new RangeError("number is too large");
    return hexToBytes(hex.padStart(expectedLen, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes2(bytes));
  }
  function isPosBig(n) {
    return typeof n === "bigint" && _0n <= n;
  }
  function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
  }
  function aInRange(title, n, min, max) {
    if (!inRange(n, min, max))
      throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
  function bitLen(n) {
    if (n < _0n)
      throw new Error("expected non-negative bigint, got " + n);
    return n === _0n ? 0 : n.toString(2).length;
  }
  var bitMask = (n) => {
    asafenumber(n, "n");
    return (_1n << BigInt(n)) - _1n;
  };
  function validateObject(object, fields = {}, optFields = {}, title = "object") {
    aobject(object, title);
    aobject(fields, "fields");
    aobject(optFields, "optFields");
    function checkField(fieldName, expectedType, isOpt) {
      const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
      const val = object[fieldName];
      if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
        throw new TypeError(`${label} is invalid: expected own property`);
      }
      if (isOpt && val === void 0)
        return;
      const current = typeof val;
      if (current !== expectedType || val === null)
        throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
  }

  // node_modules/@noble/curves/abstract/modular.js
  var _0n2 = /* @__PURE__ */ BigInt(0);
  var _1n2 = /* @__PURE__ */ BigInt(1);
  var _2n = /* @__PURE__ */ BigInt(2);
  var _3n = /* @__PURE__ */ BigInt(3);
  var _4n = /* @__PURE__ */ BigInt(4);
  var _5n = /* @__PURE__ */ BigInt(5);
  var _7n = /* @__PURE__ */ BigInt(7);
  var _8n = /* @__PURE__ */ BigInt(8);
  var _9n = /* @__PURE__ */ BigInt(9);
  var _15n = /* @__PURE__ */ BigInt(15);
  var _16n = /* @__PURE__ */ BigInt(16);
  var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
  function mod(a, b) {
    if (b <= _0n2)
      throw new Error("mod: expected positive modulus, got " + b);
    const result = a % b;
    return result >= _0n2 ? result : b + result;
  }
  function pow(num, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow: expected modulus > 1, got " + modulo);
    if (typeof power !== "bigint")
      throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
    if (power < _0n2)
      throw new Error("invalid exponent, negatives unsupported");
    if (power === _0n2)
      return _1n2;
    if (power === _1n2)
      return num;
    let d = num % modulo;
    if (d < _0n2)
      d += modulo;
    if (power < POW_WINDOWED_MIN) {
      let p2 = _1n2;
      while (power > _0n2) {
        if (power & _1n2)
          p2 = p2 * d % modulo;
        d = d * d % modulo;
        power >>= _1n2;
      }
      return p2;
    }
    const digits = [];
    while (power > _0n2) {
      digits.push(Number(power & _15n));
      power >>= _4n;
    }
    const table = new Array(16);
    table[0] = _1n2;
    table[1] = d;
    for (let i = 2; i < 16; i++)
      table[i] = table[i - 1] * d % modulo;
    let p = table[digits[digits.length - 1]];
    for (let w = digits.length - 2; w >= 0; w--) {
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      const digit = digits[w];
      if (digit !== 0)
        p = p * table[digit] % modulo;
    }
    return p;
  }
  function pow2(x, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow2: expected modulus > 1, got " + modulo);
    if (power < _0n2)
      throw new Error("pow2: expected non-negative exponent, got " + power);
    let res = x;
    while (power-- > _0n2) {
      res *= res;
      res %= modulo;
    }
    return res;
  }
  function invert(number, modulo) {
    if (number === _0n2)
      throw new Error("invert: expected non-zero number");
    if (modulo <= _1n2)
      throw new Error("invert: expected modulus > 1, got " + modulo);
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n2, u = _1n2;
    while (a !== _0n2) {
      const q = b / a;
      const r = b - a * q;
      const m = x - u * q;
      b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n2)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function assertIsSquare(Fp, root, n) {
    const F = Fp;
    if (!F.eql(F.sqr(root), n))
      throw new Error("Cannot find square root");
  }
  function aoddModulus(order, fnName) {
    if ((order & _1n2) === _0n2)
      throw new Error(fnName + ": expected odd modulus, got " + order);
  }
  function sqrt3mod4(Fp, n) {
    const F = Fp;
    const p1div4 = (F.ORDER + _1n2) / _4n;
    const root = F.pow(n, p1div4);
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt5mod8(Fp, n) {
    const F = Fp;
    const p5div8 = (F.ORDER - _5n) / _8n;
    const n2 = F.mul(n, _2n);
    const v = F.pow(n2, p5div8);
    const nv = F.mul(n, v);
    const i = F.mul(F.mul(nv, _2n), v);
    const root = F.mul(nv, F.sub(i, F.ONE));
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return ((Fp, n) => {
      const F = Fp;
      let tv1 = F.pow(n, c4);
      let tv2 = F.mul(tv1, c1);
      const tv3 = F.mul(tv1, c2);
      const tv4 = F.mul(tv1, c3);
      const e1 = F.eql(F.sqr(tv2), n);
      const e2 = F.eql(F.sqr(tv3), n);
      tv1 = F.cmov(tv1, tv2, e1);
      tv2 = F.cmov(tv4, tv3, e2);
      const e3 = F.eql(F.sqr(tv2), n);
      const root = F.cmov(tv1, tv2, e3);
      assertIsSquare(F, root, n);
      return root;
    });
  }
  function tonelliShanks(P) {
    if (P < _3n)
      throw new Error("sqrt is not defined for small field");
    aoddModulus(P, "tonelliShanks");
    let Q2 = P - _1n2;
    let S = 0;
    while (Q2 % _2n === _0n2) {
      Q2 /= _2n;
      S++;
    }
    let Z2 = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z2) === 1) {
      if (Z2++ > 1e3)
        throw new Error("Cannot find square root: probably non-prime P");
    }
    if (S === 1)
      return sqrt3mod4;
    let cc = _Fp.pow(Z2, Q2);
    const Q1div2 = (Q2 + _1n2) / _2n;
    return function tonelliSlow(Fp, n) {
      const F = Fp;
      if (F.is0(n))
        return n;
      if (FpLegendre(F, n) !== 1)
        throw new Error("Cannot find square root");
      let M = S;
      let c = F.mul(F.ONE, cc);
      let t = F.pow(n, Q2);
      let R = F.pow(n, Q1div2);
      while (!F.eql(t, F.ONE)) {
        if (F.is0(t))
          throw new Error("Cannot find square root: probably non-prime P");
        let i = 1;
        let t_tmp = F.sqr(t);
        while (!F.eql(t_tmp, F.ONE)) {
          i++;
          t_tmp = F.sqr(t_tmp);
          if (i === M)
            throw new Error("Cannot find square root");
        }
        const exponent = _1n2 << BigInt(M - i - 1);
        const b = F.pow(c, exponent);
        M = i;
        c = F.sqr(b);
        t = F.mul(t, c);
        R = F.mul(R, b);
      }
      return R;
    };
  }
  function FpSqrt(P) {
    aoddModulus(P, "Fp.sqrt");
    if (P % _4n === _3n)
      return sqrt3mod4;
    if (P % _8n === _5n)
      return sqrt5mod8;
    if (P % _16n === _9n)
      return sqrt9mod16(P);
    return tonelliShanks(P);
  }
  var isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n2) === _1n2;
  var FIELD_FIELDS = [
    "create",
    "isValid",
    "is0",
    "neg",
    "inv",
    "sqrt",
    "sqr",
    "eql",
    "add",
    "sub",
    "mul",
    "pow",
    "div",
    "addN",
    "subN",
    "mulN",
    "sqrN"
  ];
  function validateField(field) {
    aobject(field, "field");
    if (typeof field.ORDER !== "bigint")
      throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
    asafenumber(field.BYTES, "BYTES");
    asafenumber(field.BITS, "BITS");
    for (const name of FIELD_FIELDS)
      afunction(field[name], "field." + name);
    if (field.BYTES < 1 || field.BITS < 1)
      throw new Error("invalid field: expected BYTES/BITS > 0");
    if (field.ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
    return field;
  }
  function FpInvertBatch(Fp, nums, passZero = false) {
    validateField(Fp);
    aarray(nums, "nums");
    abool(passZero, "passZero");
    const F = Fp;
    const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
    const multipliedAcc = nums.reduce((acc, num, i) => {
      if (F.is0(num))
        return acc;
      inverted[i] = acc;
      return F.mul(acc, num);
    }, F.ONE);
    const invertedAcc = F.inv(multipliedAcc);
    nums.reduceRight((acc, num, i) => {
      if (F.is0(num))
        return acc;
      inverted[i] = F.mul(acc, inverted[i]);
      return F.mul(acc, num);
    }, invertedAcc);
    return inverted;
  }
  function FpLegendre(Fp, n) {
    validateField(Fp);
    const F = Fp;
    aoddModulus(F.ORDER, "FpLegendre");
    const p1mod2 = (F.ORDER - _1n2) / _2n;
    const powered = F.pow(n, p1mod2);
    const yes = F.eql(powered, F.ONE);
    const zero = F.eql(powered, F.ZERO);
    const no = F.eql(powered, F.neg(F.ONE));
    if (!yes && !zero && !no)
      throw new Error("invalid Legendre symbol result");
    return yes ? 1 : zero ? 0 : -1;
  }
  function nLength(n, nBitLength) {
    if (nBitLength !== void 0)
      anumber2(nBitLength);
    if (n <= _0n2)
      throw new Error("invalid n length: expected positive n, got " + n);
    if (nBitLength !== void 0 && nBitLength < 1)
      throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
    const bits = bitLen(n);
    if (nBitLength !== void 0 && nBitLength < bits)
      throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
    const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
  var _Field = class {
    ORDER;
    BITS;
    BYTES;
    isLE;
    ZERO = _0n2;
    ONE = _1n2;
    _lengths;
    _mod;
    constructor(ORDER, opts = {}) {
      if (ORDER <= _1n2)
        throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
      let _nbitLength = void 0;
      this.isLE = false;
      if (opts != null && typeof opts === "object") {
        if (typeof opts.BITS === "number")
          _nbitLength = opts.BITS;
        if (typeof opts.sqrt === "function")
          Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
        if (typeof opts.isLE === "boolean")
          this.isLE = opts.isLE;
        if (opts.allowedLengths)
          this._lengths = Object.freeze(opts.allowedLengths.slice());
        if (typeof opts.modFromBytes === "boolean")
          this._mod = opts.modFromBytes;
      }
      const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
      if (nByteLength > 2048)
        throw new Error("invalid field: expected ORDER of <= 2048 bytes");
      this.ORDER = ORDER;
      this.BITS = nBitLength;
      this.BYTES = nByteLength;
      Object.freeze(this);
    }
    create(num) {
      return mod(num, this.ORDER);
    }
    isValid(num) {
      if (typeof num !== "bigint")
        throw new TypeError("invalid field element: expected bigint, got " + typeof num);
      return _0n2 <= num && num < this.ORDER;
    }
    is0(num) {
      return num === _0n2;
    }
    // is valid and invertible
    isValidNot0(num) {
      return !this.is0(num) && this.isValid(num);
    }
    isOdd(num) {
      return (num & _1n2) === _1n2;
    }
    neg(num) {
      return mod(-num, this.ORDER);
    }
    eql(lhs, rhs) {
      return lhs === rhs;
    }
    sqr(num) {
      return mod(num * num, this.ORDER);
    }
    add(lhs, rhs) {
      return mod(lhs + rhs, this.ORDER);
    }
    sub(lhs, rhs) {
      return mod(lhs - rhs, this.ORDER);
    }
    mul(lhs, rhs) {
      return mod(lhs * rhs, this.ORDER);
    }
    pow(num, power) {
      return pow(num, power, this.ORDER);
    }
    div(lhs, rhs) {
      return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
    }
    // Same as above, but doesn't normalize
    sqrN(num) {
      return num * num;
    }
    addN(lhs, rhs) {
      return lhs + rhs;
    }
    subN(lhs, rhs) {
      return lhs - rhs;
    }
    mulN(lhs, rhs) {
      return lhs * rhs;
    }
    inv(num) {
      return invert(num, this.ORDER);
    }
    sqrt(num) {
      let sqrt = FIELD_SQRT.get(this);
      if (!sqrt)
        FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
      return sqrt(this, num);
    }
    toBytes(num) {
      return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
    }
    fromBytes(bytes, skipValidation = false) {
      abytes2(bytes);
      const { _lengths: allowedLengths, BYTES, isLE: isLE2, ORDER, _mod: modFromBytes } = this;
      if (allowedLengths) {
        if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!this.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    }
    // TODO: we don't need it here, move out to separate fn
    invertBatch(lst) {
      return FpInvertBatch(this, lst, true);
    }
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov(a, b, condition) {
      abool(condition, "condition");
      return condition ? b : a;
    }
  };
  function Field(ORDER, opts = {}) {
    Object.freeze(_Field.prototype);
    return new _Field(ORDER, opts);
  }

  // node_modules/@noble/curves/abstract/curve.js
  var _0n3 = /* @__PURE__ */ BigInt(0);
  var _1n3 = /* @__PURE__ */ BigInt(1);
  var _4n2 = /* @__PURE__ */ BigInt(4);
  var BLIND_BYTES = 16;
  var BLIND_BITS = 128;
  var FW_WINDOW = 5;
  var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
  function validatePointCons(Point) {
    const pc = Point;
    if (typeof pc !== "function")
      throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
    afunction(pc.fromAffine, "Point.fromAffine");
    afunction(pc.fromBytes, "Point.fromBytes");
    afunction(pc.fromHex, "Point.fromHex");
    aobject(pc.BASE, "Point.BASE");
    aobject(pc.ZERO, "Point.ZERO");
    validateField(pc.Fp);
    validateField(pc.Fn);
  }
  function normalizeZ(c, points) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
  }
  function validateW(W, bits, min = 1) {
    if (!Number.isSafeInteger(W) || W < min || W > bits)
      throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
  }
  function validateTableBytes(numPoints, fpBytes) {
    const bytes = numPoints * (4 * fpBytes + 128);
    if (bytes > TABLE_BYTES_MAX)
      throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
  }
  function probeRandomBytes(randomBytes4, length) {
    if (randomBytes4 === void 0)
      return void 0;
    afunction(randomBytes4, "randomBytes");
    try {
      const probe = randomBytes4(length);
      if (!isBytes2(probe) || probe.length !== length)
        return void 0;
    } catch {
      return void 0;
    }
    return randomBytes4;
  }
  function validateMSMPoints(points, c) {
    aarray(points, "points");
    points.forEach((p, i) => {
      if (!(p instanceof c))
        throw new Error("invalid point at index " + i);
    });
  }
  function validateMSMScalars(scalars, field, maxScalar) {
    if (!Array.isArray(scalars))
      throw new Error("array of scalars expected");
    scalars.forEach((s, i) => {
      const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
      if (!ok)
        throw new Error("invalid scalar at index " + i);
    });
  }
  var pointWindowSizes = /* @__PURE__ */ new WeakMap();
  function getWindowSize(P) {
    return pointWindowSizes.get(P) || 1;
  }
  function oddMultiples(p, size) {
    const dbl = p.double();
    const t = [p];
    for (let j = 1; j < size; j++)
      t.push(t[j - 1].add(dbl));
    return t;
  }
  function wnafDigits(n, W) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const d = [];
    while (n > _0n3) {
      let w = 0;
      if (n & _1n3) {
        w = Number(n & mask);
        if (w >= half)
          w -= size;
        n -= BigInt(w);
      }
      d.push(w);
      n >>= _1n3;
    }
    return d;
  }
  function signedWindowDigits(n, W, windows) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const shiftBy = BigInt(W);
    const d = [];
    for (let w = 0; w < windows; w++) {
      let v = Number(n & mask);
      n >>= shiftBy;
      if (v > half) {
        v -= size;
        n += _1n3;
      }
      d.push(v);
    }
    if (n !== _0n3)
      throw new Error("invalid wnaf");
    return d;
  }
  function wnafWalk(zero, tables, digits) {
    let max = 0;
    for (const d of digits)
      max = Math.max(max, d.length);
    let acc = zero;
    for (let bit = max - 1; bit >= 0; bit--) {
      if (bit !== max - 1)
        acc = acc.double();
      for (let i = 0; i < digits.length; i++) {
        const w = digits[i][bit];
        if (w) {
          const item = tables[i][Math.abs(w) - 1 >> 1];
          acc = acc.add(w < 0 ? item.negate() : item);
        }
      }
    }
    return acc;
  }
  var ScalarMultiplier = class {
    Point;
    BASE;
    ZERO;
    randomBytes;
    wnafPrecomputes = /* @__PURE__ */ new WeakMap();
    baseCanBeBlinded;
    bits;
    // Parametrized with a given Point class (not individual point)
    constructor(Point, randomBytes4) {
      validatePointCons(Point);
      this.randomBytes = probeRandomBytes(randomBytes4, BLIND_BYTES);
      this.Point = Point;
      this.BASE = Point.BASE;
      this.ZERO = Point.ZERO;
      this.bits = Point.Fn.BITS;
    }
    /**
     * Creates a signed fixed-window wNAF precomputation table: for every window w, the
     * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
     * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
     * window absorbs the final carry of signed-digit recoding.
     * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
     * @param point - Point instance
     * @param W - window size
     * @param bits - scalar bitlength the table must cover
     */
    buildWnafTable(point, W, bits) {
      const windows = Math.ceil(bits / W) + 1;
      const half = 2 ** (W - 1);
      const comp = [];
      let base = point;
      for (let w = 0; w < windows; w++) {
        let acc = base;
        for (let i = 0; i < half; i++) {
          comp.push(acc);
          acc = acc.add(base);
        }
        base = comp[comp.length - 1].double();
      }
      return { W, bits, windows, comp };
    }
    /**
     * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
     * Constant-time: fixed window count with one table addition per window — zero digits feed
     * the fake accumulator — and no doublings; the lookup scans the whole window slice.
     * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
     * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
     * signedWindowDigits throws if `n` exceeds the table.
     * @returns real and fake (for const-time) points
     */
    wnafCachedCT(precomputes, n) {
      const { W, windows, comp } = precomputes;
      const half = 2 ** (W - 1);
      const digits = signedWindowDigits(n, W, windows);
      let p = this.ZERO;
      let f = this.BASE;
      for (let w = 0; w < windows; w++) {
        const digit = digits[w];
        const start = w * half;
        const idx = Math.abs(digit) - 1;
        let sel = comp[start];
        for (let i = 1; i < half; i++)
          sel = i === idx ? comp[start + i] : sel;
        const neg = sel.negate();
        if (digit === 0)
          f = f.add(comp[start]);
        else
          p = p.add(digit < 0 ? neg : sel);
      }
      return { p, f };
    }
    // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
    // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
    // incompatible `transform(...)` layouts and expect a separate cache entry.
    getWnafPrecomputes(W, point, bits, transform) {
      let entries = this.wnafPrecomputes.get(point);
      let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
      if (!comp) {
        comp = this.buildWnafTable(point, W, bits);
        if (typeof transform === "function")
          comp = { ...comp, comp: transform(comp.comp) };
        if (!entries) {
          entries = [];
          this.wnafPrecomputes.set(point, entries);
        }
        entries.push(comp);
      }
      return comp;
    }
    assertPoint(point) {
      if (!(point instanceof this.Point))
        throw new TypeError('"point" expected Point instance, got type=' + typeof point);
    }
    // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
    // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
    // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
    validateMulInput(point, scalar) {
      this.assertPoint(point);
      if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
        throw new Error("invalid scalar");
    }
    // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
    // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
    // multiply. `n` must be < 2^bits.
    runCT(point, n, bits, transform) {
      const W = getWindowSize(point);
      if (W === 1)
        return this.fixedWindowCT(point, n, bits);
      return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
    }
    mulCT(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      return this.runCT(point, scalar, this.bits, transform);
    }
    mulCTBlinded(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      if (this.randomBytes === void 0)
        throw new Error("randomBytes is required for scalar blinding");
      const bits = this.Point.Fn.BITS + BLIND_BITS;
      const blind = this.randomBytes(BLIND_BYTES);
      if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
        throw new Error("randomBytes returned invalid byte array");
      blind[0] = blind[0] & 63 | 128;
      const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
      return this.runCT(point, n, bits, transform);
    }
    /**
     * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
     * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
     * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
     * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
     * every table entry, and one addition (adds the identity when the window digit is 0 — never
     * skipped).
     *
     * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
     * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
     * projective form (no normalizeZ): normalizing this small a table costs more than the
     * mixed-add savings it would buy for a single multiply.
     * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
     * (this path needs no fake accumulator — its op-count is already scalar-independent).
     */
    fixedWindowCT(point, n, bits) {
      const W = FW_WINDOW;
      const size = 1 << W;
      const mask = bitMask(W);
      const table = new Array(size);
      table[0] = this.ZERO;
      for (let i = 1; i < size; i++)
        table[i] = table[i - 1].add(point);
      const windows = Math.ceil(bits / W);
      let acc = this.ZERO;
      for (let window2 = windows - 1; window2 >= 0; window2--) {
        if (window2 !== windows - 1)
          for (let d = 0; d < W; d++)
            acc = acc.double();
        const digit = Number(n >> BigInt(window2 * W) & mask);
        let sel = table[0];
        for (let i = 1; i < size; i++)
          sel = i === digit ? table[i] : sel;
        acc = acc.add(sel);
      }
      return { p: acc, f: acc };
    }
    shouldBlind(point, cofactor) {
      if (this.randomBytes === void 0)
        return false;
      if (cofactor === _1n3)
        return true;
      if (point !== this.BASE)
        return false;
      if (this.baseCanBeBlinded === void 0)
        this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
      return this.baseCanBeBlinded;
    }
    mulSecret(point, scalar, cofactor, transform) {
      return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
    }
    mulUnsafe(point, scalar, transform) {
      this.assertPoint(point);
      if (!isPosBig(scalar))
        throw new Error("invalid scalar");
      const W = getWindowSize(point);
      if (W === 1 || scalar >= this.Point.Fn.ORDER)
        return mulAddUnsafe(this.Point, [point], [scalar], true);
      const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
      return this.wnafCachedCT(precomputes, scalar).p;
    }
    // Remembers the window size used for precomputed wNAF multiplication of the given point
    // and drops any previously built tables. Usually only the base point is precomputed.
    // W=1 resets the point to the un-precomputed (table-less) paths.
    // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
    setWindowSize(point, W) {
      this.assertPoint(point);
      validateW(W, this.bits);
      const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
      validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
      pointWindowSizes.set(point, W);
      this.wnafPrecomputes.delete(point);
    }
    // True when a window size is set: tables themselves are built lazily on first multiply.
    hasWindowSize(point) {
      return getWindowSize(point) !== 1;
    }
  };
  function mulAddUnsafe(c, points, scalars, allowOversized = false) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    abool(allowOversized, "allowOversized");
    validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
    if (points.length !== scalars.length)
      throw new Error("arrays of points and scalars must have equal length");
    const tables = points.map((p) => oddMultiples(p, 4));
    const digits = scalars.map((n) => wnafDigits(n, 4));
    return wnafWalk(c.ZERO, tables, digits);
  }
  function createField(order, field, isLE2) {
    if (field) {
      if (field.ORDER !== order)
        throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      validateField(field);
      return field;
    } else {
      return Field(order, { isLE: isLE2 });
    }
  }
  function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
    if (type !== "weierstrass" && type !== "edwards")
      throw new Error('expected curve type "weierstrass" or "edwards"');
    if (FpFnLE === void 0)
      FpFnLE = type === "edwards";
    if (!CURVE || typeof CURVE !== "object")
      throw new Error(`expected valid ${type} CURVE object`);
    validateObject(curveOpts);
    for (const p of ["p", "n", "h"]) {
      const val = CURVE[p];
      if (!(isPosBig(val) && val !== _0n3))
        throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type === "weierstrass" ? "b" : "d";
    const params = ["Gx", "Gy", "a", _b];
    for (const p of params) {
      if (!Fp.isValid(CURVE[p]))
        throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp, Fn };
  }
  function createKeygen(randomSecretKey, getPublicKey) {
    return function keygen(seed) {
      const secretKey = randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey(secretKey) };
    };
  }

  // node_modules/@noble/curves/abstract/edwards.js
  var _0n4 = /* @__PURE__ */ BigInt(0);
  var _1n4 = /* @__PURE__ */ BigInt(1);
  var _2n2 = /* @__PURE__ */ BigInt(2);
  var _4n3 = /* @__PURE__ */ BigInt(4);
  var _8n2 = /* @__PURE__ */ BigInt(8);
  function isEdValidXY(Fp, CURVE, x, y) {
    const x2 = Fp.sqr(x);
    const y2 = Fp.sqr(y);
    const left = Fp.add(Fp.mul(CURVE.a, x2), y2);
    const right = Fp.add(Fp.ONE, Fp.mul(CURVE.d, Fp.mul(x2, y2)));
    return Fp.eql(left, right);
  }
  function edwards(params, extraOpts = {}) {
    validateObject(extraOpts, {}, {}, "extraOpts");
    const opts = extraOpts;
    const validated = createCurveFields("edwards", params, opts, opts.FpFnLE);
    const { Fp, Fn } = validated;
    let CURVE = validated.CURVE;
    const { h: cofactor } = CURVE;
    if (FpLegendre(Fp, CURVE.a) !== 1)
      throw new Error("edwards: CURVE.a must be a square in Fp for complete addition formulas");
    if (FpLegendre(Fp, CURVE.d) !== -1)
      throw new Error("edwards: CURVE.d must be a non-square in Fp for complete addition formulas");
    validateObject(opts, {}, { uvRatio: "function", randomBytes: "function" });
    const randomBytes4 = opts.randomBytes === void 0 ? randomBytes2 : opts.randomBytes;
    const MASK = _2n2 << BigInt(Fp.BYTES * 8) - _1n4;
    function isOdd(n) {
      if (!Fp.isOdd)
        throw new Error("Field does not have .isOdd()");
      return Fp.isOdd(n);
    }
    const uvRatio2 = opts.uvRatio === void 0 ? (u, v) => {
      try {
        return { isValid: true, value: Fp.sqrt(Fp.div(u, v)) };
      } catch (e) {
        return { isValid: false, value: _0n4 };
      }
    } : opts.uvRatio;
    if (!isEdValidXY(Fp, CURVE, CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    const mulA = Fp.eql(CURVE.a, Fp.neg(Fp.ONE)) ? (x) => Fp.neg(x) : Fp.eql(CURVE.a, Fp.ONE) ? (x) => x : (x) => Fp.mul(CURVE.a, x);
    function acoord(title, n, banZero = false) {
      const min = banZero ? _1n4 : _0n4;
      aInRange("coordinate " + title, n, min, MASK);
      return n;
    }
    function aedpoint(other) {
      if (!(other instanceof Point))
        throw new Error("EdwardsPoint expected");
    }
    class Point {
      static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE, Fp.mul(CURVE.Gx, CURVE.Gy));
      static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ONE, Fp.ZERO);
      static Fp = Fp;
      static Fn = Fn;
      X;
      Y;
      Z;
      T;
      constructor(X, Y, Z2, T) {
        this.X = acoord("x", X);
        this.Y = acoord("y", Y);
        this.Z = acoord("z", Z2, true);
        this.T = acoord("t", T);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      /**
       * Create one extended Edwards point from affine coordinates.
       * Does NOT validate that the point is on-curve or torsion-free.
       * Use `.assertValidity()` on adversarial inputs.
       */
      static fromAffine(p) {
        if (p instanceof Point)
          throw new Error("extended point not allowed");
        const { x, y } = p || {};
        acoord("x", x);
        acoord("y", y);
        return new Point(x, y, Fp.ONE, Fp.mul(x, y));
      }
      // Uses algo from RFC8032 5.1.3.
      static fromBytes(bytes, zip215 = false) {
        const len = Fp.BYTES;
        const { a, d } = CURVE;
        bytes = copyBytes(abytes2(bytes, len, "point"));
        abool(zip215, "zip215");
        const normed = copyBytes(bytes);
        const lastByte = bytes[len - 1];
        normed[len - 1] = lastByte & ~128;
        const y = bytesToNumberLE(normed);
        const max = zip215 ? MASK : Fp.ORDER;
        aInRange("point.y", y, _0n4, max);
        const y2 = Fp.sqr(y);
        const u = Fp.sub(y2, Fp.ONE);
        const v = Fp.sub(Fp.mulN(d, y2), a);
        let { isValid, value: x } = uvRatio2(u, v);
        if (!isValid)
          throw new Error("bad point: invalid y coordinate");
        const isXOdd = isOdd(x);
        const isLastByteOdd = (lastByte & 128) !== 0;
        if (!zip215 && Fp.is0(x) && isLastByteOdd)
          throw new Error("bad point: x=0 and x_0=1");
        if (isLastByteOdd !== isXOdd)
          x = Fp.neg(x);
        return Point.fromAffine({ x, y });
      }
      static fromHex(hex, zip215 = false) {
        return Point.fromBytes(hexToBytes2(hex), zip215);
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      precompute(windowSize = 6, isLazy = true) {
        wnaf.setWindowSize(this, windowSize);
        if (!isLazy)
          this.multiply(_2n2);
        return this;
      }
      // Useful in fromAffine() - not for fromBytes(), which always created valid points.
      assertValidity() {
        const p = this;
        const { a, d } = CURVE;
        if (p.is0())
          throw new Error("bad point: ZERO");
        const { X, Y, Z: Z2, T } = p;
        const X2 = Fp.sqr(X);
        const Y2 = Fp.sqr(Y);
        const Z22 = Fp.sqr(Z2);
        const Z4 = Fp.sqr(Z22);
        const aX2 = Fp.mul(X2, a);
        const left = Fp.mul(Fp.add(aX2, Y2), Z22);
        const right = Fp.add(Z4, Fp.mul(d, Fp.mul(X2, Y2)));
        if (!Fp.eql(left, right))
          throw new Error("bad point: equation left != right (1)");
        const XY = Fp.mul(X, Y);
        const ZT = Fp.mul(Z2, T);
        if (!Fp.eql(XY, ZT))
          throw new Error("bad point: equation left != right (2)");
      }
      // Compare one point to another.
      equals(other) {
        aedpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const X1Z2 = Fp.mul(X1, Z2);
        const X2Z1 = Fp.mul(X2, Z1);
        const Y1Z2 = Fp.mul(Y1, Z2);
        const Y2Z1 = Fp.mul(Y2, Z1);
        return Fp.eql(X1Z2, X2Z1) && Fp.eql(Y1Z2, Y2Z1);
      }
      is0() {
        return this.equals(Point.ZERO);
      }
      negate() {
        return new Point(Fp.neg(this.X), this.Y, this.Z, Fp.neg(this.T));
      }
      // Fast algo for doubling Extended Point.
      // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
      // Cost: 4M + 4S + 1*a + 6add + 1*2.
      double() {
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const A2 = Fp.sqr(X1);
        const B = Fp.sqr(Y1);
        const C = Fp.mul(Fp.sqr(Z1), _2n2);
        const D = mulA(A2);
        const x1y1 = Fp.addN(X1, Y1);
        const E = Fp.sub(Fp.subN(Fp.sqr(x1y1), A2), B);
        const G = Fp.addN(D, B);
        const F = Fp.subN(G, C);
        const H = Fp.subN(D, B);
        const X3 = Fp.mul(E, F);
        const Y3 = Fp.mul(G, H);
        const T3 = Fp.mul(E, H);
        const Z3 = Fp.mul(F, G);
        return new Point(X3, Y3, Z3, T3);
      }
      // Fast algo for adding 2 Extended Points.
      // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
      // Cost: 9M + 1*a + 1*d + 7add.
      add(other) {
        aedpoint(other);
        const { d } = CURVE;
        const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
        const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
        const A2 = Fp.mul(X1, X2);
        const B = Fp.mul(Y1, Y2);
        const C = Fp.mul(Fp.mulN(T1, d), T2);
        const D = Fp.mul(Z1, Z2);
        const E = Fp.sub(Fp.subN(Fp.mulN(Fp.addN(X1, Y1), Fp.addN(X2, Y2)), A2), B);
        const F = Fp.subN(D, C);
        const G = Fp.addN(D, C);
        const H = Fp.sub(B, mulA(A2));
        const X3 = Fp.mul(E, F);
        const Y3 = Fp.mul(G, H);
        const T3 = Fp.mul(E, H);
        const Z3 = Fp.mul(F, G);
        return new Point(X3, Y3, Z3, T3);
      }
      subtract(other) {
        aedpoint(other);
        return this.add(other.negate());
      }
      // Constant-time multiplication.
      multiply(scalar) {
        if (!Fn.isValidNot0(scalar))
          throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");
        const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
        return normalize([p, f])[0];
      }
      // Non-constant-time multiplication. Uses double-and-add algorithm.
      // It's faster, but should only be used when you don't care about
      // an exposed private key e.g. sig verification.
      // Keeps the same subgroup-scalar contract: 0 is allowed for public-scalar callers, but
      // n and larger values are rejected instead of being reduced mod n to the identity point.
      multiplyUnsafe(scalar) {
        if (!Fn.isValid(scalar))
          throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");
        if (scalar === _0n4)
          return Point.ZERO;
        if (this.is0() || scalar === _1n4)
          return this;
        return wnaf.mulUnsafe(this, scalar, normalize);
      }
      // Checks if point is of small order.
      // If you add something to small order point, you will have "dirty"
      // point with torsion component.
      // Clears cofactor and checks if the result is 0.
      isSmallOrder() {
        return this.clearCofactor().is0();
      }
      // Multiplies point by curve order and checks if the result is 0.
      // Returns `false` is the point is dirty.
      isTorsionFree() {
        return wnaf.mulUnsafe(this, CURVE.n).is0();
      }
      // Converts Extended point to default (x, y) coordinates.
      // Can accept precomputed Z^-1 - for example, from invertBatch.
      toAffine(invertedZ) {
        const p = this;
        let iz = invertedZ;
        if (iz != null && typeof iz !== "bigint")
          throw new TypeError('"invertedZ" expected bigint, got type=' + typeof iz);
        const { X, Y, Z: Z2 } = p;
        const is0 = p.is0();
        if (iz == null)
          iz = is0 ? Fp.create(_8n2) : Fp.inv(Z2);
        const x = Fp.mul(X, iz);
        const y = Fp.mul(Y, iz);
        const zz = Fp.mul(Z2, iz);
        if (is0)
          return { x: Fp.ZERO, y: Fp.ONE };
        if (!Fp.eql(zz, Fp.ONE))
          throw new Error("invZ was invalid");
        return { x, y };
      }
      clearCofactor() {
        if (cofactor === _1n4)
          return this;
        if (cofactor === _2n2)
          return this.double();
        if (cofactor === _4n3)
          return this.double().double();
        if (cofactor === _8n2)
          return this.double().double().double();
        return this.multiplyUnsafe(cofactor);
      }
      toBytes() {
        const { x, y } = this.toAffine();
        const bytes = Fp.toBytes(y);
        bytes[bytes.length - 1] |= isOdd(x) ? 128 : 0;
        return bytes;
      }
      toHex() {
        return bytesToHex2(this.toBytes());
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
    }
    const normalize = (points) => normalizeZ(Point, points);
    const wnaf = new ScalarMultiplier(Point, randomBytes4);
    if (wnaf.bits >= 6)
      Point.BASE.precompute(6);
    Object.freeze(Point.prototype);
    Object.freeze(Point);
    return Point;
  }

  // node_modules/@noble/curves/abstract/montgomery.js
  var _0n5 = /* @__PURE__ */ BigInt(0);
  var _1n5 = /* @__PURE__ */ BigInt(1);
  var _2n3 = /* @__PURE__ */ BigInt(2);
  function cmask(P, swap) {
    return P + swap - (swap >> _1n5 << _1n5);
  }
  function cswap(P) {
    const offset = BigInt(6) * P;
    return (mask, x_2, x_3) => {
      const sum = x_2 + x_3;
      const d = offset + x_3 - x_2;
      const a = (d * mask + x_2) % P;
      return { x_2: a, x_3: sum - a };
    };
  }
  function validateOpts(curve) {
    validateObject(curve, {
      P: "bigint",
      type: "string",
      adjustScalarBytes: "function",
      powPminus2: "function"
    }, {
      randomBytes: "function",
      scalarMultBase: "function"
    });
    return Object.freeze({ ...curve });
  }
  function montgomery(curveDef) {
    const CURVE = validateOpts(curveDef);
    const { P, type, adjustScalarBytes: adjustScalarBytes2, powPminus2, randomBytes: rand } = CURVE;
    const mulBaseHook = CURVE.scalarMultBase;
    const is25519 = type === "x25519";
    if (!is25519 && type !== "x448")
      throw new Error("invalid type");
    const randomBytes_ = rand === void 0 ? randomBytes2 : rand;
    const montgomeryBits = is25519 ? 255 : 448;
    const swap = cswap(P);
    const fieldLen = is25519 ? 32 : 56;
    const Gu = is25519 ? BigInt(9) : BigInt(5);
    const a24 = is25519 ? BigInt(121665) : BigInt(39081);
    const minScalar = is25519 ? _2n3 ** BigInt(254) : _2n3 ** BigInt(447);
    const maxAdded = is25519 ? BigInt(8) * (_2n3 ** BigInt(251) - _1n5) : BigInt(4) * (_2n3 ** BigInt(445) - _1n5);
    const maxScalar = minScalar + maxAdded + _1n5;
    const modP = (n) => mod(n, P);
    const GuBytes = encodeU2(Gu);
    function encodeU2(u) {
      return numberToBytesLE(modP(u), fieldLen);
    }
    function decodeU2(u) {
      const _u = copyBytes(abytes2(u, fieldLen, "uCoordinate"));
      if (is25519)
        _u[31] &= 127;
      return modP(bytesToNumberLE(_u));
    }
    function decodeScalar(scalar) {
      return bytesToNumberLE(adjustScalarBytes2(copyBytes(abytes2(scalar, fieldLen, "scalar"))));
    }
    const lowOrderU = new Set(is25519 ? [
      _0n5,
      _1n5,
      P - _1n5,
      BigInt("325606250916557431795983626356110631294008115727848805560023387167927233504"),
      BigInt("39382357235489614581723060781553021112529911719440698176882885853963445705823")
    ] : [_0n5, _1n5, P - _1n5]);
    function scalarMult(scalar, u) {
      const pointU = decodeU2(u);
      if (lowOrderU.has(pointU))
        throw new Error("invalid private or public key received");
      const pu = montgomeryLadder(pointU, decodeScalar(scalar));
      if (pu === _0n5)
        throw new Error("invalid private or public key received");
      return encodeU2(pu);
    }
    function scalarMultBase(scalar) {
      if (mulBaseHook === void 0)
        return scalarMult(scalar, GuBytes);
      const k = decodeScalar(scalar);
      aInRange("scalar", k, minScalar, maxScalar);
      const pu = modP(mulBaseHook(k));
      if (pu === _0n5)
        throw new Error("invalid private or public key received");
      return encodeU2(pu);
    }
    const getPublicKey = scalarMultBase;
    const getSharedSecret = scalarMult;
    function montgomeryLadder(u, scalar) {
      aInRange("u", u, _0n5, P);
      aInRange("scalar", scalar, minScalar, maxScalar);
      const k = scalar;
      const x_1 = u;
      let x_2 = _1n5;
      let z_2 = _0n5;
      let x_3 = u;
      let z_3 = _1n5;
      const kx = k ^ k >> _1n5;
      for (let t = BigInt(montgomeryBits - 1); t >= _0n5; t--) {
        const mask2 = cmask(P, kx >> t);
        ({ x_2, x_3 } = swap(mask2, x_2, x_3));
        ({ x_2: z_2, x_3: z_3 } = swap(mask2, z_2, z_3));
        const A2 = x_2 + z_2;
        const AA = modP(A2 * A2);
        const B = x_2 - z_2;
        const BB = modP(B * B);
        const E = AA - BB;
        const C = x_3 + z_3;
        const D = x_3 - z_3;
        const DA = modP(D * A2);
        const CB = modP(C * B);
        const dacb = DA + CB;
        const da_cb = DA - CB;
        x_3 = modP(dacb * dacb);
        z_3 = modP(x_1 * modP(da_cb * da_cb));
        x_2 = modP(AA * BB);
        z_2 = modP(E * (AA + modP(a24 * E)));
      }
      const mask = cmask(P, k);
      ({ x_2, x_3 } = swap(mask, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = swap(mask, z_2, z_3));
      const z2 = powPminus2(z_2);
      return modP(x_2 * z2);
    }
    const lengths = {
      secretKey: fieldLen,
      publicKey: fieldLen,
      seed: fieldLen
    };
    const randomSecretKey = (seed) => {
      seed = seed === void 0 ? randomBytes_(fieldLen) : seed;
      abytes2(seed, lengths.seed, "seed");
      return seed;
    };
    const utils = { randomSecretKey };
    Object.freeze(lengths);
    Object.freeze(utils);
    return Object.freeze({
      keygen: createKeygen(randomSecretKey, getPublicKey),
      getSharedSecret,
      getPublicKey,
      scalarMult,
      scalarMultBase,
      utils,
      GuBytes: GuBytes.slice(),
      lengths
    });
  }

  // node_modules/@noble/curves/ed25519.js
  var _0n6 = /* @__PURE__ */ BigInt(0);
  var _1n6 = /* @__PURE__ */ BigInt(1);
  var _2n4 = /* @__PURE__ */ BigInt(2);
  var _3n2 = /* @__PURE__ */ BigInt(3);
  var _5n2 = /* @__PURE__ */ BigInt(5);
  var _8n3 = /* @__PURE__ */ BigInt(8);
  var ed25519_CURVE_p = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
  var ed25519_CURVE = /* @__PURE__ */ (() => ({
    p: ed25519_CURVE_p,
    n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
    h: _8n3,
    a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
    d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
    Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
    Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
  }))();
  function ed25519_pow_2_252_3(x) {
    const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
    const P = ed25519_CURVE_p;
    const x2 = x * x % P;
    const b2 = x2 * x % P;
    const b4 = pow2(b2, _2n4, P) * b2 % P;
    const b5 = pow2(b4, _1n6, P) * x % P;
    const b10 = pow2(b5, _5n2, P) * b5 % P;
    const b20 = pow2(b10, _10n, P) * b10 % P;
    const b40 = pow2(b20, _20n, P) * b20 % P;
    const b80 = pow2(b40, _40n, P) * b40 % P;
    const b160 = pow2(b80, _80n, P) * b80 % P;
    const b240 = pow2(b160, _80n, P) * b80 % P;
    const b250 = pow2(b240, _10n, P) * b10 % P;
    const pow_p_5_8 = pow2(b250, _2n4, P) * x % P;
    return { pow_p_5_8, b2 };
  }
  function adjustScalarBytes(bytes) {
    bytes[0] &= 248;
    bytes[31] &= 127;
    bytes[31] |= 64;
    return bytes;
  }
  var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
  function uvRatio(u, v) {
    const P = ed25519_CURVE_p;
    const v3 = mod(v * v * v, P);
    const v7 = mod(v3 * v3 * v, P);
    const pow3 = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
    let x = mod(u * v3 * pow3, P);
    const vx2 = mod(v * x * x, P);
    const root1 = x;
    const root2 = mod(x * ED25519_SQRT_M1, P);
    const useRoot1 = vx2 === u;
    const useRoot2 = vx2 === mod(-u, P);
    const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
    if (useRoot1)
      x = root1;
    if (useRoot2 || noRoot)
      x = root2;
    if (isNegativeLE(x, P))
      x = mod(-x, P);
    return { isValid: useRoot1 || useRoot2, value: x };
  }
  var ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
  var x25519 = /* @__PURE__ */ (() => {
    const P = ed25519_CURVE_p;
    const powPminus2 = (x) => {
      const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
      return mod(pow2(pow_p_5_8, _3n2, P) * b2, P);
    };
    return montgomery({
      P,
      type: "x25519",
      powPminus2,
      adjustScalarBytes,
      // ~3x faster fixed-base: [k]B on the birationally-equivalent Edwards curve using cached
      // base tables, mapped back via u = (1+y)/(1-y) = (Z+Y)/(Z-Y) with one Fermat inversion.
      // Same construction as libsodium's crypto_scalarmult_curve25519_base.
      scalarMultBase: (k) => {
        const kn = mod(k, ed25519_Point.Fn.ORDER);
        if (kn === _0n6)
          return _0n6;
        const p = ed25519_Point.BASE.multiply(kn);
        return mod((p.Z + p.Y) * powPminus2(mod(p.Z - p.Y, P)), P);
      }
    });
  })();

  // node_modules/@noble/ciphers/utils.js
  function isBytes3(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle3 = (title) => title ? `"${title}" ` : "";
  function abool2(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle3(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function anumber3(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle3(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle3(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes3(value, length, title = "") {
    if (isBytes3(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber3(length, "length");
    const bytes = isBytes3(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle3(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  var aobject2 = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(label === "object" ? "expected valid options object" : `"${label}" expected object, got type=${typeof value}`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes3(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function aoutput32(out, instance) {
    aoutput(out, instance);
    if (!isAligned32(out))
      throw new Error("invalid output, must be aligned");
  }
  function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  var swap8IfBE = isLE ? (n) => n : (n) => byteSwap(n) >>> 0;
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  function overlapBytes(a, b) {
    if (!a.byteLength || !b.byteLength)
      return false;
    return a.buffer === b.buffer && // best we can do, may fail with an obscure Proxy
    a.byteOffset < b.byteOffset + b.byteLength && // a starts before b end
    b.byteOffset < a.byteOffset + a.byteLength;
  }
  function complexOverlapBytes(input, output) {
    if (overlapBytes(input, output) && input.byteOffset < output.byteOffset)
      throw new Error("complex overlap of input and output is not supported");
  }
  function checkOpts(defaults, opts) {
    aobject2(defaults, "defaults");
    aobject2(opts, "opts");
    const merged = Object.assign(defaults, opts);
    return merged;
  }
  function equalBytes(a, b) {
    a = abytes3(a);
    b = abytes3(b);
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  function wrapMacConstructor(keyLen, macCons, fromMsg) {
    const mac = macCons;
    const getArgs = fromMsg || (() => []);
    const macC = (msg, key) => mac(key, ...getArgs(msg)).update(msg).digest();
    const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
    macC.outputLen = tmp.outputLen;
    macC.blockLen = tmp.blockLen;
    macC.create = (key, ...args) => mac(key, ...args);
    return macC;
  }
  var wrapCipher = /* @__NO_SIDE_EFFECTS__ */ (params, constructor) => {
    function wrappedCipher(key, ...args) {
      abytes3(key, void 0, "key");
      if (params.nonceLength !== void 0) {
        const nonce = args[0];
        abytes3(nonce, params.varSizeNonce ? void 0 : params.nonceLength, "nonce");
      }
      const tagl = params.tagLength;
      const aadStart = params.nonceLength !== void 0 ? 1 : 0;
      if (!params.withAAD) {
        for (let i = aadStart; i < args.length; i++)
          if (isBytes3(args[i]))
            throw new Error("AAD not supported");
      }
      if (params.withAAD && args[aadStart] !== void 0)
        abytes3(args[aadStart], void 0, "AAD");
      const cipher = constructor(key, ...args);
      const checkOutput = (fnLength, output) => {
        if (output !== void 0) {
          if (fnLength !== 2)
            throw new Error("cipher output not supported");
          abytes3(output, void 0, "output");
        }
      };
      let called = false;
      const wrCipher = {
        encrypt(data, output) {
          if (called)
            throw new Error("cannot encrypt() twice with same key + nonce");
          called = true;
          abytes3(data, void 0, "data");
          checkOutput(cipher.encrypt.length, output);
          return cipher.encrypt(data, output);
        },
        decrypt(data, output) {
          abytes3(data, void 0, "data");
          if (tagl && data.length < tagl)
            throw new Error('"ciphertext" expected length >= tagLength=' + tagl);
          checkOutput(cipher.decrypt.length, output);
          return cipher.decrypt(data, output);
        }
      };
      return wrCipher;
    }
    Object.assign(wrappedCipher, params);
    return wrappedCipher;
  };
  function getOutput(expectedLength, out, onlyAligned = true) {
    if (out === void 0)
      return new Uint8Array(expectedLength);
    abytes3(out, expectedLength, "output");
    if (onlyAligned && !isAligned32(out))
      throw new Error("invalid output, must be aligned");
    return out;
  }
  function u64Lengths(dataLength, aadLength, isLE2) {
    anumber3(dataLength);
    anumber3(aadLength);
    abool2(isLE2);
    const num = new Uint8Array(16);
    const view = createView(num);
    view.setBigUint64(0, BigInt(aadLength), isLE2);
    view.setBigUint64(8, BigInt(dataLength), isLE2);
    return num;
  }
  function isAligned32(bytes) {
    return bytes.byteOffset % 4 === 0;
  }
  function copyBytes2(bytes) {
    return Uint8Array.from(abytes3(bytes));
  }

  // node_modules/@noble/ciphers/_arx.js
  var encodeStr = (str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0));
  var sigma16_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr("expand 16-byte k"))))();
  var sigma32_32 = /* @__PURE__ */ (() => swap32IfBE(u32(encodeStr("expand 32-byte k"))))();
  function rotl(a, b) {
    return a << b | a >>> 32 - b;
  }
  var BLOCK_LEN = 64;
  var BLOCK_LEN32 = 16;
  var MAX_COUNTER = /* @__PURE__ */ (() => 2 ** 32 - 1)();
  var U32_EMPTY = /* @__PURE__ */ Uint32Array.of();
  function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
    const len = data.length;
    const block = new Uint8Array(BLOCK_LEN);
    const b32 = u32(block);
    const isAligned = isLE && isAligned32(data) && isAligned32(output);
    const d32 = isAligned ? u32(data) : U32_EMPTY;
    const o32 = isAligned ? u32(output) : U32_EMPTY;
    if (!isLE) {
      for (let pos = 0; pos < len; counter++) {
        core(sigma, key, nonce, b32, counter, rounds);
        swap32IfBE(b32);
        if (counter >= MAX_COUNTER)
          throw new Error("arx: counter overflow");
        const take = Math.min(BLOCK_LEN, len - pos);
        for (let j = 0, posj; j < take; j++) {
          posj = pos + j;
          output[posj] = data[posj] ^ block[j];
        }
        pos += take;
      }
      return;
    }
    for (let pos = 0; pos < len; counter++) {
      core(sigma, key, nonce, b32, counter, rounds);
      if (counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const take = Math.min(BLOCK_LEN, len - pos);
      if (isAligned && take === BLOCK_LEN) {
        const pos32 = pos / 4;
        if (pos % 4 !== 0)
          throw new Error("arx: invalid block position");
        for (let j = 0, posj; j < BLOCK_LEN32; j++) {
          posj = pos32 + j;
          o32[posj] = d32[posj] ^ b32[j];
        }
        pos += BLOCK_LEN;
        continue;
      }
      for (let j = 0, posj; j < take; j++) {
        posj = pos + j;
        output[posj] = data[posj] ^ block[j];
      }
      pos += take;
    }
  }
  function createCipher(core, opts) {
    const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
    if (typeof core !== "function")
      throw new Error("core must be a function");
    anumber3(counterLength);
    anumber3(rounds);
    abool2(counterRight);
    abool2(allowShortKeys);
    return (key, nonce, data, output, counter = 0) => {
      abytes3(key, void 0, "key");
      abytes3(nonce, void 0, "nonce");
      abytes3(data, void 0, "data");
      const len = data.length;
      const hasOutput = output !== void 0;
      output = getOutput(len, output, false);
      if (hasOutput)
        complexOverlapBytes(data, output);
      anumber3(counter);
      if (counter < 0 || counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const toClean = [];
      let l = key.length;
      let k;
      let sigma;
      if (l === 32) {
        toClean.push(k = copyBytes2(key));
        sigma = sigma32_32;
      } else if (l === 16 && allowShortKeys) {
        k = new Uint8Array(32);
        k.set(key);
        k.set(key, 16);
        sigma = sigma16_32;
        toClean.push(k);
      } else {
        abytes3(key, 32, "arx key");
        throw new Error("invalid key size");
      }
      if (!isLE || !isAligned32(nonce))
        toClean.push(nonce = copyBytes2(nonce));
      let k32 = u32(k);
      if (extendNonceFn) {
        if (nonce.length !== 24)
          throw new Error("arx: extended nonce must be 24 bytes");
        const n16 = nonce.subarray(0, 16);
        if (isLE)
          extendNonceFn(sigma, k32, u32(n16), k32);
        else {
          const sigmaRaw = swap32IfBE(Uint32Array.from(sigma));
          extendNonceFn(sigmaRaw, k32, u32(n16), k32);
          clean(sigmaRaw);
          swap32IfBE(k32);
        }
        nonce = nonce.subarray(16);
      } else if (!isLE)
        swap32IfBE(k32);
      const nonceNcLen = 16 - counterLength;
      if (nonceNcLen !== nonce.length)
        throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
      if (nonceNcLen !== 12) {
        const nc = new Uint8Array(12);
        nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
        nonce = nc;
        toClean.push(nonce);
      }
      const n32 = swap32IfBE(u32(nonce));
      try {
        runCipher(core, sigma, k32, n32, data, output, counter, rounds);
        return output;
      } finally {
        clean(...toClean);
      }
    };
  }

  // node_modules/@noble/ciphers/_poly1305.js
  function u8to16(a, i) {
    return a[i++] & 255 | (a[i++] & 255) << 8;
  }
  var Poly1305 = class {
    blockLen = 16;
    outputLen = 16;
    buffer = new Uint8Array(16);
    r = new Uint16Array(10);
    // Allocating 1 array with .subarray() here is slower than 3
    h = new Uint16Array(10);
    pad = new Uint16Array(8);
    pos = 0;
    finished = false;
    destroyed = false;
    // Can be speed-up using BigUint64Array, at the cost of complexity
    constructor(key) {
      key = copyBytes2(abytes3(key, 32, "key"));
      const t0 = u8to16(key, 0);
      const t1 = u8to16(key, 2);
      const t2 = u8to16(key, 4);
      const t3 = u8to16(key, 6);
      const t4 = u8to16(key, 8);
      const t5 = u8to16(key, 10);
      const t6 = u8to16(key, 12);
      const t7 = u8to16(key, 14);
      this.r[0] = t0 & 8191;
      this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
      this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
      this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
      this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
      this.r[5] = t4 >>> 1 & 8190;
      this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
      this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
      this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
      this.r[9] = t7 >>> 5 & 127;
      for (let i = 0; i < 8; i++)
        this.pad[i] = u8to16(key, 16 + 2 * i);
    }
    process(data, offset, isLast = false) {
      const hibit = isLast ? 0 : 1 << 11;
      const { h, r } = this;
      const r0 = r[0];
      const r1 = r[1];
      const r2 = r[2];
      const r3 = r[3];
      const r4 = r[4];
      const r5 = r[5];
      const r6 = r[6];
      const r7 = r[7];
      const r8 = r[8];
      const r9 = r[9];
      const t0 = u8to16(data, offset + 0);
      const t1 = u8to16(data, offset + 2);
      const t2 = u8to16(data, offset + 4);
      const t3 = u8to16(data, offset + 6);
      const t4 = u8to16(data, offset + 8);
      const t5 = u8to16(data, offset + 10);
      const t6 = u8to16(data, offset + 12);
      const t7 = u8to16(data, offset + 14);
      let h0 = h[0] + (t0 & 8191);
      let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
      let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
      let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
      let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
      let h5 = h[5] + (t4 >>> 1 & 8191);
      let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
      let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
      let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
      let h9 = h[9] + (t7 >>> 5 | hibit);
      let c = 0;
      let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
      c = d0 >>> 13;
      d0 &= 8191;
      d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
      c += d0 >>> 13;
      d0 &= 8191;
      let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
      c = d1 >>> 13;
      d1 &= 8191;
      d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
      c += d1 >>> 13;
      d1 &= 8191;
      let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
      c = d2 >>> 13;
      d2 &= 8191;
      d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
      c += d2 >>> 13;
      d2 &= 8191;
      let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
      c = d3 >>> 13;
      d3 &= 8191;
      d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
      c += d3 >>> 13;
      d3 &= 8191;
      let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
      c = d4 >>> 13;
      d4 &= 8191;
      d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
      c += d4 >>> 13;
      d4 &= 8191;
      let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
      c = d5 >>> 13;
      d5 &= 8191;
      d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
      c += d5 >>> 13;
      d5 &= 8191;
      let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
      c = d6 >>> 13;
      d6 &= 8191;
      d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
      c += d6 >>> 13;
      d6 &= 8191;
      let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
      c = d7 >>> 13;
      d7 &= 8191;
      d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
      c += d7 >>> 13;
      d7 &= 8191;
      let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
      c = d8 >>> 13;
      d8 &= 8191;
      d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
      c += d8 >>> 13;
      d8 &= 8191;
      let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
      c = d9 >>> 13;
      d9 &= 8191;
      d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
      c += d9 >>> 13;
      d9 &= 8191;
      c = (c << 2) + c | 0;
      c = c + d0 | 0;
      d0 = c & 8191;
      c = c >>> 13;
      d1 += c;
      h[0] = d0;
      h[1] = d1;
      h[2] = d2;
      h[3] = d3;
      h[4] = d4;
      h[5] = d5;
      h[6] = d6;
      h[7] = d7;
      h[8] = d8;
      h[9] = d9;
    }
    finalize() {
      const { h, pad } = this;
      const g = new Uint16Array(10);
      let c = h[1] >>> 13;
      h[1] &= 8191;
      for (let i = 2; i < 10; i++) {
        h[i] += c;
        c = h[i] >>> 13;
        h[i] &= 8191;
      }
      h[0] += c * 5;
      c = h[0] >>> 13;
      h[0] &= 8191;
      h[1] += c;
      c = h[1] >>> 13;
      h[1] &= 8191;
      h[2] += c;
      g[0] = h[0] + 5;
      c = g[0] >>> 13;
      g[0] &= 8191;
      for (let i = 1; i < 10; i++) {
        g[i] = h[i] + c;
        c = g[i] >>> 13;
        g[i] &= 8191;
      }
      g[9] -= 1 << 13;
      let mask = (c ^ 1) - 1;
      for (let i = 0; i < 10; i++)
        g[i] &= mask;
      mask = ~mask;
      for (let i = 0; i < 10; i++)
        h[i] = h[i] & mask | g[i];
      h[0] = (h[0] | h[1] << 13) & 65535;
      h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
      h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
      h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
      h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
      h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
      h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
      h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
      let f = h[0] + pad[0];
      h[0] = f & 65535;
      for (let i = 1; i < 8; i++) {
        f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
        h[i] = f & 65535;
      }
      clean(g);
    }
    update(data) {
      aexists(this);
      abytes3(data);
      data = copyBytes2(data);
      const { buffer, blockLen } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(data, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(buffer, 0, false);
          this.pos = 0;
        }
      }
      return this;
    }
    destroy() {
      this.destroyed = true;
      clean(this.h, this.r, this.buffer, this.pad);
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, h } = this;
      let { pos } = this;
      if (pos) {
        buffer[pos++] = 1;
        for (; pos < 16; pos++)
          buffer[pos] = 0;
        this.process(buffer, 0, true);
      }
      this.finalize();
      let opos = 0;
      for (let i = 0; i < 8; i++) {
        out[opos++] = h[i] >>> 0;
        out[opos++] = h[i] >>> 8;
      }
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
  };
  var poly1305 = /* @__PURE__ */ wrapMacConstructor(32, (key) => new Poly1305(key));

  // node_modules/@noble/ciphers/chacha.js
  function chachaCore(s, k, n, out, cnt, rounds = 20) {
    let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let r = 0; r < rounds; r += 2) {
      x00 = x00 + x04 | 0;
      x12 = rotl(x12 ^ x00, 16);
      x08 = x08 + x12 | 0;
      x04 = rotl(x04 ^ x08, 12);
      x00 = x00 + x04 | 0;
      x12 = rotl(x12 ^ x00, 8);
      x08 = x08 + x12 | 0;
      x04 = rotl(x04 ^ x08, 7);
      x01 = x01 + x05 | 0;
      x13 = rotl(x13 ^ x01, 16);
      x09 = x09 + x13 | 0;
      x05 = rotl(x05 ^ x09, 12);
      x01 = x01 + x05 | 0;
      x13 = rotl(x13 ^ x01, 8);
      x09 = x09 + x13 | 0;
      x05 = rotl(x05 ^ x09, 7);
      x02 = x02 + x06 | 0;
      x14 = rotl(x14 ^ x02, 16);
      x10 = x10 + x14 | 0;
      x06 = rotl(x06 ^ x10, 12);
      x02 = x02 + x06 | 0;
      x14 = rotl(x14 ^ x02, 8);
      x10 = x10 + x14 | 0;
      x06 = rotl(x06 ^ x10, 7);
      x03 = x03 + x07 | 0;
      x15 = rotl(x15 ^ x03, 16);
      x11 = x11 + x15 | 0;
      x07 = rotl(x07 ^ x11, 12);
      x03 = x03 + x07 | 0;
      x15 = rotl(x15 ^ x03, 8);
      x11 = x11 + x15 | 0;
      x07 = rotl(x07 ^ x11, 7);
      x00 = x00 + x05 | 0;
      x15 = rotl(x15 ^ x00, 16);
      x10 = x10 + x15 | 0;
      x05 = rotl(x05 ^ x10, 12);
      x00 = x00 + x05 | 0;
      x15 = rotl(x15 ^ x00, 8);
      x10 = x10 + x15 | 0;
      x05 = rotl(x05 ^ x10, 7);
      x01 = x01 + x06 | 0;
      x12 = rotl(x12 ^ x01, 16);
      x11 = x11 + x12 | 0;
      x06 = rotl(x06 ^ x11, 12);
      x01 = x01 + x06 | 0;
      x12 = rotl(x12 ^ x01, 8);
      x11 = x11 + x12 | 0;
      x06 = rotl(x06 ^ x11, 7);
      x02 = x02 + x07 | 0;
      x13 = rotl(x13 ^ x02, 16);
      x08 = x08 + x13 | 0;
      x07 = rotl(x07 ^ x08, 12);
      x02 = x02 + x07 | 0;
      x13 = rotl(x13 ^ x02, 8);
      x08 = x08 + x13 | 0;
      x07 = rotl(x07 ^ x08, 7);
      x03 = x03 + x04 | 0;
      x14 = rotl(x14 ^ x03, 16);
      x09 = x09 + x14 | 0;
      x04 = rotl(x04 ^ x09, 12);
      x03 = x03 + x04 | 0;
      x14 = rotl(x14 ^ x03, 8);
      x09 = x09 + x14 | 0;
      x04 = rotl(x04 ^ x09, 7);
    }
    let oi = 0;
    out[oi++] = y00 + x00 | 0;
    out[oi++] = y01 + x01 | 0;
    out[oi++] = y02 + x02 | 0;
    out[oi++] = y03 + x03 | 0;
    out[oi++] = y04 + x04 | 0;
    out[oi++] = y05 + x05 | 0;
    out[oi++] = y06 + x06 | 0;
    out[oi++] = y07 + x07 | 0;
    out[oi++] = y08 + x08 | 0;
    out[oi++] = y09 + x09 | 0;
    out[oi++] = y10 + x10 | 0;
    out[oi++] = y11 + x11 | 0;
    out[oi++] = y12 + x12 | 0;
    out[oi++] = y13 + x13 | 0;
    out[oi++] = y14 + x14 | 0;
    out[oi++] = y15 + x15 | 0;
  }
  var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
    counterRight: false,
    counterLength: 4,
    allowShortKeys: false
  });
  var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
  var updatePadded = (h, msg) => {
    h.update(msg);
    const leftover = msg.length % 16;
    if (leftover)
      h.update(ZEROS16.subarray(leftover));
  };
  var ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
  function computeTag(fn, key, nonce, ciphertext, AAD) {
    if (AAD !== void 0)
      abytes3(AAD, void 0, "AAD");
    const authKey = fn(key, nonce, ZEROS32);
    const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
    const h = poly1305.create(authKey);
    if (AAD)
      updatePadded(h, AAD);
    updatePadded(h, ciphertext);
    h.update(lengths);
    const res = h.digest();
    clean(authKey, lengths);
    return res;
  }
  var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
    const tagLength = 16;
    return {
      encrypt(plaintext, output) {
        const plength = plaintext.length;
        output = getOutput(plength + tagLength, output, false);
        output.set(plaintext);
        const oPlain = output.subarray(0, -tagLength);
        xorStream(key, nonce, oPlain, oPlain, 1);
        const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
        output.set(tag, plength);
        clean(tag);
        return output;
      },
      decrypt(ciphertext, output) {
        output = getOutput(ciphertext.length - tagLength, output, false);
        const data = ciphertext.subarray(0, -tagLength);
        const passedTag = ciphertext.subarray(-tagLength);
        const tag = computeTag(xorStream, key, nonce, data, AAD);
        if (!equalBytes(passedTag, tag)) {
          clean(tag);
          throw new Error("invalid tag");
        }
        output.set(ciphertext.subarray(0, -tagLength));
        xorStream(key, nonce, output, output, 1);
        clean(tag);
        return output;
      }
    };
  };
  var chacha20poly1305 = /* @__PURE__ */ wrapCipher(
    { blockSize: 64, nonceLength: 12, tagLength: 16, withAAD: true },
    /* @__PURE__ */ _poly1305_aead(chacha20)
  );

  // node_modules/@noble/ciphers/_polyval.js
  var BLOCK_SIZE = 16;
  var ZEROS162 = /* @__PURE__ */ new Uint8Array(16);
  var ZEROS322 = /* @__PURE__ */ u32(ZEROS162);
  var POLY = 225;
  var mul2 = (s0, s1, s2, s3) => {
    const hiBit = s3 & 1;
    return {
      s3: s2 << 31 | s3 >>> 1,
      s2: s1 << 31 | s2 >>> 1,
      s1: s0 << 31 | s1 >>> 1,
      // NIST SP 800-38D §6.3 applies `V >> 1` and XORs R on carry. In this
      // 4x32-bit split, R = 0xe1 || 0^120 lives in the top byte of s0.
      s0: s0 >>> 1 ^ POLY << 24 & -(hiBit & 1)
      // reduce % poly
    };
  };
  var swapLE = (n) => (n >>> 0 & 255) << 24 | (n >>> 8 & 255) << 16 | (n >>> 16 & 255) << 8 | n >>> 24 & 255 | 0;
  var estimateWindow = (bytes) => {
    if (bytes > 64 * 1024)
      return 8;
    if (bytes > 1024)
      return 4;
    return 2;
  };
  var GHASH = class {
    blockLen = BLOCK_SIZE;
    outputLen = BLOCK_SIZE;
    s0 = 0;
    s1 = 0;
    s2 = 0;
    s3 = 0;
    finished = false;
    destroyed = false;
    t;
    W;
    windowSize;
    // We select bits per window adaptively based on expectedLength
    constructor(key, expectedLength) {
      abytes3(key, 16, "key");
      key = copyBytes2(key);
      const kView = createView(key);
      let k0 = kView.getUint32(0, false);
      let k1 = kView.getUint32(4, false);
      let k2 = kView.getUint32(8, false);
      let k3 = kView.getUint32(12, false);
      const doubles = [];
      for (let i = 0; i < 128; i++) {
        doubles.push({ s0: swapLE(k0), s1: swapLE(k1), s2: swapLE(k2), s3: swapLE(k3) });
        ({ s0: k0, s1: k1, s2: k2, s3: k3 } = mul2(k0, k1, k2, k3));
      }
      const W = estimateWindow(expectedLength || 1024);
      if (![1, 2, 4, 8].includes(W))
        throw new Error("ghash: invalid window size, expected 2, 4 or 8");
      this.W = W;
      const bits = 128;
      const windows = bits / W;
      const windowSize = this.windowSize = 2 ** W;
      const items = [];
      for (let w = 0; w < windows; w++) {
        for (let byte = 0; byte < windowSize; byte++) {
          let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
          for (let j = 0; j < W; j++) {
            const bit = byte >>> W - j - 1 & 1;
            if (!bit)
              continue;
            const { s0: d0, s1: d1, s2: d2, s3: d3 } = doubles[W * w + j];
            s0 ^= d0, s1 ^= d1, s2 ^= d2, s3 ^= d3;
          }
          items.push({ s0, s1, s2, s3 });
        }
      }
      this.t = items;
    }
    _updateBlock(s0, s1, s2, s3) {
      s0 ^= this.s0, s1 ^= this.s1, s2 ^= this.s2, s3 ^= this.s3;
      const { W, t, windowSize } = this;
      let o0 = 0, o1 = 0, o2 = 0, o3 = 0;
      const mask = (1 << W) - 1;
      let w = 0;
      for (const num of [s0, s1, s2, s3]) {
        for (let bytePos = 0; bytePos < 4; bytePos++) {
          const byte = num >>> 8 * bytePos & 255;
          for (let bitPos = 8 / W - 1; bitPos >= 0; bitPos--) {
            const bit = byte >>> W * bitPos & mask;
            const { s0: e0, s1: e1, s2: e2, s3: e3 } = t[w * windowSize + bit];
            o0 ^= e0, o1 ^= e1, o2 ^= e2, o3 ^= e3;
            w += 1;
          }
        }
      }
      this.s0 = o0;
      this.s1 = o1;
      this.s2 = o2;
      this.s3 = o3;
    }
    update(data) {
      aexists(this);
      abytes3(data);
      data = copyBytes2(data);
      const b32 = u32(data);
      const blocks = Math.floor(data.length / BLOCK_SIZE);
      const left = data.length % BLOCK_SIZE;
      for (let i = 0; i < blocks; i++) {
        this._updateBlock(swap8IfBE(b32[i * 4 + 0]), swap8IfBE(b32[i * 4 + 1]), swap8IfBE(b32[i * 4 + 2]), swap8IfBE(b32[i * 4 + 3]));
      }
      if (left) {
        ZEROS162.set(data.subarray(blocks * BLOCK_SIZE));
        this._updateBlock(swap8IfBE(ZEROS322[0]), swap8IfBE(ZEROS322[1]), swap8IfBE(ZEROS322[2]), swap8IfBE(ZEROS322[3]));
        clean(ZEROS322);
      }
      return this;
    }
    destroy() {
      this.destroyed = true;
      const { t } = this;
      for (const elm of t) {
        elm.s0 = 0, elm.s1 = 0, elm.s2 = 0, elm.s3 = 0;
      }
    }
    digestInto(out) {
      aexists(this);
      aoutput32(out, this);
      this.finished = true;
      const { s0, s1, s2, s3 } = this;
      const o32 = u32(out);
      o32[0] = s0;
      o32[1] = s1;
      o32[2] = s2;
      o32[3] = s3;
      if (!isLE)
        swap32IfBE(o32.subarray(0, BLOCK_SIZE / 4));
    }
    digest() {
      const res = new Uint8Array(BLOCK_SIZE);
      this.digestInto(res);
      this.destroy();
      return res;
    }
  };
  var ghash = /* @__PURE__ */ wrapMacConstructor(16, (key, expectedLength) => new GHASH(key, expectedLength), (msg) => [msg.length]);

  // node_modules/@noble/ciphers/aes.js
  var BLOCK_SIZE2 = 16;
  var BLOCK_SIZE32 = 4;
  var EMPTY_BLOCK = /* @__PURE__ */ new Uint8Array(BLOCK_SIZE2);
  var POLY2 = 283;
  function validateKeyLength(key) {
    if (![16, 24, 32].includes(key.length))
      throw new Error('"aes key" expected Uint8Array of length 16/24/32, got length=' + key.length);
  }
  function mul22(n) {
    return n << 1 ^ POLY2 & -(n >> 7);
  }
  function mul(a, b) {
    let res = 0;
    for (; b > 0; b >>= 1) {
      res ^= a & -(b & 1);
      a = mul22(a);
    }
    return res;
  }
  var sbox = /* @__PURE__ */ (() => {
    const t = new Uint8Array(256);
    for (let i = 0, x = 1; i < 256; i++, x ^= mul22(x))
      t[i] = x;
    const box = new Uint8Array(256);
    box[0] = 99;
    for (let i = 0; i < 255; i++) {
      let x = t[255 - i];
      x |= x << 8;
      box[t[i]] = (x ^ x >> 4 ^ x >> 5 ^ x >> 6 ^ x >> 7 ^ 99) & 255;
    }
    clean(t);
    return box;
  })();
  var rotr32_8 = (n) => n << 24 | n >>> 8;
  var rotl32_8 = (n) => n << 8 | n >>> 24;
  function genTtable(sbox2, fn) {
    if (sbox2.length !== 256)
      throw new Error("wrong sbox length");
    const T0 = new Uint32Array(256).map((_, j) => fn(sbox2[j]));
    const T1 = T0.map(rotl32_8);
    const T2 = T1.map(rotl32_8);
    const T3 = T2.map(rotl32_8);
    const T01 = new Uint32Array(256 * 256);
    const T23 = new Uint32Array(256 * 256);
    const sbox22 = new Uint16Array(256 * 256);
    for (let i = 0; i < 256; i++) {
      for (let j = 0; j < 256; j++) {
        const idx = i * 256 + j;
        T01[idx] = T0[i] ^ T1[j];
        T23[idx] = T2[i] ^ T3[j];
        sbox22[idx] = sbox2[i] << 8 | sbox2[j];
      }
    }
    return { sbox: sbox2, sbox2: sbox22, T0, T1, T2, T3, T01, T23 };
  }
  var tableEncoding = /* @__PURE__ */ genTtable(sbox, (s) => mul(s, 3) << 24 | s << 16 | s << 8 | mul(s, 2));
  var xPowers = /* @__PURE__ */ (() => {
    const p = new Uint8Array(16);
    for (let i = 0, x = 1; i < 16; i++, x = mul22(x))
      p[i] = x;
    return p;
  })();
  function expandKeyLE(key) {
    abytes3(key);
    const len = key.length;
    validateKeyLength(key);
    const { sbox2 } = tableEncoding;
    const toClean = [];
    if (!isLE || !isAligned32(key))
      toClean.push(key = copyBytes2(key));
    const k32 = swap32IfBE(u32(key));
    const Nk = k32.length;
    const subByte = (n) => applySbox(sbox2, n, n, n, n);
    const xk = new Uint32Array(len + 28);
    xk.set(k32);
    for (let i = Nk; i < xk.length; i++) {
      let t = xk[i - 1];
      if (i % Nk === 0)
        t = subByte(rotr32_8(t)) ^ xPowers[i / Nk - 1];
      else if (Nk > 6 && i % Nk === 4)
        t = subByte(t);
      xk[i] = xk[i - Nk] ^ t;
    }
    clean(...toClean);
    return xk;
  }
  function apply0123(T01, T23, s0, s1, s2, s3) {
    return T01[s0 << 8 & 65280 | s1 >>> 8 & 255] ^ T23[s2 >>> 8 & 65280 | s3 >>> 24 & 255];
  }
  function applySbox(sbox2, s0, s1, s2, s3) {
    return sbox2[s0 & 255 | s1 & 65280] | sbox2[s2 >>> 16 & 255 | s3 >>> 16 & 65280] << 16;
  }
  function encrypt(xk, s0, s1, s2, s3) {
    const { sbox2, T01, T23 } = tableEncoding;
    let k = 0;
    s0 ^= xk[k++], s1 ^= xk[k++], s2 ^= xk[k++], s3 ^= xk[k++];
    const rounds = xk.length / 4 - 2;
    for (let i = 0; i < rounds; i++) {
      const t02 = xk[k++] ^ apply0123(T01, T23, s0, s1, s2, s3);
      const t12 = xk[k++] ^ apply0123(T01, T23, s1, s2, s3, s0);
      const t22 = xk[k++] ^ apply0123(T01, T23, s2, s3, s0, s1);
      const t32 = xk[k++] ^ apply0123(T01, T23, s3, s0, s1, s2);
      s0 = t02, s1 = t12, s2 = t22, s3 = t32;
    }
    const t0 = xk[k++] ^ applySbox(sbox2, s0, s1, s2, s3);
    const t1 = xk[k++] ^ applySbox(sbox2, s1, s2, s3, s0);
    const t2 = xk[k++] ^ applySbox(sbox2, s2, s3, s0, s1);
    const t3 = xk[k++] ^ applySbox(sbox2, s3, s0, s1, s2);
    return { s0: t0, s1: t1, s2: t2, s3: t3 };
  }
  function ctr32(xk, isLE2, nonce, src, dst) {
    abytes3(nonce, BLOCK_SIZE2, "nonce");
    abytes3(src);
    dst = getOutput(src.length, dst);
    const ctr = nonce;
    const c32 = u32(ctr);
    const view = createView(ctr);
    const src32 = u32(src);
    const dst32 = u32(dst);
    const ctrPos = isLE2 ? 0 : 12;
    const srcLen = src.length;
    let ctrNum = view.getUint32(ctrPos, isLE2);
    for (let i = 0; i + 4 <= src32.length; i += 4) {
      const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
      dst32[i + 0] = src32[i + 0] ^ swap8IfBE(s0);
      dst32[i + 1] = src32[i + 1] ^ swap8IfBE(s1);
      dst32[i + 2] = src32[i + 2] ^ swap8IfBE(s2);
      dst32[i + 3] = src32[i + 3] ^ swap8IfBE(s3);
      ctrNum = ctrNum + 1 >>> 0;
      view.setUint32(ctrPos, ctrNum, isLE2);
    }
    const start = BLOCK_SIZE2 * Math.floor(src32.length / BLOCK_SIZE32);
    if (start < srcLen) {
      const { s0, s1, s2, s3 } = encrypt(xk, swap8IfBE(c32[0]), swap8IfBE(c32[1]), swap8IfBE(c32[2]), swap8IfBE(c32[3]));
      const b32 = new Uint32Array([s0, s1, s2, s3]);
      swap32IfBE(b32);
      const buf = u8(b32);
      for (let i = start, pos = 0; i < srcLen; i++, pos++)
        dst[i] = src[i] ^ buf[pos];
      clean(b32);
    }
    return dst;
  }
  function computeTag2(fn, isLE2, key, data, AAD) {
    const aadLength = AAD ? AAD.length : 0;
    const h = fn.create(key, data.length + aadLength);
    if (AAD)
      h.update(AAD);
    const num = u64Lengths(8 * data.length, 8 * aadLength, isLE2);
    h.update(data);
    h.update(num);
    const res = h.digest();
    clean(num);
    return res;
  }
  var gcm = /* @__PURE__ */ wrapCipher({ blockSize: 16, nonceLength: 12, tagLength: 16, withAAD: true, varSizeNonce: true }, function aesgcm(key, nonce, AAD) {
    if (nonce.length < 8)
      throw new Error("aes/gcm: invalid nonce length");
    const tagLength = 16;
    function _computeTag(authKey, tagMask, data) {
      const tag = computeTag2(ghash, false, authKey, data, AAD);
      for (let i = 0; i < tagMask.length; i++)
        tag[i] ^= tagMask[i];
      return tag;
    }
    function deriveKeys() {
      const xk = expandKeyLE(key);
      const authKey = EMPTY_BLOCK.slice();
      const counter = EMPTY_BLOCK.slice();
      ctr32(xk, false, counter, counter, authKey);
      if (nonce.length === 12) {
        counter.set(nonce);
      } else {
        const nonceLen = EMPTY_BLOCK.slice();
        const view = createView(nonceLen);
        view.setBigUint64(8, BigInt(nonce.length * 8), false);
        const g = ghash.create(authKey).update(nonce).update(nonceLen);
        g.digestInto(counter);
        g.destroy();
      }
      const tagMask = ctr32(xk, false, counter, EMPTY_BLOCK);
      return { xk, authKey, counter, tagMask };
    }
    return {
      encrypt(plaintext) {
        const { xk, authKey, counter, tagMask } = deriveKeys();
        const out = new Uint8Array(plaintext.length + tagLength);
        const toClean = [xk, authKey, counter, tagMask];
        if (!isAligned32(plaintext))
          toClean.push(plaintext = copyBytes2(plaintext));
        ctr32(xk, false, counter, plaintext, out.subarray(0, plaintext.length));
        const tag = _computeTag(authKey, tagMask, out.subarray(0, out.length - tagLength));
        toClean.push(tag);
        out.set(tag, plaintext.length);
        clean(...toClean);
        return out;
      },
      decrypt(ciphertext) {
        const { xk, authKey, counter, tagMask } = deriveKeys();
        const toClean = [xk, authKey, tagMask, counter];
        if (!isAligned32(ciphertext))
          toClean.push(ciphertext = copyBytes2(ciphertext));
        const data = ciphertext.subarray(0, -tagLength);
        const passedTag = ciphertext.subarray(-tagLength);
        const tag = _computeTag(authKey, tagMask, data);
        toClean.push(tag);
        if (!equalBytes(tag, passedTag)) {
          clean(...toClean);
          throw new Error("aes-gcm: invalid tag");
        }
        const out = ctr32(xk, false, counter, data);
        clean(...toClean);
        return out;
      }
    };
  });

  // node_modules/@sendspin/sendspin-js/node_modules/@noble/hashes/_u64.js
  var U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
  var _32n = /* @__PURE__ */ BigInt(32);
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
      const { h, l } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  var fromNumH = (n) => n / 2 ** 32 | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view, byteOffset, n, isLE2) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
    view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
  }
  var shrSH = (h, _l, s) => h >>> s;
  var shrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
  var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
  var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
  function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
  }
  var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
  var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
  var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
  var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
  var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

  // node_modules/@sendspin/sendspin-js/node_modules/@noble/hashes/utils.js
  function isBytes4(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle4 = (title) => title ? `"${title}" ` : "";
  function anumber4(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle4(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle4(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes4(value, length, title = "") {
    if (isBytes4(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber4(length, "length");
    const bytes = isBytes4(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle4(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new TypeError("expected hash wrapped by utils.createHasher");
    anumber4(h.outputLen);
    anumber4(h.blockLen);
    if (h.outputLen < 1 || h.blockLen < 1)
      throw new Error("hash blockLen / outputLen must be >= 1");
  }
  var aobject3 = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject3(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists2(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput2(out, instance) {
    abytes4(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function clean2(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView2(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  function checkOpts2(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts2({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@sendspin/sendspin-js/node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    // For partial updates less than block size
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(blockLen, outputLen, padOffset, isLE2) {
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView2(this.buffer);
    }
    update(data) {
      aexists2(this);
      abytes4(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView2(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists2(this);
      aoutput2(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
      this.process(view, 0);
      this.roundClean();
      const oview = out === buffer ? view : createView2(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    4089235720,
    3144134277,
    2227873595,
    1013904242,
    4271175723,
    2773480762,
    1595750129,
    1359893119,
    2917565137,
    2600822924,
    725511199,
    528734635,
    4215389547,
    1541459225,
    327033209
  ]);

  // node_modules/@sendspin/sendspin-js/node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and makes sha256 3x slower (measured).
    A = 0;
    B = 0;
    C = 0;
    D = 0;
    E = 0;
    F = 0;
    G = 0;
    H = 0;
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A: A2, B, C, D, E, F, G, H } = this;
      return [A2, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A2, B, C, D, E, F, G, H) {
      this.A = A2 | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A: A2, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A2, 2) ^ rotr(A2, 13) ^ rotr(A2, 22);
        const T2 = sigma0 + Maj(A2, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A2;
        A2 = T1 + T2 | 0;
      }
      A2 = A2 + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A2, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean2(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean2(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var K512 = /* @__PURE__ */ (() => split([
    "0x428a2f98d728ae22",
    "0x7137449123ef65cd",
    "0xb5c0fbcfec4d3b2f",
    "0xe9b5dba58189dbbc",
    "0x3956c25bf348b538",
    "0x59f111f1b605d019",
    "0x923f82a4af194f9b",
    "0xab1c5ed5da6d8118",
    "0xd807aa98a3030242",
    "0x12835b0145706fbe",
    "0x243185be4ee4b28c",
    "0x550c7dc3d5ffb4e2",
    "0x72be5d74f27b896f",
    "0x80deb1fe3b1696b1",
    "0x9bdc06a725c71235",
    "0xc19bf174cf692694",
    "0xe49b69c19ef14ad2",
    "0xefbe4786384f25e3",
    "0x0fc19dc68b8cd5b5",
    "0x240ca1cc77ac9c65",
    "0x2de92c6f592b0275",
    "0x4a7484aa6ea6e483",
    "0x5cb0a9dcbd41fbd4",
    "0x76f988da831153b5",
    "0x983e5152ee66dfab",
    "0xa831c66d2db43210",
    "0xb00327c898fb213f",
    "0xbf597fc7beef0ee4",
    "0xc6e00bf33da88fc2",
    "0xd5a79147930aa725",
    "0x06ca6351e003826f",
    "0x142929670a0e6e70",
    "0x27b70a8546d22ffc",
    "0x2e1b21385c26c926",
    "0x4d2c6dfc5ac42aed",
    "0x53380d139d95b3df",
    "0x650a73548baf63de",
    "0x766a0abb3c77b2a8",
    "0x81c2c92e47edaee6",
    "0x92722c851482353b",
    "0xa2bfe8a14cf10364",
    "0xa81a664bbc423001",
    "0xc24b8b70d0f89791",
    "0xc76c51a30654be30",
    "0xd192e819d6ef5218",
    "0xd69906245565a910",
    "0xf40e35855771202a",
    "0x106aa07032bbd1b8",
    "0x19a4c116b8d2d0c8",
    "0x1e376c085141ab53",
    "0x2748774cdf8eeb99",
    "0x34b0bcb5e19b48a8",
    "0x391c0cb3c5c95a63",
    "0x4ed8aa4ae3418acb",
    "0x5b9cca4f7763e373",
    "0x682e6ff3d6b2b8a3",
    "0x748f82ee5defb2fc",
    "0x78a5636f43172f60",
    "0x84c87814a1f0ab72",
    "0x8cc702081a6439ec",
    "0x90befffa23631e28",
    "0xa4506cebde82bde9",
    "0xbef9a3f7b2c67915",
    "0xc67178f2e372532b",
    "0xca273eceea26619c",
    "0xd186b8c721c0c207",
    "0xeada7dd6cde0eb1e",
    "0xf57d4f7fee6ed178",
    "0x06f067aa72176fba",
    "0x0a637dc5a2c898a6",
    "0x113f9804bef90dae",
    "0x1b710b35131c471b",
    "0x28db77f523047d84",
    "0x32caab7b40c72493",
    "0x3c9ebe0a15c9bebc",
    "0x431d67c49c100d4c",
    "0x4cc5d4becb3e42b6",
    "0x597f299cfc657e2a",
    "0x5fcb6fab3ad6faec",
    "0x6c44198c4a475817"
  ].map((n) => BigInt(n))))();
  var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
  var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
  var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
  var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
  var SHA2_64B = class extends HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // h -- high 32 bits, l -- low 32 bits
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and slows hashing down (measured on sha256).
    Ah = 0;
    Al = 0;
    Bh = 0;
    Bl = 0;
    Ch = 0;
    Cl = 0;
    Dh = 0;
    Dl = 0;
    Eh = 0;
    El = 0;
    Fh = 0;
    Fl = 0;
    Gh = 0;
    Gl = 0;
    Hh = 0;
    Hl = 0;
    constructor(outputLen, IV) {
      super(128, outputLen, 16, false);
      this.Ah = IV[0] | 0;
      this.Al = IV[1] | 0;
      this.Bh = IV[2] | 0;
      this.Bl = IV[3] | 0;
      this.Ch = IV[4] | 0;
      this.Cl = IV[5] | 0;
      this.Dh = IV[6] | 0;
      this.Dl = IV[7] | 0;
      this.Eh = IV[8] | 0;
      this.El = IV[9] | 0;
      this.Fh = IV[10] | 0;
      this.Fl = IV[11] | 0;
      this.Gh = IV[12] | 0;
      this.Gl = IV[13] | 0;
      this.Hh = IV[14] | 0;
      this.Hl = IV[15] | 0;
    }
    // prettier-ignore
    get() {
      const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
      this.Ah = Ah | 0;
      this.Al = Al | 0;
      this.Bh = Bh | 0;
      this.Bl = Bl | 0;
      this.Ch = Ch | 0;
      this.Cl = Cl | 0;
      this.Dh = Dh | 0;
      this.Dl = Dl | 0;
      this.Eh = Eh | 0;
      this.El = El | 0;
      this.Fh = Fh | 0;
      this.Fl = Fl | 0;
      this.Gh = Gh | 0;
      this.Gl = Gl | 0;
      this.Hh = Hh | 0;
      this.Hl = Hl | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4) {
        SHA512_W_H[i] = view.getUint32(offset);
        SHA512_W_L[i] = view.getUint32(offset += 4);
      }
      for (let i = 16; i < 80; i++) {
        const W15h = SHA512_W_H[i - 15] | 0;
        const W15l = SHA512_W_L[i - 15] | 0;
        const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
        const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
        const W2h = SHA512_W_H[i - 2] | 0;
        const W2l = SHA512_W_L[i - 2] | 0;
        const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
        const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
        const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
        const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
        SHA512_W_H[i] = SUMh | 0;
        SHA512_W_L[i] = SUMl | 0;
      }
      let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      for (let i = 0; i < 80; i++) {
        const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
        const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
        const CHIh = Eh & Fh ^ ~Eh & Gh;
        const CHIl = El & Fl ^ ~El & Gl;
        const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
        const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
        const T1l = T1ll | 0;
        const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
        const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
        const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
        const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
        Hh = Gh | 0;
        Hl = Gl | 0;
        Gh = Fh | 0;
        Gl = Fl | 0;
        Fh = Eh | 0;
        Fl = El | 0;
        ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
        Dh = Ch | 0;
        Dl = Cl | 0;
        Ch = Bh | 0;
        Cl = Bl | 0;
        Bh = Ah | 0;
        Bl = Al | 0;
        const All = add3L(T1l, sigma0l, MAJl);
        Ah = add3H(All, T1h, sigma0h, MAJh);
        Al = All | 0;
      }
      ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
      ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
      ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
      ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
      ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
      ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
      ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
      ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
      this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
      clean2(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
      this.destroyed = true;
      clean2(this.buffer);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var _SHA512 = class extends SHA2_64B {
    constructor() {
      super(64, SHA512_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );
  var sha512 = /* @__PURE__ */ createHasher(
    () => new _SHA512(),
    /* @__PURE__ */ oidNist(3)
  );

  // node_modules/@sendspin/sendspin-js/dist/core/noise/suites.js
  var NONCE = new Uint8Array(12);
  var NONCE_VIEW = new DataView(NONCE.buffer);
  function nonceLE(n) {
    NONCE_VIEW.setBigUint64(4, n, true);
    return NONCE;
  }
  function nonceBE(n) {
    NONCE_VIEW.setBigUint64(4, n, false);
    return NONCE;
  }
  var dh = (priv, pub) => x25519.getSharedSecret(priv, pub);
  var publicKey = (priv) => x25519.getPublicKey(priv);
  var generateKeypair = () => {
    const privateKey = x25519.utils.randomSecretKey();
    return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
  };
  var SUITES = {
    chacha: {
      name: "ChaChaPoly",
      dhLen: 32,
      dh,
      generateKeypair,
      publicKey,
      hash: sha256,
      aeadEncrypt: (k, n, ad, pt) => chacha20poly1305(k, nonceLE(n), ad).encrypt(pt),
      aeadDecrypt: (k, n, ad, ct) => chacha20poly1305(k, nonceLE(n), ad).decrypt(ct)
    },
    aesgcm: {
      name: "AESGCM",
      dhLen: 32,
      dh,
      generateKeypair,
      publicKey,
      hash: sha256,
      aeadEncrypt: (k, n, ad, pt) => gcm(k, nonceBE(n), ad).encrypt(pt),
      aeadDecrypt: (k, n, ad, ct) => gcm(k, nonceBE(n), ad).decrypt(ct)
    }
  };
  var SUITE_WIRE_NAME = {
    chacha: "25519_ChaChaPoly_SHA256",
    aesgcm: "25519_AESGCM_SHA256"
  };

  // node_modules/@sendspin/sendspin-js/dist/core/noise/base64url.js
  function base64urlEncode(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++)
      bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64urlDecode(s) {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
      out[i] = bin.charCodeAt(i);
    return out;
  }

  // node_modules/@sendspin/sendspin-js/dist/core/noise/identity.js
  var SK_KEY = "sendspin-identity-sk";
  var Identity = class _Identity {
    constructor(privateKey, publicKey2) {
      this.privateKey = privateKey;
      this.publicKey = publicKey2;
      this.clientId = base64urlEncode(publicKey2);
    }
    get keypair() {
      return { privateKey: this.privateKey, publicKey: this.publicKey };
    }
    static loadOrCreate(storage) {
      const kp = SUITES.chacha;
      if (storage) {
        const stored = storage.getItem(SK_KEY);
        if (stored) {
          try {
            const sk = base64urlDecode(stored);
            return new _Identity(sk, kp.publicKey(sk));
          } catch {
            console.warn("Sendspin: stored identity key is invalid, generating a new one");
          }
        }
        const fresh2 = kp.generateKeypair();
        storage.setItem(SK_KEY, base64urlEncode(fresh2.privateKey));
        return new _Identity(fresh2.privateKey, fresh2.publicKey);
      }
      const fresh = kp.generateKeypair();
      return new _Identity(fresh.privateKey, fresh.publicKey);
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/noise/constants.js
  var enc = new TextEncoder();
  var SENTINEL_PSK = sha256(enc.encode("sendspin-sentinel-psk-v1"));
  var PSK_ID_LABEL = enc.encode("sendspin-psk-id-v1");
  function pskId(psk) {
    const buf = new Uint8Array(PSK_ID_LABEL.length + psk.length);
    buf.set(PSK_ID_LABEL, 0);
    buf.set(psk, PSK_ID_LABEL.length);
    return base64urlEncode(sha256(buf));
  }
  var SENTINEL_PSK_ID = pskId(SENTINEL_PSK);

  // node_modules/@sendspin/sendspin-js/dist/core/noise/psk.js
  function randomPsk() {
    return crypto.getRandomValues(new Uint8Array(32));
  }
  var LONG_TERM_KEY = "sendspin-psks";
  var PAIRING_KEY = "sendspin-pairing-psk";
  var PskStore = class {
    constructor(storage) {
      this.storage = storage;
      this.entries = /* @__PURE__ */ new Map();
      this.add({
        psk: SENTINEL_PSK,
        pskId: pskId(SENTINEL_PSK),
        category: "sentinel"
      });
      this.loadPersisted();
    }
    add(e) {
      this.entries.set(e.pskId, e);
    }
    loadPersisted() {
      if (!this.storage)
        return;
      const raw = this.storage.getItem(LONG_TERM_KEY);
      if (raw) {
        try {
          const records = JSON.parse(raw);
          for (const r of records) {
            if (!r.serverId)
              continue;
            const psk = base64urlDecode(r.psk);
            this.add({
              psk,
              pskId: pskId(psk),
              category: "long_term",
              serverId: r.serverId
            });
          }
        } catch {
          this.storage.setItem(LONG_TERM_KEY, "[]");
        }
      }
      const pairing = this.storage.getItem(PAIRING_KEY);
      if (pairing) {
        try {
          const psk = base64urlDecode(pairing);
          this.add({ psk, pskId: pskId(psk), category: "pairing" });
        } catch {
          this.storage.setItem(PAIRING_KEY, "");
        }
      }
    }
    persistLongTerm() {
      if (!this.storage)
        return;
      const records = [];
      for (const e of this.entries.values()) {
        if (e.category === "long_term") {
          records.push({ psk: base64urlEncode(e.psk), serverId: e.serverId });
        }
      }
      this.storage.setItem(LONG_TERM_KEY, JSON.stringify(records));
    }
    lookup(id) {
      return this.entries.get(id) ?? null;
    }
    addLongTerm(psk, serverId) {
      const e = {
        psk,
        pskId: pskId(psk),
        category: "long_term",
        serverId
      };
      this.add(e);
      this.persistLongTerm();
      return e;
    }
    replaceLongTerm(psk, serverId) {
      for (const [id, e] of this.entries) {
        if (e.category === "long_term" && e.serverId === serverId) {
          this.entries.delete(id);
        }
      }
      return this.addLongTerm(psk, serverId);
    }
    removeByPskId(id) {
      const e = this.entries.get(id);
      if (!e || e.category !== "long_term")
        return;
      this.entries.delete(id);
      this.persistLongTerm();
    }
    getOrCreatePairingPsk() {
      for (const e of this.entries.values()) {
        if (e.category === "pairing")
          return e.psk;
      }
      return this.setPairingPsk(randomPsk());
    }
    rotatePairingPsk() {
      for (const [id, e] of this.entries) {
        if (e.category === "pairing")
          this.entries.delete(id);
      }
      return this.setPairingPsk(randomPsk());
    }
    setPairingPsk(psk) {
      this.add({ psk, pskId: pskId(psk), category: "pairing" });
      this.storage?.setItem(PAIRING_KEY, base64urlEncode(psk));
      return psk;
    }
  };

  // node_modules/@sendspin/sendspin-js/node_modules/@noble/hashes/hmac.js
  var _HMAC = class {
    oHash;
    iHash;
    blockLen;
    outputLen;
    canXOF = false;
    finished = false;
    destroyed = false;
    constructor(hash, key) {
      ahash(hash);
      abytes4(key, void 0, "key");
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("expected Hash instance");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash.create();
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54 ^ 92;
      this.oHash.update(pad);
      clean2(pad);
    }
    update(buf) {
      aexists2(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists2(this);
      aoutput2(out, this);
      this.finished = true;
      const buf = out.subarray(0, this.outputLen);
      this.iHash.digestInto(buf);
      this.oHash.update(buf);
      this.oHash.digestInto(buf);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to ||= Object.create(Object.getPrototypeOf(this), {});
      const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.canXOF = canXOF;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = /* @__PURE__ */ (() => {
    const hmac_ = ((hash, key, message) => new _HMAC(hash, key).update(message).digest());
    hmac_.create = (hash, key) => new _HMAC(hash, key);
    return hmac_;
  })();

  // node_modules/@sendspin/sendspin-js/dist/core/noise/cipher-state.js
  var EMPTY = new Uint8Array(0);
  var CipherState = class {
    constructor(suite) {
      this.suite = suite;
      this.k = null;
      this.n = 0n;
    }
    initializeKey(key) {
      this.k = key;
      this.n = 0n;
    }
    hasKey() {
      return this.k !== null;
    }
    encryptWithAd(ad, plaintext) {
      if (this.k === null)
        return plaintext;
      const ct = this.suite.aeadEncrypt(this.k, this.n, ad, plaintext);
      this.n += 1n;
      return ct;
    }
    decryptWithAd(ad, ciphertext) {
      if (this.k === null)
        return ciphertext;
      const pt = this.suite.aeadDecrypt(this.k, this.n, ad, ciphertext);
      this.n += 1n;
      return pt;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/noise/symmetric-state.js
  var HASHLEN = 32;
  function hkdf(ck, ikm, num) {
    const tempKey = hmac(sha256, ck, ikm);
    const o1 = hmac(sha256, tempKey, Uint8Array.of(1));
    const o2 = hmac(sha256, tempKey, concat(o1, Uint8Array.of(2)));
    if (num === 2)
      return [o1, o2];
    const o3 = hmac(sha256, tempKey, concat(o2, Uint8Array.of(3)));
    return [o1, o2, o3];
  }
  function concat(...parts) {
    const len = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  var SymmetricState = class {
    constructor(suite) {
      this.suite = suite;
      this.cipher = new CipherState(suite);
    }
    initialize(protocolName) {
      const name = new TextEncoder().encode(protocolName);
      if (name.length <= HASHLEN) {
        const h = new Uint8Array(HASHLEN);
        h.set(name);
        this.h = h;
      } else {
        this.h = this.suite.hash(name);
      }
      this.ck = this.h;
      this.cipher.initializeKey(null);
    }
    mixHash(data) {
      this.h = this.suite.hash(concat(this.h, data));
    }
    mixKey(ikm) {
      const [ck, tempK] = hkdf(this.ck, ikm, 2);
      this.ck = ck;
      this.cipher.initializeKey(tempK.slice(0, 32));
    }
    mixKeyAndHash(ikm) {
      const [ck, tempH, tempK] = hkdf(this.ck, ikm, 3);
      this.ck = ck;
      this.mixHash(tempH);
      this.cipher.initializeKey(tempK.slice(0, 32));
    }
    encryptAndHash(plaintext) {
      const ct = this.cipher.encryptWithAd(this.h, plaintext);
      this.mixHash(ct);
      return ct;
    }
    decryptAndHash(ciphertext) {
      const pt = this.cipher.decryptWithAd(this.h, ciphertext);
      this.mixHash(ciphertext);
      return pt;
    }
    /** Returns [sender-facing, receiver-facing] transport CipherStates. */
    split() {
      const [tempK1, tempK2] = hkdf(this.ck, EMPTY, 2);
      const c1 = new CipherState(this.suite);
      const c2 = new CipherState(this.suite);
      c1.initializeKey(tempK1.slice(0, 32));
      c2.initializeKey(tempK2.slice(0, 32));
      return [c1, c2];
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/noise/handshake.js
  var MSG1 = ["e", "es", "ss"];
  var MSG2 = ["e", "ee", "se", "psk"];
  function concat2(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  var HandshakeState = class {
    constructor(p) {
      this.suite = p.suite;
      this.role = p.role;
      this.s = p.s;
      this.rs = p.rs;
      this.psk = p.psk;
      this.fixedEphemeral = p.fixedEphemeral;
      this.sym = new SymmetricState(p.suite);
      this.sym.initialize(`Noise_KKpsk2_25519_${p.suite.name}_SHA256`);
      this.sym.mixHash(p.prologue);
      const initiatorStatic = p.role === "initiator" ? p.s.publicKey : p.rs;
      const responderStatic = p.role === "responder" ? p.s.publicKey : p.rs;
      this.sym.mixHash(initiatorStatic);
      this.sym.mixHash(responderStatic);
    }
    /** The running handshake hash, e.g. for the re-handshake prologue. */
    get handshakeHash() {
      return this.sym.h;
    }
    setPsk(psk) {
      this.psk = psk;
    }
    dhToken(token) {
      const init = this.role === "initiator";
      switch (token) {
        case "ee":
          return this.suite.dh(this.e.privateKey, this.re);
        case "ss":
          return this.suite.dh(this.s.privateKey, this.rs);
        case "es":
          return init ? this.suite.dh(this.e.privateKey, this.rs) : this.suite.dh(this.s.privateKey, this.re);
        case "se":
          return init ? this.suite.dh(this.s.privateKey, this.re) : this.suite.dh(this.e.privateKey, this.rs);
      }
    }
    processTokenWrite(token, out) {
      if (token === "e") {
        this.e = this.fixedEphemeral ?? this.suite.generateKeypair();
        this.sym.mixHash(this.e.publicKey);
        this.sym.mixKey(this.e.publicKey);
        out.buf = concat2(out.buf, this.e.publicKey);
      } else if (token === "s") {
        out.buf = concat2(out.buf, this.sym.encryptAndHash(this.s.publicKey));
      } else if (token === "psk") {
        this.sym.mixKeyAndHash(this.psk);
      } else {
        this.sym.mixKey(this.dhToken(token));
      }
    }
    processTokenRead(token, cursor) {
      if (token === "e") {
        this.re = cursor.buf.slice(0, this.suite.dhLen);
        cursor.buf = cursor.buf.slice(this.suite.dhLen);
        this.sym.mixHash(this.re);
        this.sym.mixKey(this.re);
      } else if (token === "s") {
        const len = this.suite.dhLen + 16;
        this.sym.decryptAndHash(cursor.buf.slice(0, len));
        cursor.buf = cursor.buf.slice(len);
      } else if (token === "psk") {
        this.sym.mixKeyAndHash(this.psk);
      } else {
        this.sym.mixKey(this.dhToken(token));
      }
    }
    writeMessage(tokens, payload) {
      const out = { buf: new Uint8Array(0) };
      for (const t of tokens)
        this.processTokenWrite(t, out);
      out.buf = concat2(out.buf, this.sym.encryptAndHash(payload));
      return out.buf;
    }
    readMessage(tokens, message) {
      const cursor = { buf: message };
      for (const t of tokens)
        this.processTokenRead(t, cursor);
      return this.sym.decryptAndHash(cursor.buf);
    }
    split() {
      return this.sym.split();
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/noise/session.js
  var EMPTY2 = new Uint8Array(0);
  var NoiseSession = class {
    constructor(role, split2) {
      const [c1, c2] = split2;
      if (role === "initiator") {
        this.sendCs = c1;
        this.recvCs = c2;
      } else {
        this.sendCs = c2;
        this.recvCs = c1;
      }
    }
    encrypt(plaintext) {
      return this.sendCs.encryptWithAd(EMPTY2, plaintext);
    }
    decrypt(ciphertext) {
      return this.recvCs.decryptWithAd(EMPTY2, ciphertext);
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/activate-authorization.js
  function isAllowedActivitySet(category, activities, unpairedAccess) {
    if (activities.some((a) => a !== "playback" && a !== "pairing")) {
      return false;
    }
    if (category === "long_term")
      return !activities.includes("pairing");
    return unpairedAccess || !activities.includes("playback");
  }
  function isPlaybackCapable(category, activities, unpairedAccess) {
    return isAllowedActivitySet(category, [...activities, "playback"], unpairedAccess);
  }
  function isAdmissible(category, activities, activeRoles, unpairedAccess) {
    if (!isAllowedActivitySet(category, activities, unpairedAccess))
      return false;
    return activeRoles.length === 0 || isPlaybackCapable(category, activities, unpairedAccess);
  }
  function isMissingPairingField(activities, pairing) {
    if (!activities.includes("pairing"))
      return false;
    if (!pairing?.method)
      return true;
    return pairing.method === "dynamic_pairing_code" && typeof pairing.format !== "string";
  }
  function isAllowedPairing(category, activities, pairing, offered) {
    if (!activities.includes("pairing"))
      return true;
    const { method, format } = pairing;
    if (method === "pairing_psk" !== (category === "pairing"))
      return false;
    if (!Object.keys(offered).includes(method))
      return false;
    return method !== "dynamic_pairing_code" || offered.dynamic_pairing_code.formats.includes(format);
  }
  function authorizeActivate(category, activities, activeRoles, persistedRoles, unpairedAccess, pairing, offered) {
    if (isMissingPairingField(activities, pairing)) {
      return { ok: false, protocolError: true };
    }
    const roles = activeRoles ?? (isPlaybackCapable(category, activities, unpairedAccess) ? persistedRoles : []);
    const pairingAllowed = isAllowedPairing(category, activities, pairing, offered);
    if (pairingAllowed && isAdmissible(category, activities, roles, unpairedAccess)) {
      return { ok: true, activeRoles: [...roles] };
    }
    if (category !== "long_term" && !unpairedAccess && pairingAllowed && isAdmissible(category, activities, roles, true)) {
      return { ok: false, goodbye: "pairing_required" };
    }
    if (!isAdmissible(category, activities, roles, unpairedAccess)) {
      return { ok: false, goodbye: "unauthorized" };
    }
    return {
      ok: false,
      pairAbort: "method_not_supported",
      activeRoles: isPlaybackCapable(category, [], unpairedAccess) ? [...persistedRoles] : []
    };
  }

  // node_modules/@sendspin/sendspin-js/dist/core/transport.js
  var utf8 = new TextEncoder();
  var dutf8 = new TextDecoder();
  var strictUtf8 = new TextDecoder("utf-8", { fatal: true });
  var HANDSHAKE_TIMEOUT_MS = 3e4;
  var MAX_TRANSPORT_PLAINTEXT = 65519;
  var MAX_TRANSPORT_CIPHERTEXT = MAX_TRANSPORT_PLAINTEXT + 16;
  var MAX_REASSEMBLY_BYTES = 4 * 1024 * 1024;
  var MSG_TYPE_FRAGMENT = 1;
  var FRAGMENT_FLAG_LAST = 1;
  var FRAGMENT_FLAG_FIRST = 2;
  var FRAGMENT_FLAGS_RESERVED = 252;
  var PSK_CATEGORY_CODES = /* @__PURE__ */ new Map([
    ["lt", "long_term"],
    ["pr", "pairing"],
    ["sn", "sentinel"]
  ]);
  function parseNoise1Payload(bytes) {
    const { psk_id, psk_category } = JSON.parse(strictUtf8.decode(bytes)) ?? {};
    const category = PSK_CATEGORY_CODES.get(psk_category);
    if (typeof psk_id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(psk_id) || category === void 0) {
      throw new Error("Sendspin: malformed noise/handshake payload");
    }
    return { pskId: psk_id, category };
  }
  function concat3(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  var SendspinTransport = class {
    constructor(wsManager, deps, cb) {
      this.wsManager = wsManager;
      this.deps = deps;
      this.cb = cb;
      this.state = "idle";
      this.hs = null;
      this.session = null;
      this.matched = null;
      this.serverId = "";
      this.rawClientInit = new Uint8Array(0);
      this.rawServerInit = new Uint8Array(0);
      this.timeout = null;
      this.frag = null;
      this.lastHandshakeHash = new Uint8Array(0);
      this.quiesced = false;
      this.outboundQueue = [];
      this.activeRoles = [];
    }
    get suite() {
      return SUITES[this.deps.suiteId];
    }
    /** True once transport mode is established. */
    get ready() {
      return this.state === "transport";
    }
    get handshakeInfo() {
      if (!this.matched)
        return null;
      return {
        category: this.matched.category,
        serverId: this.serverId,
        entry: this.matched
      };
    }
    /** The Noise handshake hash h of the current session (PIN pairing binds to it). */
    get handshakeHash() {
      return this.lastHandshakeHash;
    }
    start() {
      this.resetSession();
      const initStr = JSON.stringify({
        type: "client/init",
        payload: {
          client_id: this.deps.identity.clientId,
          version: 1,
          suite: SUITE_WIRE_NAME[this.deps.suiteId]
        }
      });
      this.rawClientInit = utf8.encode(initStr);
      this.wsManager.sendText(initStr);
      this.state = "await_server_init";
      this.armTimeout();
    }
    /** Reset per-connection handshake and session state. */
    resetSession() {
      this.hs = null;
      this.session = null;
      this.matched = null;
      this.frag = null;
      this.serverId = "";
      this.rawServerInit = new Uint8Array(0);
      this.quiesced = false;
      this.outboundQueue = [];
      this.lastHandshakeHash = new Uint8Array(0);
      this.activeRoles = [];
    }
    /**
     * The socket closed. Drop the handshake timer and session so a reconnect
     * starts clean and no send targets the dead session's keys.
     */
    onSocketClosed() {
      this.clearTimeout();
      this.resetSession();
      this.state = "idle";
    }
    /** Public close: pair/abort and other flows need to tear down the socket. */
    close() {
      this.clearTimeout();
      this.wsManager.disconnect();
    }
    handleRaw(event) {
      const receivedAtUs = Math.floor(performance.now() * 1e3);
      if (this.state === "transport") {
        if (typeof event.data === "string")
          return this.fail();
        let plain;
        try {
          const bytes = new Uint8Array(event.data);
          if (bytes.length > MAX_TRANSPORT_CIPHERTEXT)
            return this.fail();
          plain = this.session.decrypt(bytes);
        } catch {
          return this.fail();
        }
        if (plain.length < 1)
          return this.fail();
        try {
          this.dispatchPlain(plain, receivedAtUs);
        } catch (e) {
          console.warn("Sendspin: dropped malformed transport message", e);
        }
        return;
      }
      try {
        if (typeof event.data !== "string")
          return this.fail();
        this.handleHandshakeText(event.data);
      } catch {
        this.fail();
      }
    }
    handleHandshakeText(raw) {
      const msg = JSON.parse(raw);
      if (this.state === "await_server_init" && msg.type === "server/error") {
        console.error(`Sendspin: Server refused the connection (reason: ${String(msg.payload?.reason)})`);
        return this.fail();
      }
      if (this.state === "await_server_init" && msg.type === "server/init") {
        if (msg.payload.version !== 1)
          return this.fail();
        this.serverId = String(msg.payload.server_id);
        this.rawServerInit = utf8.encode(raw);
        this.hs = new HandshakeState({
          suite: this.suite,
          role: "responder",
          prologue: concat3(this.rawClientInit, this.rawServerInit),
          s: this.deps.identity.keypair,
          rs: base64urlDecode(this.serverId)
        });
        this.state = "await_noise1";
        this.armTimeout();
        return;
      }
      if (this.state === "await_noise1" && msg.type === "noise/handshake") {
        this.processNoise1(base64urlDecode(String(msg.payload.data)));
        return;
      }
      this.fail();
    }
    processNoise1(data) {
      const payload1 = this.hs.readMessage(MSG1, data);
      const entry = this.matchPsk(payload1) ?? this.deps.pskStore.lookup(SENTINEL_PSK_ID);
      this.hs.setPsk(entry.psk);
      const m2 = this.hs.writeMessage(MSG2, utf8.encode("{}"));
      this.wsManager.sendText(JSON.stringify({
        type: "noise/handshake",
        payload: { data: base64urlEncode(m2) }
      }));
      this.session = new NoiseSession("responder", this.hs.split());
      this.matched = entry;
      this.state = "transport";
      this.clearTimeout();
      this.lastHandshakeHash = this.hs.handshakeHash;
      this.cb.onHandshakeComplete(this.handshakeInfo);
    }
    /** Stored PSK selected by a Noise message 1 payload, or null on a lookup miss. */
    matchPsk(payload1) {
      const { pskId: pskId2, category } = parseNoise1Payload(payload1);
      const entry = this.deps.pskStore.lookup(pskId2);
      if (entry?.category !== category)
        return null;
      if (category === "long_term" && entry.serverId !== this.serverId) {
        throw new Error("Sendspin: long-term PSK bound to another server");
      }
      return entry;
    }
    /** Route one decrypted plaintext frame on its leading message-type byte. */
    dispatchPlain(full, receivedAtUs) {
      const type = full[0];
      if (type === MSG_TYPE_FRAGMENT)
        return this.handleFragment(full, receivedAtUs);
      if (this.frag !== null)
        return this.fail();
      if (type === 0) {
        this.handleControl(JSON.parse(dutf8.decode(full.subarray(1))), receivedAtUs);
      } else {
        this.cb.onBinaryMessage(full, receivedAtUs);
      }
    }
    handleFragment(full, receivedAtUs) {
      if (full.length < 2)
        return this.fail();
      const flags = full[1];
      if (flags & FRAGMENT_FLAGS_RESERVED)
        return this.fail();
      let data;
      if (flags & FRAGMENT_FLAG_FIRST) {
        if (this.frag !== null || full.length < 3)
          return this.fail();
        if (full[2] === MSG_TYPE_FRAGMENT)
          return this.fail();
        this.frag = { origType: full[2], parts: [], size: 0 };
        data = full.subarray(3);
      } else {
        if (this.frag === null)
          return this.fail();
        data = full.subarray(2);
      }
      this.frag.parts.push(data);
      this.frag.size += data.length;
      if (this.frag.size > MAX_REASSEMBLY_BYTES) {
        this.frag = null;
        return this.fail();
      }
      if (!(flags & FRAGMENT_FLAG_LAST))
        return;
      const origType = this.frag.origType;
      const assembled = new Uint8Array(this.frag.size + 1);
      assembled[0] = origType;
      let off = 1;
      for (const p of this.frag.parts) {
        assembled.set(p, off);
        off += p.length;
      }
      this.frag = null;
      if (origType === 0) {
        this.handleControl(JSON.parse(dutf8.decode(assembled.subarray(1))), receivedAtUs);
      } else {
        this.cb.onBinaryMessage(assembled, receivedAtUs);
      }
    }
    handleControl(msg, receivedAtUs) {
      if (msg.type === "noise/handshake") {
        try {
          this.handleRehandshake(msg);
        } catch {
          return this.fail();
        }
        this.cb.onHandshakeComplete(this.handshakeInfo);
        return;
      }
      if (msg.type === "server/activate") {
        this.handleActivate(msg, receivedAtUs);
        return;
      }
      if (msg.type === "server/unpair") {
        this.handleUnpair();
        return;
      }
      this.cb.onControlMessage(msg, receivedAtUs);
    }
    handleRehandshake(msg) {
      const newHs = new HandshakeState({
        suite: this.suite,
        role: "responder",
        prologue: this.lastHandshakeHash,
        s: this.deps.identity.keypair,
        rs: base64urlDecode(this.serverId)
      });
      const payload1 = newHs.readMessage(MSG1, base64urlDecode(msg.payload.data));
      const entry = this.matchPsk(payload1);
      if (!entry)
        throw new Error("Sendspin: psk_id lookup miss in a re-handshake");
      newHs.setPsk(entry.psk);
      const m2 = newHs.writeMessage(MSG2, utf8.encode("{}"));
      this.quiesced = true;
      this.armTimeout();
      this.encryptSendJson({
        type: "noise/handshake",
        payload: { data: base64urlEncode(m2) }
      });
      this.session = new NoiseSession("responder", newHs.split());
      this.matched = entry;
      this.lastHandshakeHash = newHs.handshakeHash;
    }
    handleActivate(msg, receivedAtUs) {
      const result = authorizeActivate(this.matched.category, msg.payload.activities, msg.payload.active_roles, this.activeRoles, this.deps.unpairedAccess, msg.payload.pairing, this.deps.pairMethods());
      if ("protocolError" in result) {
        console.warn("Sendspin: server/activate is missing its pairing method or format, so the server is non-compliant.");
        this.close();
        return;
      }
      if ("goodbye" in result) {
        this.sendGoodbyeAndClose(result.goodbye);
        return;
      }
      this.activeRoles = result.activeRoles;
      this.clearTimeout();
      const isActive = (queued) => queued.role !== void 0 && this.activeRoles.includes(queued.role);
      const removedRoleEnds = this.outboundQueue.filter((queued) => queued.alwaysReplay && !isActive(queued));
      const replay = this.outboundQueue.filter(isActive);
      this.quiesced = false;
      this.outboundQueue = [];
      for (const queued of removedRoleEnds) {
        this.encryptSend(queued.type, queued.body);
      }
      if (result.ok) {
        this.cb.onControlMessage({
          ...msg,
          payload: { ...msg.payload, active_roles: this.activeRoles }
        }, receivedAtUs);
      } else {
        this.cb.onActivateRefused(this.activeRoles);
      }
      for (const queued of replay)
        this.encryptSend(queued.type, queued.body);
    }
    handleUnpair() {
      if (this.matched?.category !== "long_term")
        return;
      this.deps.pskStore.removeByPskId(this.matched.pskId);
      this.sendGoodbyeAndClose("unpaired");
    }
    sendGoodbyeAndClose(reason) {
      try {
        this.encryptSendJson({ type: "client/goodbye", payload: { reason } });
      } catch {
      }
      this.close();
    }
    /** A message held during a re-handshake is replayed only if `role` is still active. */
    sendControl(msg, role) {
      const type = msg.type;
      this.send(0, utf8.encode(JSON.stringify(msg)), role, type !== "client/hello", type === "client-stream/end");
    }
    sendBinary(type, data, role) {
      this.send(type, data, role, true, false);
    }
    send(type, body, role, holdable, alwaysReplay) {
      if (this.state !== "transport" || !this.session) {
        console.warn("Sendspin: send before transport ready");
        return;
      }
      if (this.quiesced && holdable) {
        this.outboundQueue.push({
          type,
          body: Uint8Array.from(body),
          role,
          alwaysReplay
        });
        return;
      }
      this.encryptSend(type, body);
    }
    encryptSend(type, body) {
      if (body.length < MAX_TRANSPORT_PLAINTEXT) {
        const pt = concat3(Uint8Array.of(type), body);
        this.wsManager.sendBinary(this.session.encrypt(pt));
        return;
      }
      for (let start = 0; start < body.length; ) {
        const first = start === 0;
        const end = Math.min(body.length, start + MAX_TRANSPORT_PLAINTEXT - (first ? 3 : 2));
        const flags = (first ? FRAGMENT_FLAG_FIRST : 0) | (end === body.length ? FRAGMENT_FLAG_LAST : 0);
        const header = first ? Uint8Array.of(MSG_TYPE_FRAGMENT, flags, type) : Uint8Array.of(MSG_TYPE_FRAGMENT, flags);
        const pt = concat3(header, body.subarray(start, end));
        this.wsManager.sendBinary(this.session.encrypt(pt));
        start = end;
      }
    }
    encryptSendJson(msg) {
      this.encryptSend(0, utf8.encode(JSON.stringify(msg)));
    }
    armTimeout() {
      this.clearTimeout();
      this.timeout = globalThis.setTimeout(() => this.fail(), HANDSHAKE_TIMEOUT_MS);
    }
    clearTimeout() {
      if (this.timeout !== null) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }
    /** Any handshake or transport failure: close the socket with no app-level error. */
    fail() {
      this.clearTimeout();
      this.wsManager.disconnect();
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/pake/cpace.js
  var Q = 2n ** 255n - 19n;
  var A = 486662n;
  var Z = 2n;
  var FIELD_BYTES = 32;
  var SHARE_SIZE = 32;
  var TAG_SIZE = 64;
  var DSI = utf82("CPace255");
  var DSI_ISK = utf82("CPace255_ISK");
  var MAC_LABEL = utf82("CPaceMac");
  var SHA512_BLOCK_BYTES = 128;
  var CPaceError = class extends Error {
  };
  function utf82(s) {
    return new TextEncoder().encode(s);
  }
  function concat4(...parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  function prependLen(data) {
    let length = data.length;
    const prefix = [];
    for (; ; ) {
      prefix.push(length < 128 ? length : length & 127 | 128);
      length >>= 7;
      if (length === 0)
        break;
    }
    return concat4(new Uint8Array(prefix), data);
  }
  function lvCat(...parts) {
    return concat4(...parts.map(prependLen));
  }
  function generatorString(prs, ci, sid) {
    const lenZpad = Math.max(0, SHA512_BLOCK_BYTES - 1 - prependLen(prs).length - prependLen(DSI).length);
    return lvCat(DSI, prs, new Uint8Array(lenZpad), ci, sid);
  }
  function mod2(n, m) {
    const r = n % m;
    return r < 0n ? r + m : r;
  }
  function modPow(base, exp, m) {
    let result = 1n;
    let b = mod2(base, m);
    let e = exp;
    while (e > 0n) {
      if (e & 1n)
        result = result * b % m;
      b = b * b % m;
      e >>= 1n;
    }
    return result;
  }
  function modInv(n, m) {
    return modPow(n, m - 2n, m);
  }
  function decodeU(value) {
    const u = value.slice();
    u[u.length - 1] &= 127;
    let n = 0n;
    for (let i = u.length - 1; i >= 0; i--)
      n = n << 8n | BigInt(u[i]);
    return n;
  }
  function encodeU(x) {
    const out = new Uint8Array(FIELD_BYTES);
    let n = x;
    for (let i = 0; i < FIELD_BYTES; i++) {
      out[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    return out;
  }
  function elligator2(r) {
    const rq = mod2(r, Q);
    const v = mod2(-A * modInv(mod2(1n + Z * rq * rq, Q), Q), Q);
    const eps = modPow(mod2(v * v * v + A * v * v + v, Q), (Q - 1n) / 2n, Q);
    const x = mod2(eps * v - mod2(1n - eps, Q) * A * modInv(2n, Q), Q);
    return encodeU(x);
  }
  function calculateGenerator(prs, ci, sid) {
    const genHash = sha512(generatorString(prs, ci, sid)).slice(0, FIELD_BYTES);
    return elligator2(decodeU(genHash));
  }
  function scalarMultVfy(scalar, point, what) {
    let shared;
    try {
      shared = x25519.scalarMult(scalar, point);
    } catch {
      throw new CPaceError(`${what} encodes a low-order point`);
    }
    if (shared.every((b) => b === 0)) {
      throw new CPaceError(`${what} encodes a low-order point`);
    }
    return shared;
  }
  function constantTimeEqual(a, b) {
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
      diff |= a[i] ^ b[i];
    return diff === 0;
  }
  var CPace = class _CPace {
    constructor(role, scalar, sid, ada, adb, generator) {
      this.role = role;
      this.sid = sid;
      this.ada = ada;
      this.adb = adb;
      this.macKey = null;
      this.initiatorShare = null;
      this.responderShare = null;
      this.iskValue = null;
      this.scalar = scalar;
      this.publicShare = scalarMultVfy(scalar, generator, "generator");
    }
    /** Begin a CPace run, sampling a scalar and computing the public share. */
    static start(opts) {
      const scalar = opts.scalar ?? crypto.getRandomValues(new Uint8Array(FIELD_BYTES));
      const generator = calculateGenerator(opts.prs, opts.ci ?? new Uint8Array(0), opts.sid);
      return new _CPace(opts.role, scalar, opts.sid, opts.ada ?? new Uint8Array(0), opts.adb ?? new Uint8Array(0), generator);
    }
    /** Ingest the peer's public share, deriving the confirmation MAC key. */
    derive(peerShare) {
      if (!this.scalar) {
        throw new CPaceError("derive() may only be called once");
      }
      const scalar = this.scalar;
      this.scalar = null;
      if (peerShare.length !== SHARE_SIZE) {
        throw new CPaceError(`peer share must be ${SHARE_SIZE} bytes, got ${peerShare.length}`);
      }
      const shared = scalarMultVfy(scalar, peerShare, "peer share");
      if (this.role === "initiator") {
        this.initiatorShare = this.publicShare;
        this.responderShare = peerShare;
      } else {
        this.initiatorShare = peerShare;
        this.responderShare = this.publicShare;
      }
      const transcript = concat4(lvCat(this.initiatorShare, this.ada), lvCat(this.responderShare, this.adb));
      this.iskValue = sha512(concat4(lvCat(DSI_ISK, this.sid, shared), transcript));
      this.macKey = sha512(concat4(MAC_LABEL, this.sid, this.iskValue));
    }
    /** The 64-byte CPace intermediate session key (ISK). derive() must run first. */
    get isk() {
      if (!this.iskValue) {
        throw new CPaceError("derive() must be called before reading the ISK");
      }
      return this.iskValue;
    }
    /** This side's confirmation tag (Ta for the initiator, Tb for the responder). */
    tag() {
      return this.mac(true);
    }
    /** Whether peerTag matches the peer's expected confirmation tag. */
    verify(peerTag) {
      const expected = this.mac(false);
      if (constantTimeEqual(expected, this.mac(true)))
        return false;
      return constantTimeEqual(peerTag, expected);
    }
    mac(own) {
      if (!this.macKey || !this.initiatorShare || !this.responderShare) {
        throw new CPaceError("derive() must be called before confirmation tags");
      }
      const useInitiator = own === (this.role === "initiator");
      const share = useInitiator ? this.initiatorShare : this.responderShare;
      const ad = useInitiator ? this.ada : this.adb;
      return hmac(sha512, this.macKey, lvCat(share, ad));
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/pake/pin.js
  var PAIRING_CODE_DERIVE_LABEL = new TextEncoder().encode("sendspin-pairing-code-derive-v1");
  var PAIR_COMMIT_LABEL = new TextEncoder().encode("sendspin-pair-commit-v1");
  var NONCE_SIZE = 32;
  var DYNAMIC_CODE_DIGITS = 6;
  var QR_CODE_SIZE = 24;
  var STATIC_PIN_DIGITS = 8;
  var STATIC_PIN_RE = new RegExp(`^[0-9]{${STATIC_PIN_DIGITS}}$`);
  function isValidStaticPairingCode(pin) {
    return STATIC_PIN_RE.test(pin);
  }
  function generateNonce() {
    return crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
  }
  function commitNonce(nonce) {
    const input = new Uint8Array(PAIR_COMMIT_LABEL.length + nonce.length);
    input.set(PAIR_COMMIT_LABEL, 0);
    input.set(nonce, PAIR_COMMIT_LABEL.length);
    return sha256(input);
  }
  function pairingCodeDigest(handshakeHash, nonceA, nonceB) {
    const input = new Uint8Array(PAIRING_CODE_DERIVE_LABEL.length + handshakeHash.length + nonceA.length + nonceB.length);
    input.set(PAIRING_CODE_DERIVE_LABEL, 0);
    input.set(handshakeHash, PAIRING_CODE_DERIVE_LABEL.length);
    input.set(nonceA, PAIRING_CODE_DERIVE_LABEL.length + handshakeHash.length);
    input.set(nonceB, PAIRING_CODE_DERIVE_LABEL.length + handshakeHash.length + nonceA.length);
    return sha256(input);
  }
  function derivePairingCode(handshakeHash, nonceA, nonceB) {
    const digest = pairingCodeDigest(handshakeHash, nonceA, nonceB);
    let n = 0n;
    for (const b of digest)
      n = n << 8n | BigInt(b);
    const code = n % 10n ** BigInt(DYNAMIC_CODE_DIGITS);
    return code.toString().padStart(DYNAMIC_CODE_DIGITS, "0");
  }
  function deriveQrPairingCode(handshakeHash, nonceA, nonceB) {
    return pairingCodeDigest(handshakeHash, nonceA, nonceB).slice(0, QR_CODE_SIZE);
  }

  // node_modules/@sendspin/sendspin-js/dist/core/noise/pairing-token.js
  var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var KEY_SIZE = 32;
  function encodeBase32(bytes) {
    let bits = 0;
    let value = 0;
    let encoded = "";
    for (const byte of bytes) {
      value = value << 8 | byte;
      bits += 8;
      while (bits >= 5) {
        encoded += BASE32_ALPHABET[value >>> bits - 5 & 31];
        bits -= 5;
      }
      value &= (1 << bits) - 1;
    }
    if (bits > 0) {
      encoded += BASE32_ALPHABET[value << 5 - bits & 31];
    }
    return encoded;
  }
  function encodeToken(version, payload) {
    return `SP:${version}${encodeBase32(payload).replace(/2/g, "9")}`;
  }
  function encodePairingToken(clientId, pairingPsk) {
    const clientKey = base64urlDecode(clientId);
    if (clientKey.length !== KEY_SIZE) {
      throw new Error(`clientId must decode to ${KEY_SIZE} bytes`);
    }
    if (pairingPsk.length !== KEY_SIZE) {
      throw new Error(`pairingPsk must be ${KEY_SIZE} bytes`);
    }
    const payload = new Uint8Array(clientKey.length + pairingPsk.length);
    payload.set(clientKey);
    payload.set(pairingPsk, clientKey.length);
    return encodeToken("0", payload);
  }
  function encodeQrCodeToken(code) {
    return encodeToken("1", code);
  }

  // node_modules/@sendspin/sendspin-js/dist/core/pairing.js
  var utf83 = (s) => new TextEncoder().encode(s);
  function concatBytes4(...parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  var PAKE_SID_LABEL = "sendspin-pair-pake-v1";
  var PSK_WRAP_LABEL = utf83("sendspin-pair-psk-wrap-v1");
  var NONCE_WRAP_LABEL = utf83("sendspin-pair-nonce-wrap-v1");
  var CPACE_AD_A = utf83("server");
  var CPACE_AD_B = utf83("client");
  var ATTEMPT_TIMEOUT_MS = 12e4;
  var WINDOW_LIFETIME_MS = 3e5;
  var WINDOW_FAILURE_LIMIT = 5;
  var ROUND_LIMIT = 20;
  var ROUNDS_STORAGE_KEY = "sendspin-pair-failures";
  var ROUNDS_FIELD = "dynamic_pin";
  var CODE_METHODS = [
    "dynamic_pairing_code",
    "static_pairing_code"
  ];
  function withLocations(locations) {
    return locations?.length ? { locations } : {};
  }
  function readLanguages(value) {
    if (!Array.isArray(value) || value.length === 0)
      return void 0;
    return value.every((tag) => typeof tag === "string" && tag !== "") ? value : void 0;
  }
  var PairingManager = class {
    constructor(deps) {
      this.deps = deps;
      this.pendingPsk = null;
      this.phase = "idle";
      this.method = null;
      this.cpace = null;
      this.nonceB = null;
      this.attemptTimer = null;
      this.windowTimer = null;
      this.windowOpen = false;
      this.windowBound = false;
      this.windowFailures = 0;
      this.currentSid = null;
      this.pairingActivateCount = 0;
      this.attemptIndex = 0;
      this.format = null;
      this.code = null;
      this.prs = null;
      this.round = 0;
      this.discardStray = false;
      if (deps.staticPairingCode !== void 0 && !isValidStaticPairingCode(deps.staticPairingCode)) {
        throw new Error("staticPairingCode must be exactly 8 decimal digits");
      }
      const formats = deps.pairingCodeFormats;
      if (formats?.length === 0) {
        throw new Error("pairingCodeFormats must not be empty");
      }
      if (formats?.includes("qr_code") && !(deps.pairingCodeOutChannels ?? ["display"]).includes("display")) {
        throw new Error("qr_code in pairingCodeFormats needs display in pairingCodeOutChannels");
      }
      this.rounds = this.loadRounds();
    }
    /** The pairing methods to advertise in client/hello. */
    supportedPairMethods() {
      const methods = {
        pairing_psk: withLocations(this.deps.pairingPskLocations)
      };
      if (this.deps.staticPairingCode !== void 0) {
        methods.static_pairing_code = withLocations(this.deps.staticPairingCodeLocations);
      }
      if (this.deps.onPairingCode) {
        methods.dynamic_pairing_code = {
          out_channels: this.deps.pairingCodeOutChannels ?? ["display"],
          formats: this.deps.pairingCodeFormats ?? ["digits"]
        };
      }
      return methods;
    }
    /**
     * Whether dynamic pairing code attempts are held back at the round limit.
     * The method stays offered, and attempts wait for releasePairingHold().
     */
    isRoundLimitReached() {
      return this.rounds >= ROUND_LIMIT;
    }
    /**
     * Operator action that releases dynamic pairing code attempts held back at
     * the round limit and resets the round count. Has no effect while an
     * attempt is running.
     */
    releasePairingHold() {
      if (!this.isRoundLimitReached())
        return;
      if (this.phase !== "idle" && this.phase !== "held-back")
        return;
      this.resetRounds();
      if (this.phase === "held-back" && !this.isHeldBack())
        this.startAttempt();
    }
    /**
     * Operator gesture that opens the pairing window for about 5 minutes. If an
     * attempt is already waiting on it the attempt starts immediately.
     */
    openPairingWindow() {
      if (this.windowTimer)
        clearTimeout(this.windowTimer);
      this.windowOpen = true;
      this.windowFailures = 0;
      this.windowTimer = setTimeout(() => this.closeWindow(), WINDOW_LIFETIME_MS);
      if (this.phase === "held-back" && !this.isHeldBack())
        this.startAttempt();
    }
    closeWindow() {
      this.windowOpen = false;
      this.windowBound = false;
      this.windowFailures = 0;
      if (this.windowTimer)
        clearTimeout(this.windowTimer);
      this.windowTimer = null;
    }
    /**
     * Operator cancellation: close the pairing window and cancel any attempt
     * with pair/abort user_cancelled.
     */
    cancelPairing() {
      this.closeWindow();
      if (this.phase === "idle")
        return;
      this.abort("user_cancelled");
    }
    onServerHello(languages) {
      this.languages = readLanguages(languages);
    }
    /** Called for every admissible server/activate. */
    onActivate(activities, pairing) {
      this.discardStray = false;
      const isPairing = activities.includes("pairing");
      if (!isPairing) {
        this.abandonAttempt("server_cancelled");
        return;
      }
      this.abandonAttempt("superseded");
      this.pairingActivateCount += 1;
      this.attemptIndex = this.pairingActivateCount;
      const { method, format } = pairing;
      this.method = method;
      if (method === "dynamic_pairing_code")
        this.format = format;
      if (this.isHeldBack()) {
        this.phase = "held-back";
        this.deps.sendControl({
          type: "client/pair-pending",
          payload: { pairing_index: this.attemptIndex }
        });
        this.deps.onEvent?.("pending");
        return;
      }
      this.startAttempt();
    }
    /** Called for a pairing server/activate whose method or format is not admissible. */
    onRefusedActivate() {
      this.abandonAttempt("superseded");
      this.pairingActivateCount += 1;
      this.abort("method_not_supported");
    }
    /**
     * Whether the selected method withholds client/pair-init: static pairing
     * code until a window is open, dynamic pairing code at the round limit.
     */
    isHeldBack() {
      if (this.method === "static_pairing_code")
        return !this.windowOpen;
      return this.method === "dynamic_pairing_code" && this.isRoundLimitReached();
    }
    /** server/pair-init: begins a round, carrying the server's nonce in the first. */
    onPairInit(payload) {
      if (this.phase === "idle")
        return this.strayMessage();
      if (this.phase !== "await-init" || this.method !== "dynamic_pairing_code") {
        return this.fail();
      }
      const h = this.deps.handshakeHash();
      if (this.round === 0) {
        const nonceA = this.decode(payload.nonce_A, NONCE_SIZE);
        if (!nonceA)
          return this.fail();
        if (this.format === "qr_code") {
          this.prs = deriveQrPairingCode(h, nonceA, this.nonceB);
          this.code = encodeQrCodeToken(this.prs);
        } else {
          this.code = derivePairingCode(h, nonceA, this.nonceB);
          this.prs = utf83(this.code);
        }
      } else if (payload.nonce_A !== void 0) {
        return this.fail();
      }
      this.round += 1;
      this.rounds += 1;
      this.saveRounds();
      this.currentSid = this.sid(h, this.attemptIndex, this.round);
      this.cpace = CPace.start({
        role: "responder",
        prs: this.prs,
        sid: this.currentSid,
        ada: CPACE_AD_A,
        adb: CPACE_AD_B
      });
      this.phase = "await-auth";
      this.deps.onPairingCode?.(this.code, this.languages, this.format);
    }
    /** server/pair-auth: the server's CPace public share (both PIN methods). */
    onPairAuth(payload) {
      if (this.phase === "idle")
        return this.strayMessage();
      if (this.phase !== "await-auth" || !this.cpace)
        return this.fail();
      const peerShare = this.decode(payload.pake_msg_1, SHARE_SIZE);
      if (!peerShare)
        return this.fail();
      this.deps.sendControl({
        type: "client/pair-auth",
        payload: { pake_msg_2: base64urlEncode(this.cpace.publicShare) }
      });
      try {
        this.cpace.derive(peerShare);
      } catch (e) {
        if (e instanceof CPaceError)
          return this.fail();
        throw e;
      }
      this.phase = "await-confirm";
    }
    /** server/pair-confirm: verify the server's tag, then confirm and finalize. */
    onPairConfirm(payload) {
      if (this.phase === "idle")
        return this.strayMessage();
      if (this.phase !== "await-confirm" || !this.cpace)
        return this.fail();
      const serverKc = this.decode(payload.server_kc, TAG_SIZE);
      if (!serverKc)
        return this.fail();
      if (!this.cpace.verify(serverKc)) {
        if (this.method === "dynamic_pairing_code" && !this.isRoundLimitReached()) {
          return this.retry();
        }
        if (this.method === "static_pairing_code") {
          this.windowFailures += 1;
          if (this.windowFailures >= WINDOW_FAILURE_LIMIT)
            this.closeWindow();
        }
        return this.abort("pairing_code_mismatch");
      }
      if (this.method === "dynamic_pairing_code")
        this.resetRounds();
      const confirm = {
        client_kc: base64urlEncode(this.cpace.tag())
      };
      if (this.method === "dynamic_pairing_code") {
        confirm.wrapped_nonce_B = base64urlEncode(this.wrap(NONCE_WRAP_LABEL, this.nonceB));
      }
      this.deps.sendControl({ type: "client/pair-confirm", payload: confirm });
      this.phase = "await-finalize";
      this.sendFinalize();
    }
    onPairFinalize() {
      if (this.phase === "idle")
        return this.strayMessage();
      if (this.phase !== "await-finalize" || !this.pendingPsk)
        return this.fail();
      this.deps.pskStore.replaceLongTerm(this.pendingPsk, this.deps.serverId());
      this.clearAttempt();
      this.closeWindow();
      this.deps.onEvent?.("finalized");
    }
    /**
     * Inbound pair/abort from the server: discard the attempt. The sender closes
     * the connection when needed, so the receiver keeps it open. A pair/abort for
     * an already-ended attempt has no effect.
     */
    onAbort(reason) {
      if (this.phase === "idle" && !this.pendingPsk)
        return;
      this.clearAttempt();
      this.deps.onEvent?.("aborted", reason);
    }
    /** Close a pairing window bound to the dropped connection, then reset. */
    onConnectionClosed() {
      if (this.windowBound)
        this.closeWindow();
      this.reset();
    }
    /** Discard any in-flight pairing state and the activate counter (on handshake/close). */
    reset() {
      this.clearAttempt();
      this.discardStray = false;
      this.pairingActivateCount = 0;
      this.attemptIndex = 0;
    }
    /** Send client/pair-init. A static attempt binds the window to this connection. */
    startAttempt() {
      if (this.method === "static_pairing_code")
        this.windowBound = true;
      this.armAttemptTimer();
      if (this.method === "pairing_psk") {
        this.deps.sendControl({
          type: "client/pair-init",
          payload: { pairing_index: this.attemptIndex }
        });
        this.phase = "await-finalize";
        this.sendFinalize();
        this.deps.onEvent?.("started");
        return;
      }
      this.deps.onEvent?.("started");
      if (this.method === "dynamic_pairing_code") {
        this.nonceB = generateNonce();
        this.phase = "await-init";
        this.deps.sendControl({
          type: "client/pair-init",
          payload: {
            pairing_index: this.attemptIndex,
            commit_B: base64urlEncode(commitNonce(this.nonceB))
          }
        });
        return;
      }
      const h = this.deps.handshakeHash();
      this.currentSid = this.sid(h, this.attemptIndex, 1);
      this.cpace = CPace.start({
        role: "responder",
        prs: new TextEncoder().encode(this.deps.staticPairingCode),
        sid: this.currentSid,
        ada: CPACE_AD_A,
        adb: CPACE_AD_B
      });
      this.phase = "await-auth";
      this.deps.sendControl({
        type: "client/pair-init",
        payload: { pairing_index: this.attemptIndex }
      });
    }
    /** Ask for another round, keeping the attempt, its code and its timer. */
    retry() {
      this.cpace = null;
      this.currentSid = null;
      this.phase = "await-init";
      this.deps.sendControl({ type: "client/pair-retry", payload: {} });
    }
    /** Mint the long-term PSK and send client/pair-finalize. */
    sendFinalize() {
      const psk = crypto.getRandomValues(new Uint8Array(32));
      this.pendingPsk = psk;
      if (this.cpace && this.currentSid) {
        this.deps.sendControl({
          type: "client/pair-finalize",
          payload: {
            wrapped_psk: base64urlEncode(this.wrap(PSK_WRAP_LABEL, psk))
          }
        });
        return;
      }
      this.deps.sendControl({
        type: "client/pair-finalize",
        payload: { long_term_psk: base64urlEncode(psk) }
      });
    }
    /** Seal value under a key derived from the CPace output and sid. */
    wrap(label, value) {
      const kWrap = sha256(concatBytes4(label, this.currentSid, this.cpace.isk));
      return this.deps.aeadSeal(kWrap, value);
    }
    sid(handshakeHash, index, round) {
      const label = utf83(PAKE_SID_LABEL);
      const offset = label.length + handshakeHash.length;
      const sid = new Uint8Array(offset + 8);
      sid.set(label, 0);
      sid.set(handshakeHash, label.length);
      const view = new DataView(sid.buffer);
      view.setUint32(offset, index, false);
      view.setUint32(offset + 4, round, false);
      return sid;
    }
    armAttemptTimer() {
      this.attemptTimer = setTimeout(() => this.abort("attempt_timeout"), ATTEMPT_TIMEOUT_MS);
    }
    /**
     * Send pair/abort with reason and discard state. The connection stays open
     * for a retry. Only concurrent_attempt closes it.
     */
    abort(reason) {
      this.clearAttempt();
      this.discardStray = true;
      this.deps.sendControl({ type: "pair/abort", payload: { reason } });
      this.deps.onEvent?.("aborted", reason);
      if (reason === "concurrent_attempt")
        this.deps.close();
    }
    /** Protocol violation or malformed field: fail closed without an abort reason. */
    fail() {
      this.clearAttempt();
      this.deps.close();
    }
    /**
     * A pairing message with no attempt running. Messages still in flight after
     * the client's own pair/abort are discarded, anything else is out of sequence.
     */
    strayMessage() {
      if (!this.discardStray)
        this.fail();
    }
    clearAttempt() {
      if (this.attemptTimer)
        clearTimeout(this.attemptTimer);
      this.attemptTimer = null;
      if (this.method && CODE_METHODS.includes(this.method)) {
        this.deps.onPairingCode?.(null);
      }
      this.pendingPsk = null;
      this.phase = "idle";
      this.method = null;
      this.cpace = null;
      this.currentSid = null;
      this.nonceB = null;
      this.format = null;
      this.code = null;
      this.prs = null;
      this.round = 0;
    }
    /**
     * End an attempt the server walked away from, without sending pair/abort.
     * The event lets the app drop any "waiting for gesture" UI, which a silent
     * cancel would otherwise leave up (the server's pair/abort is only a SHOULD).
     */
    abandonAttempt(detail) {
      if (this.phase === "idle" && !this.pendingPsk)
        return;
      this.clearAttempt();
      this.deps.onEvent?.("aborted", detail);
    }
    decode(value, size) {
      if (typeof value !== "string")
        return null;
      try {
        const raw = base64urlDecode(value);
        return raw.length === size ? raw : null;
      } catch {
        return null;
      }
    }
    loadRounds() {
      try {
        const raw = this.deps.storage?.getItem(ROUNDS_STORAGE_KEY);
        if (!raw)
          return 0;
        const stored = JSON.parse(raw);
        return stored[ROUNDS_FIELD] ?? 0;
      } catch {
        return 0;
      }
    }
    saveRounds() {
      this.deps.storage?.setItem(ROUNDS_STORAGE_KEY, JSON.stringify({ [ROUNDS_FIELD]: this.rounds }));
    }
    resetRounds() {
      this.rounds = 0;
      this.saveRounds();
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/core/application-roles.js
  var ROLE_ID = /^_[^@]+@[^@]+$/;
  var MIN_BINARY_ID = 192;
  var MAX_BINARY_ID = 255;
  var familyOf = (id) => id.split("@")[0];
  function validate(roles) {
    const ids = /* @__PURE__ */ new Set();
    const binaryOwners = /* @__PURE__ */ new Map();
    for (const role of roles) {
      if (!ROLE_ID.test(role.id)) {
        throw new Error(`Application role id ${JSON.stringify(role.id)} must start with "_" and end in "@<version>"`);
      }
      if (ids.has(role.id)) {
        throw new Error(`Application role ${role.id} is listed twice`);
      }
      ids.add(role.id);
      const family = familyOf(role.id);
      for (const id of role.binaryMessageIds ?? []) {
        if (!Number.isInteger(id) || id < MIN_BINARY_ID || id > MAX_BINARY_ID) {
          throw new RangeError(`Application role ${role.id} binary message ID ${id} is outside ${MIN_BINARY_ID}-${MAX_BINARY_ID}`);
        }
        const owner = binaryOwners.get(id);
        if (owner !== void 0 && owner !== family) {
          throw new Error(`Binary message ID ${id} is claimed by both ${owner} and ${family}`);
        }
        binaryOwners.set(id, family);
      }
    }
  }
  var ApplicationRoles = class {
    constructor(roles, deps) {
      this.roles = roles;
      this.deps = deps;
      this.active = /* @__PURE__ */ new Map();
      this.serverHello = {};
      this.connection = 0;
      validate(roles);
    }
    get supportedRoles() {
      return this.roles.map((role) => role.id);
    }
    get helloSupport() {
      return Object.fromEntries(this.roles.filter((role) => role.support !== void 0).map((role) => [`${role.id}_support`, role.support]));
    }
    /** Returns whether a role was added. */
    applyActivation(activeRoles) {
      const connection = this.connection;
      for (const [role, activation] of this.active) {
        if (activeRoles.has(role.id))
          continue;
        this.active.delete(role);
        if (activation.clientStreamOpen) {
          this.deps.sendControl(clientStreamEnd(role), role.id);
        }
        call(role, "onDeactivate", () => role.onDeactivate?.());
        if (this.connection !== connection)
          return false;
      }
      let added = false;
      for (const role of this.roles) {
        if (!activeRoles.has(role.id) || this.active.has(role))
          continue;
        const activation = { streamActive: false, clientStreamOpen: false };
        this.active.set(role, activation);
        added = true;
        const session = this.createSession(role, activation);
        call(role, "onActivate", () => role.onActivate?.(session));
        if (this.connection !== connection)
          return false;
      }
      return added;
    }
    /** Deactivate every role without messaging the server, which is gone. */
    deactivateAll() {
      this.connection++;
      const roles = [...this.active.keys()];
      this.active.clear();
      for (const role of roles) {
        call(role, "onDeactivate", () => role.onDeactivate?.());
      }
    }
    clientStateObjects() {
      const objects = {};
      for (const role of this.active.keys()) {
        if (!role.getState)
          continue;
        const state = call(role, "getState", () => role.getState?.());
        if (state !== void 0)
          objects[familyOf(role.id)] = state;
      }
      return objects;
    }
    handleMessage(msg) {
      const payload = msg.payload ?? {};
      if (msg.type === "server/hello") {
        this.serverHello = payload;
        return;
      }
      const serverTransmittedUs = payload.server_transmitted;
      const roles = Array.isArray(payload.roles) ? payload.roles : void 0;
      for (const [role, activation] of this.active) {
        const family = familyOf(role.id);
        switch (msg.type) {
          case "server/state":
            if (family in payload) {
              call(role, "onServerState", () => role.onServerState?.(payload[family]));
            }
            break;
          case "server/command":
            if (family in payload) {
              call(role, "onServerCommand", () => role.onServerCommand?.(payload[family]));
            }
            break;
          case "stream/start":
            if (family in payload) {
              const isUpdate = activation.streamActive;
              activation.streamActive = true;
              call(role, "onStreamStart", () => role.onStreamStart?.(payload[family], isUpdate, serverTransmittedUs));
            }
            break;
          case "stream/clear":
            if (roles?.includes(family)) {
              call(role, "onStreamClear", () => role.onStreamClear?.(serverTransmittedUs));
            }
            break;
          case "stream/end":
            if (roles ? roles.includes(family) : activation.streamActive) {
              activation.streamActive = false;
              call(role, "onStreamEnd", () => role.onStreamEnd?.());
            }
            break;
        }
      }
    }
    /** Returns false for IDs below the application range, which the caller handles. */
    handleBinary(bytes, receivedAtUs) {
      const id = bytes[0];
      if (id < MIN_BINARY_ID)
        return false;
      for (const role of this.active.keys()) {
        if (!role.binaryMessageIds?.includes(id))
          continue;
        call(role, "onBinaryMessage", () => role.onBinaryMessage?.(id, bytes.subarray(1), receivedAtUs));
        break;
      }
      return true;
    }
    createSession(role, activation) {
      const family = familyOf(role.id);
      const deps = this.deps;
      const isActive = () => this.active.get(role) === activation;
      return {
        serverSupport: this.serverHello[`${role.id}_support`],
        sendCommand(command) {
          if (!isActive())
            return;
          deps.sendControl({ type: "client/command", payload: { [family]: command } }, role.id);
        },
        sendState() {
          if (isActive())
            deps.sendState();
        },
        sendBinaryMessage(id, data) {
          if (!role.binaryMessageIds?.includes(id)) {
            throw new RangeError(`Binary message ID ${id} is not assigned to ${role.id}`);
          }
          if (isActive())
            deps.sendBinary(id, data, role.id);
        },
        startClientStream(config) {
          if (!isActive())
            return;
          activation.clientStreamOpen = true;
          deps.sendControl({ type: "client-stream/start", payload: { [family]: config } }, role.id);
        },
        endClientStream() {
          if (!isActive())
            return;
          activation.clientStreamOpen = false;
          deps.sendControl(clientStreamEnd(role), role.id);
        },
        computeClientTime: (serverTimeUs) => deps.computeClientTime(serverTimeUs),
        computeServerTime: (clientTimeUs) => deps.computeServerTime(clientTimeUs)
      };
    }
  };
  function call(role, hook, fn) {
    try {
      return fn();
    } catch (e) {
      console.error(`Sendspin: application role ${role.id} ${hook} threw`, e);
      return void 0;
    }
  }
  function clientStreamEnd(role) {
    return {
      type: "client-stream/end",
      payload: { roles: [familyOf(role.id)] }
    };
  }

  // node_modules/@sendspin/sendspin-js/dist/core/core.js
  var SendspinCore = class {
    constructor(config) {
      this.handshakeInfo = null;
      this.applicationRoles = new ApplicationRoles(config.applicationRoles ?? [], {
        sendControl: (msg, role) => this.transport.sendControl(msg, role),
        sendBinary: (type, data, role) => this.transport.sendBinary(type, data, role),
        sendState: () => this.protocolHandler.sendStateUpdate(),
        computeClientTime: (us) => this.timeFilter.computeClientTime(us),
        computeServerTime: (us) => this.timeFilter.computeServerTime(us)
      });
      if (!config.storage) {
        console.warn("Sendspin: no storage provided, so the identity, Pairing PSK, paired servers and pairing round count are kept in memory only and reset on reload.");
      }
      this.identity = Identity.loadOrCreate(config.storage ?? null);
      const clientName = config.clientName ?? `Sendspin JS Client (${this.identity.clientId.slice(0, 6)})`;
      this.config = { ...config, clientName };
      this.delayStore = new StaticDelayStore(config.storage ?? null);
      const persisted = this.delayStore.load();
      const initialDelay = config.syncDelay ?? persisted ?? config.defaultSyncDelay ?? 0;
      this._syncDelayMs = clampSyncDelayMs(initialDelay);
      this.timeFilter = new SendspinTimeFilter();
      this.stateManager = new StateManager(config.onStateChange, new VolumeStore(config.storage ?? null));
      this.decoder = new SendspinDecoder((chunk) => this._onAudioData?.(chunk), () => this.stateManager.streamGeneration);
      this.wsManager = new WebSocketManager(config.reconnect);
      this.pskStore = new PskStore(config.storage ?? null);
      for (const r of config.longTermPsks ?? []) {
        if (!r.serverId)
          throw new Error("longTermPsks entries need a serverId");
        this.pskStore.addLongTerm(base64urlDecode(r.psk), r.serverId);
      }
      this.pskStore.getOrCreatePairingPsk();
      this.transport = new SendspinTransport(this.wsManager, {
        identity: this.identity,
        pskStore: this.pskStore,
        suiteId: config.suite ?? "chacha",
        unpairedAccess: config.unpairedAccess ?? true,
        pairMethods: () => this.pairing.supportedPairMethods()
      }, {
        onHandshakeComplete: (info) => {
          const isRehandshake = this.handshakeInfo !== null;
          this.handshakeInfo = info;
          this.pairing.reset();
          this.protocolHandler.resetActivation(isRehandshake);
        },
        onControlMessage: (msg, receivedAtUs) => this.routeControl(msg, receivedAtUs),
        onBinaryMessage: (bytes, receivedAtUs) => {
          if (!this.applicationRoles.handleBinary(bytes, receivedAtUs)) {
            this.handleBinaryMessage(bytes.buffer);
          }
        },
        onActivateRefused: (activeRoles) => {
          this.protocolHandler.resumeActivation(activeRoles);
          this.pairing.onRefusedActivate();
        }
      });
      this.pairing = new PairingManager({
        sendControl: (m) => this.transport.sendControl(m),
        close: () => this.transport.close(),
        pskStore: this.pskStore,
        serverId: () => this.handshakeInfo?.serverId ?? "",
        handshakeHash: () => this.transport.handshakeHash,
        aeadSeal: (key, plaintext) => SUITES[config.suite ?? "chacha"].aeadEncrypt(key, 0n, new Uint8Array(0), plaintext),
        storage: config.storage ?? null,
        onPairingCode: config.onPairingCode ?? null,
        pairingCodeOutChannels: config.pairingCodeOutChannels,
        pairingCodeFormats: config.pairingCodeFormats,
        staticPairingCode: config.staticPairingCode,
        staticPairingCodeLocations: config.staticPairingCodeLocations,
        pairingPskLocations: config.pairingPskLocations,
        onEvent: (e, d) => this.config.onPairing?.(e, d)
      });
      const helloContext = {
        pairMethods: () => this.pairing.supportedPairMethods(),
        unpairedAccess: config.unpairedAccess ?? true
      };
      this.protocolHandler = new ProtocolHandler(
        this.transport,
        helloContext,
        this,
        // this class implements StreamHandler
        this.stateManager,
        this.timeFilter,
        {
          clientName,
          productName: config.productName,
          manufacturer: config.manufacturer,
          softwareVersion: config.softwareVersion,
          codecs: config.codecs,
          bufferCapacity: config.bufferCapacity,
          requiredLeadTimeMs: config.requiredLeadTimeMs,
          minBufferMs: config.minBufferMs,
          useHardwareVolume: config.useHardwareVolume,
          onVolumeCommand: config.onVolumeCommand,
          onDelayCommand: config.onDelayCommand,
          getExternalVolume: config.getExternalVolume,
          applicationRoles: this.applicationRoles
        }
      );
    }
    // Route decrypted control messages from the transport. Pairing handles its
    // own pair messages and also sees every server/hello and server/activate.
    routeControl(msg, receivedAtUs) {
      if (msg.type === "server/hello") {
        this.pairing.onServerHello((msg.payload ?? {}).languages);
      }
      if (msg.type === "server/activate") {
        const p = msg.payload ?? {};
        this.protocolHandler.handleServerMessage(msg, receivedAtUs);
        this.pairing.onActivate(p.activities ?? [], p.pairing);
        return;
      }
      if (msg.type === "server/pair-init") {
        return this.pairing.onPairInit(msg.payload ?? {});
      }
      if (msg.type === "server/pair-auth") {
        return this.pairing.onPairAuth(msg.payload ?? {});
      }
      if (msg.type === "server/pair-confirm") {
        return this.pairing.onPairConfirm(msg.payload ?? {});
      }
      if (msg.type === "server/pair-finalize")
        return this.pairing.onPairFinalize();
      if (msg.type === "pair/abort") {
        return this.pairing.onAbort((msg.payload ?? {}).reason ?? "");
      }
      this.protocolHandler.handleServerMessage(msg, receivedAtUs);
      this.applicationRoles.handleMessage(msg);
    }
    onTransportClose() {
      this.resetSession();
      console.log("Sendspin: Connection closed");
      this._onConnectionClose?.();
    }
    resetSession() {
      this.transport.onSocketClosed();
      this.handshakeInfo = null;
      this.protocolHandler.stopTimeSync();
      this.protocolHandler.resetActivation();
      this.pairing.onConnectionClosed();
      this.stateManager.clearConnectionState();
      this.stateManager.clearStateUpdateInterval();
    }
    // ========================================
    // StreamHandler implementation
    // (called by ProtocolHandler)
    // ========================================
    handleBinaryMessage(data) {
      if (new Uint8Array(data)[0] !== 4)
        return;
      if (data.byteLength < 13) {
        console.warn("Sendspin: closing the connection due to an invalid audio message shorter than 13 bytes");
        this.transport.close();
        return;
      }
      const format = this.stateManager.currentStreamFormat;
      if (!format) {
        console.warn("Sendspin: Received audio chunk but no stream format set");
        return;
      }
      const generation = this.stateManager.streamGeneration;
      this.decoder.handleBinaryMessage(data, format, generation);
    }
    handleStreamStart(format, isFormatUpdate) {
      if (!isFormatUpdate) {
        this.discardPendingAudio();
      }
      this._onStreamStart?.(format, isFormatUpdate);
    }
    handleStreamClear() {
      this.discardPendingAudio();
      this._onStreamClear?.();
    }
    handleStreamEnd() {
      this.discardPendingAudio();
      this._onStreamEnd?.();
    }
    // A new generation makes the decoder drop decodes still in flight.
    discardPendingAudio() {
      this.stateManager.resetStreamAnchors();
      this.decoder.clearState();
    }
    handleVolumeUpdate() {
      this._onVolumeUpdate?.();
    }
    applyDelay(delayMs) {
      this._syncDelayMs = clampSyncDelayMs(delayMs);
      this.delayStore.save(this._syncDelayMs);
      this._onSyncDelayChange?.(this._syncDelayMs);
    }
    handleSyncDelayChange(delayMs) {
      this.applyDelay(delayMs);
    }
    getSyncDelayMs() {
      return this._syncDelayMs;
    }
    // ========================================
    // Event registration
    // ========================================
    set onAudioData(cb) {
      this._onAudioData = cb;
    }
    set onStreamStart(cb) {
      this._onStreamStart = cb;
    }
    set onStreamClear(cb) {
      this._onStreamClear = cb;
    }
    set onStreamEnd(cb) {
      this._onStreamEnd = cb;
    }
    set onVolumeUpdate(cb) {
      this._onVolumeUpdate = cb;
    }
    set onSyncDelayChange(cb) {
      this._onSyncDelayChange = cb;
    }
    set onConnectionOpen(cb) {
      this._onConnectionOpen = cb;
    }
    set onConnectionClose(cb) {
      this._onConnectionClose = cb;
    }
    // ========================================
    // Connection
    // ========================================
    async connect() {
      if (this.isConnected)
        this.resetSession();
      const onOpen = () => {
        this.timeFilter.reset();
        this._onConnectionOpen?.();
        this.transport.start();
      };
      const onMessage = (event) => {
        this.transport.handleRaw(event);
      };
      const onError = (error) => {
        console.error("Sendspin: WebSocket error", error);
      };
      const onClose = () => this.onTransportClose();
      if (this.config.webSocket) {
        await this.wsManager.adopt(this.config.webSocket, onOpen, onMessage, onError, onClose);
      } else {
        if (!this.config.url) {
          throw new Error("SendspinCore requires either url or webSocket to be provided.");
        }
        if (!/^wss?:\/\//i.test(this.config.url)) {
          throw new Error(`The url option must use ws:// or wss://, got ${JSON.stringify(this.config.url)}.`);
        }
        await this.wsManager.connect(this.config.url, onOpen, onMessage, onError, onClose);
      }
    }
    /**
     * Reset playback-related state (isPlaying, currentStreamFormat) without
     * tearing down the connection. Intended for transport-loss cleanup after
     * any buffered audio has finished draining.
     */
    resetPlaybackState() {
      this.stateManager.isPlaying = false;
      this.stateManager.currentStreamFormat = null;
    }
    disconnect(reason = "user_request") {
      if (this.transport.ready) {
        this.protocolHandler.sendGoodbye(reason);
      }
      this.protocolHandler.stopTimeSync();
      this.stateManager.clearAllIntervals();
      this.wsManager.disconnect();
      this.resetSession();
      this.decoder.close();
      this.timeFilter.reset();
      this.stateManager.reset();
    }
    /** Leave the current group. Does nothing until the server has activated the connection. */
    leaveGroup() {
      this.protocolHandler.sendLeave();
    }
    // ========================================
    // Volume / Mute
    // ========================================
    setVolume(volume) {
      if (Number.isNaN(volume))
        throw new RangeError("volume must be a number");
      this.stateManager.volume = volume;
      this._onVolumeUpdate?.();
      this.protocolHandler.sendStateUpdate();
    }
    setMuted(muted) {
      this.stateManager.muted = muted;
      this._onVolumeUpdate?.();
      this.protocolHandler.sendStateUpdate();
    }
    // ========================================
    // Sync delay
    // ========================================
    setSyncDelay(delayMs) {
      this.applyDelay(delayMs);
      this.protocolHandler.sendStateUpdate();
    }
    // ========================================
    // Buffer timing
    // ========================================
    setRequiredLeadTimeMs(leadTimeMs) {
      this.protocolHandler.setRequiredLeadTimeMs(leadTimeMs);
    }
    setMinBufferMs(minBufferMs) {
      this.protocolHandler.setMinBufferMs(minBufferMs);
    }
    // ========================================
    // Controller commands
    // ========================================
    sendCommand(command, params) {
      const supportedCommands = this.stateManager.serverState.controller?.supported_commands;
      if (!supportedCommands) {
        throw new Error(`Command '${command}' cannot be sent before the server reports its controller state`);
      }
      if (!supportedCommands.includes(command)) {
        throw new Error(`Command '${command}' is not supported by the server. Supported commands: ${supportedCommands.join(", ")}`);
      }
      if (command === "volume" && Number.isNaN(params.volume)) {
        throw new RangeError("volume must be a number");
      }
      if (command === "seek" && !Number.isFinite(params.position_ms)) {
        throw new RangeError("position_ms must be a finite number");
      }
      if (command === "seek_relative" && !Number.isFinite(params.offset_ms)) {
        throw new RangeError("offset_ms must be a finite number");
      }
      this.protocolHandler.sendCommand(command, params);
    }
    // ========================================
    // State getters
    // ========================================
    get isPlaying() {
      return this.stateManager.isPlaying;
    }
    get volume() {
      return this.stateManager.volume;
    }
    get muted() {
      return this.stateManager.muted;
    }
    get playerState() {
      return this.stateManager.playerState;
    }
    get currentFormat() {
      return this.stateManager.currentStreamFormat;
    }
    get isConnected() {
      return this.wsManager.isConnected();
    }
    // ========================================
    // Identity / pairing
    // ========================================
    get clientId() {
      return this.identity.clientId;
    }
    get pairingToken() {
      return encodePairingToken(this.clientId, this.pskStore.getOrCreatePairingPsk());
    }
    rotatePairingPsk() {
      this.pskStore.rotatePairingPsk();
      return this.pairingToken;
    }
    /**
     * Operator gesture that opens the pairing window for about 5 minutes. Static
     * pairing code attempts need an open window.
     */
    openPairingWindow() {
      this.pairing.openPairingWindow();
    }
    /** Close the pairing window and cancel an in-progress attempt with pair/abort user_cancelled. */
    cancelPairing() {
      this.pairing.cancelPairing();
    }
    /** Operator action that releases dynamic pairing code attempts held back at the round limit. */
    releasePairingHold() {
      this.pairing.releasePairingHold();
    }
    /** Whether dynamic pairing code attempts are held back at the 20-round limit. */
    isRoundLimitReached() {
      return this.pairing.isRoundLimitReached();
    }
    get timeSyncInfo() {
      return {
        synced: this.timeFilter.is_synchronized,
        offset: Math.round(this.timeFilter.offset / 1e3),
        error: Math.round(this.timeFilter.error / 1e3)
      };
    }
    getCurrentServerTimeUs() {
      return this.timeFilter.computeServerTime(Math.floor(performance.now() * 1e3));
    }
    get trackProgress() {
      const metadata = this.stateManager.serverState.metadata;
      if (!metadata?.progress) {
        return null;
      }
      const serverTimeUs = this.getCurrentServerTimeUs();
      const elapsedUs = serverTimeUs - metadata.timestamp;
      const positionMs = metadata.progress.track_progress + elapsedUs * metadata.progress.playback_speed / 1e6;
      const trackDuration = metadata.progress.track_duration;
      return {
        // track_duration 0 means unbounded (live radio), so floor at 0 only.
        positionMs: trackDuration === 0 ? Math.max(0, positionMs) : Math.max(0, Math.min(positionMs, trackDuration)),
        durationMs: trackDuration,
        playbackSpeed: metadata.progress.playback_speed / 1e3
      };
    }
    // ========================================
    // Internal accessors (for SendspinPlayer)
    // ========================================
    /** @internal */
    get _stateManager() {
      return this.stateManager;
    }
    /** @internal */
    get _timeFilter() {
      return this.timeFilter;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/audio/clock-source.js
  var OUTPUT_TIMESTAMP_MAX_FRESHNESS_MS = 250;
  var OUTPUT_TIMESTAMP_MIN_SAMPLE_INTERVAL_MS = 40;
  var OUTPUT_TIMESTAMP_SLOPE_MIN = 0.95;
  var OUTPUT_TIMESTAMP_SLOPE_MAX = 1.05;
  var OUTPUT_TIMESTAMP_MAX_DIVERGENCE_SEC = 0.25;
  var OUTPUT_TIMESTAMP_MAX_DIVERGENCE_DELTA_SEC = 0.05;
  var OUTPUT_TIMESTAMP_MAX_BACKWARD_SEC = 5e-3;
  var OUTPUT_TIMESTAMP_FUTURE_TOLERANCE_MS = 5;
  var OUTPUT_TIMESTAMP_PROMOTION_MIN_GOOD_SAMPLES = 6;
  var OUTPUT_TIMESTAMP_PROMOTION_MIN_SPAN_MS = 750;
  var OUTPUT_TIMESTAMP_MAX_CONSECUTIVE_BAD_SAMPLES = 2;
  var TIMING_MAX_SLEW_SEC = 2e-3;
  var TIMING_RESET_THRESHOLD_SEC = 0.5;
  var TIMING_MAX_LEAD_SEC = 0.1;
  var ClockSource = class {
    constructor() {
      this.activeSource = "estimated";
      this._pendingCutover = false;
      this._lastRejectReason = null;
      this._timestampPromotionDisabled = false;
      this.lastSample = null;
      this.goodSamples = 0;
      this.badSamples = 0;
      this.goodSinceMs = null;
      this.estimateAudioTimeSec = null;
      this.estimateAtMs = null;
    }
    get active() {
      return this.activeSource;
    }
    get pendingCutover() {
      return this._pendingCutover;
    }
    set pendingCutover(value) {
      this._pendingCutover = value;
    }
    get lastRejectReason() {
      return this._lastRejectReason;
    }
    get timestampGoodSamples() {
      return this.goodSamples;
    }
    get timestampPromotionDisabled() {
      return this._timestampPromotionDisabled;
    }
    /** Disable timestamp promotion (e.g., on Cast receivers to avoid rate oscillations). */
    disableTimestampPromotion() {
      this._timestampPromotionDisabled = true;
    }
    setActive(source) {
      if (this.activeSource === source)
        return false;
      this.activeSource = source;
      this._pendingCutover = source === "timestamp";
      if (this._pendingCutover) {
        this._onPromotion?.();
      }
      return this._pendingCutover;
    }
    onPromotion(cb) {
      this._onPromotion = cb;
    }
    reset() {
      this.activeSource = "estimated";
      this._pendingCutover = false;
      this.lastSample = null;
      this.goodSamples = 0;
      this._lastRejectReason = null;
      this.badSamples = 0;
      this.goodSinceMs = null;
      this.estimateAudioTimeSec = null;
      this.estimateAtMs = null;
    }
    demote(reason) {
      this.reset();
      this._lastRejectReason = reason;
    }
    rejectSample(reason, catastrophic = false) {
      this.lastSample = null;
      this.goodSamples = 0;
      this.goodSinceMs = null;
      this._lastRejectReason = reason;
      if (this.activeSource !== "timestamp") {
        this.badSamples = 0;
        return;
      }
      this.badSamples += 1;
      if (catastrophic || this.badSamples >= OUTPUT_TIMESTAMP_MAX_CONSECUTIVE_BAD_SAMPLES) {
        this.demote(reason);
      }
    }
    getEstimatedTime(rawTimeSec, nowMs) {
      if (this.estimateAudioTimeSec === null) {
        this.estimateAudioTimeSec = rawTimeSec;
        this.estimateAtMs = nowMs;
      } else if (this.estimateAtMs !== null) {
        const wallDeltaSec = Math.max(0, (nowMs - this.estimateAtMs) / 1e3);
        const predicted = this.estimateAudioTimeSec + wallDeltaSec;
        this.estimateAtMs = nowMs;
        const errorSec = rawTimeSec - predicted;
        if (Math.abs(errorSec) > TIMING_RESET_THRESHOLD_SEC) {
          this.estimateAudioTimeSec = rawTimeSec;
        } else {
          const slew = Math.max(-TIMING_MAX_SLEW_SEC, Math.min(TIMING_MAX_SLEW_SEC, errorSec));
          const next = Math.max(this.estimateAudioTimeSec, predicted + slew);
          this.estimateAudioTimeSec = Math.min(next, rawTimeSec + TIMING_MAX_LEAD_SEC);
        }
      }
      return this.estimateAudioTimeSec ?? rawTimeSec;
    }
    getTimestampDerivedTime(rawTimeSec, audioContext, playoutLatencySec) {
      if (this._timestampPromotionDisabled) {
        if (this.activeSource !== "estimated" || this.lastSample !== null || this.goodSamples !== 0 || this._lastRejectReason !== null) {
          this.reset();
        }
        return null;
      }
      const getOutputTimestamp = audioContext.getOutputTimestamp;
      if (typeof getOutputTimestamp !== "function") {
        if (this.activeSource === "timestamp") {
          this.demote("getOutputTimestamp unavailable");
        }
        return null;
      }
      try {
        const ts = getOutputTimestamp.call(audioContext);
        const nowMs = performance.now();
        const rawFreshnessMs = nowMs - ts.performanceTime;
        if (rawFreshnessMs < -OUTPUT_TIMESTAMP_FUTURE_TOLERANCE_MS) {
          this.rejectSample(`performanceTime in future (${rawFreshnessMs.toFixed(1)}ms)`, true);
          return null;
        }
        const freshnessMs = Math.max(0, rawFreshnessMs);
        const predictedAudioTimeSec = ts.contextTime + freshnessMs / 1e3 + playoutLatencySec;
        const sample = {
          contextTimeSec: ts.contextTime,
          performanceTimeMs: ts.performanceTime,
          nowMs,
          predictedAudioTimeSec,
          rawAudioTimeSec: rawTimeSec
        };
        if (freshnessMs > OUTPUT_TIMESTAMP_MAX_FRESHNESS_MS) {
          this.rejectSample(`stale timestamp (${freshnessMs.toFixed(1)}ms old)`, true);
          return null;
        }
        const divergenceSec = predictedAudioTimeSec - rawTimeSec;
        if (Math.abs(divergenceSec) > OUTPUT_TIMESTAMP_MAX_DIVERGENCE_SEC) {
          this.rejectSample(`timestamp/raw divergence ${Math.abs(divergenceSec * 1e3).toFixed(1)}ms`, true);
          return null;
        }
        const prev = this.lastSample;
        if (prev) {
          const perfDeltaMs = ts.performanceTime - prev.performanceTimeMs;
          if (perfDeltaMs < 0) {
            this.rejectSample(`performanceTime moved backward (${perfDeltaMs.toFixed(1)}ms)`, true);
            return null;
          }
          if (predictedAudioTimeSec < prev.predictedAudioTimeSec - OUTPUT_TIMESTAMP_MAX_BACKWARD_SEC) {
            this.rejectSample(`predicted audio time moved backward ${((prev.predictedAudioTimeSec - predictedAudioTimeSec) * 1e3).toFixed(1)}ms`, true);
            return null;
          }
          const prevDivergenceSec = prev.predictedAudioTimeSec - prev.rawAudioTimeSec;
          if (Math.abs(divergenceSec - prevDivergenceSec) > OUTPUT_TIMESTAMP_MAX_DIVERGENCE_DELTA_SEC) {
            this.rejectSample(`timestamp/raw divergence drift ${Math.abs((divergenceSec - prevDivergenceSec) * 1e3).toFixed(1)}ms`);
            return null;
          }
          if (perfDeltaMs >= OUTPUT_TIMESTAMP_MIN_SAMPLE_INTERVAL_MS) {
            const perfDeltaSec = perfDeltaMs / 1e3;
            const contextSlope = (ts.contextTime - prev.contextTimeSec) / perfDeltaSec;
            const predictedSlope = (predictedAudioTimeSec - prev.predictedAudioTimeSec) / perfDeltaSec;
            if (contextSlope < OUTPUT_TIMESTAMP_SLOPE_MIN || contextSlope > OUTPUT_TIMESTAMP_SLOPE_MAX) {
              this.rejectSample(`context slope ${contextSlope.toFixed(3)} out of range`);
              return null;
            }
            if (predictedSlope < OUTPUT_TIMESTAMP_SLOPE_MIN || predictedSlope > OUTPUT_TIMESTAMP_SLOPE_MAX) {
              this.rejectSample(`predicted slope ${predictedSlope.toFixed(3)} out of range`);
              return null;
            }
          }
        }
        this.lastSample = sample;
        this.badSamples = 0;
        if (this.goodSinceMs === null) {
          this.goodSinceMs = nowMs;
        }
        this.goodSamples += 1;
        if (this.activeSource !== "timestamp" && this.goodSamples >= OUTPUT_TIMESTAMP_PROMOTION_MIN_GOOD_SAMPLES && this.goodSinceMs !== null && nowMs - this.goodSinceMs >= OUTPUT_TIMESTAMP_PROMOTION_MIN_SPAN_MS) {
          this.setActive("timestamp");
          this._lastRejectReason = null;
        }
        return predictedAudioTimeSec;
      } catch (error) {
        const reason = error instanceof Error ? `getOutputTimestamp failed: ${error.message}` : `getOutputTimestamp failed: ${String(error)}`;
        this.rejectSample(reason, true);
        return null;
      }
    }
    /**
     * Get a timing snapshot with both derived and raw AudioContext times.
     *
     * @param playoutLatencySec Measured baseLatency + outputLatency, or 0 where
     *   contextTime is already at the render position. Used to
     *   normalize the getOutputTimestamp-derived clock into the render-clock
     *   domain. Pass the measured value regardless of whether latency
     *   compensation is enabled: this only keeps the two clock sources in one
     *   domain, it does not compensate playback.
     */
    getTimingSnapshot(audioContext, playoutLatencySec = 0) {
      const nowMs = performance.now();
      const nowUs = nowMs * 1e3;
      if (!audioContext) {
        return {
          audioContextTimeSec: 0,
          audioContextRawTimeSec: 0,
          nowMs,
          nowUs
        };
      }
      const rawTimeSec = audioContext.currentTime;
      const estimatedTimeSec = this.getEstimatedTime(rawTimeSec, nowMs);
      const timestampTimeSec = this.getTimestampDerivedTime(rawTimeSec, audioContext, playoutLatencySec);
      let derivedTimeSec = this.activeSource === "timestamp" && timestampTimeSec !== null ? timestampTimeSec : estimatedTimeSec;
      if (!Number.isFinite(derivedTimeSec)) {
        derivedTimeSec = rawTimeSec;
      }
      return {
        audioContextTimeSec: derivedTimeSec,
        audioContextRawTimeSec: rawTimeSec,
        nowMs,
        nowUs
      };
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/audio/recorrection-monitor.js
  var RECORRECTION_CHECK_INTERVAL_MS = 250;
  var RECORRECTION_TRIGGER_MS = 30;
  var RECORRECTION_SUSTAIN_MS = 400;
  var RECORRECTION_COOLDOWN_MS = 1500;
  var RECORRECTION_TRANSIENT_JUMP_MS = 25;
  var RECORRECTION_TRANSIENT_CONFIRM_WINDOW_MS = RECORRECTION_CHECK_INTERVAL_MS * 4;
  var HARD_RESYNC_STARTUP_GRACE_MS = 1e3;
  var HARD_RESYNC_COOLDOWN_MS = 500;
  var RecorrectionMonitor = class {
    get minScheduleTimeSec() {
      return this._minScheduleTimeSec;
    }
    setMinScheduleTime(timeSec) {
      this._minScheduleTimeSec = timeSec;
    }
    clearMinScheduleTime() {
      this._minScheduleTimeSec = null;
    }
    constructor(onCheck) {
      this.onCheck = onCheck;
      this.interval = null;
      this.breachStartedAtMs = null;
      this.lastRecorrectionAtMs = -Infinity;
      this.prevRawSyncErrorMs = null;
      this.pendingJumpSign = null;
      this.pendingJumpAtMs = null;
      this.transientStartedAtMs = null;
      this._hardResyncGraceUntilMs = null;
      this._lastHardResyncAtMs = -Infinity;
      this._minScheduleTimeSec = null;
    }
    start() {
      if (this.interval !== null)
        return;
      this.interval = globalThis.setInterval(() => this.onCheck(), RECORRECTION_CHECK_INTERVAL_MS);
    }
    stop() {
      if (this.interval !== null) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.resetCheckState();
      this.lastRecorrectionAtMs = -Infinity;
    }
    clearBreachState() {
      this.breachStartedAtMs = null;
      this.pendingJumpSign = null;
      this.pendingJumpAtMs = null;
      this.transientStartedAtMs = null;
    }
    resetCheckState() {
      this.clearBreachState();
      this.prevRawSyncErrorMs = null;
    }
    clearHardResyncCooldown() {
      this._hardResyncGraceUntilMs = null;
      this._lastHardResyncAtMs = -Infinity;
    }
    armStartupGrace(nowMs, isTimestampClock) {
      if (isTimestampClock) {
        this._hardResyncGraceUntilMs = null;
        return;
      }
      if (this._hardResyncGraceUntilMs === null) {
        this._hardResyncGraceUntilMs = nowMs + HARD_RESYNC_STARTUP_GRACE_MS;
      }
    }
    canUseHardResync(nowMs, isTimestampClock) {
      if (isTimestampClock) {
        this._hardResyncGraceUntilMs = null;
      } else if (this._hardResyncGraceUntilMs !== null && nowMs < this._hardResyncGraceUntilMs) {
        return false;
      }
      return nowMs - this._lastHardResyncAtMs >= HARD_RESYNC_COOLDOWN_MS;
    }
    noteHardResync(nowMs) {
      this._lastHardResyncAtMs = nowMs;
    }
    /** Mark a recorrection as having just happened (for cooldown). */
    markRecorrection(nowMs) {
      this.lastRecorrectionAtMs = nowMs;
    }
    shouldIgnoreTransientJump(rawSyncErrorMs, nowMs) {
      const prev = this.prevRawSyncErrorMs;
      this.prevRawSyncErrorMs = rawSyncErrorMs;
      if (prev === null) {
        this.pendingJumpSign = null;
        this.pendingJumpAtMs = null;
        return false;
      }
      const jumpDeltaMs = rawSyncErrorMs - prev;
      const jumpSign = Math.sign(jumpDeltaMs);
      const isJumpDetected = Math.abs(jumpDeltaMs) >= RECORRECTION_TRANSIENT_JUMP_MS;
      if (!isJumpDetected) {
        this.pendingJumpSign = null;
        this.pendingJumpAtMs = null;
        return false;
      }
      const isConfirmed = this.pendingJumpSign === jumpSign && this.pendingJumpAtMs !== null && nowMs - this.pendingJumpAtMs <= RECORRECTION_TRANSIENT_CONFIRM_WINDOW_MS;
      this.pendingJumpSign = jumpSign;
      this.pendingJumpAtMs = nowMs;
      if (isConfirmed) {
        return false;
      }
      return true;
    }
    /**
     * Evaluate whether a recorrection should fire given the current sync state.
     * Returns true if the scheduler should perform a guarded cutover.
     */
    shouldRecorrect(smoothedAbsErrorMs, rawSyncErrorMs, nowMs) {
      const isTransient = this.shouldIgnoreTransientJump(rawSyncErrorMs, nowMs);
      if (smoothedAbsErrorMs < RECORRECTION_TRIGGER_MS) {
        this.clearBreachState();
        return false;
      }
      if (isTransient) {
        if (this.transientStartedAtMs === null) {
          this.transientStartedAtMs = nowMs;
        }
        if (nowMs - this.transientStartedAtMs < RECORRECTION_SUSTAIN_MS) {
          this.breachStartedAtMs = null;
          return false;
        }
        if (this.breachStartedAtMs === null) {
          this.breachStartedAtMs = this.transientStartedAtMs;
        }
      } else {
        this.transientStartedAtMs = null;
      }
      if (this.breachStartedAtMs === null) {
        this.breachStartedAtMs = nowMs;
        return false;
      }
      if (nowMs - this.breachStartedAtMs < RECORRECTION_SUSTAIN_MS) {
        return false;
      }
      if (nowMs - this.lastRecorrectionAtMs < RECORRECTION_COOLDOWN_MS) {
        return false;
      }
      return true;
    }
    /** Full reset (on disconnect or stream clear). */
    fullReset() {
      this.stop();
      this._hardResyncGraceUntilMs = null;
      this._lastHardResyncAtMs = -Infinity;
      this._minScheduleTimeSec = null;
    }
  };
  var RECORRECTION_CUTOVER_GUARD_SEC = 0.3;

  // node_modules/@sendspin/sendspin-js/dist/audio/output-latency-tracker.js
  var UNREPORTED_OUTPUT_LATENCY_SEC = 0.04;
  var MAX_PLAUSIBLE_LATENCY_SEC = 5;
  var OUTPUT_LATENCY_ALPHA = 0.01;
  var OUTPUT_LATENCY_STORAGE_KEY = "sendspin-output-latency-us";
  var OUTPUT_LATENCY_PERSIST_INTERVAL_MS = 1e4;
  function resolveLatencySec(reportedSec, fallbackSec) {
    const usable = typeof reportedSec === "number" && Number.isFinite(reportedSec) && reportedSec >= 0 && reportedSec <= MAX_PLAUSIBLE_LATENCY_SEC;
    return usable ? reportedSec : fallbackSec;
  }
  var OutputLatencyTracker = class {
    constructor(storage) {
      this.storage = storage;
      this.smoothedOutputLatencyUs = null;
      this.lastLatencyPersistAtMs = null;
      this.loadPersisted();
    }
    loadPersisted() {
      if (!this.storage)
        return;
      try {
        const stored = this.storage.getItem(OUTPUT_LATENCY_STORAGE_KEY);
        if (stored) {
          const latency = parseFloat(stored);
          if (!isNaN(latency) && latency >= 0) {
            this.smoothedOutputLatencyUs = latency;
          }
        }
      } catch {
      }
    }
    persist() {
      if (!this.storage || this.smoothedOutputLatencyUs === null)
        return;
      try {
        this.storage.setItem(OUTPUT_LATENCY_STORAGE_KEY, this.smoothedOutputLatencyUs.toString());
      } catch {
      }
    }
    /** Get raw output latency in microseconds from AudioContext. */
    getRawUs(audioContext) {
      if (!audioContext)
        return 0;
      const baseLatency = resolveLatencySec(audioContext.baseLatency, 0);
      const outputLatency = resolveLatencySec(audioContext.outputLatency, UNREPORTED_OUTPUT_LATENCY_SEC);
      return (baseLatency + outputLatency) * 1e6;
    }
    /** Get EMA-smoothed output latency in microseconds. */
    getSmoothedUs(audioContext) {
      const rawLatencyUs = this.getRawUs(audioContext);
      if (rawLatencyUs <= 0 && this.smoothedOutputLatencyUs !== null) {
        return this.smoothedOutputLatencyUs;
      }
      if (this.smoothedOutputLatencyUs === null) {
        this.smoothedOutputLatencyUs = rawLatencyUs;
      } else {
        this.smoothedOutputLatencyUs = OUTPUT_LATENCY_ALPHA * rawLatencyUs + (1 - OUTPUT_LATENCY_ALPHA) * this.smoothedOutputLatencyUs;
      }
      const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (this.lastLatencyPersistAtMs === null || nowMs - this.lastLatencyPersistAtMs >= OUTPUT_LATENCY_PERSIST_INTERVAL_MS) {
        this.persist();
        this.lastLatencyPersistAtMs = nowMs;
      }
      return this.smoothedOutputLatencyUs;
    }
    /** Reset smoother (on stream change or audio context recreation). */
    reset() {
      this.smoothedOutputLatencyUs = null;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/audio/platform-output-latency.js
  var IOS_UNREPORTED_OUTPUT_LATENCY_MS = 55;
  function getNavigatorInfo() {
    return typeof navigator === "undefined" ? void 0 : navigator;
  }
  function isIOS(navigatorInfo) {
    return /iPad|iPhone|iPod/i.test(navigatorInfo.userAgent) || navigatorInfo.platform === "MacIntel" && (navigatorInfo.maxTouchPoints ?? 0) > 1;
  }
  function reportsContextTimeAtRenderPosition(navigatorInfo = getNavigatorInfo()) {
    if (!navigatorInfo)
      return false;
    if (isIOS(navigatorInfo))
      return true;
    const { userAgent } = navigatorInfo;
    if (/Firefox/i.test(userAgent))
      return true;
    return /Macintosh/i.test(userAgent) && /AppleWebKit/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent);
  }
  function getUnreportedOutputLatencyMs(navigatorInfo = getNavigatorInfo()) {
    return navigatorInfo && isIOS(navigatorInfo) ? IOS_UNREPORTED_OUTPUT_LATENCY_MS : 0;
  }

  // node_modules/@sendspin/sendspin-js/dist/audio/scheduler.js
  var SAMPLE_CORRECTION_FADE_LEN = 8;
  var SAMPLE_CORRECTION_TARGET_BLEND_SUM = 1;
  var SAMPLE_CORRECTION_FADE_STRENGTH = Math.min(1, 2 * SAMPLE_CORRECTION_TARGET_BLEND_SUM / SAMPLE_CORRECTION_FADE_LEN);
  var SAMPLE_CORRECTION_FADE_ALPHAS = new Float32Array(SAMPLE_CORRECTION_FADE_LEN);
  for (let f = 0; f < SAMPLE_CORRECTION_FADE_LEN; f++) {
    SAMPLE_CORRECTION_FADE_ALPHAS[f] = (SAMPLE_CORRECTION_FADE_LEN - f) / (SAMPLE_CORRECTION_FADE_LEN + 1) * SAMPLE_CORRECTION_FADE_STRENGTH;
  }
  var RATE_CORRECTION_SOFT = 3e-3;
  var RATE_CORRECTION_FIRM = 5e-3;
  var SYNC_ERROR_ALPHA = 0.05;
  var SCHEDULE_HORIZON_PRECISE_SEC = 20;
  var SCHEDULE_HORIZON_GOOD_SEC = 8;
  var SCHEDULE_HORIZON_POOR_SEC = 4;
  var CAST_SCHEDULE_HORIZON_SEC = 1.5;
  var SCHEDULE_HORIZON_PRECISE_ERROR_MS = 2;
  var SCHEDULE_HORIZON_GOOD_ERROR_MS = 8;
  var SCHEDULE_REFILL_THRESHOLD_FRACTION = 0.5;
  var SCHEDULE_REFILL_MIN_THRESHOLD_SEC = 0.1;
  var SCHEDULE_REFILL_MAX_THRESHOLD_SEC = 5;
  var VOLUME_RAMP_TIME_CONSTANT_SEC = 0.015;
  function perceptualGain(volume) {
    return Math.pow(volume / 100, 1.5);
  }
  var DEFAULT_CORRECTION_THRESHOLDS = {
    sync: {
      resyncAboveMs: 200,
      rate2AboveMs: 35,
      rate1AboveMs: 8,
      samplesBelowMs: 8,
      deadbandBelowMs: 1,
      enableRecorrectionMonitor: true
    },
    quality: {
      resyncAboveMs: 35,
      rate2AboveMs: Infinity,
      rate1AboveMs: Infinity,
      samplesBelowMs: 35,
      deadbandBelowMs: 1,
      enableRecorrectionMonitor: false
    },
    "quality-local": {
      resyncAboveMs: 600,
      rate2AboveMs: Infinity,
      rate1AboveMs: Infinity,
      samplesBelowMs: 0,
      deadbandBelowMs: 5,
      enableRecorrectionMonitor: false
    }
  };
  var AudioScheduler = class {
    constructor(options) {
      this.audioContext = null;
      this.gainNode = null;
      this.streamDestination = null;
      this.audioBufferQueue = [];
      this.scheduledSources = [];
      this.nextPlaybackTime = 0;
      this.nextScheduleTime = 0;
      this.lastScheduledServerTime = 0;
      this.currentSyncErrorMs = 0;
      this.smoothedSyncErrorMs = 0;
      this.resyncCount = 0;
      this.currentPlaybackRate = 1;
      this.currentCorrectionMethod = "none";
      this.lastSamplesAdjusted = 0;
      this._correctionMode = "sync";
      this._lastStatusLogMs = 0;
      this._intervalResyncCount = 0;
      this.contextTimeAtRenderPosition = reportsContextTimeAtRenderPosition();
      this.scheduleTimeout = null;
      this.refillTimeout = null;
      this.queueProcessScheduled = false;
      this.clockSource = new ClockSource();
      this.stateManager = options.stateManager;
      this.timeFilter = options.timeFilter;
      this.outputMode = options.outputMode ?? "direct";
      this.audioElement = options.audioElement;
      this.isAndroid = options.isAndroid ?? false;
      this.isCastRuntime = options.isCastRuntime ?? false;
      this.ownsAudioElement = options.ownsAudioElement ?? false;
      this.silentAudioSrc = options.silentAudioSrc;
      this.syncDelayMs = clampSyncDelayMs(options.syncDelayMs ?? 0);
      this.useHardwareVolume = options.useHardwareVolume ?? false;
      this._correctionMode = options.correctionMode ?? "sync";
      this.useOutputLatencyCompensation = options.useOutputLatencyCompensation ?? true;
      this.unreportedOutputLatencySec = this.useOutputLatencyCompensation ? getUnreportedOutputLatencyMs() / 1e3 : 0;
      this.correctionThresholds = { ...DEFAULT_CORRECTION_THRESHOLDS };
      const thresholdOverrides = options.correctionThresholds;
      if (thresholdOverrides) {
        for (const mode of Object.keys(thresholdOverrides)) {
          const overrides = thresholdOverrides[mode];
          if (overrides) {
            this.correctionThresholds[mode] = {
              ...DEFAULT_CORRECTION_THRESHOLDS[mode],
              ...overrides
            };
          }
        }
      }
      this.latencyTracker = new OutputLatencyTracker(options.storage ?? null);
      if (this.isCastRuntime) {
        this.clockSource.disableTimestampPromotion();
      }
      this.clockSource.onPromotion(() => {
        if (this.audioBufferQueue.length > 0 || this.scheduledSources.length > 0) {
          this.scheduleQueueProcessing();
        }
      });
      this.recorrectionMonitor = new RecorrectionMonitor(() => this.checkRecorrection());
    }
    get correctionMode() {
      return this._correctionMode;
    }
    setCorrectionMode(mode) {
      this._correctionMode = mode;
      if (!this.correctionThresholds[mode].enableRecorrectionMonitor) {
        this.recorrectionMonitor.stop();
      } else {
        this.recorrectionMonitor.start();
      }
    }
    get usesRecorrectionMonitor() {
      return this.correctionThresholds[this._correctionMode].enableRecorrectionMonitor;
    }
    /**
     * Smoothed baseLatency + outputLatency in seconds: how long audio handed to
     * the renderer takes to reach the output port. Read on every scheduling pass
     * (even with compensation disabled) because the clock source needs it to keep
     * both of its clocks in the render-clock domain.
     */
    measurePlayoutLatencySec() {
      return this.latencyTracker.getSmoothedUs(this.audioContext) / 1e6;
    }
    getTargetScheduledHorizonSec() {
      if (this.isCastRuntime) {
        return CAST_SCHEDULE_HORIZON_SEC;
      }
      const errorMs = this.timeFilter.error / 1e3;
      if (errorMs < SCHEDULE_HORIZON_PRECISE_ERROR_MS)
        return SCHEDULE_HORIZON_PRECISE_SEC;
      if (errorMs <= SCHEDULE_HORIZON_GOOD_ERROR_MS)
        return SCHEDULE_HORIZON_GOOD_SEC;
      return SCHEDULE_HORIZON_POOR_SEC;
    }
    getScheduledAheadSec(currentTimeSec) {
      let farthest = this.nextScheduleTime;
      for (const entry of this.scheduledSources) {
        if (entry.endTime > farthest)
          farthest = entry.endTime;
      }
      return farthest <= 0 ? 0 : Math.max(0, farthest - currentTimeSec);
    }
    resetScheduledPlaybackState(_reason) {
      this.nextPlaybackTime = 0;
      this.nextScheduleTime = 0;
      this.lastScheduledServerTime = 0;
      this.recorrectionMonitor.clearMinScheduleTime();
      this.recorrectionMonitor.clearHardResyncCooldown();
      this.clockSource.pendingCutover = false;
      this.recorrectionMonitor.resetCheckState();
      this.resetSyncErrorEma();
      this.currentSyncErrorMs = 0;
      this.currentPlaybackRate = 1;
      this.currentCorrectionMethod = "none";
      this.lastSamplesAdjusted = 0;
      this._lastStatusLogMs = 0;
      this._intervalResyncCount = 0;
    }
    pruneExpiredScheduledSources(currentTimeSec) {
      if (this.scheduledSources.length === 0)
        return;
      this.scheduledSources = this.scheduledSources.filter((entry) => entry.endTime > currentTimeSec);
      if (this.scheduledSources.length === 0) {
        this.resetScheduledPlaybackState("no scheduled audio ahead");
      }
    }
    performGuardedCutover(_reason, options = {}) {
      if (!this.audioContext)
        return;
      const incrementResyncCount = options.incrementResyncCount ?? false;
      const markCooldown = options.markCooldown ?? true;
      const nowMs = performance.now();
      const cutoffTime = this.audioContext.currentTime + RECORRECTION_CUTOVER_GUARD_SEC;
      if (incrementResyncCount) {
        this.resyncCount++;
        this._intervalResyncCount++;
      }
      this.resetSyncErrorEma();
      this.currentCorrectionMethod = "resync";
      this.lastSamplesAdjusted = 0;
      this.currentPlaybackRate = 1;
      const cutResult = this.cutScheduledSources(cutoffTime);
      this.recorrectionMonitor.setMinScheduleTime(Math.max(cutoffTime, cutResult.keptTailEndTimeSec));
      this.nextPlaybackTime = 0;
      this.nextScheduleTime = 0;
      this.lastScheduledServerTime = 0;
      this.recorrectionMonitor.resetCheckState();
      if (markCooldown)
        this.recorrectionMonitor.markRecorrection(nowMs);
      this.recorrectionMonitor.noteHardResync(nowMs);
      this.processAudioQueue();
    }
    checkRecorrection() {
      if (!this.usesRecorrectionMonitor) {
        this.recorrectionMonitor.resetCheckState();
        return;
      }
      if (!this.audioContext || this.audioContext.state !== "running") {
        this.recorrectionMonitor.resetCheckState();
        return;
      }
      if (!this.timeFilter.is_synchronized || !this.stateManager.isPlaying || this.nextPlaybackTime === 0 || this.lastScheduledServerTime === 0) {
        this.recorrectionMonitor.resetCheckState();
        return;
      }
      const playoutLatencySec = this.measurePlayoutLatencySec();
      const { audioContextTimeSec, audioContextRawTimeSec, nowMs, nowUs } = this.clockSource.getTimingSnapshot(this.audioContext, this.contextTimeAtRenderPosition ? 0 : playoutLatencySec);
      this.pruneExpiredScheduledSources(audioContextRawTimeSec);
      if (this.getScheduledAheadSec(audioContextRawTimeSec) <= 0) {
        this.recorrectionMonitor.resetCheckState();
        if (this.audioBufferQueue.length > 0)
          this.processAudioQueue();
        return;
      }
      const outputLatencySec = this.useOutputLatencyCompensation ? playoutLatencySec : 0;
      const targetPlaybackTime = this.computeTargetPlaybackTime(this.lastScheduledServerTime, audioContextTimeSec, nowUs, outputLatencySec);
      const syncErrorMs = (this.nextPlaybackTime - targetPlaybackTime) * 1e3;
      const smoothedSyncErrorMs = this.applySyncErrorEma(syncErrorMs);
      if (this.recorrectionMonitor.shouldRecorrect(Math.abs(smoothedSyncErrorMs), syncErrorMs, nowMs)) {
        this.performGuardedCutover("recorrection", {
          incrementResyncCount: true,
          markCooldown: true
        });
      }
    }
    getSyncDelayMs() {
      return this.syncDelayMs;
    }
    setSyncDelay(delayMs) {
      const sanitized = clampSyncDelayMs(delayMs);
      const delta = sanitized - this.syncDelayMs;
      this.syncDelayMs = sanitized;
      if (delta === 0)
        return;
      if (!this.audioContext || this.audioContext.state !== "running")
        return;
      if (!this.stateManager.isPlaying)
        return;
      if (this.scheduledSources.length === 0 && this.audioBufferQueue.length === 0 && this.nextPlaybackTime === 0)
        return;
      this.performGuardedCutover("delay-change", {
        incrementResyncCount: false,
        markCooldown: true
      });
    }
    get syncInfo() {
      return {
        clockDriftPercent: this.timeFilter.drift * 100,
        syncErrorMs: this.currentSyncErrorMs,
        resyncCount: this.resyncCount,
        outputLatencyMs: this.latencyTracker.getRawUs(this.audioContext) / 1e3 + this.unreportedOutputLatencySec * 1e3,
        playbackRate: this.currentPlaybackRate,
        correctionMethod: this.currentCorrectionMethod,
        samplesAdjusted: this.lastSamplesAdjusted,
        correctionMode: this._correctionMode
      };
    }
    emitStatusLog(nowMs) {
      if (this._lastStatusLogMs !== 0 && nowMs - this._lastStatusLogMs < 1e4)
        return;
      this._lastStatusLogMs = nowMs;
      let corr;
      switch (this.currentCorrectionMethod) {
        case "rate":
          corr = `rate@${this.currentPlaybackRate}`;
          break;
        case "samples":
          corr = `samples:${this.lastSamplesAdjusted}`;
          break;
        default:
          corr = this.currentCorrectionMethod;
      }
      const queueDepth = this.audioBufferQueue.length + this.scheduledSources.length;
      const aheadSec = this.audioContext ? this.getScheduledAheadSec(this.audioContext.currentTime) : 0;
      let clock;
      if (this.clockSource.timestampPromotionDisabled) {
        clock = "estimated(cast-disabled)";
      } else if (this.clockSource.active === "timestamp") {
        clock = `timestamp(good:${this.clockSource.timestampGoodSamples})`;
      } else if (this.clockSource.lastRejectReason) {
        clock = `estimated(reject:"${this.clockSource.lastRejectReason}")`;
      } else {
        clock = "estimated";
      }
      const tf = this.timeFilter.is_synchronized ? `synced(err=${(this.timeFilter.error / 1e3).toFixed(1)}ms,drift=${this.timeFilter.drift.toFixed(3)},n=${this.timeFilter.count})` : `pending(n=${this.timeFilter.count})`;
      const smoothedLatUs = this.latencyTracker.getSmoothedUs(this.audioContext);
      const latMs = Math.round(smoothedLatUs / 1e3 + this.unreportedOutputLatencySec * 1e3);
      console.log(`Sendspin: sync=${this.smoothedSyncErrorMs >= 0 ? "+" : ""}${this.smoothedSyncErrorMs.toFixed(1)}ms corr=${corr} q=${queueDepth}/${aheadSec.toFixed(1)}s resyncs=${this._intervalResyncCount} clock=${clock} tf=${tf} lat=${latMs}ms mode=${this._correctionMode} ctx=${this.audioContext?.state ?? "null"} gen=${this.stateManager.streamGeneration}`);
      this._intervalResyncCount = 0;
    }
    applySyncErrorEma(inputMs) {
      this.currentSyncErrorMs = inputMs;
      this.smoothedSyncErrorMs = SYNC_ERROR_ALPHA * inputMs + (1 - SYNC_ERROR_ALPHA) * this.smoothedSyncErrorMs;
      return this.smoothedSyncErrorMs;
    }
    resetSyncErrorEma() {
      this.smoothedSyncErrorMs = 0;
    }
    copyBuffer(buffer) {
      if (!this.audioContext)
        return buffer;
      const newBuffer = this.audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        newBuffer.getChannelData(ch).set(buffer.getChannelData(ch));
      }
      return newBuffer;
    }
    adjustBufferSamples(buffer, samplesToAdjust) {
      if (!this.audioContext || samplesToAdjust === 0 || buffer.length < 2)
        return this.copyBuffer(buffer);
      const channels = buffer.numberOfChannels;
      const len = buffer.length;
      const sampleRate = buffer.sampleRate;
      try {
        if (samplesToAdjust > 0) {
          const newBuffer = this.audioContext.createBuffer(channels, len + 1, sampleRate);
          for (let ch = 0; ch < channels; ch++) {
            const oldData = buffer.getChannelData(ch);
            const newData = newBuffer.getChannelData(ch);
            newData[0] = oldData[0];
            const insertedSample = (oldData[0] + oldData[1]) / 2;
            newData[1] = insertedSample;
            newData.set(oldData.subarray(1), 2);
            for (let f = 0; f < SAMPLE_CORRECTION_FADE_LEN; f++) {
              const pos = 2 + f;
              if (pos >= newData.length)
                break;
              const alpha = SAMPLE_CORRECTION_FADE_ALPHAS[f];
              newData[pos] = newData[pos] * (1 - alpha) + insertedSample * alpha;
            }
          }
          return newBuffer;
        } else {
          const newBuffer = this.audioContext.createBuffer(channels, len - 1, sampleRate);
          for (let ch = 0; ch < channels; ch++) {
            const oldData = buffer.getChannelData(ch);
            const newData = newBuffer.getChannelData(ch);
            newData.set(oldData.subarray(0, len - 2));
            const replacementSample = (oldData[len - 2] + oldData[len - 1]) / 2;
            newData[len - 2] = replacementSample;
            for (let f = 0; f < SAMPLE_CORRECTION_FADE_LEN; f++) {
              const pos = len - 3 - f;
              if (pos < 0)
                break;
              const alpha = SAMPLE_CORRECTION_FADE_ALPHAS[f];
              newData[pos] = newData[pos] * (1 - alpha) + replacementSample * alpha;
            }
          }
          return newBuffer;
        }
      } catch (e) {
        console.error("Sendspin: adjustBufferSamples error:", e);
        return buffer;
      }
    }
    initAudioContext() {
      if (this.audioContext)
        return;
      if (this.outputMode === "media-element" && this.ownsAudioElement) {
        this.audioElement = document.createElement("audio");
        this.audioElement.style.display = "none";
        document.body.appendChild(this.audioElement);
      }
      if (navigator.audioSession) {
        navigator.audioSession.type = "playback";
      }
      const streamSampleRate = this.stateManager.currentStreamFormat?.sample_rate || 48e3;
      this.audioContext = new AudioContext({ sampleRate: streamSampleRate });
      this.gainNode = this.audioContext.createGain();
      const audioElement = this.audioElement;
      if (this.outputMode === "direct") {
        this.gainNode.connect(this.audioContext.destination);
      } else {
        if (!audioElement)
          throw new Error("Media-element output requires an audio element.");
        if (this.isAndroid && this.silentAudioSrc) {
          this.gainNode.connect(this.audioContext.destination);
          audioElement.src = this.silentAudioSrc;
          audioElement.loop = true;
          audioElement.muted = false;
          audioElement.volume = 1;
          audioElement.play().catch((e) => {
            console.warn("Sendspin: Audio autoplay blocked:", e);
          });
        } else {
          this.streamDestination = this.audioContext.createMediaStreamDestination();
          this.gainNode.connect(this.streamDestination);
          audioElement.srcObject = this.streamDestination.stream;
          audioElement.volume = 1;
          audioElement.play().catch((e) => {
            console.warn("Sendspin: Audio autoplay blocked:", e);
          });
        }
      }
      this.updateVolume();
      if (this.usesRecorrectionMonitor)
        this.recorrectionMonitor.start();
    }
    async resumeAudioContext() {
      if (this.audioContext && this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        console.log("Sendspin: AudioContext resumed");
        if (this.audioBufferQueue.length > 0)
          this.scheduleQueueProcessing();
        if (this.usesRecorrectionMonitor)
          this.recorrectionMonitor.start();
      }
    }
    cutScheduledSources(cutoffTime) {
      if (!this.audioContext)
        return { requeuedCount: 0, cutCount: 0, keptTailEndTimeSec: 0 };
      const stopTime = Math.max(cutoffTime, this.audioContext.currentTime);
      let requeued = 0, cutCount = 0, keptTailEndTimeSec = 0;
      this.scheduledSources = this.scheduledSources.filter((entry) => {
        if (entry.startTime < stopTime) {
          keptTailEndTimeSec = Math.max(keptTailEndTimeSec, entry.endTime);
          return true;
        }
        try {
          entry.source.onended = null;
          entry.source.stop(stopTime);
        } catch {
        }
        this.audioBufferQueue.push({
          buffer: entry.buffer,
          serverTime: entry.serverTime,
          generation: entry.generation
        });
        requeued++;
        cutCount++;
        return false;
      });
      if (requeued > 0) {
        this.audioBufferQueue.sort((a, b) => a.serverTime - b.serverTime);
      }
      return { requeuedCount: requeued, cutCount, keptTailEndTimeSec };
    }
    updateVolume() {
      if (!this.gainNode)
        return;
      if (this.useHardwareVolume) {
        this.gainNode.gain.value = 1;
        return;
      }
      const target = this.stateManager.muted ? 0 : perceptualGain(this.stateManager.volume);
      if (this.audioContext) {
        this.gainNode.gain.setTargetAtTime(target, this.audioContext.currentTime, VOLUME_RAMP_TIME_CONSTANT_SEC);
      } else {
        this.gainNode.gain.value = target;
      }
    }
    measureBufferedPlaybackRunwaySec() {
      if (!this.audioContext)
        return 0;
      const currentTimeSec = this.audioContext.currentTime;
      this.pruneExpiredScheduledSources(currentTimeSec);
      const scheduledAheadSec = this.getScheduledAheadSec(currentTimeSec);
      const queuedAheadSec = this.audioBufferQueue.reduce((totalSec, chunk) => totalSec + chunk.buffer.duration, 0);
      return Math.max(0, scheduledAheadSec + queuedAheadSec);
    }
    cancelScheduledRefill() {
      if (this.refillTimeout !== null) {
        clearTimeout(this.refillTimeout);
        this.refillTimeout = null;
      }
    }
    getScheduledRefillThresholdSec(targetScheduledHorizonSec) {
      return Math.max(SCHEDULE_REFILL_MIN_THRESHOLD_SEC, Math.min(SCHEDULE_REFILL_MAX_THRESHOLD_SEC, targetScheduledHorizonSec * SCHEDULE_REFILL_THRESHOLD_FRACTION));
    }
    scheduleQueueRefill(targetScheduledHorizonSec) {
      this.cancelScheduledRefill();
      if (!this.audioContext || this.audioContext.state !== "running" || !this.stateManager.isPlaying || this.audioBufferQueue.length === 0)
        return;
      const currentTimeSec = this.audioContext.currentTime;
      this.pruneExpiredScheduledSources(currentTimeSec);
      const scheduledAheadSec = this.getScheduledAheadSec(currentTimeSec);
      const refillThresholdSec = this.getScheduledRefillThresholdSec(targetScheduledHorizonSec);
      if (scheduledAheadSec <= refillThresholdSec) {
        this.scheduleQueueProcessing();
        return;
      }
      const delayMs = (scheduledAheadSec - refillThresholdSec) * 1e3;
      const runRefill = () => {
        this.refillTimeout = null;
        if (!this.audioContext || this.audioContext.state !== "running" || !this.stateManager.isPlaying || this.audioBufferQueue.length === 0)
          return;
        this.scheduleQueueProcessing();
      };
      if (typeof globalThis.setTimeout === "function") {
        this.refillTimeout = globalThis.setTimeout(runRefill, delayMs);
        return;
      }
      this.refillTimeout = null;
      if (typeof globalThis.queueMicrotask === "function") {
        globalThis.queueMicrotask(runRefill);
        return;
      }
      void Promise.resolve().then(runRefill);
    }
    scheduleQueueProcessing() {
      this.cancelScheduledRefill();
      if (this.queueProcessScheduled)
        return;
      this.queueProcessScheduled = true;
      if (typeof globalThis.setTimeout === "function") {
        this.scheduleTimeout = globalThis.setTimeout(() => {
          this.scheduleTimeout = null;
          this.queueProcessScheduled = false;
          this.processAudioQueue();
        }, 15);
        return;
      }
      const run = () => {
        this.queueProcessScheduled = false;
        this.processAudioQueue();
      };
      if (typeof globalThis.queueMicrotask === "function") {
        globalThis.queueMicrotask(run);
      } else {
        Promise.resolve().then(run);
      }
    }
    handleDecodedChunk(chunk) {
      if (!this.audioContext || !this.gainNode) {
        console.warn("Sendspin: Received audio chunk but no audio context");
        return;
      }
      if (chunk.generation !== this.stateManager.streamGeneration)
        return;
      const numChannels = chunk.samples.length;
      const numFrames = chunk.samples[0].length;
      const audioBuffer = this.audioContext.createBuffer(numChannels, numFrames, chunk.sampleRate);
      for (let ch = 0; ch < numChannels; ch++)
        audioBuffer.getChannelData(ch).set(chunk.samples[ch]);
      this.audioBufferQueue.push({
        buffer: audioBuffer,
        serverTime: chunk.serverTimeUs,
        generation: chunk.generation
      });
      this.scheduleQueueProcessing();
    }
    processAudioQueue() {
      this.cancelScheduledRefill();
      if (!this.audioContext || !this.gainNode)
        return;
      if (this.audioContext.state !== "running")
        return;
      const currentGeneration = this.stateManager.streamGeneration;
      this.audioBufferQueue = this.audioBufferQueue.filter((chunk) => chunk.generation === currentGeneration);
      this.audioBufferQueue.sort((a, b) => a.serverTime - b.serverTime);
      if (!this.timeFilter.is_synchronized)
        return;
      const playoutLatencySec = this.measurePlayoutLatencySec();
      const { audioContextTimeSec: audioContextTime, audioContextRawTimeSec, nowMs, nowUs } = this.clockSource.getTimingSnapshot(this.audioContext, this.contextTimeAtRenderPosition ? 0 : playoutLatencySec);
      this.pruneExpiredScheduledSources(audioContextRawTimeSec);
      const outputLatencySec = this.useOutputLatencyCompensation ? playoutLatencySec : 0;
      const scheduleAdvanceSec = this.syncDelayMs / 1e3 + this.unreportedOutputLatencySec;
      const targetScheduledHorizonSec = this.getTargetScheduledHorizonSec();
      if (this.usesRecorrectionMonitor)
        this.recorrectionMonitor.start();
      if (this.clockSource.pendingCutover) {
        this.clockSource.pendingCutover = false;
        if (this.scheduledSources.length > 0 || this.nextPlaybackTime !== 0 || this.lastScheduledServerTime !== 0) {
          this.performGuardedCutover("delay-change", {
            incrementResyncCount: false,
            markCooldown: false
          });
          return;
        }
      }
      while (this.audioBufferQueue.length > 0) {
        const scheduledAheadSec = this.getScheduledAheadSec(audioContextRawTimeSec);
        if (this.nextPlaybackTime > 0 && scheduledAheadSec >= targetScheduledHorizonSec)
          break;
        const chunk = this.audioBufferQueue.shift();
        let playbackTime;
        let scheduleTime;
        let playbackRate;
        let startOffsetSec = 0;
        const targetPlaybackTime = this.computeTargetPlaybackTime(chunk.serverTime, audioContextTime, nowUs, outputLatencySec);
        const isTimestamp = this.clockSource.active === "timestamp";
        if (this.nextPlaybackTime === 0 || this.lastScheduledServerTime === 0) {
          this.recorrectionMonitor.armStartupGrace(nowMs, isTimestamp);
          playbackTime = targetPlaybackTime;
          scheduleTime = playbackTime - scheduleAdvanceSec;
          const minScheduleTimeSec = this.recorrectionMonitor.minScheduleTimeSec;
          if (minScheduleTimeSec !== null) {
            if (scheduleTime + chunk.buffer.duration <= minScheduleTimeSec) {
              continue;
            }
            startOffsetSec = Math.max(0, minScheduleTimeSec - scheduleTime);
            scheduleTime += startOffsetSec;
            playbackTime += startOffsetSec;
          }
          this.recorrectionMonitor.clearMinScheduleTime();
          playbackRate = 1;
        } else {
          const serverGapUs = chunk.serverTime - this.lastScheduledServerTime;
          const serverGapSec = serverGapUs / 1e6;
          if (Math.abs(serverGapSec) < 0.1) {
            const syncErrorSec = this.nextPlaybackTime - targetPlaybackTime;
            const syncErrorMs = syncErrorSec * 1e3;
            const correctionErrorMs = this.applySyncErrorEma(syncErrorMs);
            const thresholds = this.correctionThresholds[this._correctionMode];
            const canHardResync = this.recorrectionMonitor.canUseHardResync(nowMs, isTimestamp);
            if (Math.abs(correctionErrorMs) > thresholds.resyncAboveMs && canHardResync) {
              this.recorrectionMonitor.noteHardResync(nowMs);
              this.resyncCount++;
              this._intervalResyncCount++;
              this.resetSyncErrorEma();
              this.cutScheduledSources(targetPlaybackTime - scheduleAdvanceSec);
              playbackTime = targetPlaybackTime;
              scheduleTime = playbackTime - scheduleAdvanceSec;
              playbackRate = 1;
              this.currentCorrectionMethod = "resync";
              this.lastSamplesAdjusted = 0;
            } else if (Math.abs(correctionErrorMs) > thresholds.resyncAboveMs) {
              playbackTime = this.nextPlaybackTime;
              scheduleTime = this.nextScheduleTime;
              playbackRate = Number.isFinite(thresholds.rate2AboveMs) ? correctionErrorMs > 0 ? 1 + RATE_CORRECTION_FIRM : 1 - RATE_CORRECTION_FIRM : 1;
              this.currentCorrectionMethod = playbackRate === 1 ? "none" : "rate";
              this.lastSamplesAdjusted = 0;
            } else if (Math.abs(correctionErrorMs) < thresholds.deadbandBelowMs) {
              playbackTime = this.nextPlaybackTime;
              scheduleTime = this.nextScheduleTime;
              playbackRate = 1;
              this.currentCorrectionMethod = "none";
              this.lastSamplesAdjusted = 0;
            } else if (Math.abs(correctionErrorMs) <= thresholds.samplesBelowMs) {
              playbackTime = this.nextPlaybackTime;
              scheduleTime = this.nextScheduleTime;
              playbackRate = 1;
              const samplesToAdjust = correctionErrorMs > 0 ? -1 : 1;
              chunk.buffer = this.adjustBufferSamples(chunk.buffer, samplesToAdjust);
              this.currentCorrectionMethod = "samples";
              this.lastSamplesAdjusted = samplesToAdjust;
            } else {
              playbackTime = this.nextPlaybackTime;
              scheduleTime = this.nextScheduleTime;
              const absErrorMs = Math.abs(correctionErrorMs);
              if (correctionErrorMs > 0) {
                playbackRate = absErrorMs >= thresholds.rate2AboveMs ? 1 + RATE_CORRECTION_FIRM : absErrorMs >= thresholds.rate1AboveMs ? 1 + RATE_CORRECTION_SOFT : 1;
              } else {
                playbackRate = absErrorMs >= thresholds.rate2AboveMs ? 1 - RATE_CORRECTION_FIRM : absErrorMs >= thresholds.rate1AboveMs ? 1 - RATE_CORRECTION_SOFT : 1;
              }
              this.currentCorrectionMethod = playbackRate === 1 ? "none" : "rate";
              this.lastSamplesAdjusted = 0;
            }
          } else {
            if (this.recorrectionMonitor.canUseHardResync(nowMs, isTimestamp)) {
              this.recorrectionMonitor.noteHardResync(nowMs);
              this.resyncCount++;
              this._intervalResyncCount++;
              this.cutScheduledSources(targetPlaybackTime - scheduleAdvanceSec);
            }
            playbackTime = targetPlaybackTime;
            scheduleTime = playbackTime - scheduleAdvanceSec;
            playbackRate = 1;
            this.currentCorrectionMethod = "resync";
            this.lastSamplesAdjusted = 0;
          }
        }
        this.currentPlaybackRate = playbackRate;
        if (scheduleTime < audioContextRawTimeSec) {
          this.nextPlaybackTime = 0;
          this.nextScheduleTime = 0;
          this.lastScheduledServerTime = 0;
          continue;
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = chunk.buffer;
        source.playbackRate.value = playbackRate;
        source.connect(this.gainNode);
        source.start(scheduleTime, startOffsetSec);
        const actualDuration = (chunk.buffer.duration - startOffsetSec) / playbackRate;
        this.nextPlaybackTime = playbackTime + actualDuration;
        this.nextScheduleTime = scheduleTime + actualDuration;
        this.lastScheduledServerTime = chunk.serverTime + chunk.buffer.duration * 1e6;
        const scheduledEntry = {
          source,
          startTime: scheduleTime,
          endTime: scheduleTime + actualDuration,
          buffer: chunk.buffer,
          serverTime: chunk.serverTime,
          generation: chunk.generation
        };
        this.scheduledSources.push(scheduledEntry);
        source.onended = () => {
          const idx = this.scheduledSources.indexOf(scheduledEntry);
          if (idx > -1)
            this.scheduledSources.splice(idx, 1);
          if (this.scheduledSources.length === 0) {
            this.resetScheduledPlaybackState("all scheduled audio ended");
            if (this.audioBufferQueue.length > 0)
              this.processAudioQueue();
          }
        };
      }
      this.scheduleQueueRefill(targetScheduledHorizonSec);
      this.emitStatusLog(nowMs);
    }
    /**
     * AudioContext time at which a chunk must be started so its first sample
     * leaves the audio output port at the instant the server stamped it for.
     *
     * `audioContextTime` is the render clock, the same domain `source.start()`
     * takes; audio handed to the renderer becomes audible one output latency
     * later, so that latency is subtracted. Chunks whose start, after subtracting
     * the output delay and unreported output latency, has already passed are
     * dropped by the caller rather than shifted forward, which would render them
     * late.
     */
    computeTargetPlaybackTime(serverTimeUs, audioContextTime, nowUs, outputLatencySec) {
      const chunkClientTimeUs = this.timeFilter.computeClientTime(serverTimeUs);
      const deltaSec = (chunkClientTimeUs - nowUs) / 1e6;
      return audioContextTime + deltaSec - outputLatencySec;
    }
    startAudioElement() {
      if (this.outputMode === "media-element" && this.audioElement?.paused) {
        this.audioElement.play().catch((e) => {
          console.warn("Sendspin: Failed to start audio element:", e);
        });
      }
    }
    stopAudioElement() {
      if (this.outputMode === "media-element" && this.audioElement && !this.audioElement.paused) {
        this.audioElement.pause();
      }
    }
    clearBuffers() {
      this.recorrectionMonitor.fullReset();
      this.cancelScheduledRefill();
      this.scheduledSources.forEach((entry) => {
        try {
          entry.source.stop();
        } catch {
        }
      });
      this.scheduledSources = [];
      this.audioBufferQueue = [];
      if (this.scheduleTimeout !== null) {
        clearTimeout(this.scheduleTimeout);
        this.scheduleTimeout = null;
      }
      this.queueProcessScheduled = false;
      this.stateManager.resetStreamAnchors();
      this.resetScheduledPlaybackState();
      this.resyncCount = 0;
      this.latencyTracker.reset();
      this.clockSource.reset();
    }
    // Leaves the AudioContext running, since a resumed one can play late or silent on Chromium for Android.
    stop() {
      this.clearBuffers();
      this.stopAudioElement();
    }
    close() {
      this.clearBuffers();
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      this.gainNode = null;
      this.streamDestination = null;
      if (this.outputMode === "media-element" && this.audioElement) {
        this.audioElement.pause();
        this.audioElement.srcObject = null;
        this.audioElement.loop = false;
        this.audioElement.removeAttribute("src");
        this.audioElement.load();
        if (this.ownsAudioElement) {
          this.audioElement.remove();
          this.audioElement = void 0;
        }
      }
    }
    getAudioContext() {
      return this.audioContext;
    }
  };

  // node_modules/@sendspin/sendspin-js/dist/silent-audio.generated.js
  var SILENT_AUDIO_SRC = "data:audio/flac;base64,ZkxhQwAAACICQAJAAAAMAADIAfQBcAAHkwCKnZ7FLvzY30lWx+3k6wJCBAAALAwAAABMYXZmNjEuNy4xMDABAAAAFAAAAGVuY29kZXI9TGF2ZjYxLjcuMTAwgQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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kkkkkkmSSSSSTJJJJJMkkkkySSSTJJJJMkkkk/+/+//f/7//9////////////z///z//8///P//n//+SSSSSSSSSSSSQkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkmSSSSSSSSSSSSSSST////+BVP//gkDBPnQAAAAOc/VEAP/////9//////////////////z////////+f/////////////////////////////////3///////////////////////////gAhn//gkDBTyQP///+c/y0Af/////5//////////////////////////////////v/////////////////////////////////P////////////////////+T8L/+CQMFfVAAAAA5z9xQB////////////3//////////////////////////////////+f///////////////////////////////////////////////gm0f/4JAwW/EAAAADnP9JAH///////7///////////////////////////////////////////////n///////////////////////////////////////+BEl//gkDBf7AAAAABAL//gkDBjWAAAAADVc//gkDBnRAAAAAEw0//gkDBrYAAAAAMeM//gkDBvfAAAAAL7k//gkDBzKAAAAAFD5//gkDB3NAAAAACmR//gkDB7EAAAAAKIp//gkDB/DAAAAANtB//gkDCB+AAAAAMWl//gkDCF5AAAAALzN//gkDCJwAAAAADd1//gkDCN3AAAAAE4d//gkDCRiAAAAAKAA//gkDCVlAAAAANlo//gkDCZsAAAAAFLQ//gkDCdrAAAAACu4//gkDChGAAAAAA7v//gkDClBAAAAAHeH//gkDCpIAAAAAPw///gkDCtPAAAAAIVX//gkDCxaAAAAAGtK//gkDC1dAAAAABIi//gkDC5UAAAAAJma//gkDC9TAAAAAODy//gkDDAOAAAAANM0//gkDDEJAAAAAKpc//gkDDIAAAAAACHk//gkDDMHAAAAAFiM//gkDDQSAAAAALaR//gkDDUVAAAAAM/5//gkDDYcAAAAAERB//gkDDcbAAAAAD0p//gkDDg2AAAAABh+//gkDDkxAAAAAGEW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";

  // node_modules/@sendspin/sendspin-js/dist/types.js
  var MessageType;
  (function(MessageType2) {
    MessageType2["CLIENT_HELLO"] = "client/hello";
    MessageType2["SERVER_HELLO"] = "server/hello";
    MessageType2["CLIENT_TIME"] = "client/time";
    MessageType2["SERVER_TIME"] = "server/time";
    MessageType2["CLIENT_STATE"] = "client/state";
    MessageType2["SERVER_STATE"] = "server/state";
    MessageType2["CLIENT_COMMAND"] = "client/command";
    MessageType2["CLIENT_GOODBYE"] = "client/goodbye";
    MessageType2["CLIENT_LEAVE"] = "client/leave";
    MessageType2["SERVER_COMMAND"] = "server/command";
    MessageType2["STREAM_START"] = "stream/start";
    MessageType2["STREAM_CLEAR"] = "stream/clear";
    MessageType2["STREAM_REQUEST_FORMAT"] = "stream/request-format";
    MessageType2["STREAM_END"] = "stream/end";
    MessageType2["GROUP_UPDATE"] = "group/update";
    MessageType2["CLIENT_INIT"] = "client/init";
    MessageType2["SERVER_INIT"] = "server/init";
    MessageType2["NOISE_HANDSHAKE"] = "noise/handshake";
    MessageType2["SERVER_ACTIVATE"] = "server/activate";
    MessageType2["CLIENT_PAIR_PENDING"] = "client/pair-pending";
    MessageType2["CLIENT_PAIR_INIT"] = "client/pair-init";
    MessageType2["SERVER_PAIR_INIT"] = "server/pair-init";
    MessageType2["SERVER_PAIR_AUTH"] = "server/pair-auth";
    MessageType2["CLIENT_PAIR_AUTH"] = "client/pair-auth";
    MessageType2["SERVER_PAIR_CONFIRM"] = "server/pair-confirm";
    MessageType2["CLIENT_PAIR_RETRY"] = "client/pair-retry";
    MessageType2["CLIENT_PAIR_CONFIRM"] = "client/pair-confirm";
    MessageType2["CLIENT_PAIR_FINALIZE"] = "client/pair-finalize";
    MessageType2["SERVER_PAIR_FINALIZE"] = "server/pair-finalize";
    MessageType2["PAIR_ABORT"] = "pair/abort";
    MessageType2["SERVER_UNPAIR"] = "server/unpair";
  })(MessageType || (MessageType = {}));

  // node_modules/@sendspin/sendspin-js/dist/index.js
  function detectIsAndroid() {
    if (typeof navigator === "undefined")
      return false;
    return /Android/i.test(navigator.userAgent);
  }
  function detectIsIOS() {
    if (typeof navigator === "undefined")
      return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }
  function detectIsMobile() {
    return detectIsAndroid() || detectIsIOS();
  }
  function detectIsCastRuntime() {
    if (typeof navigator === "undefined")
      return false;
    return /CrKey/i.test(navigator.userAgent);
  }
  var DISCONNECT_PLAYBACK_RESET_GRACE_MS = 250;
  var SendspinPlayer = class {
    constructor(config) {
      this.ownsAudioElement = false;
      this.disconnectPlaybackResetTimeout = null;
      this.suppressDisconnectPlaybackReset = false;
      const isAndroid = detectIsAndroid();
      const isCastRuntime = detectIsCastRuntime();
      const isMobile = detectIsMobile();
      const outputMode = config.audioElement || isMobile ? "media-element" : "direct";
      this.ownsAudioElement = outputMode === "media-element" && !config.audioElement;
      if (this.ownsAudioElement && typeof document === "undefined") {
        throw new Error("SendspinPlayer requires a DOM document to use media-element output without a provided audioElement.");
      }
      let storage = null;
      if (config.storage !== void 0) {
        storage = config.storage;
      } else if (typeof localStorage !== "undefined") {
        storage = localStorage;
      }
      this.core = new SendspinCore({
        url: config.url,
        clientName: config.clientName,
        productName: config.productName,
        manufacturer: config.manufacturer,
        softwareVersion: config.softwareVersion,
        webSocket: config.webSocket,
        codecs: config.codecs,
        bufferCapacity: config.bufferCapacity,
        syncDelay: config.syncDelay,
        defaultSyncDelay: config.defaultSyncDelay,
        storage,
        requiredLeadTimeMs: config.requiredLeadTimeMs,
        minBufferMs: config.minBufferMs,
        useHardwareVolume: config.useHardwareVolume,
        onVolumeCommand: config.onVolumeCommand,
        onDelayCommand: config.onDelayCommand,
        getExternalVolume: config.getExternalVolume,
        reconnect: config.reconnect,
        onStateChange: config.onStateChange,
        onPairing: config.onPairing,
        onPairingCode: config.onPairingCode,
        pairingCodeOutChannels: config.pairingCodeOutChannels,
        pairingCodeFormats: config.pairingCodeFormats,
        staticPairingCode: config.staticPairingCode,
        staticPairingCodeLocations: config.staticPairingCodeLocations,
        pairingPskLocations: config.pairingPskLocations,
        suite: config.suite,
        unpairedAccess: config.unpairedAccess,
        longTermPsks: config.longTermPsks,
        applicationRoles: config.applicationRoles
      });
      const syncDelay = this.core.getSyncDelayMs();
      this.scheduler = new AudioScheduler({
        stateManager: this.core._stateManager,
        timeFilter: this.core._timeFilter,
        outputMode,
        audioElement: config.audioElement,
        isAndroid,
        isCastRuntime,
        ownsAudioElement: this.ownsAudioElement,
        silentAudioSrc: isAndroid ? SILENT_AUDIO_SRC : void 0,
        syncDelayMs: syncDelay,
        useHardwareVolume: config.useHardwareVolume ?? false,
        correctionMode: config.correctionMode ?? "sync",
        storage,
        useOutputLatencyCompensation: config.useOutputLatencyCompensation ?? true,
        correctionThresholds: config.correctionThresholds
      });
      this.core.onAudioData = (chunk) => {
        this.scheduler.handleDecodedChunk(chunk);
      };
      this.core.onStreamStart = (format, isFormatUpdate) => {
        this.scheduler.initAudioContext();
        void this.scheduler.resumeAudioContext().catch((error) => {
          console.warn("Sendspin: Failed to resume AudioContext:", error);
        });
        if (!isFormatUpdate) {
          this.scheduler.clearBuffers();
        }
        this.scheduler.startAudioElement();
      };
      this.core.onStreamClear = () => {
        this.scheduler.clearBuffers();
      };
      this.core.onStreamEnd = () => {
        this.scheduler.clearBuffers();
        this.scheduler.stopAudioElement();
      };
      this.core.onVolumeUpdate = () => {
        this.scheduler.updateVolume();
      };
      this.core.onSyncDelayChange = (delayMs) => {
        this.scheduler.setSyncDelay(delayMs);
      };
      this.core.onConnectionOpen = () => {
        this.cancelPendingDisconnectPlaybackReset();
      };
      this.core.onConnectionClose = () => {
        if (this.suppressDisconnectPlaybackReset) {
          return;
        }
        this.scheduleDisconnectPlaybackReset();
      };
    }
    cancelPendingDisconnectPlaybackReset() {
      if (this.disconnectPlaybackResetTimeout !== null) {
        clearTimeout(this.disconnectPlaybackResetTimeout);
        this.disconnectPlaybackResetTimeout = null;
      }
    }
    resetPlaybackStateAfterDisconnect() {
      this.disconnectPlaybackResetTimeout = null;
      if (this.core.isConnected) {
        return;
      }
      this.scheduler.clearBuffers();
      this.core.resetPlaybackState();
      this.scheduler.stopAudioElement();
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "paused";
      }
    }
    scheduleDisconnectPlaybackReset() {
      this.cancelPendingDisconnectPlaybackReset();
      const runwaySec = this.scheduler.measureBufferedPlaybackRunwaySec();
      if (runwaySec <= 0) {
        this.resetPlaybackStateAfterDisconnect();
        return;
      }
      this.disconnectPlaybackResetTimeout = setTimeout(() => {
        this.resetPlaybackStateAfterDisconnect();
      }, runwaySec * 1e3 + DISCONNECT_PLAYBACK_RESET_GRACE_MS);
    }
    /**
     * Initialize and resume audio playback. Call this directly from a click or
     * tap handler, before any other await, to satisfy browser autoplay policies.
     */
    async unlock() {
      this.scheduler.initAudioContext();
      this.scheduler.startAudioElement();
      await this.scheduler.resumeAudioContext();
    }
    // Connect to Sendspin server
    async connect() {
      this.suppressDisconnectPlaybackReset = false;
      return this.core.connect();
    }
    /**
     * Disconnect from Sendspin server. The player keeps its audio output for the
     * next connect(). Call destroy() instead when dropping the player.
     * @param reason - Optional reason for disconnecting (default: 'user_request')
     */
    disconnect(reason = "user_request") {
      this.cancelPendingDisconnectPlaybackReset();
      this.suppressDisconnectPlaybackReset = true;
      this.core.disconnect(reason);
      this.scheduler.stop();
      if (typeof navigator !== "undefined" && navigator.mediaSession) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    }
    /**
     * Disconnect and release the audio output. Call this when dropping the player.
     * @param reason - Optional reason for disconnecting (default: 'user_request')
     */
    destroy(reason) {
      this.disconnect(reason);
      this.scheduler.close();
    }
    /** Leave the current group. Does nothing until the server has activated the connection. */
    leaveGroup() {
      this.core.leaveGroup();
    }
    // Set volume (0-100). Throws RangeError if NaN. With useHardwareVolume, report a device volume change.
    setVolume(volume) {
      this.core.setVolume(volume);
    }
    // Set muted state. With useHardwareVolume, report a device mute change.
    setMuted(muted) {
      this.core.setMuted(muted);
    }
    // Set output delay (in milliseconds, 0-5000)
    setSyncDelay(delayMs) {
      this.core.setSyncDelay(delayMs);
    }
    /**
     * Update the reported startup lead time at runtime (ms). Reported to the
     * server via client/state. Debounce calls to avoid reacting to transient
     * fluctuations. Throws RangeError if not a non-negative finite number.
     */
    setRequiredLeadTimeMs(leadTimeMs) {
      this.core.setRequiredLeadTimeMs(leadTimeMs);
    }
    /**
     * Update the reported minimum ongoing buffer duration at runtime (ms).
     * Reported to the server via client/state. Debounce calls to avoid reacting
     * to transient fluctuations. Throws RangeError if not a non-negative finite
     * number.
     */
    setMinBufferMs(minBufferMs) {
      this.core.setMinBufferMs(minBufferMs);
    }
    /**
     * Set the sync correction mode at runtime.
     */
    setCorrectionMode(mode) {
      this.scheduler.setCorrectionMode(mode);
    }
    // ========================================
    // Controller Commands (sent to server)
    // ========================================
    /**
     * Send a controller command to the server. Throws unless the latest
     * controller state lists the command, and throws RangeError if a volume
     * command carries a NaN volume or a seek command a non-finite value.
     */
    sendCommand(command, params) {
      this.core.sendCommand(command, params);
    }
    // Getters for reactive state
    get isPlaying() {
      return this.core.isPlaying;
    }
    get volume() {
      return this.core.volume;
    }
    get muted() {
      return this.core.muted;
    }
    get playerState() {
      return this.core.playerState;
    }
    get currentFormat() {
      return this.core.currentFormat;
    }
    get isConnected() {
      return this.core.isConnected;
    }
    /** The client's stable identity id (base64url X25519 public key). */
    get clientId() {
      return this.core.clientId;
    }
    /**
     * The token the operator enters on the server to pair. Keep it secret,
     * since anyone with it can pair.
     */
    get pairingToken() {
      return this.core.pairingToken;
    }
    /** Rotate the Pairing PSK, returning the new pairing token. */
    rotatePairingPsk() {
      return this.core.rotatePairingPsk();
    }
    /**
     * Opens the pairing window for 5 minutes. It admits pairing attempts on
     * the connection that carries its first, and closes on a completed pairing,
     * the fifth wrong code, a drop of that connection, or cancelPairing().
     * Call it only when the user presses a pairing button on the device, never
     * because the server asked.
     * Static code pairing always needs it.
     * onPairing("pending") fires while an attempt waits for it.
     */
    openPairingWindow() {
      this.core.openPairingWindow();
    }
    /** Close the pairing window and cancel an in-progress attempt with pair/abort user_cancelled. */
    cancelPairing() {
      this.core.cancelPairing();
    }
    /**
     * Releases dynamic code pairing after 20 rounds without a correct code and
     * resets the count.
     * Call it only when the user acts on the device, never because the server
     * asked. It has no effect while an attempt is running.
     * onPairing("pending") fires while an attempt waits for it.
     */
    releasePairingHold() {
      this.core.releasePairingHold();
    }
    /** Whether dynamic code pairing is held back after 20 rounds without a correct code. */
    isRoundLimitReached() {
      return this.core.isRoundLimitReached();
    }
    // Get current correction mode
    get correctionMode() {
      return this.scheduler.correctionMode;
    }
    // Time sync info for debugging
    get timeSyncInfo() {
      return this.core.timeSyncInfo;
    }
    /** Get current server time in microseconds using synchronized clock */
    getCurrentServerTimeUs() {
      return this.core.getCurrentServerTimeUs();
    }
    /** Get current track progress with real-time position calculation */
    get trackProgress() {
      return this.core.trackProgress;
    }
    // Sync info for debugging/display
    get syncInfo() {
      return this.scheduler.syncInfo;
    }
  };

  // desktop-audio.js
  function createDesktopAudio({ Player = SendspinPlayer, onStatus = () => {
  }, onMediaState = () => {
  } } = {}) {
    let player;
    let endpoint;
    let generation = 0;
    let statusTimer;
    let lastStatus = "";
    let activated = false;
    let connectionStarted = false;
    let waitingSince = 0;
    const report = (status, detail = "") => {
      const key = `${status}:${detail}`;
      if (key === lastStatus) return;
      lastStatus = key;
      onStatus({ status, detail, clientId: player?.clientId || "" });
    };
    const stop = () => {
      generation++;
      clearInterval(statusTimer);
      player?.destroy();
      player = void 0;
      endpoint = void 0;
      activated = false;
      connectionStarted = false;
      report("disabled");
    };
    return {
      get clientId() {
        return player?.clientId || "";
      },
      unlock: () => player?.unlock(),
      sendCommand: (command, params = {}) => player?.sendCommand(command, params),
      stop,
      async start(config) {
        if (!config.enabled) {
          stop();
          return;
        }
        if (player && endpoint === config.url) {
          const instance2 = player;
          const current2 = generation;
          await instance2.unlock();
          if (current2 === generation && !connectionStarted) {
            connectionStarted = true;
            await instance2.connect();
          }
          return;
        }
        stop();
        const current = generation;
        waitingSince = Date.now();
        endpoint = config.url;
        player = new Player({
          url: config.url,
          clientName: config.name,
          productName: "Decksona",
          softwareVersion: config.version,
          // Chromium decodes FLAC natively; PCM is the lossless fallback.
          codecs: config.codecs || ["flac", "pcm"],
          audioElement: config.audioElement,
          onStateChange: (state) => {
            if (current !== generation) return;
            if (state.groupState?.group_id) activated = true;
            onMediaState(state);
            if (activated && !lastStatus.startsWith("pairing:")) report("ready");
          },
          onPairingCode: (code) => {
            if (current === generation) report(code ? "pairing" : "connecting", code ? `Enter code ${code} in Music Assistant\u2019s player setup.` : "");
          },
          reconnect: { onReconnecting: () => {
            if (current === generation) {
              activated = false;
              waitingSince = Date.now();
              report("reconnecting");
            }
          } }
        });
        const instance = player;
        report("connecting");
        statusTimer = setInterval(() => {
          if (instance.isConnected && activated && !lastStatus.startsWith("pairing:")) report("ready");
          else if (instance.isConnected && !activated && Date.now() - waitingSince >= 15e3 && !lastStatus.startsWith("pairing:")) {
            report("error", "The audio connection is open but Music Assistant has not made this player ready. Check Decksona\u2019s player setup in Music Assistant.");
          } else if (!instance.isConnected && !["pairing", "error"].some((value) => lastStatus.startsWith(`${value}:`))) report("reconnecting");
        }, 1e3);
        try {
          await instance.unlock();
          if (current !== generation) return;
          connectionStarted = true;
          await instance.connect();
          if (current === generation && instance.isConnected && activated) report("ready");
        } catch {
          if (current === generation) report("error", "Local audio cannot connect. Check the Sendspin address, server version, and firewall; Decksona will retry automatically.");
        }
      }
    };
  }
  window.createDesktopAudio = createDesktopAudio;

  // web-audio.js
  var import_local_audio_config = __toESM(require_local_audio_config());
  window.createPhoneAudio = ({ onStatus, onMediaState } = {}) => {
    let element;
    const output = createDesktopAudio({ onStatus, onMediaState });
    return {
      get clientId() {
        return output.clientId;
      },
      unlock: () => output.unlock(),
      sendCommand: (command, params) => output.sendCommand(command, params),
      start(server, override = "") {
        const url = (0, import_local_audio_config.sendspinUrl)(server, override);
        if (location.protocol === "https:" && url.startsWith("ws:")) {
          throw new Error("This HTTPS page needs a secure wss:// Sendspin address. Enter it in Advanced phone audio, or open Decksona using your local HTTP address on home Wi-Fi.");
        }
        if (!globalThis.crypto?.getRandomValues) throw new Error("This browser cannot create a phone player. Open Decksona in an up-to-date Safari or Chrome.");
        if (!element) {
          element = document.createElement("audio");
          element.autoplay = true;
          element.setAttribute("playsinline", "");
          element.hidden = true;
          document.body.append(element);
        }
        if (navigator.audioSession) {
          try {
            navigator.audioSession.type = "playback";
          } catch {
          }
        }
        return output.start({
          enabled: true,
          url,
          name: "Decksona \xB7 Phone",
          version: "0.1.0",
          // PCM needs neither WebCodecs nor WASM and works on Safari over local HTTP.
          codecs: ["pcm"],
          audioElement: element
        });
      },
      stop() {
        output.stop();
        element?.remove();
        element = void 0;
        if (navigator.audioSession) {
          try {
            navigator.audioSession.type = "auto";
          } catch {
          }
        }
      }
    };
  };
})();
/*! Bundled license information:

@noble/curves/utils.js:
@noble/curves/abstract/modular.js:
@noble/curves/abstract/curve.js:
@noble/curves/abstract/edwards.js:
@noble/curves/abstract/montgomery.js:
@noble/curves/ed25519.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/ciphers/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)
*/
