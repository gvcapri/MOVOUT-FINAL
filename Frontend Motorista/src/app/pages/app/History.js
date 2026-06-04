import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import Text from '../../layouts/Components/Text';
import FreightCard from '../../layouts/Components/FreightCard';
import AppLayout from '../../layouts/Layouts/AppLayout';
import { theme } from '../../theme';
import axios from 'axios';
import { API_BASE_URL } from '../../../api/config';
import { useAuth } from '../../context/AuthContext';

export default function History({ navigation }) {
  const { user } = useAuth();
  const [fretes, setFretes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    const motoristaId = user?.id_motorista || user?.id || user?.id_pessoa || 1;

    try {
      const response = await axios.get(`${API_BASE_URL}/motoristas/${motoristaId}/historico`);
      setFretes(response.data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusTag = (status) => {
    if (status === 'aceito') return 'Aceito';
    if (status === 'cancelado') return 'Cancelado';
    if (status === 'em andamento') return 'Em Andamento';
    if (status === 'concluido') return 'Concluído';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <AppLayout title="Meu Histórico" scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Corridas Concluídas</Text>
        <Text style={styles.subtitle}>{fretes.length} frete(s) no histórico</Text>
      </View>

      {loading && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Carregando histórico...</Text>
        </View>
      )}

      {!loading && fretes.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 48, paddingVertical: 15 }}>📋</Text>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 12 }}>
            Nenhum frete no histórico
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {fretes.map((frete) => (
          <FreightCard
            key={frete.id}
            title={frete.descricao}
            weight={String(frete.peso_estimado)}
            distance="—"
            price={`R$ ${Number(frete.preco || 0).toFixed(2)}`}
            origin={frete.origem || 'Não informado'}
            destination={frete.destino || 'Não informado'}
            clientName={frete.cliente_nome || frete.cliente || frete.cliente?.nome || 'Cliente'}
            status="history"
            tags={[getStatusTag(frete.status)]}
            onPress={() => navigation.navigate('RideDetail', { rideId: frete.id })}
          />
        ))}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  content: {
    paddingTop: theme.spacing.xs,
  },
});
