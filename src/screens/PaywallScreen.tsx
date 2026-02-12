import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, Check } from 'lucide-react-native';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { RootStackParamList } from '../types';
import { borderRadius, colors, spacing, typography } from '../theme';
import { useSubscription } from '../hooks/useSubscription';

type PaywallNavigationProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

const PRO_FEATURES = [
  'Escaneos OCR ilimitados',
  'Recetas ilimitadas',
  'Importar recetas desde URL',
  'Lista de la compra',
  'Sync entre dispositivos',
];

const PaywallScreen = () => {
  const navigation = useNavigation<PaywallNavigationProp>();
  const {
    isPro,
    loading,
    error,
    packages,
    refreshPackages,
    purchasePro,
    restorePurchases,
  } = useSubscription();

  useEffect(() => {
    refreshPackages().catch((refreshError) => {
      console.error('Error loading RevenueCat packages:', refreshError);
    });
  }, [refreshPackages]);

  const recommendedPackage = useMemo(() => packages[0] || null, [packages]);

  const handlePurchase = async () => {
    if (!recommendedPackage) {
      Alert.alert('Planes no disponibles', 'No hay planes disponibles ahora mismo.');
      return;
    }

    try {
      const result = await purchasePro(recommendedPackage.identifier);
      if (result.isPro) {
        Alert.alert('Suscripción activada', 'Ahora tienes acceso a todas las funciones Pro.');
        navigation.goBack();
      } else {
        Alert.alert(
          'Compra pendiente',
          'La compra se procesó, pero todavía no aparece activa. Intenta restaurar compras.'
        );
      }
    } catch (purchaseError) {
      console.error('Purchase error:', purchaseError);
      Alert.alert('No se pudo completar la compra', 'Intenta de nuevo en unos segundos.');
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restorePurchases();
      if (result.isPro) {
        Alert.alert('Compras restauradas', 'Tu suscripción Pro está activa.');
        navigation.goBack();
      } else {
        Alert.alert('Sin compras activas', 'No encontramos una suscripción activa para restaurar.');
      }
    } catch (restoreError) {
      console.error('Restore purchases error:', restoreError);
      Alert.alert('No se pudieron restaurar compras', 'Intenta de nuevo.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFE5EC" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neverito Pro</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Desbloquea todo el potencial</Text>
          <Text style={styles.heroSubtitle}>Plan Free: 5 escaneos OCR y 5 recetas al mes</Text>
        </Card>

        <Card style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Incluye</Text>
          {PRO_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Check size={18} color={colors.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.priceCard}>
          <Text style={styles.sectionTitle}>Plan recomendado</Text>
          <Text style={styles.planName}>
            {recommendedPackage?.title || 'Pro Monthly'}
          </Text>
          <Text style={styles.planPrice}>
            {recommendedPackage?.priceString || '$4.99'} / mes
          </Text>
          {recommendedPackage?.description ? (
            <Text style={styles.planDescription}>{recommendedPackage.description}</Text>
          ) : null}
        </Card>

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {isPro ? (
          <Card style={styles.activeCard}>
            <Text style={styles.activeText}>Tu suscripción Pro ya está activa.</Text>
          </Card>
        ) : null}

        {!isPro && (
          <Button
            title={loading ? 'Procesando...' : 'Activar Pro'}
            onPress={handlePurchase}
            disabled={loading}
            style={styles.ctaButton}
          />
        )}
        <Button
          title="Restaurar compras"
          onPress={handleRestore}
          variant="secondary"
          disabled={loading}
          style={styles.restoreButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroCard: {
    backgroundColor: '#B5EAD7',
  },
  heroTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  featuresCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  priceCard: {
    alignItems: 'center',
  },
  planName: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  planPrice: {
    ...typography.headlineMedium,
    color: colors.primary,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  planDescription: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
  },
  restoreButton: {
    borderRadius: borderRadius.full,
  },
  errorCard: {
    backgroundColor: colors.errorContainer,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.onErrorContainer,
    textAlign: 'center',
  },
  activeCard: {
    backgroundColor: colors.primaryContainer,
  },
  activeText: {
    ...typography.bodyMedium,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default PaywallScreen;
