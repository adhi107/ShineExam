import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TenantProvider } from "./src/context/TenantContext";
import { SecurityProvider } from "./src/context/SecurityContext";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";

export function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <TenantProvider>
        <SecurityProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </SecurityProvider>
      </TenantProvider>
    </SafeAreaProvider>
  );
}

export default App;
