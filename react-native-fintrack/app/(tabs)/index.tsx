import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Bell, Sparkles } from 'lucide-react-native';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useWalletStore } from '../../src/store/useWalletStore';
import { useTransactionStore } from '../../src/store/useTransactionStore';
import WalletCarousel from '../../src/components/dashboard/WalletCarousel';
import SpringPressable from '../../src/components/ui/SpringPressable';
import AnimatedCounter from '../../src/components/ui/AnimatedCounter';

export default function DashboardScreen() {
  const router = useRouter();
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency);
  const profileName = useSettingsStore((state) => state.profileName);

  const wallets = useWalletStore((state) => state.wallets);
  const getTotalBalance = useWalletStore((state) => state.getTotalBalance);

  const transactions = useTransactionStore((state) => state.transactions);
  const monthIncome = useTransactionStore((state) => state.monthIncome);
  const monthExpense = useTransactionStore((state) => state.monthExpense);

  const totalBalance = getTotalBalance(defaultCurrency);
  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Selamat Datang,</Text>
            <Text style={styles.nameText}>{profileName || 'Pengguna FinTrack'}</Text>
          </View>

          <View style={styles.headerActions}>
            <SpringPressable
              onPress={() => router.push('/add-transaction')}
              style={styles.fabBtn}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.fabText}>Transaksi</Text>
            </SpringPressable>
          </View>
        </View>

        {/* 1. Wallet Carousel (Hero) */}
        <WalletCarousel
          totalBalance={totalBalance}
          monthIncome={monthIncome}
          monthExpense={monthExpense}
          wallets={wallets}
          defaultCurrency={defaultCurrency}
          onAddAccount={() => router.push('/add-account')}
          onSelectWallet={(w) => router.push(`/wallet/${w.id}`)}
        />

        {/* 2. Recent Transactions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TRANSAKSI TERAKHIR</Text>
            <SpringPressable onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </SpringPressable>
          </View>

          <View style={styles.txCard}>
            {recentTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Sparkles size={24} color="#9CA3AF" />
                <Text style={styles.emptyText}>Belum ada transaksi di bulan ini.</Text>
              </View>
            ) : (
              recentTransactions.map((tx, idx) => {
                const isExpense = tx.type === 'expense';
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txItem,
                      idx < recentTransactions.length - 1 && styles.txDivider,
                    ]}
                  >
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIconBadge,
                          isExpense ? styles.expenseBadge : styles.incomeBadge,
                        ]}
                      >
                        <Text style={styles.txIconText}>
                          {tx.category_id ? tx.category_id.substring(0, 1).toUpperCase() : 'T'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.txCategory}>
                          {tx.category_id || 'Transaksi'}
                        </Text>
                        <Text style={styles.txDate}>{tx.date}</Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        isExpense ? styles.expenseAmount : styles.incomeAmount,
                      ]}
                    >
                      {isExpense ? '-' : '+'}
                      {tx.amount.toLocaleString('id-ID')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F3F4F6',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#4A688A',
  },
  fabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  txCard: {
    backgroundColor: '#23272F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  txDivider: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeBadge: {
    backgroundColor: 'rgba(110, 231, 183, 0.15)',
  },
  expenseBadge: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  txIconText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F3F4F6',
  },
  txCategory: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  txDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  incomeAmount: {
    color: '#6EE7B7',
  },
  expenseAmount: {
    color: '#F87171',
  },
});
