import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAlarms } from "@/contexts/AlarmsContext";
import { useColors } from "@/hooks/useColors";
import { formatPeriod, formatTime } from "@/lib/format";
import { DAY_LABELS, type Alarm, type Weekday } from "@/lib/types";

export default function EditAlarmScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { alarms, upsertAlarm, deleteAlarm, createAlarm } = useAlarms();

  const existing = useMemo(
    () => (params.id ? alarms.find((a) => a.id === params.id) : null),
    [params.id, alarms],
  );

  const [draft, setDraft] = useState<Alarm>(
    () => existing ?? createAlarm(),
  );

  const update = (patch: Partial<Alarm>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const toggleDay = (day: Weekday) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const has = draft.days.includes(day);
    update({
      days: has
        ? draft.days.filter((d) => d !== day)
        : [...draft.days, day].sort(),
    });
  };

  const save = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await upsertAlarm(draft);
    router.back();
  };

  const remove = () => {
    if (!existing) {
      router.back();
      return;
    }
    Alert.alert("Delete alarm?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteAlarm(existing.id);
          router.back();
        },
      },
    ]);
  };

  const testNow = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Save first if new, then push ringing screen
    upsertAlarm(draft).then(() => {
      router.replace({ pathname: "/ringing", params: { id: draft.id } });
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
    >
      <View
        style={[
          styles.timeBlock,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.timeDisplay, { color: colors.foreground }]}>
          {formatTime(draft.hour, draft.minute)}
          <Text style={[styles.period, { color: colors.mutedForeground }]}>
            {" "}{formatPeriod(draft.hour)}
          </Text>
        </Text>
        <View style={styles.timeRow}>
          <NumberStepper
            label="Hour"
            value={draft.hour}
            min={0}
            max={23}
            onChange={(v) => update({ hour: v })}
          />
          <NumberStepper
            label="Minute"
            value={draft.minute}
            min={0}
            max={59}
            step={5}
            onChange={(v) => update({ minute: v })}
          />
        </View>
      </View>

      <Section label="Label">
        <TextInput
          value={draft.label}
          onChangeText={(t) => update({ label: t })}
          placeholder="Wake up"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        />
      </Section>

      <Section label="Repeat">
        <View style={styles.daysRow}>
          {DAY_LABELS.map((label, idx) => {
            const day = idx as Weekday;
            const active = draft.days.includes(day);
            return (
              <Pressable
                key={idx}
                onPress={() => toggleDay(day)}
                style={({ pressed }) => [
                  styles.dayChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label={`Steps to dismiss · ${draft.stepGoal}`}>
        <View
          style={[
            styles.sliderCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Slider
            minimumValue={5}
            maximumValue={100}
            step={5}
            value={draft.stepGoal}
            onValueChange={(v) => update({ stepGoal: Math.round(v) })}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.muted}
            thumbTintColor={colors.primary}
          />
          <View style={styles.sliderTicks}>
            <Text style={[styles.tick, { color: colors.mutedForeground }]}>
              5
            </Text>
            <Text style={[styles.tick, { color: colors.mutedForeground }]}>
              100
            </Text>
          </View>
        </View>
      </Section>

      <Section label="Wake style">
        <View
          style={[
            styles.toggleRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
              Vibration
            </Text>
            <Text
              style={[styles.toggleSub, { color: colors.mutedForeground }]}
            >
              Pulse alongside the sound
            </Text>
          </View>
          <Switch
            value={draft.vibration}
            onValueChange={(v) => update({ vibration: v })}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View
          style={[
            styles.toggleRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 8,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
              Gentle wake
            </Text>
            <Text
              style={[styles.toggleSub, { color: colors.mutedForeground }]}
            >
              Volume ramps up over 30 seconds
            </Text>
          </View>
          <Switch
            value={draft.gentleWake}
            onValueChange={(v) => update({ gentleWake: v })}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </Section>

      <Pressable
        onPress={testNow}
        style={({ pressed }) => [
          styles.testBtn,
          {
            backgroundColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="play" size={16} color={colors.accentForeground} />
        <Text style={[styles.testBtnText, { color: colors.accentForeground }]}>
          Test now
        </Text>
      </Pressable>

      <Pressable
        onPress={save}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
          {existing ? "Save changes" : "Create alarm"}
        </Text>
      </Pressable>

      {existing && (
        <Pressable
          onPress={remove}
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather
            name="trash-2"
            size={14}
            color={colors.destructive}
          />
          <Text
            style={[styles.deleteBtnText, { color: colors.destructive }]}
          >
            Delete alarm
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 24 }}>
      <Text
        style={[
          styles.sectionLabel,
          { color: colors.mutedForeground },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const colors = useColors();
  const dec = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange(value - step < min ? max : value - step);
  };
  const inc = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange(value + step > max ? min : value + step);
  };
  return (
    <View style={styles.stepperCol}>
      <Text style={[styles.stepperLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={dec}
          style={({ pressed }) => [
            styles.stepperBtn,
            {
              backgroundColor: colors.muted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.stepperValue, { color: colors.foreground }]}>
          {value.toString().padStart(2, "0")}
        </Text>
        <Pressable
          onPress={inc}
          style={({ pressed }) => [
            styles.stepperBtn,
            {
              backgroundColor: colors.muted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeBlock: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
  },
  timeDisplay: {
    fontFamily: "Outfit_700Bold",
    fontSize: 56,
    letterSpacing: -1,
  },
  period: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    letterSpacing: 1,
  },
  timeRow: { flexDirection: "row", gap: 24, marginTop: 16 },
  stepperCol: { alignItems: "center", flex: 1 },
  stepperLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 22,
    minWidth: 36,
    textAlign: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  daysRow: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  sliderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  sliderTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  tick: { fontFamily: "Inter_400Regular", fontSize: 11 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  toggleTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  toggleSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 28,
  },
  testBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
