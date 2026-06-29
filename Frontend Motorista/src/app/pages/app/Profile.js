import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import AppLayout from '../../layouts/Layouts/AppLayout';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme';
import axios from 'axios';
import { API_BASE_URL } from '../../../api/config';
import { useAuth } from '../../context/AuthContext';

export default function Profile({ navigation }) {
  const { user } = useAuth();
  const [image, setImage] = useState('https://randomuser.me/api/portraits/men/32.jpg');
  const [profileData, setProfileData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    veiculo: '',
    placa: '',
    saldo_carteira: 0,
    avaliacao: 4.8,
    total_fretes: 0
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Saque States
  const [showSaqueModal, setShowSaqueModal] = useState(false);
  const [saqueValor, setSaqueValor] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [sacando, setSacando] = useState(false);

  const motoristaId = user?.id_motorista || user?.id || 1;

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/motoristas/${motoristaId}/perfil`);
      setProfileData({
        ...response.data,
        email: response.data.email || user?.email || ''
      });
    } catch (error) {
      console.error('Erro ao buscar perfil:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [motoristaId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const response = await axios.put(`${API_BASE_URL}/motoristas/${motoristaId}/perfil`, {
        nome: profileData.nome,
        email: profileData.email,
        cpf: profileData.cpf,
        telefone: profileData.telefone,
        marca: profileData.veiculo?.split(' ')?.[0] || profileData.veiculo,
        modelo: profileData.veiculo?.split(' ')?.slice(1).join(' '),
        placa: profileData.placa
      });
      setProfileData(response.data.perfil || profileData);
      setEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado no banco.');
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.detail || e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaque = async () => {
    const valor = parseFloat(saqueValor.replace(',', '.'));
    if (!valor || valor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor de saque válido.');
      return;
    }
    if (valor > profileData.saldo_carteira) {
      Alert.alert('Saldo insuficiente', 'O valor solicitado é maior do que o saldo disponível.');
      return;
    }
    if (!chavePix.trim()) {
      Alert.alert('Chave PIX inválida', 'Digite uma chave PIX para transferência.');
      return;
    }
    setSacando(true);
    try {
      await axios.post(`${API_BASE_URL}/motoristas/${motoristaId}/sacar`, {
        valor,
        chave_pix: chavePix
      });
      Alert.alert('Sucesso', `Saque de ${formatCurrency(valor)} solicitado com sucesso!`);
      setShowSaqueModal(false);
      setSaqueValor('');
      setChavePix('');
      fetchProfile(); // reload profile to update balance!
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.detail || e.message || 'Não foi possível solicitar o saque.');
    } finally {
      setSacando(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  if (loading) {
    return (
      <AppLayout title="Meu Perfil">
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </AppLayout>
    );
  }

  const field = (label, key, keyboardType = 'default') => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={editing && key !== 'cpf'} // CPF fields should not be editable!
        value={String(profileData[key] || '')}
        onChangeText={(v) => setProfileData((prev) => ({ ...prev, [key]: v }))}
        style={[styles.input, (!editing || key === 'cpf') && styles.inputDisabled]}
        keyboardType={keyboardType}
        placeholder={label}
      />
    </View>
  );

  return (
    <AppLayout title="Meu Perfil" scrollable>
      <View style={styles.content}>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            <Image source={{ uri: image }} style={styles.avatar} />
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✎</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profileData.nome || 'Motorista'}</Text>
            <Text style={styles.userSince}>⭐ {(profileData.avaliacao || 0).toFixed(1)} • {profileData.total_fretes || 0} fretes</Text>
          </View>
        </Card>

        {/* Balance & Cashout Card */}
        <Card style={styles.earningsCard}>
          <Text style={styles.statsLabel}>SALDO NA CARTEIRA</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.earningsValue}>{formatCurrency(profileData.saldo_carteira)}</Text>
            {profileData.saldo_carteira > 0 && (
              <TouchableOpacity style={styles.saqueBtn} onPress={() => setShowSaqueModal(true)}>
                <Text style={styles.saqueBtnText}>Sacar</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.statsSub}>Saldo liberado para transferência via PIX.</Text>
        </Card>

        {/* Profile Details Form */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>DADOS DO MOTORISTA</Text>
          {field('Nome', 'nome')}
          {field('E-mail', 'email', 'email-address')}
          {field('CPF', 'cpf')}
          {field('Telefone', 'telefone', 'phone-pad')}
          {field('Veículo', 'veiculo')}
          {field('Placa', 'placa')}

          <TouchableOpacity
            style={[styles.saveButton, editing ? styles.saveButtonActive : styles.editButton]}
            onPress={editing ? saveProfile : () => setEditing(true)}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {editing ? (saving ? 'Salvando...' : 'Salvar alterações') : 'Editar perfil'}
            </Text>
          </TouchableOpacity>
        </Card>

        <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.logoutText}>Sair do aplicativo</Text>
        </TouchableOpacity>
      </View>

      {/* Cashout Modal */}
      <Modal visible={showSaqueModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar Saque</Text>
            <Text style={styles.modalSub}>Saldo disponível: {formatCurrency(profileData.saldo_carteira)}</Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Valor do Saque (R$)</Text>
              <TextInput
                style={styles.modalInput}
                value={saqueValor}
                onChangeText={setSaqueValor}
                keyboardType="numeric"
                placeholder="0,00"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Chave PIX</Text>
              <TextInput
                style={styles.modalInput}
                value={chavePix}
                onChangeText={setChavePix}
                placeholder="CPF, E-mail, Telefone ou Chave"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowSaqueModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleSaque} disabled={sacando}>
                <Text style={styles.modalBtnConfirmText}>{sacando ? 'Processando...' : 'Confirmar Saque'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingTop: theme.spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg },
  avatarContainer: { marginRight: theme.spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceAlt },
  editBadge: { position: 'absolute', right: 0, bottom: 0, backgroundColor: theme.colors.accent, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.colors.white },
  editBadgeText: { color: theme.colors.white, fontSize: 10, fontWeight: 'bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: theme.typography.fontSizes.xl, fontWeight: theme.typography.fontWeights.bold, color: theme.colors.text },
  userSince: { fontSize: theme.typography.fontSizes.sm, color: theme.colors.textSecondary, marginTop: 2 },
  earningsCard: { padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  statsLabel: { fontSize: 10, fontWeight: theme.typography.fontWeights.bold, color: theme.colors.textSecondary, marginBottom: 4, letterSpacing: 1 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  earningsValue: { fontSize: theme.typography.fontSizes.display, fontWeight: theme.typography.fontWeights.extraBold, color: theme.colors.text },
  saqueBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saqueBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  statsSub: { fontSize: 11, color: theme.colors.textSecondary },
  formCard: { padding: theme.spacing.lg },
  sectionTitle: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: 'bold', marginBottom: 14, letterSpacing: 1 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text },
  inputDisabled: { backgroundColor: theme.colors.surfaceAlt },
  saveButton: { marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveButtonActive: { backgroundColor: theme.colors.success },
  editButton: { backgroundColor: theme.colors.primary },
  saveButtonText: { color: '#FFF', fontWeight: 'bold' },
  logoutButton: { backgroundColor: theme.colors.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 18, marginBottom: 30 },
  logoutText: { color: '#FFF', fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', borderRadius: 16, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 20 },
  modalInputGroup: { marginBottom: 16 },
  modalInputLabel: { fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: theme.colors.text },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  modalBtnCancelText: { color: theme.colors.textSecondary, fontWeight: 'bold' },
  modalBtnConfirm: { backgroundColor: theme.colors.success },
  modalBtnConfirmText: { color: '#FFF', fontWeight: 'bold' }
});
