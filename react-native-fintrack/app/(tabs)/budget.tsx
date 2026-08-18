import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { PieChart, AlertCircle, Plus } from 'lucide-react-native';
import SpringPressable from '../../src/components/ui/SpringPressable';

export default function BudgetScreen() {
  const dummyBudgets = [
    { id: '1', category: 'Makanan & Minuman', spent: 1250000, limit: 2000000, color: '#6EE7B7' },
    { id: '2', category: 'Transportasi', spent: 450000, limit: 600000, color: '#60A5FA' },
    { id: '3', category: 'Belanja & Hiburan', spent: 900000, limit: 1000000, color: '#FBBF24' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Anggaran & Batas Pengeluaran</Text>
          <SpringPressable style={styles.addBtn}>
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Buat Anggaran</Text>
          </SpringPressable>
        </View>

        {/* Budget Cards */}
        <View style={styles.budgetList}>
          {dummyBudgets.map((b) => {
            const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
            return (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryName}>{b.category}</Text>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: b.color }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.spentText}>
                    Terpakai: Rp {b.spent.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.limitText}>
                    Batas: Rp {b.limit.toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>
            );
          })}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F3F4F6',
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#4A688A',
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  budgetList: {
    gap: 12,
  },
  card: {
    backgroundColor: '#23272F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  pctText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#6EE7B7',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1C2027',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  limitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
});
