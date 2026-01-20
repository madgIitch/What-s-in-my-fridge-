/**
 * Spacing scale for What's In My Fridge app
 * Based on 8px grid system
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export type SpacingKeys = keyof typeof spacing;

/**
 * Border radius values
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export type BorderRadiusKeys = keyof typeof borderRadius;
