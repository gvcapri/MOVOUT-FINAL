import React, { useState, useCallback, useRef } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';
import { Eye, EyeOff } from 'lucide-react-native';

export const Input = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    error,
    leftIcon,
    rightIcon,
    keyboardType,
    autoCapitalize,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
    style,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const borderAnim = useRef(new Animated.Value(0)).current;

    const isPassword = secureTextEntry;
    const showPasswordToggle = isPassword && value?.length > 0;

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        Animated.timing(borderAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: false,
        }).start();
    }, []);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        Animated.timing(borderAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: false,
        }).start();
    }, []);

    const togglePassword = useCallback(() => setIsPasswordVisible(v => !v), []);

    const animatedBorderColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [error ? theme.colors.error : theme.colors.border, error ? theme.colors.error : theme.colors.primary],
    });

    const animatedBgColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.colors.surfaceAlt, theme.colors.white],
    });

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text size="sm" weight="medium" color={isFocused ? 'primary' : 'text'} style={styles.label}>
                    {label}
                </Text>
            )}
            <Animated.View
                style={[
                    styles.inputContainer,
                    {
                        borderColor: animatedBorderColor,
                        backgroundColor: animatedBgColor,
                    },
                    error && styles.errorBorder,
                ]}
            >
                {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.textSecondary}
                    secureTextEntry={isPassword && !isPasswordVisible}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    blurOnSubmit={blurOnSubmit}
                    {...props}
                />
                {showPasswordToggle ? (
                    <TouchableOpacity
                        style={styles.rightIcon}
                        onPress={togglePassword}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {isPasswordVisible ? (
                            <EyeOff size={20} color={theme.colors.textSecondary} />
                        ) : (
                            <Eye size={20} color={theme.colors.textSecondary} />
                        )}
                    </TouchableOpacity>
                ) : (
                    rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>
                )}
            </Animated.View>
            {error && (
                <Text size="xs" color="error" style={styles.errorText}>
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
        width: '100%',
    },
    label: {
        marginBottom: 6,
        marginLeft: theme.spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: theme.borderRadius.xl,
        paddingHorizontal: theme.spacing.md,
        minHeight: 52,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        color: theme.colors.text,
        fontSize: theme.typography.fontSizes.md,
    },
    errorBorder: {
        borderColor: theme.colors.error,
    },
    leftIcon: {
        marginRight: 10,
    },
    rightIcon: {
        marginLeft: 10,
    },
    errorText: {
        marginTop: 4,
        marginLeft: theme.spacing.sm,
    },
});
