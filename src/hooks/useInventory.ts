import { useEffect, useState } from 'react';
import { database, collections } from '../database';
import FoodItem from '../database/models/FoodItem';
import { useInventoryStore } from '../stores/useInventoryStore';
import { syncToFirestore, deleteFromFirestore, batchDeleteFromFirestore } from '../services/firebase/firestore';
import { useIngredientNormalizer } from './useIngredientNormalizer';

/**
 * Custom hook for inventory management
 * Combines WatermelonDB reactive queries with Firestore sync
 * Equivalent to InventoryRepository + HomeVm from Android app
 */
export const useInventory = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const store = useInventoryStore();
  const { normalizeIngredient } = useIngredientNormalizer();

  // Subscribe to WatermelonDB changes
  useEffect(() => {
    store.setLoading(true);

    const subscription = collections.foodItems
      .query()
      .observe()
      .subscribe((fetchedItems) => {
        setItems(fetchedItems);
        store.setItems(fetchedItems);
        store.setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Add a new food item
   * Automatically normalizes ingredient name for recipe matching
   */
  const addItem = async (itemData: {
    name: string;
    expiryDate: number;
    category?: string;
    quantity: number;
    notes?: string;
    unit: string;
    source: 'manual' | 'ocr';
  }) => {
    store.setLoading(true);
    try {
      // Normalize ingredient name for recipe matching
      let normalizedName: string | null = null;
      let autoCategory: string | undefined = undefined;
      try {
        const normalizationResult = await normalizeIngredient(itemData.name, false);
        normalizedName = normalizationResult.normalizedName;
        autoCategory = normalizationResult.categorySpanish;
        console.log(`🔄 Normalized "${itemData.name}" → "${normalizedName}" (${normalizationResult.method}, confidence: ${normalizationResult.confidence})${autoCategory ? `, category: ${autoCategory}` : ''}`);
      } catch (error) {
        console.error('Error normalizing ingredient:', error);
        // Continue without normalization if it fails
      }

      await database.write(async () => {
        const newItem = await collections.foodItems.create((item) => {
          item.name = itemData.name;
          item.normalizedName = normalizedName || undefined;
          item.expiryDate = itemData.expiryDate;
          // Use provided category, or fallback to auto-detected category
          item.category = itemData.category || autoCategory;
          item.quantity = itemData.quantity;
          item.notes = itemData.notes;
          item.unit = itemData.unit;
          item.addedAt = Date.now();
          item.source = itemData.source;
        });

        // Sync to Firestore
        await syncToFirestore(newItem);
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error adding item:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Update an existing food item
   */
  const updateItem = async (
    itemId: string,
    updates: {
      name?: string;
      expiryDate?: number;
      category?: string;
      quantity?: number;
      notes?: string;
      unit?: string;
    }
  ) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const item = await collections.foodItems.find(itemId);

        await item.update(() => {
          if (updates.name !== undefined) item.name = updates.name;
          if (updates.expiryDate !== undefined) {
            item.expiryDate = updates.expiryDate;
          }
          if (updates.category !== undefined) item.category = updates.category;
          if (updates.quantity !== undefined) item.quantity = updates.quantity;
          if (updates.notes !== undefined) item.notes = updates.notes;
          if (updates.unit !== undefined) item.unit = updates.unit;
        });

        // Sync to Firestore
        await syncToFirestore(item);
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error updating item:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Delete a food item
   */
  const deleteItem = async (itemId: string) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const item = await collections.foodItems.find(itemId);
        await item.destroyPermanently();

        // Delete from Firestore
        await deleteFromFirestore(itemId);
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error deleting item:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Delete all items (clear inventory)
   */
  const deleteAllItems = async () => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const allItems = await collections.foodItems.query().fetch();
        const ids = allItems.map((item) => item.id);

        for (const item of allItems) {
          await item.destroyPermanently();
        }

        await batchDeleteFromFirestore(ids);
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error deleting all items:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Mark item as consumed by reducing its quantity.
   * Deletes the item only when the remaining quantity reaches zero.
   *
   * @param itemId - The item to consume
   * @param amount - How many units to consume (defaults to the full current quantity)
   */
  const markAsConsumed = async (itemId: string, amount?: number) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const item = await collections.foodItems.find(itemId);
        const toConsume = amount ?? item.quantity;
        const remaining = item.quantity - toConsume;

        if (remaining <= 0) {
          await item.destroyPermanently();
          await deleteFromFirestore(itemId);
        } else {
          await item.update(() => { item.quantity = remaining; });
          await syncToFirestore(item);
        }
      });
      store.setError(null);
    } catch (error: any) {
      console.error('Error consuming item:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Get items expiring soon (within reminderDays)
   */
  const getExpiringSoonItems = (reminderDays: number = 3) => {
    return items.filter((item) => {
      const daysLeft = item.daysLeft;
      return daysLeft >= 0 && daysLeft <= reminderDays;
    });
  };

  /**
   * Get expired items
   */
  const getExpiredItems = () => {
    return items.filter((item) => item.isExpired);
  };

  /**
   * Force re-sync all items to Firestore with normalized names
   * Useful when items were added before normalizedName was synced to Firestore
   */
  const forceSyncAllToFirestore = async () => {
    store.setLoading(true);
    try {
      const allItems = await collections.foodItems.query().fetch();
      console.log(`🔄 Force syncing ${allItems.length} items to Firestore...`);

      for (const item of allItems) {
        // If item doesn't have normalizedName, try to normalize it first
        if (!item.normalizedName) {
          try {
            const normalizationResult = await normalizeIngredient(item.name, false);
            if (normalizationResult.normalizedName) {
              await database.write(async () => {
                await item.update(() => {
                  item.normalizedName = normalizationResult.normalizedName || undefined;
                });
              });
              console.log(`🍎 Normalized "${item.name}" → "${normalizationResult.normalizedName}"`);
            }
          } catch (error) {
            console.error(`Error normalizing "${item.name}":`, error);
          }
        }

        // Sync to Firestore (now with normalizedName)
        await syncToFirestore(item);
        console.log(`✅ Synced "${item.name}" (normalized: ${item.normalizedName || 'none'})`);
      }

      console.log('🎉 Force sync completed!');
      store.setError(null);
    } catch (error: any) {
      console.error('Error force syncing:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  return {
    items,
    loading: store.loading,
    error: store.error,
    addItem,
    updateItem,
    deleteItem,
    deleteAllItems,
    markAsConsumed,
    getExpiringSoonItems,
    getExpiredItems,
    forceSyncAllToFirestore,
  };
};
