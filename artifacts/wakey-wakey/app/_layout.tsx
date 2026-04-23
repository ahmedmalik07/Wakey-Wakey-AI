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
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlarmsProvider } from "@/contexts/AlarmsContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { SettingsProvider } from "@/contexts/SettingsContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();

  // Handle notification taps -> route to ringing screen for that alarm
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const id = (response.notification.request.content.data as any)
          ?.alarmId;
        if (id) {
          router.push({ pathname: "/ringing", params: { id } });
        }
      },
    );
    // If app was launched from a notification, jump to the ringing screen
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const id = (response?.notification.request.content.data as any)
          ?.alarmId;
        if (id) {
          router.push({ pathname: "/ringing", params: { id } });
        }
      })
      .catch(() => {});
    return () => sub.remove();
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
