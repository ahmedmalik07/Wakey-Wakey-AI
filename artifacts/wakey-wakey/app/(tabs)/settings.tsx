import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Credits } from "@/components/Credits";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useSettings, useHaptics } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

type Status = "granted" | "denied" | "undetermined" | "unsupported";

function statusColor(status: Status, c: any) {
  if (status === "granted") return "#4ade80";
  if (status === "denied" || status === "unsupported") return c.destructive;
  return c.accent;
}

function statusLabel(status: Status) {
  if (status === "granted") return "Granted";
  if (status === "denied") return "Denied";
  if (status === "unsupported") return "Unsupported";
  return "Not asked yet";
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const { settings, update } = useSettings();
  const {
    pedometer,
    notifications,
    requestPedometer,
    requestNotifications,
    openSettings,
    openBatteryOptimization,
    refresh,
  } = usePermissions();

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const isAndroid = Platform.OS === "android";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>Settings</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Permissions, defaults, and feel.
      </Text>

      <SectionLabel>Permissions</SectionLabel>

      <PermRow
        title="Motion & step access"
        sub="Required for walk-to-wake and shake dismiss"
        status={pedometer}
        onAction={async () => {
          haptics.selection();
          if (pedometer === "denied") openSettings();
          else {
            await requestPedometer();
            await refresh();
          }
        }}
        primaryLabel={
          pedometer === "granted"
            ? "Re-check"
            : pedometer === "denied" || pedometer === "unsupported"
              ? "Open settings"
              : "Grant access"
        }
      />

      <PermRow
        title="Notifications"
        sub="Lets alarms ring when the app is closed"
        status={notifications}
        onAction={async () => {
          haptics.selection();
          if (notifications === "denied") openSettings();
          else {
            await requestNotifications();
            await refresh();
          }
        }}
        primaryLabel={
          notifications === "granted"
            ? "Re-check"
            : notifications === "denied" || notifications === "unsupported"
              ? "Open settings"
              : "Grant access"
        }
      />

      {isAndroid && (
        <Pressable
          onPress={async () => {
            haptics.selection();
            await openBatteryOptimization();
          }}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Disable battery optimization
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Required so Android doesn't kill alarms in the background
            </Text>
          </View>
          <View
            style={[
              styles.actionPill,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
              Open
            </Text>
          </View>
        </Pressable>
      )}

      {!isAndroid && Platform.OS !== "web" && (
        <View
          style={[
            styles.row,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Background reliability
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              iOS handles this automatically once notifications are enabled.
            </Text>
          </View>
        </View>
      )}

      <SectionLabel>Feel</SectionLabel>

      <ToggleRow
        title="Haptics"
        sub="Buzz on taps and confirmations"
        value={settings.hapticsEnabled}
        onChange={(v) => {
          if (v) haptics.selection();
          update({ hapticsEnabled: v });
        }}
      />

      <ToggleRow
        title="24-hour clock"
        sub="Display alarm times as 18:30"
        value={settings.use24Hour}
        onChange={(v) => {
          haptics.selection();
          update({ use24Hour: v });
        }}
      />

      <SectionLabel>Defaults for new alarms</SectionLabel>

      <ChipRow
        title="Default dismiss method"
        options={[
          { id: "steps", label: "Walk" },
          { id: "shake", label: "Shake" },
          { id: "math", label: "Math" },
        ]}
        value={settings.defaultDismissMode}
        onChange={(v) => {
          haptics.selection();
          update({ defaultDismissMode: v as any });
        }}
      />

      <ChipRow
        title="Default snooze"
        options={[1, 3, 5, 10, 15].map((m) => ({ id: m, label: `${m}m` }))}
        value={settings.defaultSnoozeMinutes}
        onChange={(v) => {
          haptics.selection();
          update({ defaultSnoozeMinutes: v as number });
        }}
      />

      <ChipRow
        title="Default step goal"
        options={[10, 20, 30, 50, 75, 100].map((s) => ({
          id: s,
          label: `${s}`,
        }))}
        value={settings.defaultStepGoal}
        onChange={(v) => {
          haptics.selection();
          update({ defaultStepGoal: v as number });
        }}
      />

      <SectionLabel>About</SectionLabel>

      <View
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>
            App version
          </Text>
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
            {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </View>

      <Credits />
    </ScrollView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function PermRow({
  title,
  sub,
  status,
  onAction,
  primaryLabel,
}: {
  title: string;
  sub: string;
  status: Status;
  onAction: () => void;
  primaryLabel: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: statusColor(status, colors) }]}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
          {sub} · {statusLabel(status)}
        </Text>
      </View>
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [
          styles.actionPill,
          {
            backgroundColor:
              status === "granted" ? colors.muted : colors.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionText,
            {
              color:
                status === "granted"
                  ? colors.foreground
                  : colors.primaryForeground,
            },
          ]}
        >
          {primaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({
  title,
  sub,
  value,
  onChange,
}: {
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ChipRow<T extends string | number>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.colRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.rowTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <Pressable
              key={String(o.id)}
              onPress={() => onChange(o.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: "Outfit_700Bold",
    fontSize: 32,
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 22,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  colRow: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
