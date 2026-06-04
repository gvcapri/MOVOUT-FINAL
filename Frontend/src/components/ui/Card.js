import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export const Card = ({ children, style, variant = 'default' }) => {
    return (
        <View style={[styles.card, variant === 'outlined' && styles.outlined, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
        marginBottom: theme.spacing.md,
    },
    outlined: {
        backgroundColor: theme.colors.white,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
    },
});
