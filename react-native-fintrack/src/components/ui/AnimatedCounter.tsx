import React, { useEffect } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Custom format currency helper
export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  const rounded = Math.round(amount);
  const formattedNumber = new Intl.NumberFormat('id-ID').format(Math.abs(rounded));
  const sign = rounded < 0 ? '-' : '';

  switch (currency.toUpperCase()) {
    case 'USD':
      return `${sign}$${formattedNumber}`;
    case 'EUR':
      return `${sign}€${formattedNumber}`;
    case 'SGD':
      return `${sign}S$${formattedNumber}`;
    case 'MYR':
      return `${sign}RM${formattedNumber}`;
    case 'JPY':
      return `${sign}¥${formattedNumber}`;
    case 'GBP':
      return `${sign}£${formattedNumber}`;
    case 'IDR':
    default:
      return `${sign}Rp ${formattedNumber}`;
  }
}

interface AnimatedCounterProps {
  value: number;
  currency?: string;
  duration?: number;
  style?: TextStyle;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  currency = 'IDR',
  duration = 650,
  style,
  className,
}) => {
  const animatedValue = useSharedValue(value);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration]);

  // Display current formatted text
  return (
    <Text style={style} className={className}>
      {formatCurrency(value, currency)}
    </Text>
  );
};

export default AnimatedCounter;
