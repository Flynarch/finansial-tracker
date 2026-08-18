import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Target, Plus, PiggyBank } from 'lucide-react-native';
import SpringPressable from '../../src/components/ui/SpringPressable';

export default function SavingsScreen() {
  const dummyGoals = [
    { id: '1', title: 'Dana Darurat 6 Bulan', current: 15000000, target: 30000000, color: '#6EE7B7' },
    { id: '2', title: 'Liburan Akhir Tahun', current: 3500000, target: 7000000, color: '#60A5FA' },
    { id: '3', title: 'Beli Laptop Baru', current: 8000000, target: 12000000, color: '#A78BFA' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Target Tabungan</Text>
          <SpringPressable style={styles.addBtn}>
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Target Baru</Text>
          </SpringPressable>
        </View>

        {/* Goals List */}
        <View style={styles.goalsList}>
          {dummyGoals.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            return (
              <View key={g.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <View style={styles.iconCircle}>
                      <Target size={16} color="#F3F4F6" />
                    </View>
                    <Text style={styles.goalTitle}>{g.title}</Text>
                  </View>
                  <Text style={styles.pctText}>{pct}%</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: g.color }]} />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.currentText}>
                    Terkumpul: Rp {g.current.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.targetText}>
                    Target: Rp {g.target.toLocaleString('id-ID')}
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
    fontSize: 18,
    fontWeight: '900',
    color: '#F3F4F6',
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
  goalsList: {
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
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#1C2027',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: {
    fontSize: 13,
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
  currentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  targetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
});
