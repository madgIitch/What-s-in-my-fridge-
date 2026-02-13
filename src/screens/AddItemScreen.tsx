import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from 'lucide-react-native';
import { RootStackParamList, FOOD_CATEGORIES, FOOD_UNITS } from '../types';
import { useInventory } from '../hooks/useInventory';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { DatePicker } from '../components/common/DatePicker';
import { Picker } from '../components/common/Picker';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { addDays } from 'date-fns';

type AddItemScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddItem'>;

interface Props {
  navigation: AddItemScreenNavigationProp;
}

const AddItemScreen: React.FC<Props> = ({ navigation }) => {
  const { addItem, loading } = useInventory();
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('unidad');
  const [category, setCategory] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState(addDays(new Date(), 7)); // Default 7 days from now
  const [notes, setNotes] = useState('');

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');

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

  const validate = () => {
    let valid = true;

    setNameError('');
    setQuantityError('');

    if (!name.trim()) {
      setNameError('El nombre es requerido');
      valid = false;
    }

    const quantityNum = parseInt(quantity);
    if (!quantity.trim() || isNaN(quantityNum) || quantityNum <= 0) {
      setQuantityError('La cantidad debe ser mayor a 0');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await addItem({
        name: name.trim(),
        expiryDate: expiryDate.getTime(),
        category: category || undefined,
        quantity: parseInt(quantity),
        notes: notes.trim() || undefined,
        unit,
        source: 'manual',
      });

      Alert.alert('Success', 'Item added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const categoryOptions = [
    { label: 'Uncategorized', value: '' },
    ...FOOD_CATEGORIES.map((cat) => ({ label: cat, value: cat })),
  ];

  const unitOptions = FOOD_UNITS.map((u) => ({ label: u, value: u }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Kawaii */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Item</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Completa los datos del alimento ✨
        </Text>

        {/* Food Emoji */}
        <View style={styles.foodEmojiContainer}>
          <Animated.Text
            style={[
              styles.foodEmoji,
              {
                transform: [{
                  rotate: wiggleAnim.interpolate({
                    inputRange: [-3, 3],
                    outputRange: ['-3deg', '3deg']
                  })
                }]
              }
            ]}
          >
            🍎
          </Animated.Text>
          <Text style={styles.sparkleEmoji}>✨</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

        <View style={styles.form}>
          <Input
            label="🍎 Nombre del Alimento *"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError('');
            }}
            error={nameError}
            placeholder="Ej: Leche, Manzanas, etc."
            editable={!loading}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Input
                label="📊 Quantity *"
                value={quantity}
                onChangeText={(text) => {
                  setQuantity(text);
                  setQuantityError('');
                }}
                error={quantityError}
                placeholder="1"
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <View style={styles.halfWidth}>
              <Picker
                label="📏 Unidad"
                value={unit}
                options={unitOptions}
                onChange={setUnit}
              />
            </View>
          </View>

          <DatePicker
            label="📅 Expiration Date *"
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />

          <Picker
            label="🏷️ Category"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
            placeholder="Select category"
          />

          <Input
            label="📝 Notas (Opcional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej: Comprado en Mercadona"
            multiline
            numberOfLines={3}
            editable={!loading}
            style={styles.notesInput}
          />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="text"
              disabled={loading}
              style={styles.cancelButton}
            />
            <Button
              title="✨ Add Item"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
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
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    flex: 1,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
  },
  foodEmojiContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    position: 'relative',
  },
  foodEmoji: {
    fontSize: 64,
  },
  sparkleEmoji: {
    position: 'absolute',
    top: -8,
    right: '35%',
    fontSize: 24,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  form: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

export default AddItemScreen;
