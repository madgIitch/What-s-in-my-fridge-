import { useEffect, useState } from 'react';
import { database, collections } from '../database';
import FoodItem from '../database/models/FoodItem';
import { useInventoryStore } from '../stores/useInventoryStore';
import { syncToFirestore, deleteFromFirestore } from '../services/firebase/firestore';

/**
 * Custom hook for inventory management
 * Combines WatermelonDB reactive queries with Firestore sync
 * Equivalent to InventoryRepository + HomeVm from Android app
 */
export const useInventory = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const store = useInventoryStore();

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
      await database.write(async () => {
        const newItem = await collections.foodItems.create((item) => {
          item.name = itemData.name;
          item.expiryDate = itemData.expiryDate;
          item.category = itemData.category;
          item.quantity = itemData.quantity;
          item.notes = itemData.notes;
          item.unit = itemData.unit;
          item.expiryAt = itemData.expiryDate; // Same as expiryDate
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
            item.expiryAt = updates.expiryDate;
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

        for (const item of allItems) {
          await item.destroyPermanently();
          await deleteFromFirestore(item.id);
        }
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
   * Mark item as consumed (soft delete alternative)
   */
  const markAsConsumed = async (itemId: string) => {
    // For now, just delete the item
    // Could be extended to add a "consumed" flag instead
    await deleteItem(itemId);
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
  };
};
