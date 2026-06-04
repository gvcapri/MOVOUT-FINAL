import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ArrowLeft, User, CreditCard, Bell, Shield, LogOut, ChevronRight, Edit2, HelpCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { API_BASE_URL } from '../../api/config';

const Profile = ({ onNavigate, onLogout }) => {
    const [userData, setUserData] = useState({ nome: 'Carregando...', email: '', cpf: '', telefone: '', fretes_concluidos: 0, avaliacao_media_cliente: 0 });

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const json = await AsyncStorage.getItem('userData');
            const localUser = json ? JSON.parse(json) : null;
            if (localUser) setUserData(localUser);
            if (localUser?.email) {
                try {
                    const res = await fetch(`${API_BASE_URL}/cliente/me/perfil?email=${encodeURIComponent(localUser.email)}`);
                    if (res.ok) {
                        const perfil = await res.json();
                        setUserData({ ...localUser, ...perfil });
                    }
                } catch (err) {
                    console.warn('Não foi possível carregar perfil remoto', err);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const newUserData = { ...userData, profilePic: uri };
            setUserData(newUserData);
            await AsyncStorage.setItem('userData', JSON.stringify(newUserData));
        }
    };

    const menuItems = [
        { icon: User, label: 'Editar Perfil', action: () => onNavigate('editProfile') },
        { icon: CreditCard, label: 'Pagamentos', action: () => onNavigate('payments') },
        { icon: HelpCircle, label: 'Tira-dúvidas', action: () => onNavigate('faq') },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
                        <ArrowLeft color={theme.colors.white} size={24} />
                    </TouchableOpacity>
                    <Text size="lg" weight="bold" style={styles.headerTitle}>Meu Perfil</Text>
                    <View style={styles.backButton} />
                </View>

                <View style={styles.profileInfo}>
                    <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
                        {userData.profilePic ? (
                            <Image source={{ uri: userData.profilePic }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text size="display" weight="bold" color="primary">
                                    {(userData.nome || userData.name || 'U').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.editBadge}>
                            <Edit2 color="white" size={12} />
                        </View>
                    </TouchableOpacity>
                    <Text size="xl" weight="bold" style={styles.userName}>
                        {userData.nome || userData.name}
                    </Text>
                    <Text size="sm" style={styles.userEmail}>{userData.email}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.section}>
                    <Text size="xs" weight="bold" color="textSecondary" style={styles.sectionTitle}>
                        DADOS PESSOAIS
                    </Text>

                    <View style={styles.infoRow}>
                        <Text size="md" color="textSecondary">CPF</Text>
                        <Text size="md" weight="medium" color="text">
                            {userData.cpf || 'Não informado'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text size="md" color="textSecondary">Telefone</Text>
                        <Text size="md" weight="medium" color="text">
                            {userData.telefone || 'Não informado'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text size="md" color="textSecondary">Fretes concluídos</Text>
                        <Text size="md" weight="medium" color="text">
                            {userData.fretes_concluidos ?? 0}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text size="md" color="textSecondary">Avaliação do cliente</Text>
                        <Text size="md" weight="medium" color="text">
                            ⭐ {Number(userData.avaliacao_media_cliente || 0).toFixed(1)}
                        </Text>
                    </View>
                </Card>

                <Card style={styles.section}>
                    <Text size="xs" weight="bold" color="textSecondary" style={styles.sectionTitle}>
                        CONFIGURAÇÕES
                    </Text>
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.action}>
                                <View style={styles.menuIconBox}>
                                    <Icon color={theme.colors.primary} size={20} />
                                </View>
                                <Text size="md" color="text" style={styles.menuLabel}>{item.label}</Text>
                                <ChevronRight color={theme.colors.textSecondary} size={20} />
                            </TouchableOpacity>
                        );
                    })}
                </Card>

                <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                    <LogOut color={theme.colors.white} size={20} />
                    <Text size="md" weight="bold" style={styles.logoutText}>Sair da conta</Text>
                </TouchableOpacity>

                <Text size="sm" color="textSecondary" align="center" style={styles.versionText}>
                    Versão 1.0.0
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        padding: theme.spacing.lg,
        paddingTop: 50,
        paddingBottom: theme.spacing.xl,
        borderBottomLeftRadius: theme.borderRadius.xxl,
        borderBottomRightRadius: theme.borderRadius.xxl,
        backgroundColor: theme.colors.primary,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    backButton: {
        width: 44, height: 44,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: theme.borderRadius.lg,
    },
    headerTitle: { color: theme.colors.white },
    profileInfo: { alignItems: 'center' },
    avatarContainer: { marginBottom: theme.spacing.sm, position: 'relative' },
    avatarPlaceholder: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: theme.colors.white,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
    },
    avatarImage: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
    },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: theme.colors.accent,
        padding: 6, borderRadius: 12,
        borderWidth: 2, borderColor: theme.colors.white,
    },
    userName: { color: theme.colors.white, marginBottom: 4 },
    userEmail: { color: 'rgba(255,255,255,0.8)' },
    content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
    section: {
        padding: theme.spacing.md,
        marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
        marginBottom: theme.spacing.sm,
        letterSpacing: 1,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceAlt,
        alignItems: 'center',
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: theme.spacing.sm, gap: 12,
    },
    menuIconBox: {
        width: 40, height: 40, borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        justifyContent: 'center', alignItems: 'center',
    },
    menuLabel: { flex: 1 },
    logoutButton: {
        backgroundColor: theme.colors.accent,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.md,
        flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center',
        gap: 8, marginTop: theme.spacing.sm,
        ...theme.shadows.md,
    },
    logoutText: { color: theme.colors.white },
    versionText: { marginTop: theme.spacing.xl },
});

export default Profile;