import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import AuthLayout from '../../layouts/Layouts/AuthLayout';
import Button from '../../layouts/Components/button';
import Input from '../../layouts/Components/Input';
import Logo from '../../layouts/Components/Logo';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../../api/config';

export default function Login({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !senha) {
      setErro('Informe email e senha.');
      return;
    }

    setErro('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.detail || 'E-mail ou senha incorretos.');
        return;
      }

      const usuario = data.usuario || data.user || data;
      if (!usuario?.id_motorista && usuario?.tipo !== 'motorista') {
        setErro('Este usuário não está cadastrado como motorista.');
        return;
      }

      await login(usuario);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Erro no login do motorista:', error);
      setErro('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <View style={styles.content}>
        <View style={styles.header}>
          <Logo size="lg" />
        </View>
        <Card style={styles.card}>
          <Input
            label="Email"
            placeholder="motorista@exemplo.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Text size="lg"></Text>}
          />

          <Input
            label="Senha"
            placeholder="••••••••"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            leftIcon={<Text size="lg"></Text>}
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
            onPress={() => navigation.navigate('Register')}
            variant="secondary"
            disabled={loading}
          />

          <Button
            title="Esqueceu a senha?"
            onPress={() => navigation.navigate('ForgotPassword')}
            variant="ghost"
            size="sm"
            disabled={loading}
            style={styles.forgotButton}
            textStyle={styles.forgotText}
          />
        </Card>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  appName: {
    marginTop: theme.spacing.sm,
    color: theme.colors.white,
    letterSpacing: 3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  card: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    width: '85%',
    maxWidth: 400,
    ...theme.shadows.lg,
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
