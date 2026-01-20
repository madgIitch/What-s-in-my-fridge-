/**
 * Color palette for What's In My Fridge app
 * Following Material Design 3 color system
 */

export const colors = {
  // Primary colors
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',

  // Secondary colors
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',

  // Tertiary colors
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',

  // Error colors
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',

  // Background colors
  background: '#FFFBFE',
  onBackground: '#1C1B1F',

  // Surface colors
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',

  // Outline
  outline: '#79747E',
  outlineVariant: '#CAC4D0',

  // Expiry state colors
  expiryOk: '#4CAF50', // Green
  expirySoon: '#FF9800', // Orange
  expiryExpired: '#F44336', // Red

  // Source badge colors
  sourceManual: '#2196F3', // Blue
  sourceOcr: '#9C27B0', // Purple

  // Shadow
  shadow: '#000000',
  scrim: '#000000',
};

export type ColorKeys = keyof typeof colors;
