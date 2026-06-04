import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, StatusBar } from 'react-native';
import { Logo } from '../ui/Logo';
import { Text } from '../ui/Text';
import { theme } from '../../theme';

const Splash = ({ onNavigate }) => {
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0.8);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 20,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        const timer = setTimeout(() => {
            if (onNavigate) {
                onNavigate('login');
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [onNavigate]);


    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <Logo size="lg" />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.orangeBackground,
    },
    content: {
        alignItems: 'center',
    },
    appName: {
        marginTop: theme.spacing.sm,
        letterSpacing: 4,
    },
    tagline: {
        marginTop: 8,
        letterSpacing: 0.5,
        color: 'rgba(255,255,255,0.8)',
    },
});

export default Splash;
