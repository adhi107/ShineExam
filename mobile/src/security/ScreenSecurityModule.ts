import { NativeModules, Platform } from "react-native";

interface ScreenSecurityInterface {
  enableSecureScreen: () => Promise<boolean>;
  disableSecureScreen: () => Promise<boolean>;
}

const { RNScreenSecurity } = NativeModules;

export const ScreenSecurityModule: ScreenSecurityInterface = {
  async enableSecureScreen(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    try {
      if (RNScreenSecurity && RNScreenSecurity.setFlagSecure) {
        await RNScreenSecurity.setFlagSecure(true);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("FLAG_SECURE enable error:", e);
      return false;
    }
  },

  async disableSecureScreen(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    try {
      if (RNScreenSecurity && RNScreenSecurity.setFlagSecure) {
        await RNScreenSecurity.setFlagSecure(false);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("FLAG_SECURE disable error:", e);
      return false;
    }
  },
};
