import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Check } from 'lucide-react-native';
import { useTransactionStore } from '../src/store/useTransactionStore';
import { useWalletStore } from '../src/store/useWalletStore';
import SpringPressable from '../src/components/ui/SpringPressable';

export default function AddTransactionModal() {
  const router = useRouter();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const wallets = useWalletStore((state) => state.wallets);
  const defaultWalletId = useWalletStore((state) => state.defaultWalletId);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(
    defaultWalletId || (wallets.length > 0 ? wallets[0].id : 'wallet_main')
  );
  const [category, setCategory] = useState('Makanan & Minuman');
  const [notes, setNotes] = useState('');

  const categories = [
    'Makanan & Minuman',
    'Transportasi',
    'Belanja',
    'Tagihan & Utilitas',
    'Hiburan',
    'Kesehatan',
    'Gaji',
    'Investasi',
  ];

  const handleSave = async () => {
    const numericAmount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Peringatan', 'Silakan masukkan nominal transaksi yang valid.');
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    await addTransaction({
      id: `tx_${Date.now()}`,
      wallet_id: selectedWalletId,
      type,
      amount: numericAmount,
      category_id: category,
      date: dateStr,
      time: timeStr,
      notes: notes.trim() || null,
      is_exclude_analytics: 0,
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <SpringPressable onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color="#F3F4F6" />
          </SpringPressable>
          <Text style={styles.title}>Catat Transaksi</Text>
          <SpringPressable onPress={handleSave} style={styles.saveBtn}>
            <Check size={18} color="#191B1F" strokeWidth={3} />
          </SpringPressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Type Switcher */}
          <View style={styles.typeSwitcher}>
            <SpringPressable
              onPress={() => setType('expense')}
              style={[styles.typeBtn, type === 'expense' && styles.activeExpenseBtn]}
            >
              <Text style={[styles.typeBtnText, type === 'expense' && styles.activeTypeBtnText]}>
                Pengeluaran
              </Text>
            </SpringPressable>
            <SpringPressable
              onPress={() => setType('income')}
              style={[styles.typeBtn, type === 'income' && styles.activeIncomeBtn]}
            >
              <Text style={[styles.typeBtnText, type === 'income' && styles.activeTypeBtnText]}>
                Pemasukan
              </Text>
            </SpringPressable>
          </View>

          {/* Amount Input */}
          <View style={styles.amountCard}>
            <Text style={styles.currencyPrefix}>Rp</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#4B5563"
              style={styles.amountInput}
              autoFocus
            />
          </View>

          {/* Category Selector */}
          <Text style={styles.sectionLabel}>KATEGORI</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const isSelected = category === cat;
              return (
                <SpringPressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.categoryPill, isSelected && styles.activeCategoryPill]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.activeCategoryPillText,
                    ]}
                  >
                    {cat}
                  </Text>
                </SpringPressable>
              );
            })}
          </View>

          {/* Notes Input */}
          <Text style={styles.sectionLabel}>CATATAN</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Tulis catatan (opsional)..."
            placeholderTextColor="#6B7280"
            style={styles.notesInput}
          />
        </ScrollView>
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
  saveBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#6EE7B7',
  },
  content: {
    paddingBottom: 40,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#23272F',
    borderRadius: 16,
    padding: 4,
    marginVertical: 12,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeExpenseBtn: {
    backgroundColor: '#F87171',
  },
  activeIncomeBtn: {
    backgroundColor: '#6EE7B7',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  activeTypeBtnText: {
    color: '#191B1F',
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#23272F',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '900',
    color: '#9CA3AF',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F3F4F6',
    minWidth: 120,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#23272F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeCategoryPill: {
    backgroundColor: '#4A688A',
    borderColor: '#4A688A',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  activeCategoryPillText: {
    color: '#FFFFFF',
  },
  notesInput: {
    backgroundColor: '#23272F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    fontSize: 13,
    color: '#F3F4F6',
  },
});
