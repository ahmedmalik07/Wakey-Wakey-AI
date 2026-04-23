import { Feather } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
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
  const [selected, setSelected] = useState(
    params.current ?? alarm?.sound ?? "sunrise",
  );
  const [customUri, setCustomUri] = useState<string | undefined>(
    alarm?.customSoundUri,
  );
  const [customName, setCustomName] = useState<string | undefined>(
    alarm?.customSoundName,
  );
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

  const handlePreview = async (id: string, uri?: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (playingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    setLoadingId(id);
    try {
      let resolved: string | null = uri ?? null;
      if (!resolved) {
        resolved = await getToneUri(getSoundPreset(id));
      }
      if (!resolved) return;
      setPlayingId(id);
      setPreviewUri(resolved);
    } finally {
      setLoadingId(null);
    }
  };

  const persistSelection = async (
    id: string,
    extras: Partial<{ customSoundUri: string; customSoundName: string }> = {},
  ) => {
    if (alarm) {
      await upsertAlarm({
        ...alarm,
        sound: id,
        customSoundUri:
          id === "custom" ? extras.customSoundUri ?? customUri : undefined,
        customSoundName:
          id === "custom" ? extras.customSoundName ?? customName : undefined,
      });
    }
  };

  const handleSelect = async (id: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (id === "custom" && !customUri) {
      await pickCustom();
      return;
    }
    setSelected(id);
    await persistSelection(id);
  };

  const pickCustom = async () => {
    if (Platform.OS === "web") return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file) return;
      const uri = file.uri;
      const name = file.name || "Custom audio";
      setCustomUri(uri);
      setCustomName(name);
      setSelected("custom");
      await persistSelection("custom", {
        customSoundUri: uri,
        customSoundName: name,
      });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleDone = () => {
    stopPreview();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

      {/* Custom row at top */}
      <Pressable
        onPress={() => handleSelect("custom")}
        onLongPress={pickCustom}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: selected === "custom" ? colors.primary : colors.border,
            borderWidth: selected === "custom" ? 2 : 1,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>
            {customUri ? customName || "Custom audio" : "Pick from device"}
          </Text>
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
            {customUri
              ? "Saved music or downloaded audio · long-press to change"
              : Platform.OS === "web"
                ? "Mobile only — pick MP3/M4A/WAV from your library"
                : "Choose any MP3/M4A/WAV from your library"}
          </Text>
        </View>
        {customUri ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handlePreview("custom", customUri);
            }}
            style={({ pressed }) => [
              styles.previewBtn,
              {
                backgroundColor:
                  playingId === "custom" ? colors.primary : colors.muted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {loadingId === "custom" ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Feather
                name={playingId === "custom" ? "pause" : "play"}
                size={16}
                color={
                  playingId === "custom"
                    ? colors.primaryForeground
                    : colors.foreground
                }
              />
            )}
          </Pressable>
        ) : (
          <Feather
            name="folder-plus"
            size={18}
            color={colors.mutedForeground}
          />
        )}
        {selected === "custom" && (
          <Feather
            name="check-circle"
            size={20}
            color={colors.primary}
            style={{ marginLeft: 12 }}
          />
        )}
      </Pressable>

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
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
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
