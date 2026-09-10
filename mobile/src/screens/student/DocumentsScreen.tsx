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
import { studentApi, StudentDocument } from "../../api/studentApi";
import SensitiveContent from "../../security/SensitiveContent";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { useTenant } from "../../context/TenantContext";

export const DocumentsScreen: React.FC = () => {
  const { userId } = useAuth();
  const { theme } = useTenant();
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadDocs = useCallback(async () => {
    try {
      const res = await studentApi.getDocuments(userId);
      setDocuments(res.documents || []);
    } catch (e) {
      console.warn("Failed to load documents:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocs();
    setRefreshing(false);
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase())
  );

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <SensitiveContent module="documents" userId={userId}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Study Documents</Text>
          <Text style={styles.headerSubtitle}>
            Handouts, study guides, and formula sheets assigned by your instructors.
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search documents by title..."
            value={search}
            onChangeText={setSearch}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Document List */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredDocs.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No Documents Available</Text>
              <Text style={styles.emptySubtitle}>
                No study materials or documents match your search.
              </Text>
            </Card>
          ) : (
            filteredDocs.map((doc) => (
              <Card key={doc.id} style={styles.docCard}>
                <View style={styles.docRow}>
                  <View style={styles.docIconBox}>
                    <Text style={styles.docIconText}>📄</Text>
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    {doc.description ? (
                      <Text style={styles.docDesc}>{doc.description}</Text>
                    ) : null}
                    <Text style={styles.docMeta}>
                      {formatFileSize(doc.size)} • {doc.originalName}
                    </Text>
                  </View>
                </View>

                <Button
                  title="View Document 📖"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    alert(`Viewing ${doc.title} in protected viewer`);
                  }}
                  style={styles.viewBtn}
                />
              </Card>
            ))
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
  listContent: {
    padding: 20,
  },
  docCard: {
    padding: 16,
    marginBottom: 12,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  docIconText: {
    fontSize: 22,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  docDesc: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 6,
    lineHeight: 18,
  },
  docMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  viewBtn: {
    alignSelf: "flex-end",
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

export default DocumentsScreen;
