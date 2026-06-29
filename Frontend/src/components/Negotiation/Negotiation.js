import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { ArrowLeft, Clock, DollarSign, Star, CheckCircle, MessageCircle, TrendingDown, Info, RefreshCw } from 'lucide-react-native';
import { theme } from '../../theme';
import { API_BASE_URL, WS_BASE_URL } from '../../api/config';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (val) =>
  `R$ ${parseFloat(val || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const POLL_INTERVAL = 4000;

// ─── Component ───────────────────────────────────────────────────────────────
const Negotiation = ({ onNavigate, freightId }) => {
  const [frete, setFrete] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [contraValor, setContraValor] = useState('');
  const [enviandoContra, setEnviandoContra] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [aguardandoProposta, setAguardandoProposta] = useState(true);
  const [preFilledProposalId, setPreFilledProposalId] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef(null);

  // Pulsing animation while waiting
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    if (aguardandoProposta) pulse.start();
    else pulse.stop();
    return () => pulse.stop();
  }, [aguardandoProposta]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const carregar = async () => {
    if (!freightId) return;
    try {
      // Busca dados do frete (preco_estimado + status)
      const [freteRes, propostasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/fretes/${freightId}`),
        fetch(`${API_BASE_URL}/fretes/${freightId}/propostas`),
      ]);

      if (!freteRes.ok) {
        setErrorMsg('Frete não encontrado.');
        return;
      }

      const freteData = await freteRes.json();
      setFrete(freteData);

      // Verifica se o frete já foi aceito (motorista aceitou a contraproposta)
      if (freteData.status === 'aceito') {
        clearInterval(intervalRef.current);
        onNavigate('accepted', { freightId });
        return;
      }

      if (propostasRes.ok) {
        const propostasData = await propostasRes.json();
        if (Array.isArray(propostasData) && propostasData.length > 0) {
          const ultima = propostasData[propostasData.length - 1];
          setProposta(ultima);
          setAguardandoProposta(false);
          setLoading(false);
          setErrorMsg('');
          // Pre-preenche contraproposta apenas se for uma nova proposta carregada
          if (preFilledProposalId !== (ultima.id_negociacao || ultima.id)) {
            const sugerido = (parseFloat(ultima.valor) * 0.9).toFixed(2);
            setContraValor(sugerido);
            setPreFilledProposalId(ultima.id_negociacao || ultima.id);
          }
        } else {
          setAguardandoProposta(true);
          setLoading(false);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar negociação:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(carregar, POLL_INTERVAL);

    let ws = null;
    if (freightId) {
      const wsUrl = `${WS_BASE_URL}/ws/fretes/${freightId}`;
      console.log('[Negotiation] Connecting to WebSocket:', wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const dados = JSON.parse(event.data);
          console.log('[Negotiation] WebSocket message received:', dados);
          if (dados.tipo === 'FRETE_ACEITO' || dados.status === 'ACEITO') {
            console.log('[Negotiation] Freight accepted, navigating to accepted screen');
            clearInterval(intervalRef.current);
            ws.close();
            onNavigate('accepted', { freightId });
          } else if (dados.tipo === 'CONTRAPROPOSTA_MOTORISTA') {
            carregar();
          }
        } catch (err) {
          console.error('[Negotiation] WS parsing error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[Negotiation] WS error:', err);
      };

      ws.onclose = () => {
        console.log('[Negotiation] WS connection closed');
      };
    }

    return () => {
      clearInterval(intervalRef.current);
      if (ws) ws.close();
    };
  }, [freightId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAceitar = async () => {
    if (!proposta) return;
    setAceitando(true);
    try {
      const url = `${API_BASE_URL}/fretes/${freightId}/aceitar-proposta?motorista_id=${proposta.motorista_id}`;
      const resp = await fetch(url, { method: 'POST' });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Erro ao aceitar proposta');
      }
      clearInterval(intervalRef.current);
      onNavigate('accepted', { freightId });
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível aceitar a proposta.');
    } finally {
      setAceitando(false);
    }
  };

  const handleContraproposta = async () => {
    const valor = parseFloat(contraValor.replace(',', '.'));
    if (!valor || valor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor válido para a contraproposta.');
      return;
    }
    if (proposta && valor >= proposta.valor) {
      Alert.alert('Valor inválido', 'A contraproposta deve ser menor que o valor do motorista.');
      return;
    }
    setEnviandoContra(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/fretes/${freightId}/contraproposta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor,
          motorista_id: proposta?.motorista_id || null,
          id_negociacao: proposta?.id_negociacao || null,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Erro ao enviar contraproposta');
      }
      Alert.alert(
        '✅ Contraproposta Enviada',
        `Seu valor de ${fmt(valor)} foi enviado ao motorista. Aguardando resposta...`,
      );
      setAguardandoProposta(true);
      setProposta(null);
      await carregar();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível enviar a contraproposta.');
    } finally {
      setEnviandoContra(false);
    }
  };

  const handleCancelar = () => {
    Alert.alert(
      'Cancelar Frete',
      'Tem certeza que deseja cancelar este frete?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar Frete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE_URL}/fretes/${freightId}/cancelar`, { method: 'POST' });
            } catch {}
            clearInterval(intervalRef.current);
            onNavigate('history');
          },
        },
      ]
    );
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderPrecosEstimados = () => {
    if (!frete) return null;
    const preco = frete.valor_total_calculado || frete.preco_estimado || 0;
    return (
      <View style={styles.estimativaCard}>
        <View style={styles.estimativaHeader}>
          <Info color={theme.colors.primary} size={16} />
          <Text style={styles.estimativaTitle}>Estimativa do Sistema</Text>
        </View>
        <View style={styles.estimativaRow}>
          <Text style={styles.estimativaLabel}>Preço calculado pelo app:</Text>
          <Text style={styles.estimativaValue}>{fmt(preco)}</Text>
        </View>
        {frete.distancia_km > 0 && (
          <View style={styles.estimativaRow}>
            <Text style={styles.estimativaLabel}>Distância:</Text>
            <Text style={styles.estimativaSubValue}>{frete.distancia_km} km</Text>
          </View>
        )}
        {frete.tipo_veiculo && (
          <View style={styles.estimativaRow}>
            <Text style={styles.estimativaLabel}>Veículo:</Text>
            <Text style={styles.estimativaSubValue}>{frete.tipo_veiculo}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderAguardando = () => (
    <View style={styles.waitCard}>
      <Animated.View style={[styles.waitIcon, { opacity: pulseAnim }]}>
        <RefreshCw color={theme.colors.primary} size={40} />
      </Animated.View>
      <Text style={styles.waitTitle}>Aguardando proposta...</Text>
      <Text style={styles.waitSub}>
        Motoristas próximos estão sendo notificados. Você receberá a proposta em instantes.
      </Text>
      {renderPrecosEstimados()}
    </View>
  );

  const renderNegociacao = () => {
    if (!proposta) return null;
    const driverVal = parseFloat(proposta.valor_original || proposta.valor || 0);
    const diferenca = frete
      ? ((driverVal - parseFloat(frete.preco_estimado || 0)) / parseFloat(frete.preco_estimado || 1)) * 100
      : 0;

    return (
      <>
        {/* Motorista */}
        <View style={styles.card}>
          <View style={styles.driverHeader}>
            <Image
              source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(proposta.nome_motorista || 'M')}&background=1E3A8A&color=fff&size=64` }}
              style={styles.driverPhoto}
            />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{proposta.nome_motorista || 'Motorista'}</Text>
              <View style={styles.ratingRow}>
                <Star color="#F59E0B" size={14} fill="#F59E0B" />
                <Text style={styles.ratingText}>
                  {parseFloat(proposta.rating || 4.8).toFixed(1)} avaliação
                </Text>
              </View>
              {(proposta.veiculo && proposta.veiculo !== 'Veículo') && (
                <Text style={styles.vehicleText}>🚚 {proposta.veiculo} • {proposta.placa || ''}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Valores */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Proposta do Motorista</Text>

          <View style={styles.priceComparison}>
            <View style={styles.priceBox}>
              <Text style={styles.priceBoxLabel}>App Estimou</Text>
              <Text style={styles.priceBoxValue}>{fmt(frete?.valor_total_calculado || frete?.preco_estimado || 0)}</Text>
            </View>
            <View style={styles.priceArrow}>
              <Text style={styles.priceArrowText}>→</Text>
            </View>
            <View style={[styles.priceBox, styles.priceBoxDriver]}>
              <Text style={styles.priceBoxLabel}>Motorista Pede</Text>
              <Text style={[styles.priceBoxValue, styles.priceBoxDriverValue]}>{fmt(proposta.valor_original || proposta.valor)}</Text>
              {Math.abs(diferenca) > 1 && (
                <Text style={[styles.priceDiff, diferenca > 0 ? styles.priceDiffUp : styles.priceDiffDown]}>
                  {diferenca > 0 ? '+' : ''}{diferenca.toFixed(0)}%
                </Text>
              )}
            </View>
          </View>

          {/* Tempo estimado */}
          {proposta.tempo_estimado && (
            <View style={styles.infoRow}>
              <Clock color={theme.colors.textSecondary} size={16} />
              <Text style={styles.infoText}>Tempo estimado: {proposta.tempo_estimado}</Text>
            </View>
          )}
        </View>

        {/* Contraproposta */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <TrendingDown color={theme.colors.accent} size={20} />
            <Text style={styles.sectionTitle}>Sua Contraproposta</Text>
          </View>
          <Text style={styles.contraDesc}>
            Sugira um valor menor. O motorista decidirá se aceita ou recusa.
          </Text>
          <View style={styles.contraInputRow}>
            <Text style={styles.currencySign}>R$</Text>
            <TextInput
              style={styles.contraInput}
              value={contraValor}
              onChangeText={setContraValor}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, styles.btnContra, enviandoContra && styles.btnDisabled]}
            onPress={handleContraproposta}
            disabled={enviandoContra}
            activeOpacity={0.8}
          >
            {enviandoContra
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <TrendingDown color="#fff" size={18} />
                  <Text style={styles.actionBtnText}>Enviar Contraproposta</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('request')} style={styles.backButton}>
          <ArrowLeft color={theme.colors.white} size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Negociação</Text>
          <Text style={styles.headerSub}>Frete #{freightId}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 60 }} />
          ) : aguardandoProposta ? (
            renderAguardando()
          ) : (
            renderNegociacao()
          )}
        </ScrollView>

        {/* Footer — só aparece quando há proposta */}
        {proposta && !aguardandoProposta && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnAceitar, aceitando && styles.btnDisabled]}
              onPress={handleAceitar}
              disabled={aceitando}
              activeOpacity={0.8}
            >
              {aceitando
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <CheckCircle color="#fff" size={20} />
                    <Text style={styles.actionBtnText}>Aceitar Proposta</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnCancelar]}
              onPress={handleCancelar}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Recusar e Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer de espera */}
        {aguardandoProposta && !loading && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnCancelar]}
              onPress={handleCancelar}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancelar Frete</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: theme.spacing.lg,
    paddingTop: 50,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  backButton: {
    width: 44, height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.white },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  content: { padding: theme.spacing.lg, paddingBottom: 24 },

  // ── Aguardando ──
  waitCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  waitIcon: { marginBottom: theme.spacing.md },
  waitTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  waitSub: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: theme.spacing.lg },

  // ── Estimativa ──
  estimativaCard: {
    backgroundColor: theme.colors.primaryLight + '25',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    width: '100%',
    marginTop: 4,
  },
  estimativaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  estimativaTitle: { fontWeight: '700', color: theme.colors.primary, fontSize: 13 },
  estimativaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  estimativaLabel: { fontSize: 13, color: theme.colors.textSecondary },
  estimativaValue: { fontSize: 16, fontWeight: 'bold', color: theme.colors.primary },
  estimativaSubValue: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },

  // ── Cards ──
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  // ── Driver card ──
  driverHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  driverPhoto: { width: 62, height: 62, borderRadius: 31, backgroundColor: theme.colors.surfaceAlt },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 17, fontWeight: 'bold', color: theme.colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, color: theme.colors.textSecondary },
  vehicleText: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },

  // ── Price comparison ──
  priceComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  priceBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    alignItems: 'center',
  },
  priceBoxDriver: {
    backgroundColor: theme.colors.accent + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  priceBoxLabel: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  priceBoxValue: { fontSize: 17, fontWeight: 'bold', color: theme.colors.text },
  priceBoxDriverValue: { color: theme.colors.accent },
  priceArrow: { paddingHorizontal: 8 },
  priceArrowText: { fontSize: 20, color: theme.colors.textSecondary },
  priceDiff: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  priceDiffUp: { color: '#EF4444' },
  priceDiffDown: { color: theme.colors.success || '#22C55E' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  infoText: { color: theme.colors.textSecondary, fontSize: 13 },

  // ── Contraproposta ──
  contraDesc: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },
  contraInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.md,
  },
  currencySign: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginRight: 8 },
  contraInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    paddingVertical: 14,
  },

  // ── Buttons ──
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'android' ? 24 : 28,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.xl,
  },
  btnAceitar: {
    backgroundColor: theme.colors.accent,
    ...theme.shadows.md,
  },
  btnContra: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  btnCancelar: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  btnDisabled: { opacity: 0.55 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default Negotiation;
