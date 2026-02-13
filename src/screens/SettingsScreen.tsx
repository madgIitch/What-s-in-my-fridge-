import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Button } from '../components/common/Button';
import { signOut } from '../services/firebase/auth';
import { migrateInventoryNormalization } from '../services/firebase/functions';
import { useIngredientNormalizer } from '../hooks/useIngredientNormalizer';
import { colors, typography, spacing } from '../theme';
import { RootStackParamList } from '../types';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'SettingsTab'>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const [migrating, setMigrating] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const { clearCache } = useIngredientNormalizer();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
    }
  };

  const handleMigrateNormalization = async () => {
    Alert.alert(
      'Normalizar Inventario',
      'This action will update all inventory items with normalized names to improve recipe suggestions. Do you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Actualizar',
          onPress: async () => {
            setMigrating(true);
            try {
              console.log('🔄 Starting inventory normalization migration...');
              const result = await migrateInventoryNormalization();

              console.log('✅ Migration complete:', result);

              Alert.alert(
                'Migration completed',
                `Updated ${result.updatedCount} de ${result.totalItems} items.\n\n${
                  result.errorCount > 0 ? `Errors: ${result.errorCount}` : 'Everything looks good!'
                }`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              console.error('❌ Migration error:', error);
              Alert.alert('Error', 'Error migrating inventory normalization');
            } finally {
              setMigrating(false);
            }
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This action will remove all cached ingredient normalizations. The next time you scan an ingredient, it will be normalized again with the updated vocabulary. Do you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              console.log('🗑️ Clearing ingredient normalization cache...');
              await clearCache();
              console.log('✅ Cache cleared successfully');
              Alert.alert('Cache Cleared', 'All cached normalizations have been removed.', [
                { text: 'OK' },
              ]);
            } catch (error: any) {
              console.error('❌ Error clearing cache:', error);
              Alert.alert('Error', 'Error clearing cache');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.text}>⚙️ Settings Screen</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Mantenimiento</Text>
        <Button
          title={migrating ? "Normalizando..." : "Normalizar Inventario"}
          onPress={handleMigrateNormalization}
          style={styles.button}
          disabled={migrating}
        />
        <Text style={styles.helperText}>
          Actualiza los nombres de tus items para mejorar las sugerencias de recipes
        </Text>

        <Button
          title={clearingCache ? 'Clearing...' : '🗑️ Clear Normalization Cache'}
          onPress={handleClearCache}
          style={[styles.button, styles.clearCacheButton]}
          disabled={clearingCache}
        />
        <Text style={styles.helperText}>
          Remove all locally cached normalizations to force a fresh sync from the server
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Cuenta</Text>
        <Button
          title="Neverito Pro"
          onPress={() => navigation.navigate('Paywall', { source: 'settings' })}
          style={styles.button}
        />

        <Button
          title="Sign Out"
          onPress={handleSignOut}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  text: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  button: {
    marginBottom: spacing.sm,
  },
  clearCacheButton: {
    marginTop: spacing.lg,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});

export default SettingsScreen;
