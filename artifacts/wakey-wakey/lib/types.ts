export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DismissMode = "steps" | "shake" | "math";

export type MathDifficulty = "easy" | "medium" | "hard";

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
  days: Weekday[];
  dismissMode: DismissMode;
  stepGoal: number;
  shakeGoal: number;
  mathCount: number;
  mathDifficulty: MathDifficulty;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  sound: string;
  customSoundUri?: string;
  customSoundName?: string;
  vibration: boolean;
  gentleWake: boolean;
  createdAt: number;
}

export interface DismissalRecord {
  id: string;
  alarmId: string;
  alarmLabel: string;
  ranAt: number;
  dismissedAt: number;
  steps: number;
  durationMs: number;
  success: boolean;
}

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
