import React, { useState, useCallback } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
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
    style,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPassword = secureTextEntry;
    const showPasswordToggle = isPassword && value?.length > 0;

    const handleFocus = useCallback(() => setIsFocused(true), []);
    const handleBlur = useCallback(() => setIsFocused(false), []);
    const togglePassword = useCallback(() => setIsPasswordVisible(v => !v), []);

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text size="sm" weight="medium" color="text" style={styles.label}>
                    {label}
                </Text>
            )}
            <View
                style={[
                    styles.inputContainer,
                    isFocused && styles.focused,
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
            </View>
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
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.xl,
        paddingHorizontal: theme.spacing.md,
        minHeight: 50,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        color: theme.colors.text,
        fontSize: theme.typography.fontSizes.md,
    },
    focused: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.white,
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
