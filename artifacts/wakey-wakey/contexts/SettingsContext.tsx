import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DismissMode } from "@/lib/types";

export interface AppSettings {
  hapticsEnabled: boolean;
  defaultSnoozeMinutes: number;
  defaultStepGoal: number;
  defaultDismissMode: DismissMode;
  use24Hour: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  hapticsEnabled: true,
  defaultSnoozeMinutes: 5,
  defaultStepGoal: 30,
  defaultDismissMode: "steps",
  use24Hour: false,
};

const KEY = "ww:settings:v1";

interface SettingsContextValue {
  settings: AppSettings;
  ready: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const Ctx = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {}
      setReady(true);
    })();
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, update }),
    [settings, ready, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSettings must be used inside SettingsProvider");
  return c;
}

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function useHaptics() {
  const { settings } = useSettings();
  return useMemo(
    () => ({
      selection: () => {
        if (!settings.hapticsEnabled || Platform.OS === "web") return;
        Haptics.selectionAsync().catch(() => {});
      },
      impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
        if (!settings.hapticsEnabled || Platform.OS === "web") return;
        Haptics.impactAsync(style).catch(() => {});
      },
      notify: (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
        if (!settings.hapticsEnabled || Platform.OS === "web") return;
        Haptics.notificationAsync(type).catch(() => {});
      },
    }),
    [settings.hapticsEnabled],
  );
}
