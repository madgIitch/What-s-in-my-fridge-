import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRecipeJobStore } from "../stores/useRecipeJobStore";
import { colors, spacing, typography } from "../theme";
import { borderRadius } from "../theme/spacing";

const statusLabel: Record<string, string> = {
  pending: "En cola...",
  transcribing: "Transcribiendo...",
  extracting: "Extrayendo receta...",
};

export const RecipeJobProgress: React.FC = () => {
  const activeJobs = useRecipeJobStore((state) => state.activeJobs);
  const jobs = Array.from(activeJobs.values());

  if (jobs.length === 0) {
    return null;
  }

  const firstStatus = jobs[0]?.status || "pending";

  return (
    <View style={styles.container}>
      <Text style={styles.count}>{jobs.length}</Text>
      <Text style={styles.label}>{statusLabel[firstStatus] || "Procesando..."}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  count: {
    ...typography.labelMedium,
    color: colors.onPrimaryContainer,
    fontWeight: "800",
  },
  label: {
    ...typography.labelSmall,
    color: colors.onPrimaryContainer,
    fontWeight: "600",
  },
});

export default RecipeJobProgress;
