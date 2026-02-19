import React from 'react';
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
  'Importaciones de URL ilimitadas',
  'Sincronización entre dispositivos',
];

const PaywallScreen = () => {
  const navigation = useNavigation<PaywallNavigationProp>();
  const { isPro, loading, error, openPaywall, openCustomerPortal } = useSubscription();

  const handlePurchase = async () => {
    try {
      await openPaywall();
    } catch (purchaseError) {
      console.error('Purchase error:', purchaseError);
      Alert.alert('No se pudo abrir el pago', 'Inténtalo de nuevo en unos segundos.');
    }
  };

  const handleRestore = async () => {
    try {
      await openCustomerPortal();
    } catch (restoreError) {
      console.error('Customer portal error:', restoreError);
      Alert.alert('No se pudo abrir el portal', 'Inténtalo de nuevo.');
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
          <Text style={styles.heroTitle}>Desbloquea todo tu potencial</Text>
          <Text style={styles.heroSubtitle}>Plan Gratuito: 5 escaneos OCR y 5 recetas al mes</Text>
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
          <Text style={styles.sectionTitle}>Plan Recomendado</Text>
          <Text style={styles.planName}>Pro Mensual</Text>
          <Text style={styles.planPrice}>$4.99 / mes</Text>
          <Text style={styles.planDescription}>
            Serás redirigido al navegador para completar el pago de forma segura con Stripe.
          </Text>
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
          title="Gestionar suscripción"
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
