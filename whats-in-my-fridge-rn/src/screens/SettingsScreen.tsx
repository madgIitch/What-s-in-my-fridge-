import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/common/Button';
import { signOut } from '../services/firebase/auth';
import { colors, typography, spacing } from '../theme';

const SettingsScreen = () => {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>⚙️ Settings Screen</Text>
      <Button title="Cerrar Sesión" onPress={handleSignOut} style={styles.button} />
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
    marginBottom: spacing.xl,
  },
  button: {
    minWidth: 200,
  },
});

export default SettingsScreen;
