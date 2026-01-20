import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useInventory } from '../hooks/useInventory';
import { useAuthStore } from '../stores/useAuthStore';
import { signOut } from '../services/firebase/auth';
import { startFirestoreSync } from '../services/firebase/firestore';
import FoodItem from '../database/models/FoodItem';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { colors, typography, spacing } from '../theme';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { items, loading, error, deleteItem } = useInventory();
  const user = useAuthStore((state) => state.user);

  // Start Firestore sync when user is logged in
  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = startFirestoreSync(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Set header right button (Settings)
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.headerButtonText}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleDeleteItem = (item: FoodItem) => {
    Alert.alert(
      'Eliminar Item',
      `¿Seguro que quieres eliminar "${item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: FoodItem }) => {
    const expiryColor =
      item.expiryState === 'EXPIRED'
        ? colors.expiryExpired
        : item.expiryState === 'SOON'
        ? colors.expirySoon
        : colors.expiryOk;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Detail', { itemId: item.id })}
        onLongPress={() => handleDeleteItem(item)}
      >
        <Card>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={[styles.expiryBadge, { backgroundColor: expiryColor }]}>
              <Text style={styles.expiryText}>
                {item.expiryState === 'EXPIRED'
                  ? 'EXPIRADO'
                  : item.expiryState === 'SOON'
                  ? `${item.daysLeft}d`
                  : 'OK'}
              </Text>
            </View>
          </View>

          <View style={styles.itemDetails}>
            <Text style={styles.detailText}>
              📅 {item.expiryDateFormatted}
            </Text>
            <Text style={styles.detailText}>
              📦 {item.quantity} {item.unit}
            </Text>
            {item.category && (
              <Text style={styles.detailText}>🏷️ {item.category}</Text>
            )}
          </View>

          {item.source === 'ocr' && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>📸 OCR</Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>🍎 Inventario vacío</Text>
      <Text style={styles.emptyText}>
        Añade items manualmente o escanea un recibo
      </Text>
      <View style={styles.emptyButtons}>
        <Button
          title="Añadir Item"
          onPress={() => navigation.navigate('AddItem')}
          style={styles.emptyButton}
        />
        <Button
          title="Escanear Recibo"
          onPress={() => navigation.navigate('Scan')}
          variant="secondary"
          style={styles.emptyButton}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} colors={[colors.primary]} />
        }
      />

      {items.length > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fab, styles.fabSecondary]}
            onPress={() => navigation.navigate('RecipesPro')}
          >
            <Text style={styles.fabText}>🍳</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, styles.fabPrimary]}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.fabText}>📸</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, styles.fabPrimary]}
            onPress={() => navigation.navigate('AddItem')}
          >
            <Text style={styles.fabText}>➕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerButton: {
    marginRight: spacing.md,
  },
  headerButtonText: {
    fontSize: 24,
  },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.titleMedium,
    color: colors.onSurface,
    flex: 1,
  },
  expiryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expiryText: {
    ...typography.labelSmall,
    color: colors.onPrimary,
    fontWeight: 'bold',
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  sourceBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  sourceBadgeText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButtons: {
    width: '100%',
    gap: spacing.md,
  },
  emptyButton: {
    width: '100%',
  },
  fabContainer: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.md,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
  fabSecondary: {
    backgroundColor: colors.secondary,
  },
  fabText: {
    fontSize: 24,
  },
});

export default HomeScreen;
