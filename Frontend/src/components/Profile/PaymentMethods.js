import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Trash2,
  Star,
  X,
  Check,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { API_BASE_URL } from '../../api/config';

const STORAGE_KEY = 'paymentMethods';


const PaymentMethods = ({ onNavigate, from }) => {
  const [methods, setMethods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState('credit');

  // Card form fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');



  useEffect(() => {
    loadMethods();
  }, []);

  const loadMethods = async () => {
    try {
      const userJson = await AsyncStorage.getItem('userData');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user?.email) {
        try {
          const res = await fetch(`${API_BASE_URL}/cliente/me/cartoes?email=${encodeURIComponent(user.email)}`);
          if (res.ok) {
            const remote = await res.json();
            if (Array.isArray(remote) && remote.length > 0) {
              const mapped = remote.map((c) => ({
                id: String(c.id_cartao),
                type: String(c.bandeira || '').toLowerCase().includes('débito') ? 'debit' : 'credit',
                label: `${c.bandeira || 'Cartão'} •••• ${c.ultimos4}`,
                cardName: c.titular || '',
                lastDigits: c.ultimos4,
                expiry: c.mes_expiracao && c.ano_expiracao ? `${String(c.mes_expiracao).padStart(2, '0')}/${String(c.ano_expiracao).slice(-2)}` : '',
                isDefault: !!c.principal,
              }));
              setMethods(mapped);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
              return;
            }
          }
        } catch (err) {
          console.warn('Não foi possível carregar cartões do backend', err);
        }
      }
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setMethods(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading payment methods', e);
    }
  };

  const saveMethods = async (updatedMethods) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMethods));
      setMethods(updatedMethods);
    } catch (e) {
      console.error('Error saving payment methods', e);
    }
  };

  const resetForm = () => {
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setCardCVV('');
    setSelectedType('credit');
  };

  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (text) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 3) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  const handleAddMethod = async () => {
    const rawNumber = cardNumber.replace(/\s/g, '');
    if (rawNumber.length < 13) {
      Alert.alert('Erro', 'Número do cartão inválido.');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Erro', 'Insira o nome no cartão.');
      return;
    }
    if (cardExpiry.length < 5) {
      Alert.alert('Erro', 'Validade inválida.');
      return;
    }
    if (cardCVV.length < 3) {
      Alert.alert('Erro', 'CVV inválido.');
      return;
    }

    const last4 = rawNumber.slice(-4);
    const typeLabel = selectedType === 'credit' ? 'Crédito' : 'Débito';
    const newMethod = {
      id: Date.now().toString(),
      type: selectedType,
      label: `${typeLabel} •••• ${last4}`,
      cardName: cardName.trim(),
      lastDigits: last4,
      expiry: cardExpiry,
      isDefault: methods.length === 0,
    };
    const updated = [...methods, newMethod];
    await saveMethods(updated);
    try {
      const userJson = await AsyncStorage.getItem('userData');
      const user = userJson ? JSON.parse(userJson) : null;
      if (user?.email) {
        const [mes, ano] = cardExpiry.split('/');
        await fetch(`${API_BASE_URL}/cliente/me/cartoes?email=${encodeURIComponent(user.email)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apelido: newMethod.label,
            titular: newMethod.cardName,
            bandeira: selectedType === 'credit' ? 'Crédito' : 'Débito',
            numero_cartao: rawNumber,
            ultimos4: last4,
            mes_expiracao: Number(mes),
            ano_expiracao: 2000 + Number(ano),
            principal: newMethod.isDefault,
          }),
        });
      }
    } catch (err) {
      console.warn('Cartão salvo localmente, mas não sincronizado com o backend', err);
    }
    resetForm();
    setShowModal(false);
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Remover pagamento',
      'Tem certeza que deseja remover este método de pagamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            const updated = methods.filter((m) => m.id !== id);
            // If we removed the default, make the first one default
            if (updated.length > 0 && !updated.some((m) => m.isDefault)) {
              updated[0].isDefault = true;
            }
            saveMethods(updated);
          },
        },
      ]
    );
  };

  const handleSetDefault = (id) => {
    const updated = methods.map((m) => ({
      ...m,
      isDefault: m.id === id,
    }));
    saveMethods(updated);
  };

  const getPaymentIcon = (type) => {
    switch (type) {
      case 'credit':
        return '💳';
      case 'debit':
        return '💳';
      default:
        return '💰';
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'credit':
        return 'Cartão de Crédito';
      case 'debit':
        return 'Cartão de Débito';
      default:
        return type;
    }
  };

  const paymentTypes = [
    { id: 'credit', label: 'Crédito', icon: '💳', color: '#7C3AED' },
    { id: 'debit', label: 'Débito', icon: '💳', color: '#2563EB' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => {
              if (from === 'request') {
                onNavigate('request');
              } else {
                onNavigate('profile');
              }
            }}
            style={styles.backButton}
          >
            <ArrowLeft color={theme.colors.white} size={24} />
          </TouchableOpacity>
          <Text size="lg" weight="bold" style={styles.headerTitle}>
            Pagamentos
          </Text>
          <View style={styles.backButton} />
        </View>
        <Text size="sm" style={styles.headerSubtitle}>
          Gerencie seus métodos de pagamento
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.addButtonIcon}>
            <Plus color={theme.colors.white} size={20} />
          </View>
          <View>
            <Text size="md" weight="bold" color="text">
              Adicionar método de pagamento
            </Text>
            <Text size="xs" color="textSecondary">
              Cartão de crédito ou débito
            </Text>
          </View>
        </TouchableOpacity>

        {/* Methods List */}
        {methods.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <CreditCard color={theme.colors.textSecondary} size={40} />
            </View>
            <Text size="md" weight="medium" color="textSecondary" align="center">
              Nenhum método cadastrado
            </Text>
            <Text size="sm" color="textSecondary" align="center" style={{ marginTop: 4 }}>
              Adicione um cartão para pagar seus fretes
            </Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            <Text size="xs" weight="bold" color="textSecondary" style={styles.sectionLabel}>
              MÉTODOS CADASTRADOS
            </Text>
            {methods.map((method) => (
              <Card key={method.id} style={styles.methodCard}>
                <View style={styles.methodRow}>
                  <View style={styles.methodLeft}>
                    <View
                      style={[
                        styles.methodIconBox,
                        method.type === 'credit' && { backgroundColor: '#EDE7F6' },
                        method.type === 'debit' && { backgroundColor: '#E3F2FD' },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{getPaymentIcon(method.type)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text size="md" weight="bold" color="text">
                        {method.label}
                      </Text>
                      <Text size="xs" color="textSecondary">
                        {getPaymentTypeLabel(method.type)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.methodActions}>
                    {method.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Star color="#F59E0B" size={12} />
                        <Text style={styles.defaultBadgeText}>Padrão</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleSetDefault(method.id)}
                      >
                        <Star color={theme.colors.textSecondary} size={14} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(method.id)}
                    >
                      <Trash2 color={theme.colors.error} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Payment Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text size="lg" weight="bold" color="text">
                  Novo pagamento
                </Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                  <X color={theme.colors.textSecondary} size={24} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type Selector */}
                <Text size="xs" weight="bold" color="textSecondary" style={styles.formLabel}>
                  TIPO
                </Text>
                <View style={styles.typeSelector}>
                  {paymentTypes.map((pt) => {
                    const isActive = selectedType === pt.id;
                    return (
                      <TouchableOpacity
                        key={pt.id}
                        style={[
                          styles.typeOption,
                          isActive && { borderColor: pt.color, backgroundColor: pt.color + '10' },
                        ]}
                        onPress={() => setSelectedType(pt.id)}
                      >
                        <Text style={{ fontSize: 20 }}>{pt.icon}</Text>
                        <Text
                          size="sm"
                          weight={isActive ? 'bold' : 'regular'}
                          style={{ color: isActive ? pt.color : theme.colors.text }}
                        >
                          {pt.label}
                        </Text>
                        {isActive && (
                          <View style={[styles.typeCheck, { backgroundColor: pt.color }]}>
                            <Check color="#fff" size={10} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Card Form */}
                {(selectedType === 'credit' || selectedType === 'debit') && (
                  <View style={styles.formSection}>
                    <Text size="xs" weight="bold" color="textSecondary" style={styles.formLabel}>
                      DADOS DO CARTÃO
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Número do cartão</Text>
                      <TextInput
                        style={styles.formInput}
                        value={cardNumber}
                        onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                        placeholder="0000 0000 0000 0000"
                        placeholderTextColor={theme.colors.textSecondary}
                        keyboardType="numeric"
                        maxLength={19}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Nome no cartão</Text>
                      <TextInput
                        style={styles.formInput}
                        value={cardName}
                        onChangeText={setCardName}
                        placeholder="Como está impresso no cartão"
                        placeholderTextColor={theme.colors.textSecondary}
                        autoCapitalize="characters"
                      />
                    </View>

                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Validade</Text>
                        <TextInput
                          style={styles.formInput}
                          value={cardExpiry}
                          onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                          placeholder="MM/AA"
                          placeholderTextColor={theme.colors.textSecondary}
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                      <View style={{ width: 12 }} />
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <TextInput
                          style={styles.formInput}
                          value={cardCVV}
                          onChangeText={(t) => setCardCVV(t.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          placeholderTextColor={theme.colors.textSecondary}
                          keyboardType="numeric"
                          maxLength={4}
                          secureTextEntry
                        />
                      </View>
                    </View>
                  </View>
                )}



                {/* Save Button */}
                <TouchableOpacity style={styles.saveButton} onPress={handleAddMethod} activeOpacity={0.8}>
                  <Text size="md" weight="bold" style={{ color: '#fff' }}>
                    Salvar método de pagamento
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    marginBottom: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  addButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  methodsList: {
    gap: 0,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  methodCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  methodIconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  methodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  setDefaultBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 0,
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    padding: theme.spacing.lg,
    paddingBottom: 40,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  formLabel: {
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    gap: 4,
    position: 'relative',
  },
  typeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputRow: {
    flexDirection: 'row',
  },
  pixInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.md,
  },
});

export default PaymentMethods;
