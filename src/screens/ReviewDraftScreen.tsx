import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, FOOD_CATEGORIES, FOOD_UNITS } from '../types';
import { useDrafts } from '../hooks/useDrafts';
import { useInventory } from '../hooks/useInventory';
import { ParsedItem } from '../database/models/ParsedDraft';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Picker } from '../components/common/Picker';
import { DatePicker } from '../components/common/DatePicker';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';

type ReviewDraftScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReviewDraft'>;
type ReviewDraftScreenRouteProp = RouteProp<RootStackParamList, 'ReviewDraft'>;

interface Props {
  navigation: ReviewDraftScreenNavigationProp;
  route: ReviewDraftScreenRouteProp;
}

interface EditableItem extends ParsedItem {
  id: string;
  selected: boolean;
  expiryDateObj: Date;
}

const ReviewDraftScreen: React.FC<Props> = ({ navigation, route }) => {
  const { draftId } = route.params;
  const { getDraftById, confirmDraft, deleteDraft } = useDrafts();
  const { addItem } = useInventory();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [unrecognizedLines, setUnrecognizedLines] = useState<string[]>([]);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editCategory, setEditCategory] = useState('Otros');
  const [editUnit, setEditUnit] = useState('unidad');
  const [editExpiryDate, setEditExpiryDate] = useState(new Date());

  useEffect(() => {
    loadDraft();
  }, [draftId]);

  const loadDraft = async () => {
    setLoading(true);
    try {
      const draft = await getDraftById(draftId);
      if (draft) {
        setMerchant(draft.merchant || null);
        setPurchaseDate(draft.purchaseDate || null);
        setTotal(draft.total || null);
        setUnrecognizedLines(draft.unrecognizedLinesArray);

        const parsedItems = draft.items;
        const editableItems: EditableItem[] = parsedItems.map((item, index) => ({
          ...item,
          id: `item-${index}`,
          selected: true,
          expiryDateObj: getDefaultExpiryDate(item.category),
        }));
        setItems(editableItems);
      } else {
        Alert.alert('Error', 'No se pudo cargar el borrador');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      Alert.alert('Error', 'Error al cargar el borrador');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const getDefaultExpiryDate = (category?: string): Date => {
    const today = new Date();
    let daysToAdd = 7;

    switch (category) {
      case 'Lácteos':
        daysToAdd = 14;
        break;
      case 'Carnes':
      case 'Pescados':
        daysToAdd = 3;
        break;
      case 'Frutas':
      case 'Verduras':
        daysToAdd = 7;
        break;
      case 'Granos':
      case 'Condimentos':
        daysToAdd = 180;
        break;
      case 'Bebidas':
        daysToAdd = 30;
        break;
      default:
        daysToAdd = 14;
    }

    today.setDate(today.getDate() + daysToAdd);
    return today;
  };

  const toggleItemSelection = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = items.every((item) => item.selected);
    setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const openEditModal = (item: EditableItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(String(item.quantity || 1));
    setEditCategory(item.category || 'Otros');
    setEditUnit('unidad');
    setEditExpiryDate(item.expiryDateObj);
    setEditModalVisible(true);
  };

  const saveEditedItem = () => {
    if (!editingItem) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: editName.trim(),
              quantity: parseInt(editQuantity) || 1,
              category: editCategory,
              expiryDateObj: editExpiryDate,
            }
          : item
      )
    );
    setEditModalVisible(false);
    setEditingItem(null);
  };

  const deleteItem = (itemId: string) => {
    Alert.alert(
      'Eliminar item',
      '¿Estás seguro de que quieres eliminar este item?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((item) => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleConfirm = async () => {
    const selectedItems = items.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      Alert.alert('Sin selección', 'Selecciona al menos un item para agregar');
      return;
    }

    Alert.alert(
      'Confirmar',
      `¿Agregar ${selectedItems.length} item(s) al inventario?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Agregar',
          onPress: async () => {
            setSaving(true);
            try {
              for (const item of selectedItems) {
                await addItem({
                  name: item.name,
                  expiryDate: item.expiryDateObj.getTime(),
                  category: item.category,
                  quantity: item.quantity || 1,
                  unit: 'unidad',
                  source: 'ocr',
                });
              }

              await confirmDraft(draftId);

              Alert.alert(
                'Éxito',
                `${selectedItems.length} item(s) agregados al inventario`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('Home'),
                  },
                ]
              );
            } catch (error) {
              console.error('Error adding items:', error);
              Alert.alert('Error', 'Error al agregar items al inventario');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDiscard = () => {
    Alert.alert(
      'Descartar borrador',
      '¿Estás seguro de que quieres descartar este borrador?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draftId);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting draft:', error);
              Alert.alert('Error', 'Error al descartar el borrador');
            }
          },
        },
      ]
    );
  };

  const renderItem = (item: EditableItem) => (
    <View key={item.id} style={styles.itemRow}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleItemSelection(item.id)}
      >
        <Text style={styles.checkboxText}>{item.selected ? '☑️' : '⬜'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.itemContent, !item.selected && styles.itemDisabled]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemDetails}>
            Cantidad: {item.quantity || 1} • {item.category || 'Sin categoría'}
          </Text>
          {item.price && (
            <Text style={styles.itemPrice}>€{item.price.toFixed(2)}</Text>
          )}
        </View>
        <Text style={styles.editIcon}>✏️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteItem(item.id)}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando borrador...</Text>
      </View>
    );
  }

  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {(merchant || purchaseDate || total) && (
          <Card variant="outlined" style={styles.infoCard}>
            {merchant && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🏪 Tienda:</Text>
                <Text style={styles.infoValue}>{merchant}</Text>
              </View>
            )}
            {purchaseDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📅 Fecha:</Text>
                <Text style={styles.infoValue}>{purchaseDate}</Text>
              </View>
            )}
            {total && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>💰 Total:</Text>
                <Text style={styles.infoValue}>€{total.toFixed(2)}</Text>
              </View>
            )}
          </Card>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Items Detectados ({items.length})
            </Text>
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={styles.selectAllText}>
                {items.every((item) => item.selected)
                  ? 'Deseleccionar todo'
                  : 'Seleccionar todo'}
              </Text>
            </TouchableOpacity>
          </View>

          {items.length > 0 ? (
            items.map(renderItem)
          ) : (
            <Text style={styles.emptyText}>No se detectaron items</Text>
          )}
        </View>

        {unrecognizedLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Líneas no reconocidas ({unrecognizedLines.length})
            </Text>
            <Card variant="outlined" style={styles.unrecognizedCard}>
              {unrecognizedLines.slice(0, 5).map((line, index) => (
                <Text key={index} style={styles.unrecognizedLine}>
                  • {line}
                </Text>
              ))}
              {unrecognizedLines.length > 5 && (
                <Text style={styles.moreLines}>
                  ... y {unrecognizedLines.length - 5} más
                </Text>
              )}
            </Card>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomActions}>
        <Text style={styles.selectedText}>
          {selectedCount} de {items.length} seleccionados
        </Text>
        <View style={styles.actionButtons}>
          <Button
            title="Descartar"
            variant="secondary"
            onPress={handleDiscard}
            style={styles.actionButton}
          />
          <Button
            title={saving ? 'Guardando...' : 'Agregar al inventario'}
            onPress={handleConfirm}
            loading={saving}
            disabled={selectedCount === 0 || saving}
            style={styles.actionButton}
          />
        </View>
      </View>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Item</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nombre del producto"
                placeholderTextColor={colors.onSurfaceVariant}
              />

              <Text style={styles.inputLabel}>Cantidad</Text>
              <TextInput
                style={styles.textInput}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.onSurfaceVariant}
              />

              <Picker
                label="Categoría"
                value={editCategory}
                onChange={setEditCategory}
                options={FOOD_CATEGORIES.map((cat) => ({
                  label: cat,
                  value: cat,
                }))}
              />

              <Picker
                label="Unidad"
                value={editUnit}
                onChange={setEditUnit}
                options={FOOD_UNITS.map((unit) => ({
                  label: unit,
                  value: unit,
                }))}
              />

              <DatePicker
                label="Fecha de caducidad"
                value={editExpiryDate}
                onChange={setEditExpiryDate}
                minimumDate={new Date()}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setEditModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title="Guardar"
                onPress={saveEditedItem}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  infoCard: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginRight: spacing.sm,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '500',
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  selectAllText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  checkbox: {
    padding: spacing.xs,
  },
  checkboxText: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '500',
  },
  itemDetails: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  itemPrice: {
    ...typography.labelMedium,
    color: colors.primary,
    marginTop: 2,
  },
  editIcon: {
    fontSize: 16,
    marginLeft: spacing.sm,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  deleteIcon: {
    fontSize: 18,
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    padding: spacing.xl,
  },
  unrecognizedCard: {
    backgroundColor: colors.surfaceVariant,
  },
  unrecognizedLine: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  moreLines: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  bottomActions: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  selectedText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  closeButton: {
    ...typography.headlineSmall,
    color: colors.onSurfaceVariant,
  },
  modalBody: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  inputLabel: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  textInput: {
    ...typography.bodyLarge,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  modalButton: {
    flex: 1,
  },
});

export default ReviewDraftScreen;
