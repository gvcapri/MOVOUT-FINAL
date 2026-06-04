import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Camera,
  User,
  Mail,
  Phone,
  FileText,
  Save,
  Edit2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { API_BASE_URL } from '../../api/config';

const EditProfile = ({ onNavigate }) => {
  const [userData, setUserData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    profilePic: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

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

  const updateField = (field, value) => {
    setUserData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
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
      updateField('profilePic', uri);
    }
  };

  const handleSave = async () => {
    if (!userData.nome || !userData.nome.trim()) {
      Alert.alert('Erro', 'O nome é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const emailAtual = userData.email_original || userData.email;
      const response = await fetch(`${API_BASE_URL}/cliente/me?email_atual=${encodeURIComponent(emailAtual)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: userData.nome || userData.name, email: userData.email, cpf: userData.cpf, telefone: userData.telefone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erro ao salvar no banco');
      const updated = { ...userData, ...(data.usuario || {}), email_original: (data.usuario || {}).email || userData.email };
      await AsyncStorage.setItem('userData', JSON.stringify(updated));
      setUserData(updated);
      setHasChanges(false);
      Alert.alert('Sucesso', 'Perfil atualizado no banco!', [
        { text: 'OK', onPress: () => onNavigate('profile') },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoBack = () => {
    if (hasChanges) {
      Alert.alert(
        'Alterações não salvas',
        'Você tem alterações não salvas. Deseja descartá-las?',
        [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: () => onNavigate('profile') },
        ]
      );
    } else {
      onNavigate('profile');
    }
  };

  const formatPhone = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };



  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <ArrowLeft color={theme.colors.white} size={24} />
          </TouchableOpacity>
          <Text size="lg" weight="bold" style={styles.headerTitle}>
            Editar Perfil
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Avatar */}
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
          <View style={styles.cameraBadge}>
            <Camera color="#fff" size={14} />
          </View>
        </TouchableOpacity>
        <Text size="sm" style={styles.changePhotoText}>
          Toque para alterar a foto
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Personal Data */}
          <Card style={styles.section}>
            <Text size="xs" weight="bold" color="textSecondary" style={styles.sectionTitle}>
              INFORMAÇÕES PESSOAIS
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <User color={theme.colors.primary} size={16} />
                <Text style={styles.inputLabel}>Nome completo</Text>
              </View>
              <TextInput
                style={styles.formInput}
                value={userData.nome || userData.name || ''}
                onChangeText={(t) => updateField('nome', t)}
                placeholder="Seu nome completo"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Mail color={theme.colors.primary} size={16} />
                <Text style={styles.inputLabel}>E-mail</Text>
              </View>
              <TextInput
                style={styles.formInput}
                value={userData.email || ''}
                onChangeText={(t) => updateField('email', t)}
                placeholder="Seu e-mail"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <FileText color={theme.colors.primary} size={16} />
                <Text style={styles.inputLabel}>CPF</Text>
              </View>
              <TextInput
                style={[styles.formInput, styles.disabledInput]}
                value={userData.cpf || ''}
                editable={false}
                placeholder="000.000.000-00"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <Text size="xs" color="textSecondary" style={styles.inputHint}>
                O CPF não pode ser alterado
              </Text>
            </View>

            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.inputLabelRow}>
                <Phone color={theme.colors.primary} size={16} />
                <Text style={styles.inputLabel}>Telefone</Text>
              </View>
              <TextInput
                style={styles.formInput}
                value={userData.telefone || ''}
                onChangeText={(t) => updateField('telefone', formatPhone(t))}
                placeholder="(00) 00000-0000"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </Card>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              !hasChanges && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            activeOpacity={0.8}
          >
            <Save color="#fff" size={20} />
            <Text size="md" weight="bold" style={{ color: '#fff', marginLeft: 8 }}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
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
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: 50,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
    alignItems: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.lg,
  },
  headerTitle: {
    color: theme.colors.white,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.xs,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: theme.colors.accent,
    padding: 8,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  changePhotoText: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: 40,
  },
  section: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  formInput: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.text,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: theme.colors.surfaceAlt,
  },
  inputHint: {
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});

export default EditProfile;
