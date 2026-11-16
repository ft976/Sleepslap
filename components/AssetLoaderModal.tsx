'use client';

import React, { useState } from 'react';
import {
  Download,
  FolderUp,
  Image as ImageIcon,
  Music,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  AUDIO_MANIFEST,
  type AudioKey,
  type HeadKey,
} from '@/lib/game/types';

export interface CustomImageMeta {
  url: string;
  fileName: string;
}

export interface CustomAudioMeta {
  url: string;
  fileName: string;
}

interface AssetLoaderModalProps {
  open: boolean;
  onClose: () => void;
  headPreviews: Record<HeadKey, string>;
  customImages: Partial<Record<HeadKey, CustomImageMeta>>;
  customAudios: Partial<Record<AudioKey, CustomAudioMeta>>;
  muted: boolean;
  onToggleMute: () => void;
  onUploadImage: (key: HeadKey, file: File) => void;
  onResetImage: (key: HeadKey) => void;
  onUploadAudio: (key: AudioKey, file: File) => void;
  onImportAudioPack: (files: File[]) => Promise<{ matched: number; total: number }>;
  onDownloadAudioPack: () => Promise<void>;
  onResetAudio: (key: AudioKey) => void;
  onPreviewAudio: (key: AudioKey) => void;
  onResetAllAssets: () => void;
}

const HEAD_SLOTS: Array<{ key: HeadKey; title: string; desc: string }> = [
  {
    key: 'sleeper_head',
    title: 'Sleeper Head (sleeper_head.png)',
    desc: 'Photo cutout resting on the pillow at bottom-left of bed',
  },
  {
    key: 'flyer_head_1',
    title: 'Flying Roaster 1 (flyer_head_1.png)',
    desc: 'Photo cutout roaster 1 alternating on top spawns',
  },
  {
    key: 'flyer_head_2',
    title: 'Flying Roaster 2 (flyer_head_2.png)',
    desc: 'Photo cutout roaster 2 alternating on top spawns',
  },
];

const AUDIO_KEYS = Object.keys(AUDIO_MANIFEST) as AudioKey[];

export default function AssetLoaderModal({
  open,
  onClose,
  headPreviews,
  customImages,
  customAudios,
  muted,
  onToggleMute,
  onUploadImage,
  onResetImage,
  onUploadAudio,
  onImportAudioPack,
  onDownloadAudioPack,
  onResetAudio,
  onPreviewAudio,
  onResetAllAssets,
}: AssetLoaderModalProps) {
  const [packStatus, setPackStatus] = useState<string>('');
  const [downloadingPack, setDownloadingPack] = useState<boolean>(false);

  if (!open) return null;

  const customCount = Object.keys(customAudios).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
    >
      <div className="flex max-h-[88dvh] w-full max-w-[406px] flex-col overflow-hidden rounded-2xl border-2 border-[#222222] bg-[#F7F7F7] text-[#222222] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
          <div>
            <h2
              id="asset-modal-title"
              className="text-base font-extrabold tracking-tight text-[#222222]"
            >
              Customize Images &amp; Audio
            </h2>
            <p className="text-xs text-[#666666]">
              Download Audio Pack, import MP3/ZIP packs, or swap PNGs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize modal"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-[#222222] transition-colors hover:bg-black/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Quick Sound & Export Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white px-2 text-xs font-bold text-[#222222] whitespace-nowrap transition-colors hover:bg-black/5"
            >
              {muted ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>Sound Off</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#222222]" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            <a
              href="/sleep-slap-standalone.html"
              download="sleep-slap.html"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white px-2 text-xs font-bold text-[#222222] whitespace-nowrap transition-colors hover:bg-black/5"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>HTML File</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setPackStatus('');
                onResetAllAssets();
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white px-2 text-xs font-bold text-[#555555] whitespace-nowrap transition-colors hover:bg-black/5"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Reset All</span>
            </button>
          </div>

          {/* Audio Pack Bulk Download & Import */}
          <section className="rounded-xl border border-black/15 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#222222]">
                  Audio Pack ({AUDIO_KEYS.length} Tracks Active)
                </h3>
                <p className="mt-0.5 text-[11px] text-[#666666]">
                  {customCount > 0
                    ? `${customCount} custom audio${customCount === 1 ? '' : 's'} loaded & saved`
                    : 'All 12 default audio tracks ready'}
                </p>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="download-audio-pack"
                disabled={downloadingPack}
                onClick={async () => {
                  setDownloadingPack(true);
                  setPackStatus('Packaging audio pack...');
                  try {
                    await onDownloadAudioPack();
                    setPackStatus('Audio pack ZIP downloaded (12 tracks)');
                  } catch {
                    setPackStatus('Could not package audio pack');
                  } finally {
                    setDownloadingPack(false);
                  }
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-black/15 bg-[#F4F4F4] px-2.5 text-xs font-bold text-[#222222] transition-colors hover:bg-black/10 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{downloadingPack ? 'Packing...' : 'Download Pack'}</span>
              </button>

              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#222222] px-2.5 text-xs font-bold text-white transition-colors hover:bg-black">
                <FolderUp className="h-3.5 w-3.5 shrink-0" />
                <span>Import Pack / ZIP</span>
                <input
                  type="file"
                  accept=".zip,application/zip,audio/*"
                  multiple
                  className="sr-only"
                  data-testid="import-audio-pack"
                  aria-label="Import audio pack ZIP or multiple audio files"
                  onChange={async (e) => {
                    const list = e.target.files;
                    if (!list || list.length === 0) return;
                    const files = Array.from(list);
                    e.currentTarget.value = '';
                    setPackStatus('Loading audio pack...');
                    const res = await onImportAudioPack(files);
                    setPackStatus(
                      res.matched > 0
                        ? `Matched & loaded ${res.matched} of ${res.total} audio file${res.total === 1 ? '' : 's'}`
                        : 'No matching audio filenames found (use cruising_1..8, slap_sfx, hit_punchline, miss_reaction, gameover_audio)'
                    );
                  }}
                />
              </label>
            </div>

            {packStatus && (
              <p
                data-testid="audio-pack-status"
                className="mt-2 text-[11px] font-semibold text-emerald-700"
              >
                {packStatus}
              </p>
            )}
          </section>

          {/* 3 Cutout Face PNG Slots */}
          <section aria-labelledby="section-images">
            <div className="mb-2 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-[#444444]" />
              <h3
                id="section-images"
                className="text-xs font-extrabold uppercase tracking-wider text-[#444444]"
              >
                Cutout Face PNGs (3)
              </h3>
            </div>
            <div className="space-y-2.5">
              {HEAD_SLOTS.map((slot) => {
                const custom = customImages[slot.key];
                return (
                  <div
                    key={slot.key}
                    className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2.5"
                  >
                    <img
                      src={headPreviews[slot.key]}
                      alt={slot.title}
                      className="h-12 w-12 shrink-0 rounded-full border border-black/15 bg-[#EAEAEA] object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[#222222]">
                        {slot.title}
                      </div>
                      <div className="truncate text-[11px] text-[#666666]">
                        {custom ? `Loaded: ${custom.fileName}` : slot.desc}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#222222] px-2.5 text-xs font-bold text-white transition-colors hover:bg-black">
                        <span>Choose</span>
                        <input
                          type="file"
                          accept="image/png,image/webp,image/jpeg,image/*"
                          className="sr-only"
                          aria-label={`Upload image for ${slot.title}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadImage(slot.key, file);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {custom && (
                        <button
                          type="button"
                          onClick={() => onResetImage(slot.key)}
                          aria-label={`Reset ${slot.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 bg-[#F4F4F4] text-[#444444] hover:bg-black/10"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 12 Audio Slots */}
          <section aria-labelledby="section-audio">
            <div className="mb-2 flex items-center gap-1.5">
              <Music className="h-4 w-4 text-[#444444]" />
              <h3
                id="section-audio"
                className="text-xs font-extrabold uppercase tracking-wider text-[#444444]"
              >
                Voice Lines &amp; SFX (12 / 12 Loaded)
              </h3>
            </div>
            <div className="space-y-2">
              {AUDIO_KEYS.map((key) => {
                const entry = AUDIO_MANIFEST[key];
                const custom = customAudios[key];
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-black/10 bg-white p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#222222]">
                          <span>{entry.label}</span>
                          <span className="text-[10px] font-semibold text-[#777777]">
                            {entry.filename}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-[#555555]">
                          &ldquo;{entry.script}&rdquo;
                        </p>
                        {custom ? (
                          <div className="mt-1 truncate text-[11px] font-semibold text-emerald-700">
                            Loaded: {custom.fileName}
                          </div>
                        ) : (
                          <div className="mt-1 truncate text-[11px] font-semibold text-emerald-700">
                            {key === 'gameover_audio'
                              ? 'Bundled MP3 active'
                              : 'Default clip active'}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewAudio(key)}
                          aria-label={`Preview ${entry.label}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15 bg-[#F4F4F4] text-[#222222] hover:bg-black/10"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-[#222222] px-2.5 text-[11px] font-bold text-white hover:bg-black">
                          <span>MP3</span>
                          <input
                            type="file"
                            accept="audio/*"
                            className="sr-only"
                            aria-label={`Upload audio for ${entry.label}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onUploadAudio(key, file);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                        {custom && (
                          <button
                            type="button"
                            onClick={() => onResetAudio(key)}
                            aria-label={`Reset ${entry.label}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15 bg-[#F4F4F4] text-[#444444] hover:bg-black/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-[#222222] text-sm font-bold text-white transition-colors hover:bg-black"
          >
            Done &amp; Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
