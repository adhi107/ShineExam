import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { studentApi, StudentBookmark } from "../../api/studentApi";
import Card from "../../components/Card";
import Badge from "../../components/Badge";

interface BookmarksScreenProps {
  onOpenTest?: (testId: string) => void;
}

export const BookmarksScreen: React.FC<BookmarksScreenProps> = ({ onOpenTest }) => {
  const { userId } = useAuth();
  const [bookmarks, setBookmarks] = useState<StudentBookmark[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookmarks = useCallback(async () => {
    try {
      const res = await studentApi.getBookmarks(userId);
      setBookmarks(res.bookmarks || []);
    } catch (e) {
      console.warn("Failed to load bookmarks:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookmarks();
    setRefreshing(false);
  };

  const handleRemoveBookmark = async (bookmark: StudentBookmark) => {
    try {
      await studentApi.toggleBookmark({
        userId,
        type: bookmark.type,
        testId: bookmark.testId,
        questionId: bookmark.questionId,
      });
      loadBookmarks();
    } catch (e) {
      console.warn("Failed to remove bookmark:", e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Starred Bookmarks</Text>
        <Text style={styles.headerSubtitle}>
          Questions and tests saved for quick revision and deep practice.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {bookmarks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No Bookmarks Saved</Text>
            <Text style={styles.emptySubtitle}>
              Tap the star/bookmark icon on any question or exam to save it for quick revision.
            </Text>
          </Card>
        ) : (
          bookmarks.map((bm) => (
            <Card key={bm.id || `${bm.testId}_${bm.questionId}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Badge
                  label={bm.type === "question" ? "QUESTION" : "EXAM"}
                  variant={bm.type === "question" ? "warning" : "primary"}
                  size="sm"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveBookmark(bm)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.removeText}>Remove ⭐</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{bm.title}</Text>
              {bm.question ? (
                <Text style={styles.questionText} numberOfLines={3}>
                  {bm.question}
                </Text>
              ) : null}

              {bm.type === "test" && onOpenTest ? (
                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => onOpenTest(bm.testId)}
                >
                  <Text style={styles.openBtnText}>Open Test →</Text>
                </TouchableOpacity>
              ) : null}
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
  card: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  removeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#eab308",
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  questionText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 8,
  },
  openBtn: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
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

export default BookmarksScreen;
