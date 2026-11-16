export type GameStatus = 'title' | 'playing' | 'paused' | 'gameover';

export const MAX_MISSES = 3;

export type HeadKey = 'sleeper_head' | 'flyer_head_1' | 'flyer_head_2';
export type FlyerHeadKey = 'flyer_head_1' | 'flyer_head_2';

export type CruisingAudioKey =
  | 'cruising_1'
  | 'cruising_2'
  | 'cruising_3'
  | 'cruising_4'
  | 'cruising_5'
  | 'cruising_6'
  | 'cruising_7'
  | 'cruising_8';

export type AudioKey =
  | CruisingAudioKey
  | 'slap_sfx'
  | 'hit_punchline'
  | 'miss_reaction'
  | 'gameover_audio';

export const BGM_TRACKS = [
  '/assets/audio/bgm/bgm_1_are_bhai.mp3',
  '/assets/audio/bgm/bgm_2_angry_amitabh.mp3',
  '/assets/audio/bgm/bgm_3_main_amitabh.mp3',
  '/assets/audio/bgm/bgm_4_nahi_maanenge.mp3',
  '/assets/audio/bgm/bgm_5_gst_bst_cst.mp3',
  '/assets/audio/bgm/bgm_6_computer_ji.mp3',
  '/assets/audio/bgm/bgm_7_kyun_bane_crorepati.mp3',
] as const;

export interface AudioManifestEntry {
  key: AudioKey;
  filename: string;
  category: 'cruising' | 'hit' | 'miss' | 'gameover';
  label: string;
  script: string;
}

export const AUDIO_MANIFEST: Record<AudioKey, AudioManifestEntry> = {
  cruising_1: {
    key: 'cruising_1',
    filename: 'cruising_1.mp3',
    category: 'cruising',
    label: 'Cruising Line 1',
    script: 'Arre soya na abhi? Aye betichod ke so ja!',
  },
  cruising_2: {
    key: 'cruising_2',
    filename: 'cruising_2.mp3',
    category: 'cruising',
    label: 'Cruising Line 2',
    script:
      'Abbe gaandmare so ja, nahi karegi woh tere ko unblock jo tu intezaar mein baitha hua hai raat ko 1 baje!',
  },
  cruising_3: {
    key: 'cruising_3',
    filename: 'cruising_3.mp3',
    category: 'cruising',
    label: 'Cruising Line 3',
    script: 'Haan bhai chutiya uth gaya? Abbe saale thoo tere pe!',
  },
  cruising_4: {
    key: 'cruising_4',
    filename: 'cruising_4.mp3',
    category: 'cruising',
    label: 'Cruising Line 4',
    script:
      'Abbe uth ja chutiye bistar se uth ja, tere bacche taiyaar ho gaye hain tere ko school chhodne ke liye jaana hai unko!',
  },
  cruising_5: {
    key: 'cruising_5',
    filename: 'cruising_5.mp3',
    category: 'cruising',
    label: 'Cruising Line 5',
    script: 'Oye betichod ke bed pe...',
  },
  cruising_6: {
    key: 'cruising_6',
    filename: 'cruising_6.mp3',
    category: 'cruising',
    label: 'Cruising Line 6',
    script: 'Arre so jao betichod kabhi jagah baithe ho tum...',
  },
  cruising_7: {
    key: 'cruising_7',
    filename: 'cruising_7.mp3',
    category: 'cruising',
    label: 'Cruising Line 7',
    script:
      'Abbe so ja betichod ke, ab kya phone mein hi laga rahega poori raat? So ja!',
  },
  cruising_8: {
    key: 'cruising_8',
    filename: 'cruising_8.mp3',
    category: 'cruising',
    label: 'Cruising Line 8',
    script: 'Oye neend nahi aa rahi kya tujhe? Kya...',
  },
  slap_sfx: {
    key: 'slap_sfx',
    filename: 'slap_sfx.mp3',
    category: 'hit',
    label: 'Slap Impact SFX',
    script: 'Loud slap / punch impact sound',
  },
  hit_punchline: {
    key: 'hit_punchline',
    filename: 'hit_punchline.mp3',
    category: 'hit',
    label: 'Hit Impact Voice Line',
    script: 'Are maiya!',
  },
  miss_reaction: {
    key: 'miss_reaction',
    filename: 'miss_reaction.mp3',
    category: 'miss',
    label: 'Miss Reaction Voice Line',
    script: 'Chal chal chal!',
  },
  gameover_audio: {
    key: 'gameover_audio',
    filename: 'mkb_amitabh_bachchan_fa595f97.mp3',
    category: 'gameover',
    label: 'Game Over (3 Misses) Audio',
    script: 'Plays automatically when you miss 3 targets and lose',
  },
};

export const CRUISING_KEYS: CruisingAudioKey[] = [
  'cruising_1',
  'cruising_2',
  'cruising_3',
  'cruising_4',
  'cruising_5',
  'cruising_6',
  'cruising_7',
  'cruising_8',
];

export interface FlyerEntity {
  id: number;
  headKey: FlyerHeadKey;
  x: number;
  y: number;
  vx: number;
  direction: 1 | -1; // 1 = left-to-right, -1 = right-to-left
  bobPhase: number;
  knockedOut: boolean;
  koElapsedMs: number;
  koDurationMs: number;
  koSpinRad: number;
  koVy: number;
  koVx: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
  shape: 'shard' | 'spark' | 'line';
}

export interface StarburstEffect {
  active: boolean;
  x: number;
  y: number;
  elapsedMs: number;
  durationMs: number;
  seed: number;
}

export interface WhooshEffect {
  active: boolean;
  originX: number;
  originY: number;
  angleDeg: number;
  elapsedMs: number;
  durationMs: number;
}
