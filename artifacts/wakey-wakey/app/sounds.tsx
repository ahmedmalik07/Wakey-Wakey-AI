import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAlarms } from "@/contexts/AlarmsContext";
import { useColors } from "@/hooks/useColors";
import { SOUND_PRESETS, getSoundPreset, getToneUri } from "@/lib/sounds";

export default function SoundsScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; current?: string }>();
  const { alarms, upsertAlarm } = useAlarms();
  const alarm = alarms.find((a) => a.id === params.id);
  const [selected, setSelected] = useState(params.current ?? alarm?.sound ?? "sunrise");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const player = useAudioPlayer(previewUri ? { uri: previewUri } : null);

  useEffect(() => {
    if (!previewUri) return;
    try {
      player.loop = true;
      player.play();
    } catch {}
  }, [previewUri, player]);

  const stopPreview = () => {
    try {
      player.pause();
    } catch {}
    setPlayingId(null);
    setPreviewUri(null);
  };

  const handlePreview = async (id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (playingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    setLoadingId(id);
    try {
      const uri = await getToneUri(getSoundPreset(id));
      if (!uri) return;
      setPlayingId(id);
      setPreviewUri(uri);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSelect = async (id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelected(id);
    if (alarm) {
      await upsertAlarm({ ...alarm, sound: id });
    }
  };

  const handleDone = () => {
    stopPreview();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Sound</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Tap to preview, then choose your wake sound.
      </Text>

      {SOUND_PRESETS.map((preset) => {
        const isSelected = selected === preset.id;
        const isPlaying = playingId === preset.id;
        const isLoading = loadingId === preset.id;
        return (
          <Pressable
            key={preset.id}
            onPress={() => handleSelect(preset.id)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                {preset.name}
              </Text>
              <Text
                style={[styles.rowSub, { color: colors.mutedForeground }]}
              >
                {preset.description}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handlePreview(preset.id);
              }}
              style={({ pressed }) => [
                styles.previewBtn,
                {
                  backgroundColor: isPlaying ? colors.primary : colors.muted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={16}
                  color={isPlaying ? colors.primaryForeground : colors.foreground}
                />
              )}
            </Pressable>
            {isSelected && (
              <Feather
                name="check-circle"
                size={20}
                color={colors.primary}
                style={{ marginLeft: 12 }}
              />
            )}
          </Pressable>
        );
      })}

      <Pressable
        onPress={handleDone}
        style={({ pressed }) => [
          styles.doneBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.doneText, { color: colors.primaryForeground }]}>
          Done
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  previewBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
  },
  doneText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
