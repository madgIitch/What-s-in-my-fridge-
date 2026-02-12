import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Animated,
  StatusBar,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useInventory } from '../hooks/useInventory';
import { useAuthStore } from '../stores/useAuthStore';
import { signOut } from '../services/firebase/auth';
import { startFirestoreSync } from '../services/firebase/firestore';
import FoodItem from '../database/models/FoodItem';
import { Button } from '../components/common/Button';
import { KawaiiFAB, FABGroup } from '../components/common/KawaiiFAB';
import { FoodItemCard } from '../components/food/FoodItemCard';
import { Plus, Camera, ChefHat, Calendar, Settings, ShoppingCart } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeTab'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

type FilterType = 'fresh' | 'soon' | 'expired' | 'prepared';

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { items, loading, error, deleteItem } = useInventory();
  const user = useAuthStore((state) => state.user);
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const [activeFilter, setActiveFilter] = React.useState<FilterType | null>(null);

  // Wiggle animation for emoji
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: -3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();
  }, [wiggleAnim]);

  // Start Firestore sync when user is logged in
  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = startFirestoreSync(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Filter items based on active filter
  const filteredItems = React.useMemo(() => {
    if (!activeFilter) return items;

    switch (activeFilter) {
      case 'fresh':
        return items.filter(item => item.expiryState === 'OK');
      case 'soon':
        return items.filter(item => item.expiryState === 'SOON');
      case 'expired':
        return items.filter(item => item.expiryState === 'EXPIRED');
      case 'prepared':
        return items.filter(item => item.category === 'Platos preparados');
      default:
        return items;
    }
  }, [items, activeFilter]);

  // Toggle filter (deactivate if already active)
  const handleFilterPress = (filter: FilterType) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

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
    return (
      <FoodItemCard
        item={item}
        onPress={() => navigation.navigate('Detail', { itemId: item.id })}
        onDelete={() => handleDeleteItem(item)}
      />
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
          onPress={() => navigation.navigate('ScanTab')}
          variant="secondary"
          style={styles.emptyButton}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFE5EC" />
      {/* Header Kawaii */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Mi Nevera</Text>
            <Animated.Image
            source={require('../../assets/neveritoNevera.png')}
            style={[
              styles.headerImage,
              {
                transform: [{
                  rotate: wiggleAnim.interpolate({
                    inputRange: [-3, 3],
                    outputRange: ['-3deg', '3deg']
                  })
                }]
              }
            ]}
            resizeMode="contain"
            />
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigation.navigate('SettingsTab')}
              activeOpacity={0.8}
            >
              <Settings size={20} color={colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigation.navigate('CalendarTab')}
              activeOpacity={0.8}
            >
              <Calendar size={20} color={colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => navigation.navigate('ShoppingList')}
              activeOpacity={0.8}
            >
              <ShoppingCart size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {items.length} items guardados ♡
        </Text>

        {/* Filters Row */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'fresh' && styles.filterChipActive, styles.filterChipFresh]}
            onPress={() => handleFilterPress('fresh')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === 'fresh' && styles.filterChipTextActive]}>
              ♡ Frescos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'soon' && styles.filterChipActive, styles.filterChipSoon]}
            onPress={() => handleFilterPress('soon')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === 'soon' && styles.filterChipTextActive]}>
              ⚠ Pronto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'expired' && styles.filterChipActive, styles.filterChipExpired]}
            onPress={() => handleFilterPress('expired')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === 'expired' && styles.filterChipTextActive]}>
              (╥﹏╥) Vencidos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'prepared' && styles.filterChipActive, styles.filterChipPrepared]}
            onPress={() => handleFilterPress('prepared')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === 'prepared' && styles.filterChipTextActive]}>
              🍲 Platos
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} colors={[colors.primary]} />
        }
      />

      {/* Floating Action Buttons */}
      <FABGroup>
        <KawaiiFAB
          icon={<ChefHat size={28} color="#000000" />}
          onPress={() => navigation.navigate('RecipesTab')}
          variant="secondary"
        />
        <KawaiiFAB
          icon={<Plus size={36} color="#000000" />}
          onPress={() => navigation.navigate('AddItem')}
          size="large"
          pulse
        />
        <KawaiiFAB
          icon={<Camera size={28} color="#000000" />}
          onPress={() => navigation.navigate('ScanTab')}
          variant="secondary"
        />
      </FABGroup>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  header: {
    backgroundColor: '#FFE5EC',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerImage: {
    width: 40,
    height: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE5EC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
    marginBottom: spacing.md,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  filterChipFresh: {
    // Light green tint when active
  },
  filterChipSoon: {
    // Light orange tint when active
  },
  filterChipExpired: {
    // Light red tint when active
  },
  filterChipPrepared: {
    // Light blue tint when active
  },
  filterChipText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.onSurface,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
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
});

export default HomeScreen;
