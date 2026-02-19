import React, { useState } from 'react';
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

const PLANS = [
  {
    id: 'monthly' as const,
    label: 'Mensual',
    price: '2,99 €',
    period: '/ mes',
    badge: null,
  },
  {
    id: 'yearly' as const,
    label: 'Anual',
    price: '23,99 €',
    period: '/ año',
    badge: '33% descuento',
  },
];

const PaywallScreen = () => {
  const navigation = useNavigation<PaywallNavigationProp>();
  const { isPro, loading, error, openPaywall, openCustomerPortal } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

  const handlePurchase = async () => {
    try {
      await openPaywall(selectedPlan);
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

        <View style={styles.plansRow}>
          {PLANS.map((plan) => {
            const selected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, selected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.8}
              >
                {plan.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                ) : null}
                <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{plan.label}</Text>
                <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{plan.price}</Text>
                <Text style={[styles.planPeriod, selected && styles.planPeriodSelected]}>{plan.period}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.stripeNote}>
          Serás redirigido al navegador para completar el pago de forma segura con Stripe.
        </Text>

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
  plansRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  planCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  planLabel: {
    ...typography.titleSmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  planLabelSelected: {
    color: colors.onPrimaryContainer,
  },
  planPrice: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '800',
  },
  planPriceSelected: {
    color: colors.primary,
  },
  planPeriod: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  planPeriodSelected: {
    color: colors.onPrimaryContainer,
  },
  stripeNote: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
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
