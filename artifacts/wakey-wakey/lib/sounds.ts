import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export interface SoundPreset {
  id: string;
  name: string;
  description: string;
  build: () => ToneSpec;
}

interface ToneSpec {
  sampleRate: number;
  durationSec: number;
  render: (t: number, sampleRate: number) => number;
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: "sunrise",
    name: "Sunrise Chime",
    description: "Soft rising bells",
    build: () => ({
      sampleRate: 22050,
      durationSec: 2.4,
      render: (t) => {
        const env = Math.exp(-((t % 0.6) * 3));
        const phase = Math.floor(t / 0.6) % 4;
        const f = [523.25, 659.25, 784.0, 1046.5][phase];
        return Math.sin(2 * Math.PI * f * t) * env * 0.6;
      },
    }),
  },
  {
    id: "morning",
    name: "Morning Bell",
    description: "Warm temple chimes",
    build: () => ({
      sampleRate: 22050,
      durationSec: 2.0,
      render: (t) => {
        const env = Math.exp(-(t % 1.0) * 1.8);
        const f1 = 392;
        const f2 = 587.33;
        return (
          (Math.sin(2 * Math.PI * f1 * t) +
            Math.sin(2 * Math.PI * f2 * t) * 0.6) *
          env *
          0.45
        );
      },
    }),
  },
  {
    id: "classic",
    name: "Classic Buzz",
    description: "Old-school alarm clock",
    build: () => ({
      sampleRate: 22050,
      durationSec: 1.0,
      render: (t) => {
        const beat = Math.floor(t * 8) % 2;
        if (beat === 0) return 0;
        return Math.sign(Math.sin(2 * Math.PI * 880 * t)) * 0.5;
      },
    }),
  },
  {
    id: "gentle",
    name: "Gentle Tone",
    description: "Smooth steady wave",
    build: () => ({
      sampleRate: 22050,
      durationSec: 2.0,
      render: (t) => {
        const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.5 * t);
        return Math.sin(2 * Math.PI * 440 * t) * env * 0.5;
      },
    }),
  },
  {
    id: "rooster",
    name: "Rooster Crow",
    description: "Country morning call",
    build: () => ({
      sampleRate: 22050,
      durationSec: 1.6,
      render: (t) => {
        const phase = t % 1.6;
        if (phase > 1.2) return 0;
        const slide = 1 - phase / 1.2;
        const f = 320 + slide * 480;
        const env = Math.sin((Math.PI * phase) / 1.2);
        return Math.sin(2 * Math.PI * f * t) * env * 0.6;
      },
    }),
  },
  {
    id: "siren",
    name: "Siren Alert",
    description: "Won't be ignored",
    build: () => ({
      sampleRate: 22050,
      durationSec: 1.6,
      render: (t) => {
        const f = 600 + 400 * Math.sin(2 * Math.PI * 1.25 * t);
        return Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.45;
      },
    }),
  },
];

export function getSoundPreset(id: string | undefined): SoundPreset {
  return SOUND_PRESETS.find((p) => p.id === id) ?? SOUND_PRESETS[0];
}

function buildWav(spec: ToneSpec): Uint8Array {
  const { sampleRate, durationSec, render } = spec;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let v = render(t, sampleRate);
    if (v > 1) v = 1;
    if (v < -1) v = -1;
    view.setInt16(44 + i * 2, Math.floor(v * 32767), true);
  }
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  if (typeof globalThis.btoa === "function") return globalThis.btoa(bin);
  return Buffer.from(bin, "binary").toString("base64");
}

const cacheDir =
  (FileSystem as any).cacheDirectory ?? (FileSystem as any).Paths?.cache?.uri;

export async function getToneUri(preset: SoundPreset): Promise<string | null> {
  if (Platform.OS === "web") {
    const bytes = buildWav(preset.build());
    const blob = new Blob([bytes], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }
  if (!cacheDir) return null;
  const path = `${cacheDir}wakey-${preset.id}.wav`;
  try {
    const info = await (FileSystem as any).getInfoAsync(path);
    if (info?.exists) return path;
  } catch {}
  const bytes = buildWav(preset.build());
  const b64 = bytesToBase64(bytes);
  await (FileSystem as any).writeAsStringAsync(path, b64, {
    encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
  });
  return path;
}
