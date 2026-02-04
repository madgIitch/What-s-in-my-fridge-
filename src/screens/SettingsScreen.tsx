import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { Button } from '../components/common/Button';
import { signOut } from '../services/firebase/auth';
import { migrateInventoryNormalization } from '../services/firebase/functions';
import { colors, typography, spacing } from '../theme';

const SettingsScreen = () => {
  const [migrating, setMigrating] = useState(false);

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
      'Esta acción actualizará todos los items de tu inventario con nombres normalizados para mejorar las sugerencias de recetas. ¿Deseas continuar?',
      [
        {
          text: 'Cancelar',
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
                'Migración Completada',
                `Se actualizaron ${result.updatedCount} de ${result.totalItems} items.\n\n${
                  result.errorCount > 0 ? `Errores: ${result.errorCount}` : '¡Todo correcto!'
                }`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              console.error('❌ Migration error:', error);
              Alert.alert('Error', 'Error al migrar la normalización del inventario');
            } finally {
              setMigrating(false);
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
          Actualiza los nombres de tus items para mejorar las sugerencias de recetas
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Cuenta</Text>
        <Button
          title="Cerrar Sesión"
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
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});

export default SettingsScreen;
