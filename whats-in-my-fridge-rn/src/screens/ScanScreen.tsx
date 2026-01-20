import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

const ScanScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🚧 Scan Screen - Coming Soon</Text>
      <Text style={styles.subtitle}>
        Aquí podrás escanear recibos con OCR
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  text: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});

export default ScanScreen;
