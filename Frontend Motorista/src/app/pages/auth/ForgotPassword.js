import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import AuthLayout from '../../layouts/Layouts/AuthLayout';
import Button from '../../layouts/Components/button';
import Input from '../../layouts/Components/Input';
import Logo from '../../layouts/Components/Logo';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import { theme } from '../../theme';

export default function ForgotPassword({ navigation }) {
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
    <AuthLayout>
      <View style={styles.content}>
        <View style={styles.header}>
          <Logo size="md" />
          <Text size="display" weight="bold" color="white" style={styles.title}>
            Recuperar Senha
          </Text>
          <Text size="md" color="white" align="center" style={styles.subtitle}>
            Enviaremos um link para o seu e-mail
          </Text>
        </View>

        <Card style={styles.card}>
          {!sent ? (
            <>
              <Input
                label="Seu e-mail cadastrado"
                placeholder="motorista@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                leftIcon={<Text size="lg"></Text>}
              />

              <Button title="Enviar Link" onPress={handleSubmit} loading={loading} variant="primary" />
            </>
          ) : (
            <View style={styles.successContainer}>
              <Text size="xl" style={{ fontSize: 48 }}></Text>
              <Text weight="bold" size="lg" color="text" style={{ marginTop: theme.spacing.md }}>Email Enviado!</Text>
              <Text color="textSecondary" style={{ textAlign: 'center', marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
                Verifique sua caixa de entrada para redefinir sua senha.
              </Text>
              <Button
                title="Voltar ao Login"
                onPress={() => navigation.navigate('Login')}
                variant="secondary"
              />
            </View>
          )}
        </Card>

        <TouchableOpacity
          style={{ marginTop: theme.spacing.lg }}
          onPress={() => navigation.goBack()}
        >
          <Text size="sm" weight="bold" color="white" style={styles.backText}>
            Voltar para o Login
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    opacity: 0.8,
    marginTop: theme.spacing.sm,
  },
  card: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  successContainer: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  backText: {
    textDecorationLine: 'underline',
  },
});
