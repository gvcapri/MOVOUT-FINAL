import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import FreightCard from '../../layouts/Components/FreightCard';
import AppLayout from '../../layouts/Layouts/AppLayout';
import { theme } from '../../theme';
import axios from 'axios';
import { API_BASE_URL } from '../../../api/config';

export default function Home({ navigation }) {
  const [freights, setFreights] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFreights = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/fretes/`);
      const abertos = response.data.filter(f => String(f.status || '').toLowerCase() === 'aberto');
      setFreights(abertos);
    } catch (error) {
      console.error('Erro ao buscar fretes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFreights();
    const interval = setInterval(fetchFreights, 5000);
    return () => clearInterval(interval);
  }, [fetchFreights]);

  const getTagsForFrete = (frete) => {
    const tags = [];
    if (frete.prioridade === 'urgent') tags.push('Urgente');
    if (frete.fragil) tags.push('Frágil');
    if (frete.objeto_ia) tags.push('IA Confirmou');
    if (tags.length === 0) tags.push('Novo');
    return tags;
  };

  return (
    <AppLayout title="MOVOUT" scrollable>
      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryLabel}>FRETES DISPONÍVEIS</Text>
            <Text style={styles.summaryValueBig}>{freights.length}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>STATUS</Text>
            <Text style={[styles.summaryValueMedium, { color: theme.colors.success }]}>Online</Text>
          </View>
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fretes Disponíveis</Text>
        <Text style={styles.sectionSubtitle}>
          {loading ? 'Carregando...' : `${freights.length} solicitação(ões) aguardando`}
        </Text>
      </View>

      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Buscando fretes...</Text>
        </View>
      )}

      {!loading && freights.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48, paddingVertical: 15 }}>📦</Text>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 12 }}>
            Nenhum frete disponível no momento
          </Text>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
            Atualizando automaticamente...
          </Text>
        </View>
      )}

      {freights.map((frete) => (
        <FreightCard
          key={frete.id}
          title={frete.descricao || 'Frete sem descrição'}
          weight={String(frete.peso_estimado)}
          distance={String(Number(frete.distancia_km || 0).toFixed(1))}
          price={Number(frete.preco_estimado || frete.preco || 0).toFixed(2)}
          origin={frete.origem || 'Não informado'}
          destination={frete.destino || 'Não informado'}
          clientName={frete.cliente_nome || frete.cliente || frete.cliente?.nome || 'Cliente'}
          tags={getTagsForFrete(frete)}
          onPress={() => navigation.navigate('Negotiation', { freteId: frete.id })}
        />
      ))}

    </AppLayout>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: theme.typography.fontWeights.bold,
    marginBottom: 4,
    letterSpacing: 1,
  },
  summaryValueBig: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.xxl,
    fontWeight: theme.typography.fontWeights.extraBold,
  },
  summaryValueMedium: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    opacity: 0.8,
  },
});
