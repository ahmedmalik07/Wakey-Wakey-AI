import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { formatTime } from "@/lib/format";
import { getSoundPreset } from "@/lib/sounds";
import {
  DAY_LABELS,
  type Alarm,
  type DismissMode,
  type Weekday,
} from "@/lib/types";

export default function EditAlarmScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { alarms, upsertAlarm, deleteAlarm, createAlarm } = useAlarms();

  const existing = useMemo(
    () => (params.id ? alarms.find((a) => a.id === params.id) : null),
    [params.id, alarms],
  );

  const [draft, setDraft] = useState<Alarm>(() => existing ?? createAlarm());

  // Keep draft in sync with sound picker selection
  useEffect(() => {
    if (existing && existing.sound !== draft.sound) {
      setDraft((d) => ({ ...d, sound: existing.sound }));
    }
  }, [existing?.sound]);

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
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    upsertAlarm(draft).then(() => {
      router.replace({ pathname: "/ringing", params: { id: draft.id } });
    });
  };

  const openSounds = () => {
    upsertAlarm(draft);
    router.push({
      pathname: "/sounds",
      params: { id: draft.id, current: draft.sound },
    });
  };

  // 12-hour display values
  const period: "AM" | "PM" = draft.hour < 12 ? "AM" : "PM";
  const display12 = draft.hour % 12 === 0 ? 12 : draft.hour % 12;

  const setHour12 = (h12: number) => {
    let normalized = h12;
    if (normalized < 1) normalized = 12;
    if (normalized > 12) normalized = 1;
    const hour24 =
      period === "AM"
        ? normalized === 12
          ? 0
          : normalized
        : normalized === 12
          ? 12
          : normalized + 12;
    update({ hour: hour24 });
  };

  const togglePeriod = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const newPeriod = period === "AM" ? "PM" : "AM";
    const hour24 =
      newPeriod === "AM"
        ? display12 === 12
          ? 0
          : display12
        : display12 === 12
          ? 12
          : display12 + 12;
    update({ hour: hour24 });
  };

  const selectedSound = getSoundPreset(draft.sound);

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
        <View style={styles.timeDisplayRow}>
          <Text style={[styles.timeDisplay, { color: colors.foreground }]}>
            {formatTime(draft.hour, draft.minute)}
          </Text>
          <Pressable
            onPress={togglePeriod}
            style={({ pressed }) => [
              styles.periodToggle,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.periodToggleText, { color: colors.primaryForeground }]}>
              {period}
            </Text>
            <Feather
              name="refresh-cw"
              size={11}
              color={colors.primaryForeground}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
        <View style={styles.timeRow}>
          <NumberStepper
            label="Hour"
            value={display12}
            min={1}
            max={12}
            onChange={setHour12}
            holdRepeat
          />
          <NumberStepper
            label="Minute"
            value={draft.minute}
            min={0}
            max={59}
            onChange={(v) => update({ minute: v })}
            holdRepeat
          />
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Hold − or + for fast scrolling
        </Text>
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

      <Section label="Dismiss method">
        <View style={styles.modeRow}>
          {(
            [
              { id: "steps", label: "Walk", icon: "activity" },
              { id: "shake", label: "Shake", icon: "smartphone" },
            ] as { id: DismissMode; label: string; icon: any }[]
          ).map((opt) => {
            const active = draft.dismissMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  update({ dismissMode: opt.id });
                }}
                style={({ pressed }) => [
                  styles.modeBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={16}
                  color={active ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.modeText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {draft.dismissMode === "steps" ? (
        <Section label={`Steps to dismiss · ${draft.stepGoal}`}>
          <SliderCard
            min={5}
            max={100}
            step={1}
            value={draft.stepGoal}
            onChange={(v) => update({ stepGoal: v })}
            colors={colors}
          />
        </Section>
      ) : (
        <Section label={`Shakes to dismiss · ${draft.shakeGoal}`}>
          <SliderCard
            min={5}
            max={100}
            step={1}
            value={draft.shakeGoal}
            onChange={(v) => update({ shakeGoal: v })}
            colors={colors}
          />
        </Section>
      )}

      <Section label="Sound">
        <Pressable
          onPress={openSounds}
          style={({ pressed }) => [
            styles.linkRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
              {selectedSound.name}
            </Text>
            <Text
              style={[styles.toggleSub, { color: colors.mutedForeground }]}
            >
              {selectedSound.description}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Section>

      <Section label="Snooze">
        <View
          style={[
            styles.toggleRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
              Allow snooze
            </Text>
            <Text
              style={[styles.toggleSub, { color: colors.mutedForeground }]}
            >
              Postpone the alarm by a few minutes
            </Text>
          </View>
          <Switch
            value={draft.snoozeEnabled}
            onValueChange={(v) => update({ snoozeEnabled: v })}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {draft.snoozeEnabled && (
          <View
            style={[
              styles.snoozeChips,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {[1, 3, 5, 10, 15].map((m) => {
              const active = draft.snoozeMinutes === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    update({ snoozeMinutes: m });
                  }}
                  style={({ pressed }) => [
                    styles.snoozeChip,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.snoozeChipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {m}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
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
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function SliderCard({
  min,
  max,
  step,
  value,
  onChange,
  colors,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.sliderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.muted}
        thumbTintColor={colors.primary}
      />
      <View style={styles.sliderTicks}>
        <Text style={[styles.tick, { color: colors.mutedForeground }]}>
          {min}
        </Text>
        <Text style={[styles.tick, { color: colors.mutedForeground }]}>
          {max}
        </Text>
      </View>
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
  holdRepeat = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  holdRepeat?: boolean;
}) {
  const colors = useColors();
  const intervalRef = useRef<any>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const tick = (dir: 1 | -1) => {
    const next = valueRef.current + dir * step;
    const wrapped = next < min ? max : next > max ? min : next;
    onChange(wrapped);
  };

  const start = (dir: 1 | -1) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    tick(dir);
    if (!holdRepeat) return;
    let delay = 320;
    const schedule = () => {
      intervalRef.current = setTimeout(() => {
        tick(dir);
        delay = Math.max(40, delay - 30);
        schedule();
      }, delay);
    };
    schedule();
  };

  const stop = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <View style={styles.stepperCol}>
      <Text style={[styles.stepperLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPressIn={() => start(-1)}
          onPressOut={stop}
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
          onPressIn={() => start(1)}
          onPressOut={stop}
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
  timeDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeDisplay: {
    fontFamily: "Outfit_700Bold",
    fontSize: 56,
    letterSpacing: -1,
  },
  periodToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  periodToggleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1.5,
  },
  timeRow: { flexDirection: "row", gap: 24, marginTop: 16 },
  helper: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 12,
  },
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
  modeRow: { flexDirection: "row", gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
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
  snoozeChips: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    justifyContent: "space-between",
  },
  snoozeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  snoozeChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
