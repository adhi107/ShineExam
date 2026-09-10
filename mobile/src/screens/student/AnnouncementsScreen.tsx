import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { studentApi, StudentAnnouncement } from "../../api/studentApi";
import Card from "../../components/Card";

export const AnnouncementsScreen: React.FC = () => {
  const { userId } = useAuth();
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await studentApi.getAnnouncements(userId);
      setAnnouncements(res.announcements || []);
    } catch (e) {
      console.warn("Failed to load announcements:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnnouncements();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements & Updates</Text>
        <Text style={styles.headerSubtitle}>
          Important notices, exam schedules, and circulars from your administration.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {announcements.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={styles.emptyTitle}>No New Announcements</Text>
            <Text style={styles.emptySubtitle}>
              You have no active circulars or announcements at this time.
            </Text>
          </Card>
        ) : (
          announcements.map((item) => (
            <Card key={item.id} style={styles.announcementCard}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>📢 NOTICE</Text>
                </View>
                <Text style={styles.dateText}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
              </View>

              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  listContent: {
    padding: 20,
  },
  announcementCard: {
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badgeWrap: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1d4ed8",
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
});

export default AnnouncementsScreen;
