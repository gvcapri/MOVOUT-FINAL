import { colors } from './colors';
import { typography } from './typography';

export const theme = {
    colors,
    typography,
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 20,
        xxl: 28,
        round: 9999,
    },
    shadows: {
        sm: {
            shadowColor: '#1E293B',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#1E293B',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 3,
        },
        lg: {
            shadowColor: '#1E293B',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
        },
    },
};
