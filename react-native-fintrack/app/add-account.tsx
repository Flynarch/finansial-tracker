import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Search } from 'lucide-react-native';
import { INDONESIAN_INSTITUTIONS, InstitutionInfo } from '../src/data/walletInstitutions';
import { useWalletStore } from '../src/store/useWalletStore';
import SpringPressable from '../src/components/ui/SpringPressable';

export default function AddAccountModal() {
  const router = useRouter();
  const addWallet = useWalletStore((state) => state.addWallet);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'bank' | 'ewallet' | 'investment'>('all');

  const filteredInstitutions = INDONESIAN_INSTITUTIONS.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || inst.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleSelect = (inst: InstitutionInfo) => {
    Alert.prompt
      ? Alert.prompt(
          `Tambah ${inst.name}`,
          'Masukkan saldo awal akun ini (Rp):',
          async (text) => {
            const initialBalance = parseFloat(text || '0') || 0;
            await addWallet({
              id: `wallet_${Date.now()}`,
              name: inst.name,
              type: inst.category === 'bank' ? 'bank' : 'ewallet',
              balance: initialBalance,
              initial_balance: initialBalance,
              currency: 'IDR',
              institution_id: inst.id,
              color: inst.color,
              is_archived: 0,
            });
            router.back();
          },
          'plain-text',
          '0'
        )
      : (async () => {
          await addWallet({
            id: `wallet_${Date.now()}`,
            name: inst.name,
            type: inst.category === 'bank' ? 'bank' : 'ewallet',
            balance: 0,
            initial_balance: 0,
            currency: 'IDR',
            institution_id: inst.id,
            color: inst.color,
            is_archived: 0,
          });
          router.back();
        })();
  };

  const renderItem = ({ item }: { item: InstitutionInfo }) => (
    <SpringPressable onPress={() => handleSelect(item)} style={styles.card}>
      <View style={[styles.logo, { backgroundColor: item.color }]}>
        <Text style={styles.logoText}>{item.code.substring(0, 3)}</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.category}>{item.category.toUpperCase()}</Text>
      </View>
    </SpringPressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <SpringPressable onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color="#F3F4F6" />
          </SpringPressable>
          <Text style={styles.title}>Pilih Institusi / Dompet</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cari bank, e-wallet, atau crypto..."
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>

        {/* Category Pills */}
        <View style={styles.pillsRow}>
          {(['all', 'bank', 'ewallet', 'investment'] as const).map((cat) => {
            const isActive = selectedCategory === cat;
            const labels = {
              all: 'Semua',
              bank: 'Bank',
              ewallet: 'E-Wallet',
              investment: 'Investasi',
            };
            return (
              <SpringPressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.pill, isActive && styles.activePill]}
              >
                <Text style={[styles.pillText, isActive && styles.activePillText]}>
                  {labels[cat]}
                </Text>
              </SpringPressable>
            );
          })}
        </View>

        {/* List */}
        <FlatList
          data={filteredInstitutions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#191B1F',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#23272F',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23272F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#F3F4F6',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#23272F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activePill: {
    backgroundColor: '#4A688A',
    borderColor: '#4A688A',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  activePillText: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 32,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23272F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    gap: 12,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 2,
  },
});
