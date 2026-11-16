import {
  AUDIO_MANIFEST,
  BGM_TRACKS,
  CRUISING_KEYS,
  type AudioKey,
} from './types';
import {
  BGM_VOLUME,
  computeBgmGapMs,
  pickNextBgmIndex,
} from './physics';

export class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private defaultUrls: Record<AudioKey, string> = {
    cruising_1: '/assets/audio/cruising_1.wav',
    cruising_2: '/assets/audio/cruising_2.wav',
    cruising_3: '/assets/audio/cruising_3.wav',
    cruising_4: '/assets/audio/cruising_4.wav',
    cruising_5: '/assets/audio/cruising_5.wav',
    cruising_6: '/assets/audio/cruising_6.wav',
    cruising_7: '/assets/audio/cruising_7.wav',
    cruising_8: '/assets/audio/cruising_8.wav',
    slap_sfx: '/assets/audio/slap_sfx.wav',
    hit_punchline: '/assets/audio/hit_punchline.mp3',
    miss_reaction: '/assets/audio/miss_reaction.mp3',
    gameover_audio: '/assets/aistudio/mkb_amitabh_bachchan_fa595f97.mp3',
  };
  private customUrls: Partial<Record<AudioKey, string>> = {};
  private preloadedUrls: Set<string> = new Set();
  private activeCruisingAudio: HTMLAudioElement | null = null;
  private activeVoiceAudios: Set<HTMLAudioElement> = new Set();
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private bgmActive = false;
  private bgmCurrentIndex = -1;
  private muted = false;

  public preloadAll(): void {
    if (typeof Audio === 'undefined') return;
    for (const key of Object.keys(AUDIO_MANIFEST) as AudioKey[]) {
      const url = this.getEffectiveUrl(key);
      if (url && !this.preloadedUrls.has(url)) {
        this.preloadedUrls.add(url);
        try {
          const el = new Audio(url);
          el.preload = 'auto';
          el.load();
        } catch {
          // Ignore preload failure in restricted environments
        }
      }
    }
    for (const url of BGM_TRACKS) {
      if (!this.preloadedUrls.has(url)) {
        this.preloadedUrls.add(url);
        try {
          const el = new Audio(url);
          el.preload = 'auto';
          el.load();
        } catch {
          // Ignore
        }
      }
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    this.preloadAll();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopCruising();
      this.stopAllVoices();
      this.pauseBgm();
    } else if (this.bgmActive) {
      this.resumeBgm();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startBgm(): void {
    this.bgmActive = true;
    if (this.muted || typeof Audio === 'undefined') return;
    this.unlock();
    if (this.bgmAudio && this.bgmAudio.paused && !this.bgmAudio.ended) {
      void this.bgmAudio.play().catch(() => {});
      return;
    }
    if (this.bgmTimeoutId !== null) return;
    this.playNextBgmTrack();
  }

  public pauseBgm(): void {
    if (this.bgmTimeoutId !== null) {
      clearTimeout(this.bgmTimeoutId);
      this.bgmTimeoutId = null;
    }
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
      } catch {
        // Ignore
      }
    }
  }

  public resumeBgm(): void {
    if (!this.bgmActive || this.muted || typeof Audio === 'undefined') return;
    this.unlock();
    if (this.bgmAudio && this.bgmAudio.paused && !this.bgmAudio.ended) {
      void this.bgmAudio.play().catch(() => {});
      return;
    }
    if (this.bgmTimeoutId === null && !this.bgmAudio) {
      this.playNextBgmTrack();
    }
  }

  public stopBgm(): void {
    this.bgmActive = false;
    if (this.bgmTimeoutId !== null) {
      clearTimeout(this.bgmTimeoutId);
      this.bgmTimeoutId = null;
    }
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.bgmAudio = null;
    }
  }

  private playNextBgmTrack(): void {
    if (!this.bgmActive || this.muted || typeof Audio === 'undefined') return;
    if (this.bgmTimeoutId !== null) {
      clearTimeout(this.bgmTimeoutId);
      this.bgmTimeoutId = null;
    }

    const nextIdx = pickNextBgmIndex(this.bgmCurrentIndex, BGM_TRACKS.length);
    this.bgmCurrentIndex = nextIdx;
    const url = BGM_TRACKS[nextIdx];

    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.bgmAudio = null;
    }

    try {
      const audio = new Audio(url);
      audio.volume = BGM_VOLUME;

      const onTrackFinished = () => {
        if (this.bgmAudio === audio) {
          this.bgmAudio = null;
        }
        if (this.bgmActive && !this.muted) {
          const gapMs = computeBgmGapMs();
          this.bgmTimeoutId = setTimeout(() => {
            this.playNextBgmTrack();
          }, gapMs);
        }
      };

      audio.addEventListener('ended', onTrackFinished, { once: true });
      audio.addEventListener('error', onTrackFinished, { once: true });

      this.bgmAudio = audio;
      void audio.play().catch(() => {});
    } catch {
      if (this.bgmActive && !this.muted) {
        const gapMs = computeBgmGapMs();
        this.bgmTimeoutId = setTimeout(() => {
          this.playNextBgmTrack();
        }, gapMs);
      }
    }
  }

  public setCustomAudioUrl(key: AudioKey, url: string | null): void {
    if (url) {
      this.customUrls[key] = url;
      if (typeof Audio !== 'undefined' && !this.preloadedUrls.has(url)) {
        this.preloadedUrls.add(url);
        try {
          const el = new Audio(url);
          el.preload = 'auto';
          el.load();
        } catch {
          // Ignore preload failure
        }
      }
    } else {
      delete this.customUrls[key];
    }
  }

  public getEffectiveUrl(key: AudioKey): string {
    return this.customUrls[key] ?? this.defaultUrls[key];
  }

  public getDefaultUrl(key: AudioKey): string {
    return this.defaultUrls[key];
  }

  public getCustomAudioUrls(): Partial<Record<AudioKey, string>> {
    return { ...this.customUrls };
  }

  public stopCruising(): void {
    if (this.activeCruisingAudio) {
      try {
        this.activeCruisingAudio.pause();
        this.activeCruisingAudio.currentTime = 0;
      } catch {
        // Ignore media stop failures
      }
      this.activeCruisingAudio = null;
    }
  }

  public stopAllVoices(): void {
    this.stopCruising();
    for (const audio of this.activeVoiceAudios) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore media stop failures
      }
    }
    this.activeVoiceAudios.clear();
  }

  private playAudioFile(key: AudioKey, isCruising: boolean): boolean {
    if (this.muted || typeof Audio === 'undefined') return false;
    const sourceUrl = this.getEffectiveUrl(key);
    if (!sourceUrl) return false;

    try {
      const audio = new Audio(sourceUrl);
      audio.volume = key === 'slap_sfx' ? 0.95 : 0.95;
      if (isCruising) {
        this.stopCruising();
        this.activeCruisingAudio = audio;
      } else {
        this.activeVoiceAudios.add(audio);
      }
      audio.addEventListener('ended', () => {
        if (this.activeCruisingAudio === audio) {
          this.activeCruisingAudio = null;
        }
        this.activeVoiceAudios.delete(audio);
      });
      void audio.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  public playCruisingLine(): AudioKey {
    const idx = Math.floor(Math.random() * CRUISING_KEYS.length);
    const key = CRUISING_KEYS[idx];
    this.unlock();
    const played = this.playAudioFile(key, true);
    if (!played && !this.muted) {
      this.synthChatterCue();
    }
    return key;
  }

  public playHit(): void {
    this.unlock();
    // 1. Immediately interrupt any cruising voice line
    this.stopCruising();

    if (this.muted) return;

    // 2. Play slap impact (default or custom audio)
    const playedSfx = this.playAudioFile('slap_sfx', false);
    if (!playedSfx) {
      this.synthSlapImpact();
    }

    // 3. Layer the Hit Impact Voice Line
    this.playAudioFile('hit_punchline', false);
  }

  public playMiss(): void {
    this.unlock();
    if (this.muted) return;

    const played = this.playAudioFile('miss_reaction', false);
    if (!played) {
      this.synthWhoosh();
    }
  }

  public playGameOver(): void {
    this.unlock();
    this.stopBgm();
    this.stopAllVoices();
    if (this.muted) return;

    const played = this.playAudioFile('gameover_audio', false);
    if (!played) {
      this.synthWhoosh();
    }
  }

  public previewKey(key: AudioKey): void {
    this.unlock();
    if (this.muted) return;
    const isCruising = AUDIO_MANIFEST[key].category === 'cruising';
    const played = this.playAudioFile(key, isCruising);
    if (!played) {
      if (key === 'slap_sfx' || key === 'hit_punchline') {
        this.synthSlapImpact();
      } else if (key === 'miss_reaction') {
        this.synthWhoosh();
      } else {
        this.synthChatterCue();
      }
    }
  }

  private synthSlapImpact(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;

    // Sharp white-noise slap crack
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.028));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1650, now);
    bandpass.Q.setValueAtTime(0.9, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start(now);

    // Low comic punch thump
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);

    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(0.7, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(punchGain);
    punchGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  private synthWhoosh(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.22;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + duration);
    filter.Q.setValueAtTime(1.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  private synthChatterCue(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.14);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}
