import { Platform } from "react-native";

/**
 * Global Environment Configuration
 * Supports development emulator, LAN testing, staging, and production HTTPS backend.
 */
export const ENV = {
  // Production Flask Backend URL
  PROD_API_URL: "https://api.victorystudycircle.com/api",

  // Local / Development Flask Backend URL
  // Android Emulator uses 10.0.2.2 to point to host localhost
  DEV_API_URL: Platform.OS === "android" ? "http://10.0.2.2:5000/api" : "http://localhost:5000/api",

  // Change to true or set via build config in production
  IS_PRODUCTION: false,

  // Request timeout in milliseconds
  TIMEOUT_MS: 20000,
};

export function getApiBaseUrl(): string {
  if (ENV.IS_PRODUCTION) {
    return ENV.PROD_API_URL;
  }
  return ENV.DEV_API_URL;
}
