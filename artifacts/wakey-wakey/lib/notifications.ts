import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";
import { Platform } from "react-native";
import type { Alarm } from "./types";

export const CHANNEL_ID = "wakey-alarm-channel";

let setupDone = false;

export async function ensureNotificationSetup(): Promise<void> {
  if (Platform.OS === "web") return;
  if (setupDone) return;
  setupDone = true;

  if (Platform.OS === "android") {
    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: "Wakey Wakey alarms",
        importance: AndroidImportance.HIGH,
        sound: "default",
        vibration: true,
        vibrationPattern: [0, 400, 200, 400],
        bypassDnd: true,
        visibility: AndroidVisibility.PUBLIC,
        lightColor: "#FF7B47",
      });
    } catch {}
  }
}

export type PermStatus = "granted" | "denied" | "undetermined";

export async function getNotificationPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "denied";
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus >= 1) return "granted";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

export async function requestNotificationPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "denied";
  try {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus >= 1) return "granted";
    return "denied";
  } catch {
    return "undetermined";
  }
}

export async function cancelAlarmNotifications(alarmId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const triggers = await notifee.getTriggerNotificationIds();
    for (const id of triggers) {
      if (id.startsWith(`alarm-${alarmId}`)) {
        await notifee.cancelNotification(id);
      }
    }
  } catch {}
}

export async function scheduleAlarmNotifications(alarm: Alarm): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelAlarmNotifications(alarm.id);
  if (!alarm.enabled) return;

  const baseNotification = {
    title: alarm.label || "Wakey Wakey",
    body: "Time to wake up — tap to walk it off.",
    data: { alarmId: alarm.id },
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.ALARM,
      fullScreenAction: {
        id: "default",
      },
      // When the trigger fires, it will display the notification. 
      // We also handle the DELIVERED event in the background to upgrade it to a foreground service.
    },
  };

  try {
    if (!alarm.days || alarm.days.length === 0) {
      const next = nextOneShot(alarm.hour, alarm.minute);
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: next.getTime(),
        alarmManager: {
          allowWhileIdle: true,
        },
      };
      await notifee.createTriggerNotification(
        { ...baseNotification, id: `alarm-${alarm.id}-oneshot` },
        trigger
      );
    } else {
      for (const day of alarm.days) {
        // Notifee Trigger weekdays: 1=Sunday..7=Saturday. Our days use 0=Sunday..6=Saturday.
        // Wait, Notifee uses ISO days or standard JS Date days? 
        // JS Date: 0=Sun, 1=Mon.
        // Let's use TimestampTrigger with repeat frequency for weekly alarms, adjusting the first occurrence.
        const next = nextWeeklyOccurrence(alarm.hour, alarm.minute, day);
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: next.getTime(),
          repeatFrequency: RepeatFrequency.WEEKLY,
          alarmManager: {
            allowWhileIdle: true,
          },
        };
        await notifee.createTriggerNotification(
          { ...baseNotification, id: `alarm-${alarm.id}-day-${day}` },
          trigger
        );
      }
    }
  } catch (err) {
    console.error("Failed to schedule alarm", err);
  }
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

function nextWeeklyOccurrence(hour: number, minute: number, day: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  // day is 0..6 (Sun..Sat)
  const currentDay = target.getDay();
  let dayDiff = day - currentDay;
  if (dayDiff < 0 || (dayDiff === 0 && target.getTime() <= now.getTime() + 5_000)) {
    dayDiff += 7;
  }
  target.setDate(target.getDate() + dayDiff);
  return target;
}

export async function rescheduleAll(alarms: Alarm[]): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await notifee.cancelAllNotifications();
  } catch {}
  for (const a of alarms) {
    await scheduleAlarmNotifications(a);
  }
}
