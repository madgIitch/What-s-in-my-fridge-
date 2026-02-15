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
  'Unlimited OCR scans',
  'Unlimited recipes',
  'Unlimited URL imports',
  'Sync between devices',
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
      Alert.alert('Planes no disponibles', 'No plans are available right now.');
      return;
    }

    try {
      const result = await purchasePro(recommendedPackage.identifier);
      if (result.isPro) {
        Alert.alert('Subscription activated', 'You now have access to all Pro features.');
        navigation.goBack();
      } else {
        Alert.alert(
          'Compra pendiente',
          'The purchase was processed, but it is not active yet. Try restoring purchases.'
        );
      }
    } catch (purchaseError) {
      console.error('Purchase error:', purchaseError);
      Alert.alert('Purchase could not be completed', 'Try again in a few seconds.');
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restorePurchases();
      if (result.isPro) {
        Alert.alert('Purchases restored', 'Your Pro subscription is active.');
        navigation.goBack();
      } else {
        Alert.alert('No active purchases', 'No active subscription found to restore.');
      }
    } catch (restoreError) {
      console.error('Restore purchases error:', restoreError);
      Alert.alert('Could not restore purchases', 'Try again.');
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
          <Text style={styles.heroTitle}>Unlock your full potential</Text>
          <Text style={styles.heroSubtitle}>Free Plan: 5 OCR scans and 5 recipes per month</Text>
        </Card>

        <Card style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Includes</Text>
          {PRO_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Check size={18} color={colors.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.priceCard}>
          <Text style={styles.sectionTitle}>Recommended Plan</Text>
          <Text style={styles.planName}>
            {recommendedPackage?.title || 'Pro Monthly'}
          </Text>
          <Text style={styles.planPrice}>
            {recommendedPackage?.priceString || '$4.99'} / month
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
            <Text style={styles.activeText}>Your Pro subscription is already active.</Text>
          </Card>
        ) : null}

        {!isPro && (
          <Button
            title={loading ? 'Processing...' : 'Activate Pro'}
            onPress={handlePurchase}
            disabled={loading}
            style={styles.ctaButton}
          />
        )}
        <Button
          title="Restore purchases"
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
