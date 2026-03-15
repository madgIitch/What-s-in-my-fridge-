import { create } from "zustand";
import firestore from "@react-native-firebase/firestore";
import { submitRecipeJobFn } from "../services/firebase/functions";
import { useAuthStore } from "./useAuthStore";
import { detectUrlType } from "../utils/urlUtils";
import { RecipeJob } from "../types/recipeJob";

interface RecipeJobStore {
  activeJobs: Map<string, RecipeJob>;
  completedJobsQueue: RecipeJob[];
  pendingNavigation: string | null;

  submitJob: (url: string) => Promise<string | null>;
  loadActiveJobs: () => Promise<void>;
  loadRecentCompletedJobs: (hours?: number) => Promise<void>;
  listenToJob: (jobId: string) => () => void;
  dismissCompleted: (jobId: string) => void;
  onJobNotificationReceived: (jobId: string) => void;
  reset: () => void;
}

const jobUnsubscribers = new Map<string, () => void>();

const queueIfMissing = (queue: RecipeJob[], job: RecipeJob): RecipeJob[] => {
  if (queue.some((item) => item.jobId === job.jobId)) {
    return queue;
  }
  return [...queue, job];
};

export const useRecipeJobStore = create<RecipeJobStore>((set, get) => ({
  activeJobs: new Map(),
  completedJobsQueue: [],
  pendingNavigation: null,

  submitJob: async (url: string) => {
    const sourceType = detectUrlType(url);
    if (sourceType === "blog") {
      return null;
    }

    const { jobId } = await submitRecipeJobFn({ url });
    get().listenToJob(jobId);
    return jobId;
  },

  loadActiveJobs: async () => {
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) return;

    const snap = await firestore()
      .collection("users")
      .doc(userId)
      .collection("recipe_jobs")
      .where("status", "in", ["pending", "transcribing", "extracting"])
      .get();

    for (const doc of snap.docs) {
      get().listenToJob(doc.id);
    }
  },

  loadRecentCompletedJobs: async (hours: number = 2) => {
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) return;

    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    const snap = await firestore()
      .collection("users")
      .doc(userId)
      .collection("recipe_jobs")
      .where("updatedAt", ">=", cutoff)
      .orderBy("updatedAt", "desc")
      .limit(20)
      .get();

    const completed = snap.docs
      .map((doc) => doc.data() as RecipeJob)
      .filter((job) => job.status === "completed" && !!job.result);

    set((state) => ({
      completedJobsQueue: completed.reduce((queue, job) => queueIfMissing(queue, job), state.completedJobsQueue),
    }));
  },

  listenToJob: (jobId: string) => {
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) return () => {};

    const existing = jobUnsubscribers.get(jobId);
    if (existing) {
      return existing;
    }

    const unsubscribe = firestore()
      .collection("users")
      .doc(userId)
      .collection("recipe_jobs")
      .doc(jobId)
      .onSnapshot((snap) => {
        if (!snap.exists) return;
        const job = snap.data() as RecipeJob;

        set((state) => {
          const nextActive = new Map(state.activeJobs);

          if (job.status === "completed") {
            nextActive.delete(jobId);
            return {
              activeJobs: nextActive,
              completedJobsQueue: job.result ? queueIfMissing(state.completedJobsQueue, job) : state.completedJobsQueue,
            };
          }

          if (job.status === "failed") {
            nextActive.delete(jobId);
            return { activeJobs: nextActive };
          }

          nextActive.set(jobId, job);
          return { activeJobs: nextActive };
        });
      });

    jobUnsubscribers.set(jobId, unsubscribe);

    return () => {
      unsubscribe();
      jobUnsubscribers.delete(jobId);
    };
  },

  dismissCompleted: (jobId: string) => {
    set((state) => ({
      completedJobsQueue: state.completedJobsQueue.filter((job) => job.jobId !== jobId),
      pendingNavigation: state.pendingNavigation === jobId ? null : state.pendingNavigation,
    }));
  },

  onJobNotificationReceived: (jobId: string) => {
    get().listenToJob(jobId);
    set({ pendingNavigation: jobId });
  },

  reset: () => {
    for (const unsubscribe of jobUnsubscribers.values()) {
      unsubscribe();
    }
    jobUnsubscribers.clear();

    set({
      activeJobs: new Map(),
      completedJobsQueue: [],
      pendingNavigation: null,
    });
  },
}));
