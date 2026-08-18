import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, ReceiptText, PieChart, PiggyBank, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#23272F',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#6EE7B7',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dasbor',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Anggaran',
          tabBarIcon: ({ color, size }) => <PieChart color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="savings"
        options={{
          title: 'Tabungan',
          tabBarIcon: ({ color, size }) => <PiggyBank color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
