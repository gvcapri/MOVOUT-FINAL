import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Text from '../../layouts/Components/Text';
import AppLayout from '../../layouts/Layouts/AppLayout';
import Button from '../../layouts/Components/button';
import Card from '../../layouts/Components/Card';
import { theme } from '../../theme';
import axios from 'axios';
import { API_BASE_URL } from '../../../api/config';
import { useAuth } from '../../context/AuthContext';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

export default function Negotiation({ navigation, route }) {
  const freteId = route?.params?.freteId;
  const { user } = useAuth();
  const [frete, setFrete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState('');
  const [tempoEstimado, setTempoEstimado] = useState('30 min');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [forceShowForm, setForceShowForm] = useState(false);

  const motoristaId = user?.id_motorista || user?.id || 1;
  const activeProposal = frete?.propostas?.find(p => p.motorista_id === motoristaId && p.status === 'PENDENTE');
  const isProposalSent = (sent || !!activeProposal) && !forceShowForm;
  const hasCounter = activeProposal && activeProposal.valor_original && Number(activeProposal.valor) !== Number(activeProposal.valor_original);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  // new states for map preview when frete is aceito
  const [originPoint, setOriginPoint] = useState(null);
  const [destinationPoint, setDestinationPoint] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const trackingSubscription = useRef(null);

  // Buscar dados do frete
  const fetchFrete = useCallback(async () => {
    if (!freteId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/fretes/${freteId}`);
      setFrete(response.data);
    } catch (error) {
      console.error('Erro ao buscar frete:', error);
    } finally {
      setLoading(false);
    }
  }, [freteId]);

  useEffect(() => {
    fetchFrete();
    // Polling para atualizar status do frete
    const interval = setInterval(fetchFrete, 5000);
    return () => clearInterval(interval);
  }, [fetchFrete]);

  // whenever frete is updated compute points and possibly start gps tracking
  useEffect(() => {
    const resolvePoint = async (lat, lng, text) => {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
      if (!text) return null;
      try {
        const p = await Location.geocodeAsync(text);
        if (p && p.length > 0) {
          return { latitude: p[0].latitude, longitude: p[0].longitude };
        }
      } catch { }
      return null;
    };

    const loadPoints = async () => {
      if (!frete) return;
      const [o, d] = await Promise.all([
        resolvePoint(frete.origem_lat, frete.origem_lng, frete.origem),
        resolvePoint(frete.destino_lat, frete.destino_lng, frete.destino),
      ]);
      setOriginPoint(o);
      setDestinationPoint(d);
    };
    loadPoints();
  }, [frete]);

  // calculate route between origin and destination for map preview
  useEffect(() => {
    const fetchRoute = async () => {
      if (originPoint && destinationPoint) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${originPoint.longitude},${originPoint.latitude};${destinationPoint.longitude},${destinationPoint.latitude}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            setRouteCoords(coords);
          }
        } catch (e) {
          console.warn('route preview failed', e);
          setRouteCoords([]);
        }
      } else {
        setRouteCoords([]);
      }
    };
    fetchRoute();
  }, [originPoint, destinationPoint]);

  // start/stop driver GPS tracking once the frete is aceito
  useEffect(() => {
    if (frete?.status?.toLowerCase() === 'aceito') {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        trackingSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          loc => {
            const pt = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setDriverLocation(pt);
          }
        );
      })();
    } else {
      if (trackingSubscription.current) {
        trackingSubscription.current.remove();
        trackingSubscription.current = null;
      }
    }
  }, [frete?.status]);

  useEffect(() => {
    if (frete?.status?.toLowerCase() === 'aceito') {
      // ainda mostra o mapa nesta tela, mas também redireciona
      navigation.replace('RideDetail', { rideId: freteId });
    }
  }, [frete?.status, freteId, navigation]);

  const handleAcceptClientPrice = async () => {
    setSending(true);
    try {
      await axios.post(`${API_BASE_URL}/fretes/${freteId}/motorista-aceitar?motorista_id=${user?.id_motorista || user?.id || 1}`);
      Alert.alert('Frete aceito!', 'Você aceitou o valor do cliente. A corrida foi atribuída a você.');
      navigation.replace('RideDetail', { rideId: freteId });
    } catch (error) {
      console.error('Erro ao aceitar frete:', error.response?.data || error.message);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível aceitar o frete.');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptCounterProposal = async () => {
    setSending(true);
    try {
      await axios.post(`${API_BASE_URL}/fretes/${freteId}/aceitar-proposta?motorista_id=${motoristaId}`);
      Alert.alert('Sucesso', 'Você aceitou a contraproposta do cliente!');
      navigation.replace('RideDetail', { rideId: freteId });
    } catch (error) {
      console.error('Erro ao aceitar contraproposta:', error.response?.data || error.message);
      Alert.alert('Erro', error.response?.data?.detail || 'Não foi possível aceitar a contraproposta.');
    } finally {
      setSending(false);
    }
  };

  // Enviar proposta ao backend
  const handleSendProposal = async () => {
    if (!proposal || parseFloat(proposal.replace(',', '.')) <= 0) {
      Alert.alert('Valor inválido', 'Insira um valor válido para sua proposta.');
      return;
    }

    setSending(true);
    try {
      await axios.post(`${API_BASE_URL}/fretes/${freteId}/proposta`, {
        motorista_id: user?.id_motorista || user?.id || 1,
        nome_motorista: user?.nome || 'Motorista Movout',
        valor: parseFloat(proposal.replace(',', '.')),
        tempo_estimado: tempoEstimado,
      });
      setSent(true);
      setForceShowForm(false);
      await fetchFrete(); // Instant UI update!
      Alert.alert('Contraproposta enviada!', 'O cliente receberá sua contraproposta e poderá aceitar ou cancelar.');
    } catch (error) {
      console.error('Erro ao enviar proposta:', error);
      Alert.alert('Erro', 'Não foi possível enviar a proposta.');
    } finally {
      setSending(false);
    }
  };

  // Cancelar / desistir do frete (retira apenas a proposta do motorista)
  const handleCancel = async () => {
    try {
      await axios.post(`${API_BASE_URL}/fretes/${freteId}/motorista-cancelar-proposta?motorista_id=${motoristaId}`);
      Alert.alert('Proposta cancelada', 'Você retirou sua proposta.');
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao cancelar proposta:', error);
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <AppLayout title="Negociação" onBack={() => navigation.goBack()}>
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Carregando frete...</Text>
        </View>
      </AppLayout>
    );
  }

  if (!frete) {
    return (
      <AppLayout title="Negociação" onBack={() => navigation.goBack()}>
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 48 }}>❌</Text>
          <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 12 }}>Frete não encontrado</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Negociação" onBack={() => navigation.goBack()} scrollable>
      {/* Detalhes do Frete */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Detalhes do Frete</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📦 Objeto:</Text>
          <Text style={styles.detailValue}>{frete.descricao}</Text>
        </View>

        {frete.objeto_ia && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🤖 IA Detectou:</Text>
            <Text style={[styles.detailValue, { color: theme.colors.primary }]}>{frete.objeto_ia}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>⚖️ Peso:</Text>
          <Text style={styles.detailValue}>{frete.peso_estimado} kg</Text>
        </View>

        {frete.origem && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍 Origem:</Text>
            <Text style={styles.detailValue}>{frete.origem}</Text>
          </View>
        )}

        {frete.destino && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🏁 Destino:</Text>
            <Text style={styles.detailValue}>{frete.destino}</Text>
          </View>
        )}

        {frete.tipo_veiculo && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🚗 Veículo:</Text>
            <Text style={styles.detailValue}>{frete.tipo_veiculo}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📌 Status:</Text>
          <View style={[styles.statusBadge, frete.status === 'aceito' && { backgroundColor: '#10B981' }, frete.status === 'cancelado' && { backgroundColor: '#EF4444' }]}>
            <Text style={styles.statusText}>{frete.status.toUpperCase()}</Text>
          </View>
        </View>
        {frete?.status?.toLowerCase() === 'aceito' && (
          <Button
            title="Ver rota"
            onPress={() => navigation.replace('RideDetail', { rideId: freteId })}
            style={{ marginTop: theme.spacing.sm }}
          />
        )}
      </Card>

      {/* Enviar Proposta */}
      {/* Map preview once proposal is accepted */}
      {frete?.status?.toLowerCase() === 'aceito' && (originPoint || destinationPoint) && (
        <Card style={{ padding: 0, marginTop: theme.spacing.lg }}>
          <MapView
            style={{ width: '100%', height: 200 }}
            provider={PROVIDER_GOOGLE}
            region={
              (typeof driverLocation !== 'undefined' && driverLocation)
                ? { ...driverLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }
                : (typeof originPoint !== 'undefined' && originPoint)
                  ? { ...originPoint, latitudeDelta: 0.03, longitudeDelta: 0.03 }
                  : { latitude: -15.601, longitude: -56.097, latitudeDelta: 0.08, longitudeDelta: 0.08 }
            }
            showsUserLocation
          >
            {(typeof driverLocation !== 'undefined' && driverLocation) && (
              <Marker coordinate={driverLocation} title="Você" pinColor="#1E3A8A" />
            )}
            {originPoint && (
              <Marker coordinate={originPoint} title="Origem" pinColor="#2563EB" />
            )}
            {destinationPoint && (
              <Marker coordinate={destinationPoint} title="Destino" pinColor="#EF4444" />
            )}
            {routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#1E3A8A"
                strokeWidth={4}
              />
            )}
          </MapView>
        </Card>
      )}
      {!isProposalSent && ['aberto', 'pendente', 'negociando'].includes(frete?.status?.toLowerCase()) && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Negociação</Text>
          <Text style={styles.helperText}>Você pode aceitar o valor estimado do cliente ou enviar uma contraproposta para ele aprovar.</Text>
          <Button title="Aceitar valor do cliente" onPress={handleAcceptClientPrice} loading={sending} style={{ marginBottom: theme.spacing.md }} />
          <Text style={styles.cardTitle}>Enviar Contraproposta</Text>

          <View style={styles.proposalInputContainer}>
            <Text style={styles.label}>Seu Valor (R$):</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>R$</Text>
              <TextInput
                style={styles.proposalInput}
                value={proposal}
                onChangeText={setProposal}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.proposalInputContainer}>
            <Text style={styles.label}>Tempo Estimado:</Text>
            <View style={styles.timeOptions}>
              {['15 min', '30 min', '45 min', '1h'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeOption, tempoEstimado === t && styles.timeOptionActive]}
                  onPress={() => setTempoEstimado(t)}
                >
                  <Text style={[styles.timeOptionText, tempoEstimado === t && styles.timeOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Button
            title="Enviar Proposta"
            onPress={handleSendProposal}
            loading={sending}
          />
        </Card>
      )}

      {/* Proposta enviada */}
      {isProposalSent && (
        <Card style={styles.card}>
          {hasCounter ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.primary, marginTop: 8 }}>Contraproposta do Cliente!</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
                O cliente propôs o valor de <Text style={{ fontWeight: 'bold', color: theme.colors.black }}>{formatCurrency(activeProposal.valor)}</Text> para esta corrida.
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                Seu valor original: {formatCurrency(activeProposal.valor_original)}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceAlt, flex: 1, borderWidth: 1, borderColor: theme.colors.border }]}
                  onPress={() => setForceShowForm(true)}
                >
                  <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', textAlign: 'center' }}>Nova Proposta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.colors.success, flex: 1 }]}
                  onPress={handleAcceptCounterProposal}
                  disabled={sending}
                >
                  <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>
                    {sending ? 'Processando...' : `Aceitar (${formatCurrency(activeProposal.valor)})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#10B981', marginTop: 12 }}>Proposta Enviada!</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center', marginBottom: 15 }}>
                Aguarde o cliente aceitar ou cancelar sua contraproposta de R$ {activeProposal ? activeProposal.valor : proposal}
              </Text>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.colors.primary, width: '100%' }]}
                onPress={() => setForceShowForm(true)}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', textAlign: 'center' }}>Alterar Valor da Proposta</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      )}

      {/* Botão Cancelar */}
      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelBtnText}>Cancelar / Desistir</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  detailLabel: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
    width: 110,
  },
  detailValue: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.black,
    fontWeight: '500',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
  },
  statusText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  proposalInputContainer: {
    marginBottom: theme.spacing.lg,
  },
  helperText: { color: theme.colors.textSecondary, marginBottom: theme.spacing.md, lineHeight: 19 },
  label: {
    fontSize: theme.typography.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  currencySymbol: {
    fontSize: theme.typography.fontSizes.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginRight: 8,
  },
  proposalInput: {
    fontSize: theme.typography.fontSizes.display || 28,
    fontWeight: theme.typography.fontWeights.extraBold || '800',
    color: theme.colors.black,
    minWidth: 120,
    textAlign: 'center',
  },
  timeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  timeOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
  },
  timeOptionTextActive: {
    color: theme.colors.white,
  },
  cancelBtn: {
    backgroundColor: '#EF4444',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  cancelBtnText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: theme.typography.fontSizes.md,
  },
});
