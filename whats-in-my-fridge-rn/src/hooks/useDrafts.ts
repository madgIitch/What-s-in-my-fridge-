import { useEffect, useState } from 'react';
import { database, collections } from '../database';
import ParsedDraft from '../database/models/ParsedDraft';
import { useDraftStore } from '../stores/useDraftStore';
import { saveDraftToFirestore } from '../services/firebase/firestore';

/**
 * Custom hook for managing OCR drafts
 * Equivalent to DraftRepository + ReviewDraftVm from Android app
 */
export const useDrafts = () => {
  const [drafts, setDrafts] = useState<ParsedDraft[]>([]);
  const store = useDraftStore();

  // Subscribe to WatermelonDB changes
  useEffect(() => {
    store.setLoading(true);

    const subscription = collections.parsedDrafts
      .query()
      .observe()
      .subscribe((fetchedDrafts) => {
        setDrafts(fetchedDrafts);
        store.setDrafts(fetchedDrafts);
        store.setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Save a new draft
   */
  const saveDraft = async (draftData: {
    rawText: string;
    merchant?: string;
    purchaseDate?: string;
    total?: number;
    currency: string;
    linesJson: string; // JSON.stringify(ParsedItem[])
    unrecognizedLines: string; // JSON.stringify(string[])
  }) => {
    store.setLoading(true);
    try {
      let savedDraft: ParsedDraft | null = null;

      await database.write(async () => {
        savedDraft = await collections.parsedDrafts.create((draft) => {
          draft.rawText = draftData.rawText;
          draft.timestamp = Date.now();
          draft.merchant = draftData.merchant;
          draft.purchaseDate = draftData.purchaseDate;
          draft.total = draftData.total;
          draft.currency = draftData.currency;
          draft.linesJson = draftData.linesJson;
          draft.unrecognizedLines = draftData.unrecognizedLines;
          draft.confirmed = false;
        });
      });

      if (savedDraft) {
        // Optionally sync to Firestore
        try {
          await saveDraftToFirestore(savedDraft);
        } catch (error) {
          console.warn('Failed to sync draft to Firestore:', error);
          // Don't fail the whole operation if Firestore sync fails
        }
      }

      store.setError(null);
      return savedDraft;
    } catch (error: any) {
      console.error('Error saving draft:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Get draft by ID
   */
  const getDraftById = async (draftId: string): Promise<ParsedDraft | null> => {
    try {
      const draft = await collections.parsedDrafts.find(draftId);
      store.setCurrentDraft(draft);
      return draft;
    } catch (error) {
      console.error('Draft not found:', error);
      return null;
    }
  };

  /**
   * Update draft (modify parsed items)
   */
  const updateDraft = async (
    draftId: string,
    updates: {
      linesJson?: string;
      unrecognizedLines?: string;
    }
  ) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const draft = await collections.parsedDrafts.find(draftId);

        await draft.update(() => {
          if (updates.linesJson !== undefined) {
            draft.linesJson = updates.linesJson;
          }
          if (updates.unrecognizedLines !== undefined) {
            draft.unrecognizedLines = updates.unrecognizedLines;
          }
        });
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error updating draft:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Delete draft
   */
  const deleteDraft = async (draftId: string) => {
    store.setLoading(true);
    try {
      await database.write(async () => {
        const draft = await collections.parsedDrafts.find(draftId);
        await draft.destroyPermanently();
      });

      store.setError(null);
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      store.setError(error.message);
      throw error;
    } finally {
      store.setLoading(false);
    }
  };

  /**
   * Mark draft as confirmed
   */
  const confirmDraft = async (draftId: string) => {
    await database.write(async () => {
      const draft = await collections.parsedDrafts.find(draftId);
      await draft.update(() => {
        draft.confirmed = true;
      });
    });
  };

  /**
   * Get pending (unconfirmed) drafts
   */
  const getPendingDrafts = () => {
    return drafts.filter((draft) => !draft.confirmed);
  };

  return {
    drafts,
    loading: store.loading,
    error: store.error,
    currentDraft: store.currentDraft,
    saveDraft,
    getDraftById,
    updateDraft,
    deleteDraft,
    confirmDraft,
    getPendingDrafts,
  };
};
