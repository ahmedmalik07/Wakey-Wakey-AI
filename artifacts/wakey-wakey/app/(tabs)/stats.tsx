import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAlarms } from "@/contexts/AlarmsContext";
import { useColors } from "@/hooks/useColors";
import { getWeeklyInsight } from "@/lib/gemini";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, clearHistory } = useAlarms();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = history.filter((h) => h.ranAt >= sevenDaysAgo);
    const successes = recent.filter((h) => h.success);
    const successRate =
      recent.length > 0 ? (successes.length / recent.length) * 100 : 0;
    const avgSec =
      successes.length > 0
        ? successes.reduce((sum, h) => sum + h.durationMs, 0) /
          successes.length /
          1000
        : 0;
    const bestSec =
      successes.length > 0
        ? Math.min(...successes.map((h) => h.durationMs)) / 1000
        : 0;
    const totalSteps = recent.reduce((sum, h) => sum + h.steps, 0);

    // Build a 7-day chart
    const days: { label: string; count: number; success: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const dayEnd = day.getTime() + 24 * 60 * 60 * 1000;
      const dayRecords = recent.filter(
        (h) => h.ranAt >= day.getTime() && h.ranAt < dayEnd,
      );
      days.push({
        label: ["S", "M", "T", "W", "T", "F", "S"][day.getDay()],
        count: dayRecords.length,
        success: dayRecords.filter((h) => h.success).length,
      });
    }

    return {
      total: recent.length,
      successes: successes.length,
      successRate,
      avgSec,
      bestSec,
      totalSteps,
      days,
    };
  }, [history]);

  const generate = async () => {
    if (stats.total === 0) return;
    setLoading(true);
    setError(null);
    try {
      const text = await getWeeklyInsight(
        stats.successes,
        stats.total,
        stats.avgSec,
        stats.bestSec,
      );
      setInsight(text);
    } catch (e) {
      setError("Couldn't reach the insight engine. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const maxCount = Math.max(1, ...stats.days.map((d) => d.count));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Your week
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Last 7 days of wake-up walks
      </Text>

      <View style={[styles.statGrid]}>
        <StatCard
          label="Wake rate"
          value={`${stats.successRate.toFixed(0)}%`}
          accent={colors.primary}
        />
        <StatCard
          label="Beaten"
          value={`${stats.successes}/${stats.total}`}
          accent={colors.accent}
        />
      </View>
      <View style={styles.statGrid}>
        <StatCard
          label="Avg time"
          value={stats.avgSec > 0 ? `${stats.avgSec.toFixed(0)}s` : "—"}
          accent={colors.foreground}
        />
        <StatCard
          label="Fastest"
          value={stats.bestSec > 0 ? `${stats.bestSec.toFixed(0)}s` : "—"}
          accent={colors.foreground}
        />
      </View>

      <View
        style={[
          styles.chartCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.chartTitle, { color: colors.foreground }]}>
          Daily wake-ups
        </Text>
        <View style={styles.chart}>
          {stats.days.map((d, i) => {
            const height = (d.count / maxCount) * 100;
            const successRatio = d.count > 0 ? d.success / d.count : 0;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(height, 3)}%`,
                        backgroundColor:
                          successRatio === 1
                            ? colors.primary
                            : successRatio > 0
                              ? colors.accent
                              : colors.muted,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.barLabel, { color: colors.mutedForeground }]}
                >
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.insightCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.insightHeader}>
          <Feather name="zap" size={16} color={colors.accent} />
          <Text
            style={[styles.insightTitle, { color: colors.foreground }]}
          >
            AI weekly insight
          </Text>
        </View>
        {loading ? (
          <View style={{ paddingVertical: 16, alignItems: "flex-start" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : insight ? (
          <Text style={[styles.insightText, { color: colors.foreground }]}>
            {insight}
          </Text>
        ) : error ? (
          <Text style={[styles.insightText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : (
          <Text
            style={[styles.insightText, { color: colors.mutedForeground }]}
          >
            {stats.total === 0
              ? "Beat at least one alarm to unlock your weekly summary."
              : "Tap below to summarize your week."}
          </Text>
        )}
        <Pressable
          disabled={stats.total === 0 || loading}
          onPress={generate}
          style={({ pressed }) => [
            styles.insightBtn,
            {
              backgroundColor:
                stats.total === 0 || loading ? colors.muted : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather
            name="zap"
            size={14}
            color={colors.primaryForeground}
          />
          <Text
            style={[styles.insightBtnText, { color: colors.primaryForeground }]}
          >
            {insight ? "Regenerate" : "Generate insight"}
          </Text>
        </Pressable>
      </View>

      {history.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recent wake-ups
          </Text>
          {history.slice(0, 8).map((h) => (
            <View
              key={h.id}
              style={[
                styles.historyRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.historyDot,
                  {
                    backgroundColor: h.success
                      ? colors.primary
                      : colors.destructive,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.historyLabel,
                    { color: colors.foreground },
                  ]}
                >
                  {h.alarmLabel}
                </Text>
                <Text
                  style={[
                    styles.historySub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {new Date(h.ranAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.historyValue,
                    { color: colors.foreground },
                  ]}
                >
                  {h.steps} steps
                </Text>
                <Text
                  style={[
                    styles.historySub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {(h.durationMs / 1000).toFixed(0)}s
                </Text>
              </View>
            </View>
          ))}
          <Pressable
            onPress={clearHistory}
            style={({ pressed }) => [
              styles.clearBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[
                styles.clearBtnText,
                { color: colors.mutedForeground },
              ]}
            >
              Clear history
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Outfit_700Bold",
    fontSize: 32,
    marginTop: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  statGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginTop: 12,
  },
  chartTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    marginBottom: 16,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 120,
    alignItems: "flex-end",
    gap: 6,
  },
  barCol: { flex: 1, alignItems: "center", gap: 8 },
  barTrack: {
    width: "100%",
    height: 100,
    justifyContent: "flex-end",
  },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  insightCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginTop: 16,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  insightTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
  insightText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  insightBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  insightBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  recentSection: { marginTop: 28 },
  sectionTitle: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 18,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  historySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  historyValue: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
  clearBtn: { alignSelf: "center", padding: 14, marginTop: 8 },
  clearBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
