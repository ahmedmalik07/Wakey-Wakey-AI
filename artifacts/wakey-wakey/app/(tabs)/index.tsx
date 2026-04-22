import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAlarms } from "@/contexts/AlarmsContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useColors } from "@/hooks/useColors";
import {
  formatCountdown,
  formatDays,
  formatPeriod,
  formatTime,
  nextOccurrence,
} from "@/lib/format";
import type { Alarm } from "@/lib/types";

export default function AlarmsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alarms, toggleAlarm } = useAlarms();
  const { pedometer, requestPedometer, openSettings } = usePermissions();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-trigger alarms scheduled within the past 1s while app is open
  useEffect(() => {
    const enabled = alarms.filter((a) => a.enabled);
    for (const a of enabled) {
      const next = nextOccurrence(a, new Date(now - 2000));
      const diff = next.getTime() - now;
      if (diff <= 0 && diff > -2000) {
        router.push({ pathname: "/ringing", params: { id: a.id } });
        break;
      }
    }
  }, [now, alarms, router]);

  const sorted = useMemo(() => {
    return [...alarms].sort((a, b) => {
      const an = nextOccurrence(a, new Date(now)).getTime();
      const bn = nextOccurrence(b, new Date(now)).getTime();
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return an - bn;
    });
  }, [alarms, now]);

  const nextAlarm = useMemo(() => {
    const enabled = alarms.filter((a) => a.enabled);
    if (enabled.length === 0) return null;
    let best: Alarm | null = null;
    let bestTime = Infinity;
    for (const a of enabled) {
      const t = nextOccurrence(a, new Date(now)).getTime();
      if (t < bestTime) {
        bestTime = t;
        best = a;
      }
    }
    return best ? { alarm: best, fireTime: bestTime } : null;
  }, [alarms, now]);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#FF7B47", "#3D2F5C", "#1A1530"]}
        locations={[0, 0.55, 1]}
        style={[styles.heroGradient, { paddingTop: topPad }]}
      >
        <View style={styles.heroInner}>
          <Text style={styles.heroLabel}>WAKEY WAKEY</Text>
          {nextAlarm ? (
            <>
              <Text style={styles.heroCount}>
                {formatCountdown(nextAlarm.fireTime - now)}
              </Text>
              <Text style={styles.heroSub}>
                {nextAlarm.alarm.label} ·{" "}
                {formatTime(nextAlarm.alarm.hour, nextAlarm.alarm.minute)}{" "}
                {formatPeriod(nextAlarm.alarm.hour)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroCount}>No alarms</Text>
              <Text style={styles.heroSub}>Tap + to set your first one</Text>
            </>
          )}
        </View>
      </LinearGradient>

      {(pedometer === "denied" || pedometer === "undetermined") &&
        alarms.some((a) => a.enabled && a.dismissMode === "steps") && (
          <Pressable
            onPress={async () => {
              if (pedometer === "denied") openSettings();
              else await requestPedometer();
            }}
            style={({ pressed }) => [
              styles.permBanner,
              {
                backgroundColor: colors.card,
                borderColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="alert-circle" size={16} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
                Step access needed
              </Text>
              <Text
                style={[styles.bannerSub, { color: colors.mutedForeground }]}
              >
                {pedometer === "denied"
                  ? "Open settings to enable motion tracking."
                  : "Tap to grant permission so walk-to-wake works."}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

      <FlatList
        data={sorted}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 120,
          gap: 12,
        }}
        scrollEnabled={sorted.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name="moon"
              size={48}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nothing scheduled
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Create an alarm that won't shut up{"\n"}until you actually walk
              it off.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlarmRow
            alarm={item}
            onToggle={(v) => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              toggleAlarm(item.id, v);
            }}
            onPress={() =>
              router.push({ pathname: "/edit", params: { id: item.id } })
            }
          />
        )}
      />

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: 100 + (Platform.OS === "web" ? 0 : insets.bottom),
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/edit");
        }}
        accessibilityLabel="Add alarm"
      >
        <Feather name="plus" size={28} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

function AlarmRow({
  alarm,
  onToggle,
  onPress,
}: {
  alarm: Alarm;
  onToggle: (v: boolean) => void;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.timeRow}>
          <Text
            style={[
              styles.time,
              {
                color: alarm.enabled
                  ? colors.foreground
                  : colors.mutedForeground,
              },
            ]}
          >
            {formatTime(alarm.hour, alarm.minute)}
          </Text>
          <Text
            style={[
              styles.period,
              { color: colors.mutedForeground },
            ]}
          >
            {formatPeriod(alarm.hour)}
          </Text>
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {alarm.label}
        </Text>
        <View style={styles.metaRow}>
          <Feather
            name="repeat"
            size={11}
            color={colors.mutedForeground}
          />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {formatDays(alarm.days)}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          <Feather
            name="activity"
            size={11}
            color={colors.accent}
          />
          <Text style={[styles.meta, { color: colors.accent }]}>
            {alarm.stepGoal} steps
          </Text>
        </View>
      </View>
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor="#fff"
        ios_backgroundColor={colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroGradient: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroInner: { paddingTop: 16 },
  heroLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 3,
    color: "#FFF4E0",
    opacity: 0.85,
  },
  heroCount: {
    fontFamily: "Outfit_700Bold",
    fontSize: 48,
    color: "#FFF4E0",
    marginTop: 8,
    letterSpacing: -1,
  },
  heroSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFF4E0",
    opacity: 0.85,
    marginTop: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  timeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  time: {
    fontFamily: "Outfit_700Bold",
    fontSize: 36,
    letterSpacing: -1,
  },
  period: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  meta: { fontFamily: "Inter_500Medium", fontSize: 11 },
  dot: { width: 3, height: 3, borderRadius: 2, marginHorizontal: 2 },
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF7B47",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 12,
  },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  bannerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  emptyTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 20,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
