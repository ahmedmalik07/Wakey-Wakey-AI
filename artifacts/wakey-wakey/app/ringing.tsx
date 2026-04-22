import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Accelerometer, Pedometer } from "expo-sensors";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";

import { useAlarms } from "@/contexts/AlarmsContext";
import { useColors } from "@/hooks/useColors";
import { formatPeriod, formatTime } from "@/lib/format";
import { getMorningMotivator } from "@/lib/gemini";
import { getSoundPreset, getToneUri } from "@/lib/sounds";

type Phase = "ringing" | "ad" | "dismissed";

export default function RingingScreen() {
  useKeepAwake();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { alarms, recordDismissal, upsertAlarm } = useAlarms();
  const alarm = useMemo(
    () => alarms.find((a) => a.id === params.id) ?? null,
    [alarms, params.id],
  );

  const [steps, setSteps] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<Phase>("ringing");
  const [adRemaining, setAdRemaining] = useState(5);
  const [motivator, setMotivator] = useState<string | null>(null);
  const [motivatorLoading, setMotivatorLoading] = useState(false);
  const [soundUri, setSoundUri] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);
  const pedometerBaselineRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const mode = alarm?.dismissMode ?? "steps";
  const goal =
    mode === "shake" ? alarm?.shakeGoal ?? 20 : alarm?.stepGoal ?? 30;
  const progress = Math.min(steps / goal, 1);

  // Audio player
  const player = useAudioPlayer(soundUri ? { uri: soundUri } : null);

  useEffect(() => {
    if (!alarm) return;
    let cancelled = false;
    (async () => {
      try {
        const uri = await getToneUri(getSoundPreset(alarm.sound));
        if (!cancelled) setSoundUri(uri);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [alarm?.sound]);

  useEffect(() => {
    if (!soundUri) return;
    if (phase !== "ringing") {
      try {
        player.pause();
      } catch {}
      return;
    }
    try {
      player.loop = true;
      player.volume = alarm?.gentleWake ? 0.15 : 1;
      player.play();
    } catch {}
  }, [soundUri, phase, player, alarm?.gentleWake]);

  // Gentle wake volume ramp
  useEffect(() => {
    if (phase !== "ringing" || !alarm?.gentleWake || !soundUri) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const v = Math.min(1, 0.15 + elapsed / 30);
      try {
        player.volume = v;
      } catch {}
      if (v >= 1) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [phase, alarm?.gentleWake, soundUri, player]);

  // Pulse animation
  useEffect(() => {
    if (phase !== "ringing") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Vibration loop while ringing
  useEffect(() => {
    if (phase !== "ringing" || !alarm?.vibration || Platform.OS === "web") return;
    const id = setInterval(() => {
      Vibration.vibrate(400);
    }, 1200);
    return () => {
      clearInterval(id);
      Vibration.cancel();
    };
  }, [phase, alarm?.vibration]);

  // Pedometer (steps mode)
  useEffect(() => {
    if (mode !== "steps") return;
    if (Platform.OS === "web") {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const isAvail = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(isAvail);
        if (!isAvail) return;
        const perm = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== "granted") {
          setPermissionDenied(true);
          return;
        }
        // watchStepCount returns total steps since subscription started
        // (cumulative on both platforms per Expo docs).
        subscriptionRef.current = Pedometer.watchStepCount((res) => {
          if (pedometerBaselineRef.current === null) {
            pedometerBaselineRef.current = res.steps;
          }
          const delta = res.steps - (pedometerBaselineRef.current ?? 0);
          setSteps(delta < 0 ? res.steps : delta);
        });
      } catch {
        setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [mode]);

  // Accelerometer (shake mode)
  useEffect(() => {
    if (mode !== "shake") return;
    if (Platform.OS === "web") {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    let lastShake = 0;
    let active = false;
    Accelerometer.setUpdateInterval(80);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const t = Date.now();
      if (mag > 1.8 && !active && t - lastShake > 220) {
        active = true;
        lastShake = t;
        setSteps((s) => s + 1);
        if (Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (mag < 1.2 && active) {
        active = false;
      }
    });
    accelSubRef.current = sub;
    return () => {
      sub.remove();
      accelSubRef.current = null;
    };
  }, [mode]);

  // Reset progress whenever mode changes inside session
  useEffect(() => {
    setSteps(0);
    pedometerBaselineRef.current = null;
  }, [mode]);

  const finish = useCallback(
    async (success: boolean, finalSteps: number) => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      setPhase("dismissed");
      Vibration.cancel();
      try {
        player.pause();
      } catch {}
      const ranAt = startedAtRef.current;
      const dismissedAt = Date.now();
      if (alarm) {
        await recordDismissal({
          alarmId: alarm.id,
          alarmLabel: alarm.label,
          ranAt,
          dismissedAt,
          steps: finalSteps,
          durationMs: dismissedAt - ranAt,
          success,
        });
      }
      if (success) {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMotivatorLoading(true);
        try {
          const text = await getMorningMotivator(
            finalSteps,
            Math.round((dismissedAt - ranAt) / 1000),
            alarm?.label ?? "alarm",
          );
          setMotivator(text);
        } catch {
          setMotivator("Morning, mover. You earned this start.");
        } finally {
          setMotivatorLoading(false);
        }
      }
    },
    [alarm, recordDismissal, player],
  );

  // Auto-dismiss when goal hit
  useEffect(() => {
    if (phase === "ringing" && steps >= goal && goal > 0) {
      finish(true, steps);
    }
  }, [steps, goal, phase, finish]);

  // Ad countdown
  useEffect(() => {
    if (phase !== "ad") return;
    setAdRemaining(5);
    const id = setInterval(() => {
      setAdRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          finish(false, steps);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, steps, finish]);

  const handleSimulateStep = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSteps((s) => s + 1);
  };

  const handleGiveUp = () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    try {
      player.pause();
    } catch {}
    setPhase("ad");
  };

  const handleSnooze = async () => {
    if (!alarm || dismissedRef.current) return;
    dismissedRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    try {
      player.pause();
    } catch {}
    // Push the alarm time forward by snoozeMinutes
    const snoozeAt = new Date(Date.now() + alarm.snoozeMinutes * 60_000);
    await upsertAlarm({
      ...alarm,
      hour: snoozeAt.getHours(),
      minute: snoozeAt.getMinutes(),
    });
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  const elapsed = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${(elapsed % 60)
    .toString()
    .padStart(2, "0")}`;

  if (!alarm) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Alarm not found</Text>
        <Pressable onPress={handleClose} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const goalLabel = mode === "shake" ? "shakes" : "steps";
  const actionLabel =
    mode === "shake" ? "Shake to silence the alarm" : "Walk to silence the alarm";
  const manualLabel = mode === "shake" ? "Add shake (manual)" : "Add step (manual)";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={
          phase === "ringing"
            ? ["#FF7B47", "#E94560", "#3D2F5C"]
            : phase === "ad"
              ? ["#1A1530", "#0E0A1F", "#000"]
              : ["#FFB454", "#FF7B47", "#3D2F5C"]
        }
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {phase === "ringing" && (
        <View style={styles.center}>
          <Text style={styles.alarmLabel}>{alarm.label.toUpperCase()}</Text>
          <Text style={styles.bigClock}>
            {formatTime(alarm.hour, alarm.minute)}
            <Text style={styles.bigPeriod}>
              {" "}{formatPeriod(alarm.hour)}
            </Text>
          </Text>
          <Text style={styles.elapsed}>Ringing for {elapsedLabel}</Text>

          <Animated.View
            style={[
              styles.ringWrap,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          >
            <ProgressRing progress={progress} />
            <View style={styles.ringInner}>
              <Text style={styles.stepCount}>{steps}</Text>
              <Text style={styles.stepGoal}>
                of {goal} {goalLabel}
              </Text>
            </View>
          </Animated.View>

          {available === false ? (
            <Text style={styles.warn}>
              {mode === "shake"
                ? "Motion sensor unavailable. Use the manual button."
                : "No pedometer detected. Use the manual button."}
            </Text>
          ) : permissionDenied ? (
            <Text style={styles.warn}>
              Permission denied. Use the manual button below.
            </Text>
          ) : Platform.OS === "web" ? (
            <Text style={styles.warn}>
              Sensor counting is mobile-only. Use the manual button to simulate.
            </Text>
          ) : (
            <Text style={styles.hint}>{actionLabel}</Text>
          )}

          <Pressable
            onPress={handleSimulateStep}
            style={({ pressed }) => [
              styles.simulateBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="plus" size={14} color="#FFF4E0" />
            <Text style={styles.simulateText}>{manualLabel}</Text>
          </Pressable>

          <View style={styles.bottomRow}>
            {alarm.snoozeEnabled && (
              <Pressable
                onPress={handleSnooze}
                style={({ pressed }) => [
                  styles.snoozeBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="clock" size={14} color="#FFF4E0" />
                <Text style={styles.snoozeText}>
                  Snooze {alarm.snoozeMinutes}m
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleGiveUp}
              style={({ pressed }) => [
                styles.giveUpBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.giveUpText}>Give up</Text>
            </Pressable>
          </View>
        </View>
      )}

      {phase === "ad" && (
        <View style={styles.center}>
          <View style={styles.adCard}>
            <Text style={styles.adTag}>SPONSORED</Text>
            <Text style={styles.adHeadline}>
              Could've walked it off in {goal} {goalLabel}.
            </Text>
            <Text style={styles.adSub}>
              Tomorrow morning belongs to the people who get up.
            </Text>
            <View style={styles.adBrandRow}>
              <View style={styles.adLogo}>
                <Feather name="sun" size={20} color="#FF7B47" />
              </View>
              <View>
                <Text style={styles.adBrand}>Wakey Wakey Pro</Text>
                <Text style={styles.adBrandSub}>Remove ads · Premium sounds</Text>
              </View>
            </View>
            <View style={styles.adCountdownWrap}>
              <Text style={styles.adCountdown}>
                Skip in {adRemaining}s
              </Text>
            </View>
          </View>
        </View>
      )}

      {phase === "dismissed" && (
        <View style={styles.center}>
          <View style={styles.successCircle}>
            <Feather name="sun" size={48} color="#FF7B47" />
          </View>
          <Text style={styles.successTitle}>
            {motivator || motivatorLoading ? "Good morning" : "Alarm ended"}
          </Text>
          <Text style={styles.successSub}>
            {steps} {goalLabel} · {elapsedLabel}
          </Text>

          <View style={styles.motivatorBox}>
            {motivatorLoading ? (
              <ActivityIndicator color="#FFF4E0" />
            ) : motivator ? (
              <Text style={styles.motivator}>{motivator}</Text>
            ) : (
              <Text style={styles.motivator}>
                Try again tomorrow. Your future self is watching.
              </Text>
            )}
          </View>

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.doneBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.doneText}>
              {motivator ? "Start the day" : "Close"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 220;
  const stroke = 14;
  return (
    <View style={[ringStyles.outer, { width: size, height: size }]}>
      <View
        style={[
          ringStyles.track,
          {
            width: size,
            height: size,
            borderWidth: stroke,
            borderRadius: size / 2,
          },
        ]}
      />
      <View
        style={[
          ringStyles.fill,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderTopColor: "#FFF4E0",
            borderRightColor: progress > 0.25 ? "#FFF4E0" : "transparent",
            borderBottomColor: progress > 0.5 ? "#FFF4E0" : "transparent",
            borderLeftColor: progress > 0.75 ? "#FFF4E0" : "transparent",
            transform: [{ rotate: `${progress * 360 - 90}deg` }],
          },
        ]}
      />
    </View>
  );
}

const ringStyles = StyleSheet.create({
  outer: { alignItems: "center", justifyContent: "center" },
  track: {
    position: "absolute",
    borderColor: "rgba(255,255,255,0.18)",
  },
  fill: {
    position: "absolute",
    borderColor: "transparent",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  alarmLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 3,
    color: "#FFF4E0",
    opacity: 0.9,
  },
  bigClock: {
    fontFamily: "Outfit_700Bold",
    fontSize: 64,
    color: "#FFF4E0",
    letterSpacing: -2,
    marginTop: 8,
  },
  bigPeriod: {
    fontFamily: "Inter_500Medium",
    fontSize: 22,
    letterSpacing: 1,
  },
  elapsed: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FFF4E0",
    opacity: 0.75,
    marginTop: 6,
  },
  ringWrap: {
    marginTop: 36,
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCount: {
    fontFamily: "Outfit_700Bold",
    fontSize: 56,
    color: "#FFF4E0",
    letterSpacing: -1,
  },
  stepGoal: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFF4E0",
    opacity: 0.85,
    marginTop: -4,
  },
  hint: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#FFF4E0",
    marginTop: 28,
    opacity: 0.95,
  },
  warn: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FFF4E0",
    marginTop: 24,
    textAlign: "center",
    paddingHorizontal: 24,
    opacity: 0.95,
  },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 16,
  },
  simulateText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFF4E0",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 24,
  },
  snoozeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  snoozeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFF4E0",
  },
  giveUpBtn: { padding: 12 },
  giveUpText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FFF4E0",
    opacity: 0.7,
    textDecorationLine: "underline",
  },
  adCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(255,244,224,0.08)",
    borderColor: "rgba(255,244,224,0.18)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
  },
  adTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 2,
    color: "#FFB454",
    marginBottom: 12,
  },
  adHeadline: {
    fontFamily: "Outfit_700Bold",
    fontSize: 24,
    color: "#FFF4E0",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  adSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#FFF4E0",
    opacity: 0.78,
    marginTop: 12,
    lineHeight: 20,
  },
  adBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,244,224,0.12)",
  },
  adLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF4E0",
    alignItems: "center",
    justifyContent: "center",
  },
  adBrand: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF4E0",
  },
  adBrandSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#FFF4E0",
    opacity: 0.65,
    marginTop: 2,
  },
  adCountdownWrap: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,244,224,0.12)",
    alignItems: "center",
  },
  adCountdown: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#FFF4E0",
    opacity: 0.65,
    letterSpacing: 1,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFF4E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 40,
    color: "#FFF4E0",
    letterSpacing: -1,
  },
  successSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "#FFF4E0",
    opacity: 0.85,
    marginTop: 6,
  },
  motivatorBox: {
    marginTop: 32,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 20,
    paddingHorizontal: 22,
    borderRadius: 18,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 360,
  },
  motivator: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: "#FFF4E0",
    textAlign: "center",
    lineHeight: 23,
  },
  doneBtn: {
    marginTop: 32,
    backgroundColor: "#FFF4E0",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
  },
  doneText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#1A1530",
  },
});
