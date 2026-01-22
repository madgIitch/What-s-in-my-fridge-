/**
 * Color palette for What's In My Fridge app
 * Supporting light and dark modes
 */

export const Colors = {
  light: {
    // Base colors
    background: '#e2f4e4',
    surface: '#acf2b5',
    primary: '#164c6e',
    accent: '#1664af',
    text: '#000408',
    muted: '#3e4952',

    // Derived colors for compatibility
    onPrimary: '#FFFFFF',
    primaryContainer: '#d4e8f0',
    onPrimaryContainer: '#0a2433',

    onSurface: '#000408',
    onBackground: '#000408',
    surfaceVariant: '#c8e8ce',
    onSurfaceVariant: '#2a4a3a',

    // Error colors
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    // Outline
    outline: '#5a7a6a',
    outlineVariant: '#a8c8b8',

    // Expiry state colors
    expiryOk: '#4CAF50',
    expirySoon: '#FF9800',
    expiryExpired: '#F44336',

    // Source badge colors
    sourceManual: '#2196F3',
    sourceOcr: '#9C27B0',

    // Shadow
    shadow: '#000000',
    scrim: '#000000',
  },
  dark: {
    // Base colors
    background: '#000100',
    surface: '#000800',
    primary: '#76a5c6',
    accent: '#3978bd',
    text: '#d4e0e9',
    muted: '#77828a',

    // Derived colors for compatibility
    onPrimary: '#002030',
    primaryContainer: '#0d3d5a',
    onPrimaryContainer: '#cfe5f3',

    onSurface: '#d4e0e9',
    onBackground: '#d4e0e9',
    surfaceVariant: '#1a2a2a',
    onSurfaceVariant: '#b8c8d8',

    // Error colors
    error: '#F2B8B5',
    onError: '#601410',
    errorContainer: '#8C1D18',
    onErrorContainer: '#F9DEDC',

    // Outline
    outline: '#5a7a8a',
    outlineVariant: '#2a4a5a',

    // Expiry state colors
    expiryOk: '#66BB6A',
    expirySoon: '#FFA726',
    expiryExpired: '#EF5350',

    // Source badge colors
    sourceManual: '#42A5F5',
    sourceOcr: '#AB47BC',

    // Shadow
    shadow: '#000000',
    scrim: '#000000',
  },
};

// Export current color scheme (will be replaced with dynamic theme hook)
export const colors = Colors.light;

export type ColorScheme = keyof typeof Colors;
export type ColorKeys = keyof typeof Colors.light;
