import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Plus, Star } from 'lucide-react-native';
import AnimatedCounter from '../ui/AnimatedCounter';
import SpringPressable from '../ui/SpringPressable';
import { WalletEntity } from '../../db/repositories/walletRepository';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface WalletCarouselProps {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  wallets: WalletEntity[];
  defaultCurrency: string;
  onAddAccount: () => void;
  onSelectWallet: (wallet: WalletEntity) => void;
}

export const WalletCarousel: React.FC<WalletCarouselProps> = ({
  totalBalance,
  monthIncome,
  monthExpense,
  wallets,
  defaultCurrency,
  onAddAccount,
  onSelectWallet,
}) => {
  const sisaKeuangan = monthIncome - monthExpense;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {/* SLIDE 1: Sisa Keuangan & Overview */}
        <View style={[styles.card, { width: CARD_WIDTH }]}>
          <View style={styles.headerRow}>
            <Text style={styles.label}>SISA KEUANGAN</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>BULAN INI</Text>
            </View>
          </View>

          <AnimatedCounter
            value={sisaKeuangan}
            currency={defaultCurrency}
            style={styles.heroAmount}
          />

          <View style={styles.statsRow}>
            {/* Income */}
            <View style={[styles.statPill, styles.incomePill]}>
              <View style={styles.pillIcon}>
                <ArrowDownLeft size={16} color="#6EE7B7" strokeWidth={2.5} />
              </View>
              <View style={styles.pillTextContainer}>
                <Text style={styles.incomeLabel}>Pemasukan</Text>
                <AnimatedCounter
                  value={monthIncome}
                  currency={defaultCurrency}
                  style={styles.incomeAmount}
                />
              </View>
            </View>

            {/* Expense */}
            <View style={[styles.statPill, styles.expensePill]}>
              <View style={styles.pillIcon}>
                <ArrowUpRight size={16} color="#F87171" strokeWidth={2.5} />
              </View>
              <View style={styles.pillTextContainer}>
                <Text style={styles.expenseLabel}>Pengeluaran</Text>
                <AnimatedCounter
                  value={monthExpense}
                  currency={defaultCurrency}
                  style={styles.expenseAmount}
                />
              </View>
            </View>
          </View>
        </View>

        {/* SLIDE 2: Total Saldo & Wallets */}
        <View style={[styles.card, { width: CARD_WIDTH }]}>
          <View style={styles.headerRow}>
            <Text style={styles.label}>TOTAL SALDO</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{wallets.length} AKUN</Text>
            </View>
          </View>

          <AnimatedCounter
            value={totalBalance}
            currency={defaultCurrency}
            style={styles.heroAmount}
          />

          {/* Mini Wallets Horizontal List */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.miniWalletsScroll}
          >
            {wallets.map((w) => (
              <SpringPressable
                key={w.id}
                onPress={() => onSelectWallet(w)}
                style={styles.miniWallet}
              >
                <View style={styles.miniLogo}>
                  <Text style={styles.miniLogoText}>
                    {w.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text numberOfLines={1} style={styles.miniName}>
                    {w.name}
                  </Text>
                  <Text style={styles.miniBalance}>
                    {w.balance.toLocaleString('id-ID')}
                  </Text>
                </View>
              </SpringPressable>
            ))}

            <SpringPressable onPress={onAddAccount} style={[styles.miniWallet, styles.addWallet]}>
              <View style={styles.addIcon}>
                <Plus size={16} color="#191B1F" strokeWidth={2.5} />
              </View>
              <Text style={styles.addText}>Tambah</Text>
            </SpringPressable>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#23272F',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#1C2027',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F3F4F6',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  incomePill: {
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  expensePill: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  pillIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTextContainer: {
    flex: 1,
  },
  incomeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  incomeAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6EE7B7',
    marginTop: 2,
  },
  expenseLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F87171',
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F87171',
    marginTop: 2,
  },
  miniWalletsScroll: {
    marginTop: 10,
  },
  miniWallet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1C2027',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
    gap: 8,
  },
  miniLogo: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLogoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  miniName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    maxWidth: 80,
  },
  miniBalance: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  addWallet: {
    borderStyle: 'dashed',
  },
  addIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});

export default WalletCarousel;
