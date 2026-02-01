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
import { Plus, Camera, ChefHat } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HomeTab'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { items, loading, error, deleteItem } = useInventory();
  const user = useAuthStore((state) => state.user);
  const wiggleAnim = useRef(new Animated.Value(0)).current;

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
        <Text style={styles.headerSubtitle}>
          {items.length} items guardados ♡
        </Text>
      </View>

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
    gap: 8,
    marginBottom: 4,
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
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
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
