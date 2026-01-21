import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatePickerProps {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
  minimumDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  minimumDate,
}) => {
  const [show, setShow] = useState(false);

  const handleChange = (_event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios'); // Keep open on iOS
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formattedDate = format(value, 'PPP', { locale: es });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.button, error && styles.buttonError]}
        onPress={() => setShow(true)}
      >
        <Text style={styles.buttonText}>📅 {formattedDate}</Text>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
        />
      )}
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
  button: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonError: {
    borderColor: colors.error,
  },
  buttonText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
