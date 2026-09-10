import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { superAdminApi, SuperAdminStats, OrganizationItem } from "../../api/superAdminApi";
import ShineLogo from "../../components/ShineLogo";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Input from "../../components/Input";
import ConfirmDialog from "../../components/ConfirmDialog";

interface SuperAdminDashboardScreenProps {
  onEnterTenantAdmin: (tenantId: string) => void;
}

export const SuperAdminDashboardScreen: React.FC<SuperAdminDashboardScreenProps> = ({
  onEnterTenantAdmin,
}) => {
  const { user, userId, logout, switchActiveTenant } = useAuth();

  const [stats, setStats] = useState<SuperAdminStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalAdmins: 0,
    totalCandidates: 0,
    totalExams: 0,
    totalAttempts: 0,
    totalViolations: 0,
  });

  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create Org Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Status toggle confirm
  const [selectedOrgForStatusChange, setSelectedOrgForStatusChange] = useState<OrganizationItem | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await superAdminApi.getDashboardStats();
      if (res.stats) setStats(res.stats);
      if (res.organizations) setOrganizations(res.organizations);
    } catch (e) {
      console.warn("Failed to load super admin stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim() || !newTenantId.trim()) {
      alert("Please provide both an organization name and a unique tenant identifier.");
      return;
    }

    setIsCreating(true);
    try {
      await superAdminApi.createOrganization({
        name: newOrgName.trim(),
        tenantId: newTenantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        contactEmail: newContactEmail.trim(),
        status: "active",
      });
      setShowCreateModal(false);
      setNewOrgName("");
      setNewTenantId("");
      setNewContactEmail("");
      await loadDashboard();
    } catch (e: any) {
      alert(e?.message || "Failed to create organization.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleOrgStatus = async () => {
    if (!selectedOrgForStatusChange) return;
    const nextStatus = selectedOrgForStatusChange.status === "active" ? "suspended" : "active";
    try {
      await superAdminApi.updateOrganization(selectedOrgForStatusChange.id, {
        status: nextStatus,
      });
      setSelectedOrgForStatusChange(null);
      await loadDashboard();
    } catch (e: any) {
      alert(e?.message || "Failed to update status.");
    }
  };

  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.tenantId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ShineLogo size="sm" />
        <Button title="Sign Out" variant="ghost" size="sm" onPress={logout} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Banner */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>GLOBAL PLATFORM GOVERNANCE</Text>
          <Text style={styles.heroTitle}>Super Admin Master Console</Text>
          <Text style={styles.heroSubtitle}>
            Global multi-tenant governance, organization provisioning, and license monitoring.
          </Text>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Platform Metrics</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>🏢</Text>
            <Text style={styles.statVal}>{stats.totalOrganizations}</Text>
            <Text style={styles.statLbl}>Organizations</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>👤</Text>
            <Text style={styles.statVal}>{stats.totalAdmins}</Text>
            <Text style={styles.statLbl}>Org Admins</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>🎓</Text>
            <Text style={styles.statVal}>{stats.totalCandidates}</Text>
            <Text style={styles.statLbl}>Total Students</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statIcon}>📝</Text>
            <Text style={styles.statVal}>{stats.totalExams}</Text>
            <Text style={styles.statLbl}>Total Tests</Text>
          </Card>
        </View>

        {/* Organizations Management Header */}
        <View style={styles.orgHeaderRow}>
          <Text style={styles.sectionTitle}>Managed Organizations</Text>
          <Button
            title="+ Add Tenant"
            size="sm"
            onPress={() => setShowCreateModal(true)}
          />
        </View>

        {/* Search */}
        <Input
          placeholder="Search by organization name or tenant ID..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Org Cards */}
        {filteredOrgs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyTitle}>No Organizations Found</Text>
            <Text style={styles.emptySubtitle}>No organizations match your query.</Text>
          </Card>
        ) : (
          filteredOrgs.map((org) => {
            const isActive = org.status === "active";
            return (
              <Card key={org.id || org.tenantId} style={styles.orgCard}>
                <View style={styles.orgCardHeader}>
                  <Badge
                    label={org.status.toUpperCase()}
                    variant={isActive ? "success" : "danger"}
                    size="sm"
                  />
                  <Text style={styles.tenantIdBadge}>ID: {org.tenantId}</Text>
                </View>

                <Text style={styles.orgName}>{org.name}</Text>
                {org.contactEmail ? (
                  <Text style={styles.orgEmail}>✉️ {org.contactEmail}</Text>
                ) : null}

                <View style={styles.metricsRow}>
                  <Text style={styles.metricText}>
                    👤 {org.adminsCount || 0} Admins • 🎓 {org.candidatesCount || 0} Candidates • 📝 {org.examsCount || 0} Exams
                  </Text>
                </View>

                <View style={styles.orgActionRow}>
                  <Button
                    title={isActive ? "Suspend Access" : "Activate"}
                    variant={isActive ? "outline" : "primary"}
                    size="sm"
                    onPress={() => setSelectedOrgForStatusChange(org)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Enter Admin Portal →"
                    size="sm"
                    onPress={async () => {
                      await switchActiveTenant(org.tenantId);
                      onEnterTenantAdmin(org.tenantId);
                    }}
                    style={{ flex: 1.2 }}
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Create Org Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Provision New Organization</Text>
            <Text style={styles.modalSubtitle}>
              Create a tenant workspace for a new educational institution or academy.
            </Text>

            <Input
              label="Organization Name"
              placeholder="e.g. Apex Study Circle"
              value={newOrgName}
              onChangeText={(text) => {
                setNewOrgName(text);
                if (!newTenantId) {
                  setNewTenantId(text.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                }
              }}
            />

            <Input
              label="Tenant Slug / Identifier"
              placeholder="e.g. apex-study"
              value={newTenantId}
              onChangeText={setNewTenantId}
              autoCapitalize="none"
            />

            <Input
              label="Contact Email"
              placeholder="admin@apexstudy.com"
              value={newContactEmail}
              onChangeText={setNewContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowCreateModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create Workspace"
                loading={isCreating}
                onPress={handleCreateOrganization}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Status Change Modal */}
      <ConfirmDialog
        visible={Boolean(selectedOrgForStatusChange)}
        title={
          selectedOrgForStatusChange?.status === "active"
            ? "Suspend Organization?"
            : "Activate Organization?"
        }
        message={
          selectedOrgForStatusChange?.status === "active"
            ? `Suspending "${selectedOrgForStatusChange?.name}" will immediately block candidate and administrator login for this tenant. Proceed?`
            : `Re-activating "${selectedOrgForStatusChange?.name}" will restore exam access for all enrolled candidates. Proceed?`
        }
        confirmText={
          selectedOrgForStatusChange?.status === "active" ? "Yes, Suspend" : "Activate"
        }
        confirmVariant={
          selectedOrgForStatusChange?.status === "active" ? "danger" : "primary"
        }
        onConfirm={handleToggleOrgStatus}
        onCancel={() => setSelectedOrgForStatusChange(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  content: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: "#090e1a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#38bdf8",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 0,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  orgHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orgCard: {
    padding: 18,
    marginBottom: 14,
  },
  orgCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tenantIdBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  orgName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  orgEmail: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },
  metricsRow: {
    marginBottom: 14,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  orgActionRow: {
    flexDirection: "row",
    gap: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});

export default SuperAdminDashboardScreen;
