import React, { useRef } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, View, Animated } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';

export const Button = ({
    title,
    onPress,
    variant = 'primary', // primary, secondary, outline, ghost
    size = 'md', // sm, md, lg
    loading = false,
    disabled = false,
    iconLeft,
    iconRight,
    style,
    textStyle,
    fullWidth = true,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const isPrimary = variant === 'primary';
    const isOutline = variant === 'outline';
    const isGhost = variant === 'ghost';
    const isSecondary = variant === 'secondary';

    const baseBackgroundColor = isPrimary
        ? theme.colors.accent
        : isSecondary
            ? theme.colors.transparent
            : isOutline || isGhost
                ? 'transparent'
                : theme.colors.accent;

    const baseBorderColor = isSecondary
        ? theme.colors.accent
        : isOutline
            ? theme.colors.primary
            : 'transparent';

    const baseTextColor = isPrimary
        ? theme.colors.white
        : isSecondary
            ? theme.colors.accent
            : isOutline
                ? theme.colors.primary
                : theme.colors.text;

    const containerStyles = [
        styles.container,
        {
            backgroundColor: disabled ? theme.colors.border : baseBackgroundColor,
            paddingVertical: size === 'sm' ? 8 : size === 'lg' ? 16 : 12,
            paddingHorizontal: size === 'sm' ? 16 : 24,
            borderRadius: theme.borderRadius.xl,
            borderWidth: isOutline || isSecondary ? 2 : 0,
            borderColor: disabled ? theme.colors.border : baseBorderColor,
            width: fullWidth ? '100%' : 'auto',
            opacity: disabled ? 0.7 : 1,
        },
        isPrimary && theme.shadows.md,
        style,
    ];

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={containerStyles}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={title}
            >
                {loading ? (
                    <ActivityIndicator color={baseTextColor} />
                ) : (
                    <View style={styles.content}>
                        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
                        <Text
                            weight="bold"
                            size={size === 'lg' ? 'lg' : 'md'}
                            style={[{ color: baseTextColor }, textStyle]}
                        >
                            {title}
                        </Text>
                        {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: theme.spacing.sm,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconLeft: {
        marginRight: 8,
    },
    iconRight: {
        marginLeft: 8,
    },
});
