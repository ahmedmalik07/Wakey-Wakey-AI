import * as Linking from "expo-linking";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  checkPedometerPermission,
  requestPedometerPermission,
  type PermStatus,
} from "@/lib/permissions";
import {
  ensureNotificationSetup,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";

interface PermissionsContextValue {
  pedometer: PermStatus;
  notifications: PermStatus;
  ready: boolean;
  refresh: () => Promise<void>;
  requestPedometer: () => Promise<PermStatus>;
  requestNotifications: () => Promise<PermStatus>;
  openSettings: () => void;
  openBatteryOptimization: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [pedometer, setPedometer] = useState<PermStatus>("undetermined");
  const [notifications, setNotifications] = useState<PermStatus>("undetermined");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [p, n] = await Promise.all([
      checkPedometerPermission(),
      getNotificationPermission(),
    ]);
    setPedometer(p);
    setNotifications(n);
  }, []);

  const requestPedometer = useCallback(async () => {
    const p = await requestPedometerPermission();
    setPedometer(p);
    return p;
  }, []);

  const requestNotifications = useCallback(async () => {
    const n = await requestNotificationPermission();
    setNotifications(n);
    return n;
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === "web") return;
    Linking.openSettings();
  }, []);

  const openBatteryOptimization = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const pkg =
      (Constants.expoConfig as any)?.android?.package ??
      (Constants as any)?.easConfig?.android?.package ??
      "host.exp.exponent";
    try {
      // Try to open the per-app battery optimization request dialog
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
      );
    } catch {
      try {
        await IntentLauncher.startActivityAsync(
          "android.settings.APPLICATION_DETAILS_SETTINGS",
          { data: `package:${pkg}` },
        );
      } catch {
        Linking.openSettings();
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      await ensureNotificationSetup();
      const [pCur, nCur] = await Promise.all([
        checkPedometerPermission(),
        getNotificationPermission(),
      ]);
      setPedometer(pCur);
      setNotifications(nCur);

      if (pCur === "undetermined") {
        const pNext = await requestPedometerPermission();
        setPedometer(pNext);
      }
      if (nCur === "undetermined") {
        const nNext = await requestNotificationPermission();
        setNotifications(nNext);
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<PermissionsContextValue>(
    () => ({
      pedometer,
      notifications,
      ready,
      refresh,
      requestPedometer,
      requestNotifications,
      openSettings,
      openBatteryOptimization,
    }),
    [
      pedometer,
      notifications,
      ready,
      refresh,
      requestPedometer,
      requestNotifications,
      openSettings,
      openBatteryOptimization,
    ],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used inside PermissionsProvider");
  return ctx;
}
