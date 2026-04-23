import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Alarm } from "./types";

export const CHANNEL_ID = "wakey-alarm-channel";

let setupDone = false;

export async function ensureNotificationSetup(): Promise<void> {
  if (Platform.OS === "web") return;
  if (setupDone) return;
  setupDone = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Wakey Wakey alarms",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400],
        bypassDnd: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        lightColor: "#FF7B47",
      });
    } catch {}
  }
  try {
    await Notifications.setNotificationCategoryAsync("alarm", [
      { identifier: "open", buttonTitle: "Open alarm", options: { opensAppToForeground: true } },
    ]);
  } catch {}
}

export type PermStatus = "granted" | "denied" | "undetermined";

export async function getNotificationPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "denied";
  try {
    const s = await Notifications.getPermissionsAsync();
    if (s.granted) return "granted";
    if (!s.canAskAgain && s.status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

export async function requestNotificationPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "denied";
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "denied";
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    if (res.granted) return "granted";
    return res.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "undetermined";
  }
}

export async function cancelAlarmNotifications(alarmId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if ((n.content.data as any)?.alarmId === alarmId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
}

export async function scheduleAlarmNotifications(alarm: Alarm): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelAlarmNotifications(alarm.id);
  if (!alarm.enabled) return;

  const baseContent: Notifications.NotificationContentInput = {
    title: alarm.label || "Wakey Wakey",
    body: "Time to wake up — tap to walk it off.",
    sound: "default",
    priority: Notifications.AndroidNotificationPriority.MAX,
    data: { alarmId: alarm.id },
    categoryIdentifier: "alarm",
  };

  try {
    if (!alarm.days || alarm.days.length === 0) {
      const next = nextOneShot(alarm.hour, alarm.minute);
      await Notifications.scheduleNotificationAsync({
        content: baseContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: next,
          channelId: CHANNEL_ID,
        } as any,
      });
    } else {
      for (const day of alarm.days) {
        // expo weekday: 1=Sunday..7=Saturday. Our days use 0=Sunday..6=Saturday.
        const weekday = (day + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        await Notifications.scheduleNotificationAsync({
          content: baseContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: alarm.hour,
            minute: alarm.minute,
            channelId: CHANNEL_ID,
          } as any,
        });
      }
    }
  } catch {}
}

function nextOneShot(hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime() + 5_000) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export async function rescheduleAll(alarms: Alarm[]): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
  for (const a of alarms) {
    await scheduleAlarmNotifications(a);
  }
}
