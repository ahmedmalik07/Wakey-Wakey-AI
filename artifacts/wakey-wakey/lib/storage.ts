import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Alarm, DismissalRecord } from "./types";

const ALARMS_KEY = "ww:alarms:v1";
const HISTORY_KEY = "ww:history:v1";

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Alarm[];
  } catch {
    return [];
  }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

export async function loadHistory(): Promise<DismissalRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DismissalRecord[];
  } catch {
    return [];
  }
}

export async function saveHistory(history: DismissalRecord[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
