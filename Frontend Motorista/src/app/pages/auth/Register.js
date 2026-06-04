import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import AuthLayout from '../../layouts/Layouts/AuthLayout';
import Button from '../../layouts/Components/button';
import Input from '../../layouts/Components/Input';
import Logo from '../../layouts/Components/Logo';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import { theme } from '../../theme';
import { API_BASE_URL } from '../../../api/config';

export default function Register({ navigation }) {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cnh: '',
    veiculo: '',
    marca: '',
    placa: '',
    senha: '',
    confirmarSenha: ''
  });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setErro('');
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.email || !formData.telefone || !formData.cpf || !formData.cnh || !formData.veiculo || !formData.marca || !formData.placa || !formData.senha || !formData.confirmarSenha) {
      setErro('Preencha todos os campos, incluindo dados do veículo');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          senha: formData.senha,
          cpf: formData.cpf,
          telefone: formData.telefone,
          cnh: formData.cnh,
          veiculo: formData.veiculo,
          marca: formData.marca,
          placa: formData.placa,
          tipo: 'motorista'
        }),
      });
      const data = await response.json();

      if (response.ok) {
        alert('Cadastro realizado com sucesso!');
        navigation.navigate('Login');
      } else {
        setErro(data.detail || 'Erro ao cadastrar');
      }
    } catch (e) {
      setErro('Erro de conexão com o servidor');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text weight="bold" style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Logo size="md" />
            <Text size="xxl" weight="extraBold" color="white" style={styles.appName}>
              MOVOUT
            </Text>
            <Text variant="subtitle" style={styles.subtitle}>
              cadastro motorista
            </Text>
          </View>

          <Card style={styles.card}>
            <Input
              label="Nome Completo"
              placeholder="João Pedro"
              value={formData.nome}
              onChangeText={(t) => handleChange('nome', t)}
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="Email"
              placeholder="motorista@email.com"
              value={formData.email}
              onChangeText={(t) => handleChange('email', t)}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChangeText={(t) => handleChange('cpf', t)}
              keyboardType="numeric"
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="CNH"
              placeholder="00000000000"
              value={formData.cnh}
              onChangeText={(t) => handleChange('cnh', t)}
              keyboardType="numeric"
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="Tipo de Veículo"
              placeholder="Caminhão, Van, etc."
              value={formData.veiculo}
              onChangeText={(t) => handleChange('veiculo', t)}
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="Marca do Veículo"
              placeholder="Ex: Mercedes, Volkswagen"
              value={formData.marca}
              onChangeText={(t) => handleChange('marca', t)}
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="Placa do Veículo"
              placeholder="ABC-1234"
              value={formData.placa}
              onChangeText={(t) => handleChange('placa', t)}
              autoCapitalize="characters"
              leftIcon={<Text size="lg"></Text>}
            />
            <Input
              label="Telefone"
              placeholder="(65) 98765-4321"
              value={formData.telefone}
              onChangeText={(t) => handleChange('telefone', t)}
              keyboardType="phone-pad"
              leftIcon={<Text size="lg"></Text>}
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Input
                  label="Senha"
                  placeholder="••••••••"
                  value={formData.senha}
                  onChangeText={(t) => handleChange('senha', t)}
                  secureTextEntry
                  leftIcon={<Text size="lg"></Text>}
                />
              </View>
              <View style={styles.halfInputLast}>
                <Input
                  label="Confirmar"
                  placeholder="••••••••"
                  value={formData.confirmarSenha}
                  onChangeText={(t) => handleChange('confirmarSenha', t)}
                  secureTextEntry
                  leftIcon={<Text size="lg"></Text>}
                />
              </View>
            </View>

            {erro ? <Text color="error" size="sm" style={styles.error}>{erro}</Text> : null}

            <Button
              title="Cadastrar-se"
              onPress={handleSubmit}
              loading={loading}
              variant="primary"
            />
          </Card>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
            <Text color="white" weight="bold" style={styles.cancelText}>Voltar para o Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 40,
    // removed alignItems: 'center'
    // removed width: '100%'
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  backText: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.white,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    alignSelf: 'center',
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
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    width: '85%',
    maxWidth: 450,
    alignSelf: 'center',
    ...theme.shadows.lg,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  halfInput: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  halfInputLast: {
    flex: 1,
  },
  error: {
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  cancelButton: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    alignItems: 'center',
    alignSelf: 'center',
  },
  cancelText: {
    textDecorationLine: 'underline',
  },
});
