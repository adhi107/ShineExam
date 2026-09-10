import React from "react";
import { View, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import StudentDashboardScreen from "../screens/student/StudentDashboardScreen";
import MyTestsScreen from "../screens/student/MyTestsScreen";
import VideoClassesScreen from "../screens/student/VideoClassesScreen";
import DocumentsScreen from "../screens/student/DocumentsScreen";
import BookmarksScreen from "../screens/student/BookmarksScreen";
import ResultsListScreen from "../screens/student/ResultsListScreen";
import ProfileScreen from "../screens/student/ProfileScreen";
import { useTenant } from "../context/TenantContext";

export type StudentTabParamList = {
  Dashboard: undefined;
  Tests: undefined;
  Classes: undefined;
  Reports: undefined;
  Documents: undefined;
  Bookmarks: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

interface StudentNavigatorProps {
  onStartExam: (testId: string) => void;
  onOpenReport: (attemptId: string) => void;
}

export const StudentNavigator: React.FC<StudentNavigatorProps> = ({
  onStartExam,
  onOpenReport,
}) => {
  const { theme, isFeatureEnabled } = useTenant();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏠</Text>,
        }}
      >
        {({ navigation }) => (
          <StudentDashboardScreen
            onStartTest={(testId) => onStartExam(testId)}
            onNavigateToTab={(tabName) => navigation.navigate(tabName as any)}
            onOpenReport={(attemptId) => onOpenReport(attemptId)}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Tests"
        options={{
          tabBarLabel: "Tests",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📝</Text>,
        }}
      >
        {() => (
          <MyTestsScreen
            onStartTest={(testId) => onStartExam(testId)}
            onViewResult={(attemptId) => onOpenReport(attemptId)}
          />
        )}
      </Tab.Screen>

      {isFeatureEnabled("videoClasses") && (
        <Tab.Screen
          name="Classes"
          options={{
            tabBarLabel: "Classes",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🎬</Text>,
          }}
        >
          {() => (
            <VideoClassesScreen
              onSelectVideo={(video) => {
                alert(`Playing: ${video.title}`);
              }}
            />
          )}
        </Tab.Screen>
      )}

      <Tab.Screen
        name="Reports"
        options={{
          tabBarLabel: "Reports",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text>,
        }}
      >
        {() => <ResultsListScreen onSelectResult={(attemptId) => onOpenReport(attemptId)} />}
      </Tab.Screen>

      {isFeatureEnabled("learningDocuments") && (
        <Tab.Screen
          name="Documents"
          options={{
            tabBarLabel: "Docs",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📚</Text>,
          }}
          component={DocumentsScreen}
        />
      )}

      <Tab.Screen
        name="Bookmarks"
        options={{
          tabBarLabel: "Saved",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⭐</Text>,
        }}
      >
        {() => <BookmarksScreen onOpenTest={(testId) => onStartExam(testId)} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👤</Text>,
        }}
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
};

export default StudentNavigator;
