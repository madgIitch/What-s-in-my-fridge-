import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing, typography } from "../theme";
import { borderRadius } from "../theme/spacing";
import { RecipeUi } from "../database/models/RecipeCache";
import { RecipeJob } from "../types/recipeJob";
import { useRecipeJobStore } from "../stores/useRecipeJobStore";

interface Props {
  onViewRecipe: (recipe: RecipeUi) => void;
}

const toRecipeUi = (job: RecipeJob): RecipeUi => ({
  id: `job_${job.jobId}`,
  name: job.result?.recipeTitle || "Receta transcrita",
  matchPercentage: 0,
  matchedIngredients: [],
  missingIngredients: [],
  ingredientsWithMeasures: job.result?.ingredients || [],
  instructions: (job.result?.steps || []).join("\n"),
});

const getTitle = (job: RecipeJob): string => job.result?.recipeTitle || "Tu receta";

export const RecipeJobNotification: React.FC<Props> = ({ onViewRecipe }) => {
  const currentJob = useRecipeJobStore((state) => state.completedJobsQueue[0]);
  const dismissCompleted = useRecipeJobStore((state) => state.dismissCompleted);

  useEffect(() => {
    if (!currentJob) {
      return;
    }

    const timer = setTimeout(() => {
      dismissCompleted(currentJob.jobId);
    }, 8000);

    return () => clearTimeout(timer);
  }, [currentJob, dismissCompleted]);

  if (!currentJob) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.toast}>
        <Text style={styles.title}>Receta lista</Text>
        <Text style={styles.body} numberOfLines={2}>
          "{getTitle(currentJob)}" ya esta transcrita.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => dismissCompleted(currentJob.jobId)}
            style={styles.secondaryButton}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryText}>Cerrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              onViewRecipe(toRecipeUi(currentJob));
              dismissCompleted(currentJob.jobId);
            }}
            style={styles.primaryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Ver receta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    zIndex: 100,
  },
  toast: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: "700",
  },
  body: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  primaryText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: "700",
  },
});

export default RecipeJobNotification;
