import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelAlarmNotifications,
  ensureNotificationSetup,
  rescheduleAll,
  scheduleAlarmNotifications,
} from "@/lib/notifications";
import {
  loadAlarms,
  loadHistory,
  newId,
  saveAlarms,
  saveHistory,
} from "@/lib/storage";
import type { Alarm, DismissalRecord } from "@/lib/types";

interface AlarmsContextValue {
  alarms: Alarm[];
  history: DismissalRecord[];
  ready: boolean;
  upsertAlarm: (alarm: Alarm) => Promise<void>;
  toggleAlarm: (id: string, enabled: boolean) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  createAlarm: (partial?: Partial<Alarm>) => Alarm;
  recordDismissal: (record: Omit<DismissalRecord, "id">) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const AlarmsContext = createContext<AlarmsContextValue | null>(null);

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [history, setHistory] = useState<DismissalRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureNotificationSetup();
      const [a, h] = await Promise.all([loadAlarms(), loadHistory()]);
      // Backfill new fields on stored alarms
      const normalized = a.map((al) => ({
        mathCount: 3,
        mathDifficulty: "easy" as const,
        ...al,
      }));
      setAlarms(normalized);
      setHistory(h);
      setReady(true);
      // Reconcile system schedule with stored alarms
      void rescheduleAll(normalized);
    })();
  }, []);

  const upsertAlarm = useCallback(async (alarm: Alarm) => {
    setAlarms((prev) => {
      const idx = prev.findIndex((a) => a.id === alarm.id);
      const next =
        idx >= 0
          ? prev.map((a) => (a.id === alarm.id ? alarm : a))
          : [...prev, alarm];
      void saveAlarms(next);
      return next;
    });
    void scheduleAlarmNotifications(alarm);
  }, []);

  const toggleAlarm = useCallback(async (id: string, enabled: boolean) => {
    let updated: Alarm | undefined;
    setAlarms((prev) => {
      const next = prev.map((a) => {
        if (a.id !== id) return a;
        updated = { ...a, enabled };
        return updated;
      });
      void saveAlarms(next);
      return next;
    });
    if (updated) void scheduleAlarmNotifications(updated);
  }, []);

  const deleteAlarm = useCallback(async (id: string) => {
    setAlarms((prev) => {
      const next = prev.filter((a) => a.id !== id);
      void saveAlarms(next);
      return next;
    });
    void cancelAlarmNotifications(id);
  }, []);

  const createAlarm = useCallback((partial?: Partial<Alarm>): Alarm => {
    const now = new Date();
    return {
      id: newId(),
      label: "Wake up",
      hour: 7,
      minute: 0,
      enabled: true,
      days: [1, 2, 3, 4, 5],
      dismissMode: "steps",
      stepGoal: 30,
      shakeGoal: 20,
      mathCount: 3,
      mathDifficulty: "easy",
      snoozeEnabled: true,
      snoozeMinutes: 5,
      sound: "sunrise",
      vibration: true,
      gentleWake: true,
      createdAt: now.getTime(),
      ...partial,
    };
  }, []);

  const recordDismissal = useCallback(
    async (record: Omit<DismissalRecord, "id">) => {
      setHistory((prev) => {
        const next = [{ ...record, id: newId() }, ...prev].slice(0, 200);
        void saveHistory(next);
        return next;
      });
    },
    [],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await saveHistory([]);
  }, []);

  const value = useMemo<AlarmsContextValue>(
    () => ({
      alarms,
      history,
      ready,
      upsertAlarm,
      toggleAlarm,
      deleteAlarm,
      createAlarm,
      recordDismissal,
      clearHistory,
    }),
    [
      alarms,
      history,
      ready,
      upsertAlarm,
      toggleAlarm,
      deleteAlarm,
      createAlarm,
      recordDismissal,
      clearHistory,
    ],
  );

  return (
    <AlarmsContext.Provider value={value}>{children}</AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsContextValue {
  const ctx = useContext(AlarmsContext);
  if (!ctx) throw new Error("useAlarms must be used inside AlarmsProvider");
  return ctx;
}
