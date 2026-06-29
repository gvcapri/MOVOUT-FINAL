import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { API_BASE_URL } from '../../api/config';

const FreightDetails = ({ onNavigate, freightId }) => {
  const [frete, setFrete] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRating, setIsRating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${API_BASE_URL}/fretes/${freightId}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro ao carregar frete');
      setFrete(data);
      try {
        const p = await fetch(`${API_BASE_URL}/fretes/${freightId}/pagamento`);
        if (p.ok) setPagamento(await p.json());
      } catch { }
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível carregar detalhes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [freightId]);

  const confirmarConclusao = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/fretes/${freightId}/cliente-confirmar-conclusao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao: 'Cliente confirmou conclusão pelo app.' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro ao confirmar conclusão');
      Alert.alert('Conclusão confirmada', data?.resultado_pagamento?.liberado ? 'Pagamento liberado.' : 'Agora falta as avaliações para liberar o saldo.');
      load();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível confirmar conclusão.');
    }
  };

  const avaliarMotorista = async (nota) => {
    if (isRating) return;
    setIsRating(true);
    try {
      const r = await fetch(`${API_BASE_URL}/fretes/${freightId}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_avaliador: 'CLIENTE', tipo_avaliado: 'MOTORISTA', nota, comentario: `Motorista avaliado com ${nota} estrelas pelo cliente.` }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro ao avaliar');
      Alert.alert('Avaliação enviada', data?.resultado_pagamento?.liberado ? 'As duas avaliações foram feitas. Saldo liberado ao motorista.' : 'Avaliação salva. O saldo será liberado quando o motorista também avaliar.');
      load();
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível avaliar.');
    } finally {
      setIsRating(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!frete) {
    return <View style={[styles.container, styles.center]}><Text>Frete não encontrado.</Text></View>;
  }

  const price = frete.preco_fechado ?? frete.preco_estimado ?? 0;
  const motorista = frete.motorista || {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('history')} style={styles.backButton}>
          <ArrowLeft color={theme.colors.white} size={24} />
        </TouchableOpacity>
        <Text size="xxl" weight="bold" style={styles.headerTitle}>Detalhes do Frete</Text>
        <Text size="sm" style={styles.headerSubtitle}>Conclusão, pagamento e avaliação</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text size="lg" weight="bold">Frete #{frete.id_frete || frete.id}</Text>
          <Text size="sm" color="textSecondary">Status: {frete.status}</Text>
          <Text size="sm" color="textSecondary">Cliente: {frete.cliente_nome || 'Cliente'}</Text>
          <Text size="sm" color="textSecondary">Motorista: {frete.motorista_nome || frete.driver || 'Não atribuído'}</Text>
          <Text size="md" weight="bold" color="primary" style={{ marginTop: 8 }}>Valor: R$ {Number(price || 0).toFixed(2).replace('.', ',')}</Text>
        </Card>

        <Card style={styles.card}>
          <Text size="md" weight="bold">Rota</Text>
          <Text size="sm" color="textSecondary" style={styles.label}>Origem</Text>
          <Text size="sm">{frete.origem || 'Não informado'}</Text>
          <Text size="sm" color="textSecondary" style={styles.label}>Destino</Text>
          <Text size="sm">{frete.destino || 'Não informado'}</Text>
        </Card>

        <Card style={styles.card}>
          <Text size="md" weight="bold">Pagamento</Text>
          <Text size="sm" color="textSecondary">Status: {pagamento?.status || 'Ainda não iniciado'}</Text>
          <Text size="sm" color="textSecondary">Método: {frete.pagamento_descricao || frete.metodo_pagamento || 'Não informado'}</Text>
          <Text size="sm" color="textSecondary">Prioridade: {frete.prioridade_entrega || frete.prioridade || 'Hoje'}</Text>
          <Text size="sm" color="textSecondary">Regra: o saldo só é liberado quando cliente e motorista avaliarem.</Text>
        </Card>

        <TouchableOpacity style={styles.primaryButton} onPress={confirmarConclusao}>
          <Text size="md" weight="bold" style={styles.primaryText}>Confirmar corrida concluída</Text>
        </TouchableOpacity>

        <View style={styles.ratingBox}>
          <Text size="md" weight="bold">Avaliar motorista</Text>
          <Text size="sm" color="textSecondary">{motorista.nome || frete.motorista_nome || 'Motorista'}</Text>

          {isRating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.starButton}
                  onPress={() => avaliarMotorista(n)}
                  disabled={isRating}
                >
                  <Text size="xl">⭐</Text>
                  <Text size="xs">{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.chatButton} onPress={() => onNavigate('chat', { freightId })}>
          <Text size="md" weight="bold" style={styles.chatText}>Abrir chat</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    padding: theme.spacing.lg,
    paddingTop: 50,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  backButton: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: theme.borderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  headerTitle: { color: theme.colors.white },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)' },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  label: { marginTop: 10 },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg, padding: 14, alignItems: 'center', marginBottom: theme.spacing.md },
  primaryText: { color: theme.colors.white },
  ratingBox: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadows.sm },
  starsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md },
  starButton: { alignItems: 'center', backgroundColor: theme.colors.surfaceAlt, padding: 10, borderRadius: theme.borderRadius.md, minWidth: 48 },
  chatButton: { backgroundColor: theme.colors.secondary || '#111827', borderRadius: theme.borderRadius.lg, padding: 14, alignItems: 'center' },
  chatText: { color: theme.colors.white },
});

export default FreightDetails;
