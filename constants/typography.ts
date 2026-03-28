import { Platform } from 'react-native';

const fontScale = 1; // Can be used for dynamic scaling if needed

export const Typography = {
  // Font Families (can be customized if custom fonts are added later)
  fontFamily: {
    regular: Platform.select({ ios: 'System', android: 'Roboto' }),
    medium: Platform.select({ ios: 'System', android: 'Roboto-Medium' }),
    bold: Platform.select({ ios: 'System', android: 'Roboto-Bold' }),
  },

  // Font Weights
  weight: {
    regular: '400' as '400',
    medium: '500' as '500',
    semiBold: '600' as '600',
    bold: '700' as '700',
  },

  // Font Sizes
  size: {
    xxs: 10 * fontScale,
    xs: 12 * fontScale,
    sm: 14 * fontScale,
    md: 16 * fontScale,
    lg: 18 * fontScale,
    xl: 20 * fontScale,
    xxl: 24 * fontScale,
    xxxl: 32 * fontScale,
  },

  // Line Heights (generally 1.4 - 1.5x font size)
  lineHeight: {
    xxs: 14 * fontScale,
    xs: 16 * fontScale,
    sm: 20 * fontScale,
    md: 24 * fontScale,
    lg: 28 * fontScale,
    xl: 32 * fontScale,
    xxl: 36 * fontScale,
    xxxl: 40 * fontScale,
  },
  
  // Presets
  presets: {
    header: {
      fontSize: 18 * fontScale,
      fontWeight: '600' as '600',
      lineHeight: 28 * fontScale,
      color: '#333333',
    },
    subHeader: {
      fontSize: 16 * fontScale,
      fontWeight: '500' as '500',
      lineHeight: 24 * fontScale,
      color: '#555555',
    },
    body: {
      fontSize: 14 * fontScale,
      fontWeight: '400' as '400',
      lineHeight: 20 * fontScale,
      color: '#333333',
    },
    caption: {
      fontSize: 12 * fontScale,
      fontWeight: '400' as '400',
      lineHeight: 16 * fontScale,
      color: '#666666',
    },
    small: {
      fontSize: 10 * fontScale,
      fontWeight: '400' as '400',
      lineHeight: 14 * fontScale,
      color: '#999999',
    }
  }
};
