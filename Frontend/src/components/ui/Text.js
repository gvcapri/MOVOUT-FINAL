import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export const Text = ({
    children,
    variant = 'body', // body, title, subtitle, caption
    size = 'md', // xs, sm, md, lg, xl, xxl
    weight = 'regular', // regular, medium, bold
    color = 'text', // key from theme.colors
    align = 'left',
    style,
    ...props
}) => {
    const textStyles = [
        styles.base,
        {
            fontSize: theme.typography.fontSizes[size],
            fontWeight: theme.typography.fontWeights[weight],
            color: theme.colors[color] || color,
            textAlign: align,
            lineHeight: theme.typography.lineHeights[size] || theme.typography.lineHeights.md,
        },
        style,
    ];

    return <RNText style={textStyles} {...props}>{children}</RNText>;
};

const styles = StyleSheet.create({
    base: {
        fontFamily: 'System', // Can be replaced with custom font if added later
    },
});
