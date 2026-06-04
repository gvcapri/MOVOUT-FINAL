import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
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
  const [profileData, setProfileData] = useState({ nome: '', email: '', cpf: '', telefone: '', veiculo: '', placa: '', saldo_carteira: 0, avaliacao: 4.8, total_fretes: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const motoristaId = user?.id_motorista || user?.id || 1;
  const fetchProfile = async () => {
    try { setLoading(true); const response = await axios.get(`${API_BASE_URL}/motoristas/${motoristaId}/perfil`); setProfileData({ ...response.data, email: response.data.email || user?.email || '' }); }
    catch (error) { console.error('Erro ao buscar perfil:', error.response?.data || error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchProfile(); }, [motoristaId]);
  const pickImage = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 }); if (!result.canceled) setImage(result.assets[0].uri); };
  const saveProfile = async () => {
    try { setSaving(true); const response = await axios.put(`${API_BASE_URL}/motoristas/${motoristaId}/perfil`, { nome: profileData.nome, email: profileData.email, cpf: profileData.cpf, telefone: profileData.telefone, marca: profileData.veiculo?.split(' ')?.[0] || profileData.veiculo, modelo: profileData.veiculo?.split(' ')?.slice(1).join(' '), placa: profileData.placa }); setProfileData(response.data.perfil || profileData); setEditing(false); Alert.alert('Sucesso', 'Perfil atualizado no banco.'); }
    catch (e) { Alert.alert('Erro', e.response?.data?.detail || e.message || 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };
  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  if (loading) return <AppLayout title="Meu Perfil"><View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View></AppLayout>;
  const field = (label, key, keyboardType = 'default') => (<View style={styles.inputGroup}><Text style={styles.label}>{label}</Text><TextInput editable={editing} value={String(profileData[key] || '')} onChangeText={(v) => setProfileData((prev) => ({ ...prev, [key]: v }))} style={[styles.input, !editing && styles.inputDisabled]} keyboardType={keyboardType} placeholder={label} /></View>);
  return (
    <AppLayout title="Meu Perfil" scrollable>
      <View style={styles.content}>
        <Card style={styles.profileCard}><TouchableOpacity onPress={pickImage} style={styles.avatarContainer}><Image source={{ uri: image }} style={styles.avatar} /><View style={styles.editBadge}><Text style={styles.editBadgeText}>✎</Text></View></TouchableOpacity><View style={styles.userInfo}><Text style={styles.userName}>{profileData.nome || 'Motorista'}</Text><Text style={styles.userSince}>⭐ {(profileData.avaliacao || 0).toFixed(1)} • {profileData.total_fretes || 0} fretes</Text></View></Card>
        <Card style={styles.earningsCard}><Text style={styles.statsLabel}>SALDO NA CARTEIRA</Text><Text style={styles.earningsValue}>{formatCurrency(profileData.saldo_carteira)}</Text><Text style={styles.statsSub}>Saldo liberado após confirmação do pagamento.</Text></Card>
        <Card style={styles.formCard}><Text style={styles.sectionTitle}>DADOS DO MOTORISTA</Text>{field('Nome', 'nome')}{field('E-mail', 'email', 'email-address')}{field('CPF', 'cpf')}{field('Telefone', 'telefone', 'phone-pad')}{field('Veículo', 'veiculo')}{field('Placa', 'placa')}<TouchableOpacity style={[styles.saveButton, editing ? styles.saveButtonActive : styles.editButton]} onPress={editing ? saveProfile : () => setEditing(true)} disabled={saving}><Text style={styles.saveButtonText}>{editing ? (saving ? 'Salvando...' : 'Salvar alterações') : 'Editar perfil'}</Text></TouchableOpacity></Card>
        <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.navigate('Login')}><Text style={styles.logoutText}>Sair do aplicativo</Text></TouchableOpacity>
      </View>
    </AppLayout>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, content: { paddingTop: theme.spacing.md }, profileCard: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg }, avatarContainer: { marginRight: theme.spacing.lg }, avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceAlt }, editBadge: { position: 'absolute', right: 0, bottom: 0, backgroundColor: theme.colors.accent, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.colors.white }, editBadgeText: { color: theme.colors.white, fontSize: 10, fontWeight: 'bold' }, userInfo: { flex: 1 }, userName: { fontSize: theme.typography.fontSizes.xl, fontWeight: theme.typography.fontWeights.bold, color: theme.colors.text }, userSince: { fontSize: theme.typography.fontSizes.sm, color: theme.colors.textSecondary, marginTop: 2 }, earningsCard: { padding: theme.spacing.lg, marginBottom: theme.spacing.lg }, statsLabel: { fontSize: 10, fontWeight: theme.typography.fontWeights.bold, color: theme.colors.textSecondary, marginBottom: 4, letterSpacing: 1 }, earningsValue: { fontSize: theme.typography.fontSizes.display, fontWeight: theme.typography.fontWeights.extraBold, color: theme.colors.text, marginVertical: 4 }, statsSub: { fontSize: 11, color: theme.colors.textSecondary }, formCard: { padding: theme.spacing.lg }, sectionTitle: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: 'bold', marginBottom: 14, letterSpacing: 1 }, inputGroup: { marginBottom: 12 }, label: { fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 4 }, input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text }, inputDisabled: { backgroundColor: theme.colors.surfaceAlt }, saveButton: { marginTop: 10, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, saveButtonActive: { backgroundColor: theme.colors.success }, editButton: { backgroundColor: theme.colors.primary }, saveButtonText: { color: '#FFF', fontWeight: 'bold' }, logoutButton: { backgroundColor: theme.colors.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 18, marginBottom: 30 }, logoutText: { color: '#FFF', fontWeight: 'bold' },
});
