import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Logo } from '../ui/Logo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../api/config';


const Login = ({ onNavigate, onLogin }) => {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!email || !senha) {
            setErro('Por favor, preencha email e senha.');
            return;
        }

        setErro('');
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email, senha: senha }),
            });

            const data = await response.json();
            if (response.ok) {
                await AsyncStorage.setItem('userToken', data.token);
                await AsyncStorage.setItem('userData', JSON.stringify(data.usuario));
                onLogin(data.usuario);
            } else {
                setErro(data.detail || 'Erro ao fazer login.');
            }
        } catch (error) {
            setErro('Não foi possível conectar ao servidor.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.header}>
                            <Logo size="lg" />
                        </View>

                        <View style={styles.card}>
                            <Input
                                label="Email"
                                placeholder="usuario@exemplo.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="next"
                                blurOnSubmit={false}
                            />

                            <Input
                                label="Senha"
                                placeholder="••••••••"
                                value={senha}
                                onChangeText={setSenha}
                                secureTextEntry
                                returnKeyType="done"
                                onSubmitEditing={handleSubmit}
                            />

                            {erro ? (
                                <Text color="error" size="sm" style={styles.error}>
                                    {erro}
                                </Text>
                            ) : null}

                            <Button
                                title="Entrar"
                                onPress={handleSubmit}
                                loading={loading}
                                variant="primary"
                            />

                            <Button
                                title="Criar Conta"
                                onPress={() => onNavigate('register')}
                                variant="secondary"
                                disabled={loading}
                            />

                            <Button
                                title="Esqueceu a senha?"
                                onPress={() => onNavigate('forgot')}
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                style={styles.forgotButton}
                                textStyle={styles.forgotText}
                            />
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.orangeBackground,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    error: {
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    forgotButton: {
        elevation: 0,
        shadowOpacity: 0,
    },
    forgotText: {
        textDecorationLine: 'underline',
    },
});

export default Login;
