import React from 'react';
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';
import { ArrowLeft } from 'lucide-react-native';

export const Header = ({ title, onBack, rightComponent, subtitle }) => {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <ArrowLeft color={theme.colors.white} size={22} />
                    </TouchableOpacity>
                ) : <View style={{ width: 44 }} />}

                <View style={styles.titleContainer}>
                    <Text weight="bold" style={styles.title}>{title}</Text>
                    {subtitle && (
                        <Text size="xs" style={styles.subtitle}>{subtitle}</Text>
                    )}
                </View>

                <View style={styles.right}>
                    {rightComponent ? rightComponent : <View style={{ width: 44 }} />}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: theme.colors.primary,
        paddingTop: Platform.OS === 'android' ? 30 : 0,
        ...theme.shadows.md,
        zIndex: 10,
    },
    container: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.sm,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: theme.borderRadius.lg,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: theme.colors.white,
        letterSpacing: 1.5,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    right: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
