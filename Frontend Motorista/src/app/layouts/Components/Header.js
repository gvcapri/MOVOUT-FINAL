import React from 'react';
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { theme } from '../../theme';
import Text from './Text';

export default function Header({ title, onBack, rightComponent, subtitle }) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text weight="bold" style={styles.backText}>{'<'}</Text>
                    </TouchableOpacity>
                ) : <View style={{ width: 44 }} />}

                <View style={styles.titleContainer}>
                    <Text weight="bold" style={styles.title}>{title}</Text>
                    {title === 'MOVOUT' && (
                        <View style={styles.statusContainer}>
                            <View style={styles.statusDot} />
                            <Text size="xs" style={styles.statusText}>Online</Text>
                        </View>
                    )}
                    {subtitle && (
                        <Text size="xs" style={styles.subtitleText}>{subtitle}</Text>
                    )}
                </View>

                <View style={styles.right}>
                    {rightComponent ? rightComponent : <View style={{ width: 44 }} />}
                </View>
            </View>
        </SafeAreaView>
    );
}

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
    backText: {
        fontSize: 24,
        fontWeight: '900',
        color: theme.colors.white,
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
    subtitleText: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        bottom: -15,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.success,
        marginRight: 4,
    },
    statusText: {
        fontSize: 10,
        color: theme.colors.white,
        fontWeight: 'bold',
        opacity: 0.9,
    },
    right: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
