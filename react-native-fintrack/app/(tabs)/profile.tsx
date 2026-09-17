import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Switch } from 'react-native';
import { ShieldCheck, Database, HelpCircle, Coins, ChevronRight, User } from 'lucide-react-native';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import SpringPressable from '../../src/components/ui/SpringPressable';

export default function ProfileScreen() {
  const profileName = useSettingsStore((state) => state.profileName);
  const authUserEmail = useSettingsStore((state) => state.authUserEmail);
  const authProvider = useSettingsStore((state) => state.authProvider);
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency);
  const securityEnabled = useSettingsStore((state) => state.securityEnabled);
  const setSecurity = useSettingsStore((state) => state.setSecurity);

  const handleToggleSecurity = async (val: boolean) => {
    await setSecurity({
      enabled: val,
      method: 'biometric',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profil & Pengaturan</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <User size={28} color="#F3F4F6" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profileName || 'Pengguna FinTrack'}</Text>
            <Text style={styles.userEmail}>
              {authUserEmail || (authProvider === 'guest' ? 'Mode Tamu (Offline)' : 'Terhubung')}
            </Text>
          </View>
        </View>

        {/* Section 1: Preferensi */}
        <Text style={styles.sectionLabel}>PREFERENSI APLIKASI</Text>
        <View style={styles.menuGroup}>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Coins size={18} color="#9CA3AF" />
              <Text style={styles.menuText}>Mata Uang Utama</Text>
            </View>
            <Text style={styles.menuValue}>{defaultCurrency}</Text>
          </View>

          <View style={[styles.menuItem, styles.divider]}>
            <View style={styles.menuLeft}>
              <ShieldCheck size={18} color="#9CA3AF" />
              <Text style={styles.menuText}>Kunci Biometrik / Sidik Jari</Text>
            </View>
            <Switch
              value={securityEnabled}
              onValueChange={handleToggleSecurity}
              trackColor={{ false: '#374151', true: '#6EE7B7' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section 2: Data & Bantuan */}
        <Text style={styles.sectionLabel}>DATA & BANTUAN</Text>
        <View style={styles.menuGroup}>
          <SpringPressable style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Database size={18} color="#9CA3AF" />
              <Text style={styles.menuText}>Cadangan Data & Sinkronisasi</Text>
            </View>
            <ChevronRight size={18} color="#6B7280" />
          </SpringPressable>

          <SpringPressable style={[styles.menuItem, styles.divider]}>
            <View style={styles.menuLeft}>
              <HelpCircle size={18} color="#9CA3AF" />
              <Text style={styles.menuText}>Pusat Bantuan & Panduan Fitur</Text>
            </View>
            <ChevronRight size={18} color="#6B7280" />
          </SpringPressable>
        </View>

        {/* Version Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>FinTrack v4.9.1 • React Native Edition</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#191B1F',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F3F4F6',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23272F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: '#23272F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  divider: {
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  menuValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6EE7B7',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
});
