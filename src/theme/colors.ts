/**
 * Kawaii Pastel Color Palette 🌸
 * Supporting light and dark modes with cute pastel colors
 */

export const Colors = {
  light: {
    // Base kawaii colors
    background: '#FFF0F5', // Rosa pastel suave
    surface: '#FFFBF7', // Blanco cremoso
    primary: '#FF9AA2', // Rosa coral kawaii
    secondary: '#B5EAD7', // Mint pastel
    accent: '#FFDAC1', // Amarillo mantequilla
    text: '#5A4A5E', // Púrpura suave
    muted: '#FFE5EC', // Rosa muy claro

    // Derived colors
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFE5EC',
    onPrimaryContainer: '#5A4A5E',
    secondaryContainer: '#E8F8F3',
    onSecondaryContainer: '#5A4A5E',

    onSurface: '#5A4A5E',
    onBackground: '#5A4A5E',
    surfaceVariant: '#FFFBF7',
    onSurfaceVariant: '#8B7C8E',

    // Error colors (kawaii style)
    error: '#FF6B9D',
    onError: '#FFFFFF',
    errorContainer: '#FFE5EC',
    onErrorContainer: '#5A4A5E',

    // Outline
    outline: 'rgba(255, 154, 162, 0.3)',
    outlineVariant: 'rgba(255, 154, 162, 0.15)',

    // Expiry state colors (kawaii pastels)
    expiryOk: '#B5EAD7', // Verde menta pastel
    expirySoon: '#FFD4A3', // Naranja melocotón suave
    expiryExpired: '#FF9AA2', // Rosa coral

    // Source badge colors (kawaii)
    sourceManual: '#C7CEEA', // Lavanda pastel
    sourceOcr: '#FFB6C1', // Rosa claro

    // Shadow & Effects
    shadow: 'rgba(255, 154, 162, 0.2)',
    scrim: 'rgba(90, 74, 94, 0.5)',
  },
  dark: {
    // Base kawaii dark colors
    background: '#2A2438', // Púrpura oscuro suave
    surface: '#362F42', // Púrpura medio
    primary: '#FF9AA2', // Rosa coral (mismo que light)
    secondary: '#6B9B8E', // Verde menta oscuro
    accent: '#D4A574', // Amarillo oscuro
    text: '#FFE5EC', // Rosa muy claro
    muted: '#423A50', // Púrpura oscuro medio

    // Derived colors
    onPrimary: '#FFFFFF',
    primaryContainer: '#423A50',
    onPrimaryContainer: '#FFE5EC',
    secondaryContainer: '#423A50',
    onSecondaryContainer: '#FFE5EC',

    onSurface: '#FFE5EC',
    onBackground: '#FFE5EC',
    surfaceVariant: '#423A50',
    onSurfaceVariant: '#B5A8BA',

    // Error colors (dark mode)
    error: '#FF6B9D',
    onError: '#FFFFFF',
    errorContainer: '#5A2A42',
    onErrorContainer: '#FFE5EC',

    // Outline
    outline: 'rgba(255, 154, 162, 0.4)',
    outlineVariant: 'rgba(255, 154, 162, 0.2)',

    // Expiry state colors (dark mode pastels)
    expiryOk: '#6B9B8E', // Verde oscuro
    expirySoon: '#D4A574', // Naranja oscuro
    expiryExpired: '#FF9AA2', // Rosa coral

    // Source badge colors (dark)
    sourceManual: '#9B94B8', // Lavanda oscuro
    sourceOcr: '#FFB6C1', // Rosa claro

    // Shadow & Effects
    shadow: 'rgba(0, 0, 0, 0.4)',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
};

// Export current color scheme (will be replaced with dynamic theme hook)
export const colors = Colors.light;

export type ColorScheme = keyof typeof Colors;
export type ColorKeys = keyof typeof Colors.light;
