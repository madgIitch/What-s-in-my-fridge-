import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

const AddItemScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🚧 Add Item Screen - Coming Soon</Text>
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
  },
});

export default AddItemScreen;
