import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Logo } from '../ui/Logo';
import { Card } from '../ui/Card';

const ForgotPassword = ({ onNavigate }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = () => {
        if (!email) return;
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setSent(true);
        }, 1500);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                    <TouchableOpacity onPress={() => onNavigate('login')} style={styles.backButton}>
                        <ArrowLeft color={theme.colors.white} size={24} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Logo size="md" />
                        <Text size="display" weight="bold" color="white" style={styles.title}>
                            Recuperar Senha
                        </Text>
                        <Text size="md" align="center" style={styles.subtitle}>
                            Enviaremos um link para o seu e-mail
                        </Text>
                    </View>

                    <Card style={styles.card}>
                        {!sent ? (
                            <>
                                <Input
                                    label="Seu e-mail cadastrado"
                                    placeholder="usuario@exemplo.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />

                                <Button
                                    title="Enviar Link"
                                    onPress={handleSubmit}
                                    loading={loading}
                                    variant="primary"
                                />
                            </>
                        ) : (
                            <View style={styles.successContainer}>
                                <Text size="xl" style={styles.successIcon}>✅</Text>
                                <Text weight="bold" size="lg" color="text" style={styles.successTitle}>Email Enviado!</Text>
                                <Text color="textSecondary" style={styles.successText}>
                                    Verifique sua caixa de entrada para redefinir sua senha.
                                </Text>
                                <Button
                                    title="Voltar ao Login"
                                    onPress={() => onNavigate('login')}
                                    variant="secondary"
                                />
                            </View>
                        )}
                    </Card>

                    <TouchableOpacity
                        style={{ marginTop: theme.spacing.lg }}
                        onPress={() => onNavigate('login')}
                    >
                        <Text size="sm" weight="bold" color="white" style={styles.backText}>
                            Voltar para o Login
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.orangeBackground,
    },
    keyboardView: { flex: 1 },
    scrollContent: {
        padding: theme.spacing.lg,
        paddingTop: 48,
        alignItems: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        alignSelf: 'flex-start',
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    title: {
        marginTop: theme.spacing.sm,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        marginTop: theme.spacing.sm,
    },
    card: {
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        width: '100%',
        maxWidth: 400,
        ...theme.shadows.lg,
    },
    successContainer: {
        alignItems: 'center',
        padding: theme.spacing.md,
    },
    successIcon: {
        marginBottom: theme.spacing.md,
        fontSize: 48,
    },
    successTitle: {
        marginBottom: theme.spacing.sm,
    },
    successText: {
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
    },
    backText: {
        textDecorationLine: 'underline',
    },
});

export default ForgotPassword;
