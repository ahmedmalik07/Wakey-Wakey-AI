import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import notifee, { EventType } from "@notifee/react-native";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setBaseUrl } from "@workspace/api-client-react";
import { AlarmsProvider } from "@/contexts/AlarmsContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { SettingsProvider } from "@/contexts/SettingsContext";

setBaseUrl(process.env.EXPO_PUBLIC_API_URL || null);

SplashScreen.preventAutoHideAsync();

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  
  if (type === EventType.DELIVERED && notification?.data?.alarmId) {
    // When the alarm fires in the background, upgrade it to a foreground service immediately
    // so it doesn't get killed by Doze mode.
    try {
      await notifee.displayNotification({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        android: {
          ...notification.android,
          asForegroundService: true,
        },
      });
    } catch (e) {
      console.error("Failed to upgrade to foreground service", e);
    }
  }

  // Handle other background events if needed (e.g., action press)
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Handle foreground events (e.g. user taps notification)
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        const id = detail.notification?.data?.alarmId;
        if (id) {
          router.push({ pathname: "/ringing", params: { id: String(id) } });
        }
      }
    });

    // Handle app launched from a notification (including fullScreenAction)
    notifee.getInitialNotification().then((initialNotification) => {
      if (initialNotification) {
        const id = initialNotification.notification.data?.alarmId;
        if (id) {
          // Add a small delay to ensure routing happens smoothly after mount
          setTimeout(() => {
            router.push({ pathname: "/ringing", params: { id: String(id) } });
          }, 100);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1A1530" },
        headerTintColor: "#FFF4E0",
        headerTitleStyle: { fontFamily: "Outfit_600SemiBold" },
        contentStyle: { backgroundColor: "#1A1530" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="edit"
        options={{
          presentation: "modal",
          title: "Alarm",
          headerStyle: { backgroundColor: "#1A1530" },
        }}
      />
      <Stack.Screen
        name="sounds"
        options={{
          presentation: "modal",
          title: "Sound",
          headerStyle: { backgroundColor: "#1A1530" },
        }}
      />
      <Stack.Screen
        name="ringing"
        options={{
          headerShown: false,
          gestureEnabled: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <SettingsProvider>
                <PermissionsProvider>
                  <AlarmsProvider>
                    <StatusBar style="light" />
                    <RootLayoutNav />
                  </AlarmsProvider>
                </PermissionsProvider>
              </SettingsProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
