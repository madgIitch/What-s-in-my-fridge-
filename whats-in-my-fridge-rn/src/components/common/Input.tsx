import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  style,
  ...textInputProps
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.onSurfaceVariant}
        {...textInputProps}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.bodyLarge,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helperText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
});
