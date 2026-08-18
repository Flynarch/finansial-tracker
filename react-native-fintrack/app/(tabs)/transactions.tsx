import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { Search, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useTransactionStore } from '../../src/store/useTransactionStore';
import SpringPressable from '../../src/components/ui/SpringPressable';
import { TransactionEntity } from '../../src/db/repositories/transactionRepository';

export default function TransactionsScreen() {
  const transactions = useTransactionStore((state) => state.transactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  const renderItem = ({ item }: { item: TransactionEntity }) => {
    const isExpense = item.type === 'expense';
    return (
      <View style={styles.txCard}>
        <View style={styles.txLeft}>
          <View style={[styles.badge, isExpense ? styles.expenseBadge : styles.incomeBadge]}>
            {isExpense ? (
              <ArrowUpRight size={18} color="#F87171" strokeWidth={2.5} />
            ) : (
              <ArrowDownLeft size={18} color="#6EE7B7" strokeWidth={2.5} />
            )}
          </View>
          <View>
            <Text style={styles.txTitle}>{item.category_id || 'Transaksi'}</Text>
            <Text style={styles.txSubtitle}>
              {item.date} {item.notes ? `• ${item.notes}` : ''}
            </Text>
          </View>
        </View>

        <Text style={[styles.txAmount, isExpense ? styles.expenseText : styles.incomeText]}>
          {isExpense ? '-' : '+'}Rp {item.amount.toLocaleString('id-ID')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Riwayat Transaksi</Text>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari transaksi atau catatan..."
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
            />
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.pillsRow}>
          {(['all', 'expense', 'income'] as const).map((type) => {
            const isActive = filterType === type;
            const labels = { all: 'Semua', expense: 'Pengeluaran', income: 'Pemasukan' };
            return (
              <SpringPressable
                key={type}
                onPress={() => setFilterType(type)}
                style={[styles.pill, isActive && styles.activePill]}
              >
                <Text style={[styles.pillText, isActive && styles.activePillText]}>
                  {labels[type]}
                </Text>
              </SpringPressable>
            );
          })}
        </View>

        {/* Transactions List */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Tidak ada transaksi yang cocok.</Text>
            </View>
          }
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
    paddingTop: 16,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F3F4F6',
  },
  searchRow: {
    marginBottom: 12,
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
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#23272F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeBadge: {
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
  },
  expenseBadge: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  txSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
    maxWidth: 180,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  incomeText: {
    color: '#6EE7B7',
  },
  expenseText: {
    color: '#F87171',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
