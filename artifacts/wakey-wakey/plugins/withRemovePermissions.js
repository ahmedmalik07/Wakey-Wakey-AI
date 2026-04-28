const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to explicitly remove the RECORD_AUDIO permission
 * which is automatically injected by libraries like expo-audio/expo-av.
 */
module.exports = function withRemovePermissions(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    if (androidManifest["uses-permission"]) {
      androidManifest["uses-permission"] = androidManifest["uses-permission"].filter(
        (perm) => {
          const name = perm.$["android:name"];
          // Remove RECORD_AUDIO to avoid Play Store Privacy Policy rejection
          return name !== "android.permission.RECORD_AUDIO";
        }
      );
    }
    return config;
  });
};
