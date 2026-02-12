import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, ShoppingCart } from 'lucide-react-native';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useFavorites } from '../hooks/useFavorites';
import { useInventory } from '../hooks/useInventory';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { RootStackParamList } from '../types';
import { ShoppingItem, useShoppingListStore } from '../stores/useShoppingListStore';

type ShoppingListNavigationProp = StackNavigationProp<RootStackParamList, 'ShoppingList'>;

const normalizedIngredientsData = require('../../whats-in-my-fridge-backend/data/normalized-ingredients.json');

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const categoryIndex: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const ingredients = normalizedIngredientsData?.ingredients || {};

  Object.keys(ingredients).forEach((key) => {
    const entry = ingredients[key];
    const categorySpanish =
      typeof entry?.categorySpanish === 'string'
        ? entry.categorySpanish
        : 'Otros';

    map.set(normalizeText(key), categorySpanish);

    if (typeof entry?.normalized === 'string') {
      map.set(normalizeText(entry.normalized), categorySpanish);
    }

    if (Array.isArray(entry?.synonyms)) {
      for (const synonym of entry.synonyms) {
        if (typeof synonym === 'string') {
          map.set(normalizeText(synonym), categorySpanish);
        }
      }
    }
  });

  return map;
})();

const getCategoryForIngredient = (ingredientName: string): string => {
  const normalized = normalizeText(ingredientName);
  if (!normalized) return 'Otros';

  const exact = categoryIndex.get(normalized);
  if (exact) return exact;

  for (const [token, category] of categoryIndex.entries()) {
    if (normalized.includes(token) || token.includes(normalized)) {
      return category;
    }
  }

  return 'Otros';
};

const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const ShoppingListScreen = () => {
  const navigation = useNavigation<ShoppingListNavigationProp>();
  const { favorites } = useFavorites();
  const { items: inventoryItems, addItem } = useInventory();
  const { items, showChecked, generateFromFavorites, toggleItem, clearChecked, uncheckItems, setShowChecked } =
    useShoppingListStore();
  const syncingOnExitRef = useRef(false);

  useEffect(() => {
    generateFromFavorites(favorites);
  }, [favorites, generateFromFavorites]);

  const recipeCount = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      item.neededBy.forEach((id) => ids.add(id));
    }
    return ids.size;
  }, [items]);

  const uncheckedItems = useMemo(
    () => items.filter((item) => !item.checked),
    [items]
  );
  const checkedItems = useMemo(
    () => items.filter((item) => item.checked),
    [items]
  );

  const groupedUnchecked = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>();

    for (const item of uncheckedItems) {
      const category = getCategoryForIngredient(item.ingredientName);
      const bucket = groups.get(category) || [];
      bucket.push(item);
      groups.set(category, bucket);
    }

    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'es')
    );
  }, [uncheckedItems]);

  const syncCheckedItemsToInventory = useCallback(async () => {
    if (syncingOnExitRef.current) return;

    const checkedNow = useShoppingListStore
      .getState()
      .items
      .filter((item) => item.checked);

    if (checkedNow.length === 0) return;

    syncingOnExitRef.current = true;
    const inventoryNameSet = new Set(
      inventoryItems
        .map((item) => normalizeText(item.normalizedName || item.name))
        .filter((name) => name !== '')
    );

    const syncedIngredients: string[] = [];
    const defaultExpiryDate = Date.now() + 7 * 24 * 60 * 60 * 1000;

    try {
      for (const checkedItem of checkedNow) {
        const ingredientName = checkedItem.ingredientName.trim();
        if (!ingredientName) continue;

        const normalizedIngredient = normalizeText(ingredientName);
        if (inventoryNameSet.has(normalizedIngredient)) {
          syncedIngredients.push(ingredientName);
          continue;
        }

        await addItem({
          name: ingredientName,
          expiryDate: defaultExpiryDate,
          quantity: 1,
          unit: 'unidad',
          source: 'manual',
        });

        inventoryNameSet.add(normalizedIngredient);
        syncedIngredients.push(ingredientName);
      }
    } catch (error) {
      console.error('Error syncing shopping list checked items to inventory:', error);
    } finally {
      if (syncedIngredients.length > 0) {
        uncheckItems(syncedIngredients);
      }
      syncingOnExitRef.current = false;
    }
  }, [addItem, inventoryItems, uncheckItems]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      syncCheckedItemsToInventory();
    });

    return unsubscribe;
  }, [navigation, syncCheckedItemsToInventory]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Lista de la compra</Text>
          <Text style={styles.headerSubtitle}>Todo lo que te falta para tus recetas</Text>
        </View>
        <ShoppingCart size={22} color={colors.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <Text style={styles.summaryText}>
            {items.length} ingredientes · {recipeCount} recetas
          </Text>
          <TouchableOpacity
            onPress={() => setShowChecked(!showChecked)}
            style={styles.toggleCheckedBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.toggleCheckedText}>
              {showChecked ? 'Ocultar comprados' : 'Mostrar comprados'}
            </Text>
          </TouchableOpacity>
        </Card>

        {groupedUnchecked.map(([category, categoryItems]) => (
          <Card key={category} style={styles.sectionCard}>
            <SectionHeader title={category} />
            {categoryItems.map((item) => (
              <TouchableOpacity
                key={`${category}-${item.ingredientName}`}
                style={styles.itemRow}
                onPress={() => toggleItem(item.ingredientName)}
                activeOpacity={0.8}
              >
                <Text style={styles.checkIcon}>☐</Text>
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemName}>{item.ingredientName}</Text>
                  <Text style={styles.itemRecipes}>
                    {item.recipeNames.join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        ))}

        {items.length === 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.emptyText}>
              No hay ingredientes pendientes. Guarda recetas o actualiza favoritos para generar la lista.
            </Text>
          </Card>
        )}

        {showChecked && checkedItems.length > 0 && (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Comprados" />
            {checkedItems.map((item) => (
              <TouchableOpacity
                key={`checked-${item.ingredientName}`}
                style={styles.itemRow}
                onPress={() => toggleItem(item.ingredientName)}
                activeOpacity={0.8}
              >
                <Text style={styles.checkIconChecked}>☑</Text>
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemNameChecked}>{item.ingredientName}</Text>
                  <Text style={styles.itemRecipes}>
                    {item.recipeNames.join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <Button
          title="Limpiar comprados"
          onPress={clearChecked}
          style={styles.clearButton}
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    ...typography.titleLarge,
    fontWeight: '800',
    color: colors.onSurface,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.titleMedium,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  summaryText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  toggleCheckedBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleCheckedText: {
    ...typography.labelMedium,
    color: colors.onPrimaryContainer,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionHeaderText: {
    ...typography.titleSmall,
    fontWeight: '700',
    color: colors.onSurface,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  checkIcon: {
    fontSize: 18,
    color: colors.primary,
    marginTop: 1,
  },
  checkIconChecked: {
    fontSize: 18,
    color: colors.primary,
    marginTop: 1,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '600',
  },
  itemNameChecked: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  itemRecipes: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  clearButton: {
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});

export default ShoppingListScreen;
