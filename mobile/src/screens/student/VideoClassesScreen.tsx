import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { studentApi, StudentVideoClass } from "../../api/studentApi";
import SensitiveContent from "../../security/SensitiveContent";
import Card from "../../components/Card";
import Input from "../../components/Input";
import Badge from "../../components/Badge";

interface VideoClassesScreenProps {
  onSelectVideo: (video: StudentVideoClass) => void;
}

export const VideoClassesScreen: React.FC<VideoClassesScreenProps> = ({ onSelectVideo }) => {
  const { userId } = useAuth();
  const [classes, setClasses] = useState<StudentVideoClass[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadVideos = useCallback(async () => {
    try {
      const res = await studentApi.getClasses(userId, {
        search,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
      });
      setClasses(res.classes || []);
      if (res.categories) setCategories(res.categories);
    } catch (e) {
      console.warn("Failed to load video classes:", e);
    }
  }, [userId, search, selectedCategory]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const getThumbnailUrl = (video: StudentVideoClass): string | null => {
    const url = video.embedUrl || video.videoUrl || video.originalUrl || "";
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i);
    if (ytMatch) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    return null;
  };

  return (
    <SensitiveContent module="classes" userId={userId}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Video Classes</Text>
          <Text style={styles.headerSubtitle}>
            Recorded lectures and concept preparation videos assigned to your batch.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search lectures..."
            value={search}
            onChangeText={setSearch}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Category Pills */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryRow}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryPill,
                selectedCategory === "all" && styles.categoryPillActive,
              ]}
              onPress={() => setSelectedCategory("all")}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === "all" && styles.categoryTextActive,
                ]}
              >
                All Classes
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Video Cards Grid */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {classes.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎬</Text>
              <Text style={styles.emptyTitle}>No Video Lectures Available</Text>
              <Text style={styles.emptySubtitle}>
                No video classes match your current category or search query.
              </Text>
            </Card>
          ) : (
            classes.map((cls) => {
              const thumb = getThumbnailUrl(cls);
              return (
                <Card
                  key={cls.id}
                  style={styles.videoCard}
                  onPress={() => {
                    studentApi.trackVideoView(cls.id, userId).catch(() => {});
                    onSelectVideo(cls);
                  }}
                >
                  {/* Thumbnail / Play Banner */}
                  <View style={styles.thumbnailWrap}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.thumbnailImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.placeholderThumb}>
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    )}
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{cls.duration || "Video"}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.metaRow}>
                      <Badge label={cls.category || "General"} variant="primary" size="sm" />
                      <Text style={styles.viewsText}>👁️ {cls.viewCount || 0} views</Text>
                    </View>

                    <Text style={styles.videoTitle} numberOfLines={2}>
                      {cls.title}
                    </Text>

                    {cls.description ? (
                      <Text style={styles.videoDesc} numberOfLines={2}>
                        {cls.description}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>
    </SensitiveContent>
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
    paddingBottom: 12,
    backgroundColor: "#ffffff",
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  categoryRow: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryPillActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  categoryTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  listContent: {
    padding: 20,
  },
  videoCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: 16,
  },
  thumbnailWrap: {
    height: 180,
    backgroundColor: "#090e1a",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
  },
  placeholderThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    color: "#ffffff",
    fontSize: 22,
    marginLeft: 4,
  },
  durationBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardBody: {
    padding: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  viewsText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
    lineHeight: 22,
  },
  videoDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
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

export default VideoClassesScreen;
