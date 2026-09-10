import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import SecurityViolationsScreen from "../screens/admin/SecurityViolationsScreen";
import SuperAdminDashboardScreen from "../screens/admin/SuperAdminDashboardScreen";

export type AdminStackParamList = {
  SuperAdminDashboard: undefined;
  AdminDashboard: undefined;
  SecurityViolations: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export const AdminNavigator: React.FC = () => {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  return (
    <Stack.Navigator
      initialRouteName={isSuperAdmin ? "SuperAdminDashboard" : "AdminDashboard"}
      screenOptions={{ headerShown: false }}
    >
      {isSuperAdmin && (
        <Stack.Screen name="SuperAdminDashboard">
          {({ navigation }) => (
            <SuperAdminDashboardScreen
              onEnterTenantAdmin={() => navigation.navigate("AdminDashboard")}
            />
          )}
        </Stack.Screen>
      )}

      <Stack.Screen name="AdminDashboard">
        {({ navigation }) => (
          <AdminDashboardScreen
            onNavigateToViolations={() => navigation.navigate("SecurityViolations")}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SecurityViolations">
        {({ navigation }) => (
          <SecurityViolationsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AdminNavigator;
