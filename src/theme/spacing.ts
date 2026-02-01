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
 * Border radius values (Kawaii style - más redondeados 🌸)
 */
export const borderRadius = {
  none: 0,
  sm: 8,      // Más redondeado
  md: 16,     // Botones kawaii
  lg: 20,     // Componentes kawaii
  xl: 24,     // Cards kawaii
  xxl: 28,    // Extra kawaii
  full: 9999, // Completamente redondo
};

export type BorderRadiusKeys = keyof typeof borderRadius;
