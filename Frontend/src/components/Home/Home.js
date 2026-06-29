import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, StatusBar, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Truck, Home as HomeIcon, User, History as HistoryIcon } from 'lucide-react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Logo } from '../ui/Logo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Home = ({ onNavigate }) => {
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [userData, setUserData] = useState({});

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
        })();

        const loadUser = async () => {
            try {
                const json = await AsyncStorage.getItem('userData');
                if (json) {
                    setUserData(JSON.parse(json));
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadUser();
    }, []);

    const initialRegion = {
        latitude: -23.5505,
        longitude: -46.6333,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.logoWrapper}>
                        <Logo size="sm" />
                    </View>
                    <TouchableOpacity
                        style={styles.avatar}
                        onPress={() => onNavigate('profile')}
                        activeOpacity={0.7}
                    >
                        {userData.profilePic ? (
                            <Image source={{ uri: userData.profilePic }} style={styles.avatarImage} />
                        ) : (
                            <Text weight="bold" style={styles.avatarText}>
                                {(userData.nome || userData.name || 'U').charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Map Area */}
            <View style={styles.mapContainer}>
                <MapView
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={initialRegion}
                    region={location ? {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01
                    } : initialRegion}
                    showsUserLocation={true}
                />

                <TouchableOpacity
                    style={styles.requestButton}
                    onPress={() => onNavigate('request')}
                    activeOpacity={0.9}
                >
                    <Truck color="#fff" size={24} />
                    <Text weight="bold" style={styles.requestText}>Solicitar Frete</Text>
                </TouchableOpacity>
            </View>

            {/* Bottom Nav */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItemActive}>
                    <HomeIcon color={theme.colors.primary} size={24} />
                    <Text size="xs" color="primary" weight="bold" style={styles.navLabel}>Início</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('history')}>
                    <HistoryIcon color={theme.colors.textSecondary} size={24} />
                    <Text size="xs" color="textSecondary" style={styles.navLabel}>Histórico</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
                    <User color={theme.colors.textSecondary} size={24} />
                    <Text size="xs" color="textSecondary" style={styles.navLabel}>Perfil</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.primary },
    header: {
        padding: theme.spacing.lg,
        paddingTop: Platform.OS === 'android' ? 30 : 20,
        backgroundColor: theme.colors.primary,
        paddingBottom: theme.spacing.lg,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 8,
        height: 50,
        position: 'relative',
        zIndex: 1,
    },
    logoWrapper: {
        position: 'absolute',
        left: -15,
        zIndex: -1,
        transform: [{ translateY: 8 }, { scale: 2.3 }],
    },
    avatar: {
        width: 45,
        height: 45,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: theme.colors.white,
        fontSize: 18,
    },
    avatarImage: {
        width: 45,
        height: 45,
        borderRadius: 50,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        borderTopLeftRadius: theme.borderRadius.xxl,
        borderTopRightRadius: theme.borderRadius.xxl,
        backgroundColor: theme.colors.white,
        marginTop: -theme.spacing.md,
    },
    map: { width: '100%', height: '100%' },
    requestButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: theme.colors.accent,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.round,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        ...theme.shadows.lg,
    },
    requestText: { color: theme.colors.white, marginLeft: 8 },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: Platform.OS === 'android' ? 36 : 32, // Aumenta o espaço na parte inferior
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.white,
        borderTopWidth: 0,
        ...theme.shadows.lg,
    },
    navItem: { alignItems: 'center', padding: 8 },
    navItemActive: {
        alignItems: 'center',
        padding: 8,
        backgroundColor: theme.colors.primaryLight + '40',
        borderRadius: theme.borderRadius.lg,
    },
    navLabel: { marginTop: 4 },
});

export default Home;
