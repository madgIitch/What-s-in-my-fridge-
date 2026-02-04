import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Package, Calendar, Tag, Trash2 } from 'lucide-react-native';
import { colors, typography, spacing } from '../../theme';
import { borderRadius } from '../../theme/spacing';
import FoodItem from '../../database/models/FoodItem';

interface FoodItemCardProps {
  item: FoodItem;
  onPress?: () => void;
  onDelete?: () => void;
}

const STATUS_CONFIG = {
  OK: {
    backgroundColor: 'rgba(181, 234, 215, 0.3)',
    borderColor: '#B5EAD7',
    textColor: '#2D5F4E',
    emoji: '♡',
    label: 'Fresco',
    image: require('../../../assets/neveritoSonri.png'),
  },
  SOON: {
    backgroundColor: 'rgba(255, 171, 171, 0.3)',
    borderColor: '#FFABAB',
    textColor: '#8B4513',
    emoji: '⚠',
    label: 'Pronto',
    image: require('../../../assets/neveritoPreo.png'),
  },
  EXPIRED: {
    backgroundColor: 'rgba(255, 107, 157, 0.3)',
    borderColor: '#FF6B9D',
    textColor: '#8B1538',
    emoji: '(╥﹏╥)',
    label: 'Expirado',
    image: require('../../../assets/neveritoTrist.png'),
  },
};

export const FoodItemCard: React.FC<FoodItemCardProps> = ({
  item,
  onPress,
  onDelete,
}) => {
  const statusConfig = STATUS_CONFIG[item.expiryState];

  // Map category to emoji
  const getCategoryEmoji = (category?: string) => {
    const emojiMap: Record<string, string> = {
      'Lácteos': '🥛',
      'Carnes': '🥩',
      'Pescados': '🐟',
      'Frutas': '🍎',
      'Verduras': '🥬',
      'Granos': '🌾',
      'Agua': '💧',
      'Jugos': '🧃',
      'Refrescos': '🥤',
      'Café y Té': '☕',
      'Vinos': '🍷',
      'Cervezas': '🍺',
      'Licores': '🥃',
      'Snacks': '🍿',
      'Condimentos': '🧂',
      'Aceites': '🫒',
      'Harinas': '🌾',
      'Huevos': '🥚',
      'Frutos Secos': '🥜',
      'Embutidos': '🌭',
      'Congelados': '🧊',
      'Conservas': '🥫',
      'Salsas': '🍯',
      'Postres': '🍰',
      'Pan': '🍞',
      'Platos preparados': '🍲',
      'Otros': '📦',
    };
    return emojiMap[category || ''] || '🍱';
  };

  const foodEmoji = getCategoryEmoji(item.category);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Food Emoji with Status Face */}
        <View style={styles.emojiContainer}>
          <Text style={styles.foodEmoji}>{foodEmoji}</Text>
          <Image source={statusConfig.image} style={styles.statusFace} />
        </View>

        {/* Item Info */}
        <View style={styles.infoContainer}>
          <View style={styles.header}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: statusConfig.backgroundColor,
                  borderColor: statusConfig.borderColor,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: statusConfig.textColor }]}>
                {statusConfig.emoji} {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Package size={16} color={colors.primary} />
              <Text style={styles.detailText}>
                {item.quantity} {item.unit}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Calendar size={16} color={colors.secondary} />
              <Text style={styles.detailText}>
                Caduca: {item.expiryDateFormatted}
              </Text>
            </View>
            {item.category && (
              <View style={styles.detailRow}>
                <Tag size={16} color={colors.accent} />
                <Text style={styles.detailText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Delete Button Indicator */}
        {onDelete && (
          <View style={styles.deleteHint}>
            <Trash2 size={18} color={colors.onSurfaceVariant} opacity={0.3} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emojiContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  foodEmoji: {
    fontSize: 48,
  },
  statusFace: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  infoContainer: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.titleMedium,
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.labelSmall,
    fontSize: 11,
    fontWeight: '600',
  },
  details: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  deleteHint: {
    flexShrink: 0,
    marginLeft: spacing.xs,
  },
});
