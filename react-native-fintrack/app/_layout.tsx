import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSettingsStore } from '../src/store/useSettingsStore';
import { useWalletStore } from '../src/store/useWalletStore';
import { useTransactionStore } from '../src/store/useTransactionStore';
import '../global.css';

export default function RootLayout() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadWallets = useWalletStore((state) => state.loadWallets);
  const loadTransactions = useTransactionStore((state) => state.loadTransactions);

  useEffect(() => {
    const initApp = async () => {
      await loadSettings();
      await loadWallets();
      await loadTransactions();
    };
    initApp();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#191B1F' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-transaction"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="add-account"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191B1F',
  },
});
