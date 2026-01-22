import { useColorScheme } from 'react-native';
import { Colors } from '../theme/colors';

/**
 * Hook to get the current theme colors based on system color scheme
 */
export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  return {
    colors,
    isDark,
    colorScheme: colorScheme ?? 'light',
  };
}
