import * as Linking from "expo-linking";
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

interface PermissionsContextValue {
  pedometer: PermStatus;
  ready: boolean;
  refresh: () => Promise<void>;
  requestPedometer: () => Promise<PermStatus>;
  openSettings: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [pedometer, setPedometer] = useState<PermStatus>("undetermined");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const p = await checkPedometerPermission();
    setPedometer(p);
  }, []);

  const requestPedometer = useCallback(async () => {
    const p = await requestPedometerPermission();
    setPedometer(p);
    return p;
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === "web") return;
    Linking.openSettings();
  }, []);

  useEffect(() => {
    (async () => {
      const current = await checkPedometerPermission();
      setPedometer(current);
      // Auto-prompt on first launch if undetermined
      if (current === "undetermined") {
        const next = await requestPedometerPermission();
        setPedometer(next);
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<PermissionsContextValue>(
    () => ({ pedometer, ready, refresh, requestPedometer, openSettings }),
    [pedometer, ready, refresh, requestPedometer, openSettings],
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
