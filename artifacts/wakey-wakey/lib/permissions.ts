import { Pedometer } from "expo-sensors";
import { Platform } from "react-native";

export type PermStatus = "granted" | "denied" | "undetermined" | "unsupported";

export async function checkPedometerPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const isAvail = await Pedometer.isAvailableAsync();
    if (!isAvail) return "unsupported";
    const perm = await Pedometer.getPermissionsAsync();
    return (perm?.status as PermStatus) ?? "undetermined";
  } catch {
    return "unsupported";
  }
}

export async function requestPedometerPermission(): Promise<PermStatus> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const isAvail = await Pedometer.isAvailableAsync();
    if (!isAvail) return "unsupported";
    const perm = await Pedometer.requestPermissionsAsync();
    return (perm?.status as PermStatus) ?? "denied";
  } catch {
    return "unsupported";
  }
}
