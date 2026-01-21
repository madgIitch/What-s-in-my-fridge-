/**
 * Theme configuration for What's In My Fridge app
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
};

export type Theme = typeof theme;

export { colors, typography, spacing, borderRadius };
