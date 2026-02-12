import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  View,
} from 'react-native';
import { colors } from '../../theme';
import { borderRadius } from '../../theme/spacing';

interface KawaiiFABProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'large';
  pulse?: boolean;
  style?: ViewStyle;
}

export const KawaiiFAB: React.FC<KawaiiFABProps> = ({
  icon,
  onPress,
  variant = 'primary',
  size = 'normal',
  pulse = false,
  style,
}) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pulse) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, pulseAnim]);

  const fabStyle = [
    styles.fab,
    size === 'large' ? styles.fabLarge : styles.fabNormal,
    variant === 'primary' ? styles.fabPrimary : styles.fabSecondary,
    style,
  ];

  return (
    <Animated.View style={{ transform: [{ scale: pulse ? pulseAnim : 1 }] }}>
      <TouchableOpacity
        style={fabStyle}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {icon}
      </TouchableOpacity>
    </Animated.View>
  );
};

interface FABGroupProps {
  children: React.ReactNode;
}

export const FABGroup: React.FC<FABGroupProps> = ({ children }) => {
  return <View style={styles.fabGroup}>{children}</View>;
};

const styles = StyleSheet.create({
  fab: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  fabNormal: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  fabLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  fabPrimary: {
    backgroundColor: colors.primary,
  },
  fabSecondary: {
    backgroundColor: colors.secondary,
  },
  fabGroup: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
});
