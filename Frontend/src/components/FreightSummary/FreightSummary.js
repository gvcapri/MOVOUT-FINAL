import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { ArrowLeft, CheckCircle2, MapPin, User, ShieldCheck, Star } from 'lucide-react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { API_BASE_URL } from '../../api/config';

const fmt = (val) =>
  `R$ ${parseFloat(val || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const FreightSummary = ({ onNavigate, freightId }) => {
  const [frete, setFrete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRating, setIsRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);

  useEffect(() => {
    const loadFreight = async () => {
      try {
        setLoading(true);
        const r = await fetch(`${API_BASE_URL}/fretes/${freightId}`);
        if (!r.ok) throw new Error('Não foi possível carregar os dados do frete');
        const data = await r.json();
        setFrete(data);
      } catch (e) {
        Alert.alert('Erro', e.message || 'Não foi possível carregar os detalhes do frete.');
      } finally {
        setLoading(false);
      }
    };
    if (freightId) loadFreight();
  }, [freightId]);

  const handleRating = async (nota) => {
    if (isRating || hasRated) return;
    setSelectedRating(nota);
    setIsRating(true);
    try {
      const r = await fetch(`${API_BASE_URL}/fretes/${freightId}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_avaliador: 'CLIENTE',
          tipo_avaliado: 'MOTORISTA',
          nota,
          comentario: `Motorista avaliado com ${nota} estrelas pelo cliente via tela de resumo.`,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Erro ao avaliar');
      
      setHasRated(true);
      Alert.alert('Avaliação enviada', 'Obrigado por avaliar o motorista!');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Não foi possível enviar a avaliação.');
      setSelectedRating(0);
    } finally {
      setIsRating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!frete) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>Resumo não encontrado.</Text>
        <TouchableOpacity style={styles.btnHome} onPress={() => onNavigate('home')}>
          <Text style={styles.btnHomeText}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const finalPrice = frete.preco_fechado ?? frete.preco_estimado ?? 0;
  const motorista = frete.motorista || {};

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text size="lg" weight="bold" style={styles.headerTitle}>
          Resumo do Frete
        </Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <CheckCircle2 color={theme.colors.success} size={48} />
          <Text size="xl" weight="bold" style={styles.successTitle}>
            Corrida Finalizada!
          </Text>
          <Text size="sm" color="textSecondary" style={styles.successSub}>
            Seu pagamento foi processado e liberado.
          </Text>
        </View>

        {/* Price Card */}
        <Card style={styles.priceCard}>
          <Text size="sm" color="textSecondary">Valor Total Pago</Text>
          <Text size="xxl" weight="bold" color="primary" style={styles.priceText}>
            {fmt(finalPrice)}
          </Text>
        </Card>

        {/* Route Details Card */}
        <Card style={styles.card}>
          <Text size="md" weight="bold" style={styles.cardSectionTitle}>
            Detalhes da Viagem
          </Text>
          <View style={styles.routeRow}>
            <MapPin color={theme.colors.accent} size={20} />
            <View style={styles.routeTextContainer}>
              <Text size="xs" color="textSecondary" weight="bold">ORIGEM</Text>
              <Text size="sm" numberOfLines={2}>{frete.origem}</Text>
            </View>
          </View>
          <View style={styles.routeSeparator} />
          <View style={styles.routeRow}>
            <MapPin color={theme.colors.error} size={20} />
            <View style={styles.routeTextContainer}>
              <Text size="xs" color="textSecondary" weight="bold">DESTINO</Text>
              <Text size="sm" numberOfLines={2}>{frete.destino}</Text>
            </View>
          </View>
        </Card>

        {/* Driver Card */}
        <Card style={styles.card}>
          <Text size="md" weight="bold" style={styles.cardSectionTitle}>
            Seu Motorista
          </Text>
          <View style={styles.driverInfoRow}>
            <Image
              source={{ uri: motorista.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(frete.motorista_nome || 'M')}&background=1E3A8A&color=fff&size=64` }}
              style={styles.driverAvatar}
            />
            <View style={styles.driverMeta}>
              <Text size="md" weight="bold">{frete.motorista_nome || 'Motorista'}</Text>
              <Text size="xs" color="textSecondary">
                {frete.tipo_veiculo || 'Veículo'} • {motorista.placa || 'Placa não cadastrada'}
              </Text>
            </View>
            {motorista.nota && (
              <View style={styles.ratingBadge}>
                <Star color="#F59E0B" size={14} fill="#F59E0B" />
                <Text style={styles.ratingBadgeText}>{parseFloat(motorista.nota).toFixed(1)}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Rating Card */}
        <Card style={styles.card}>
          <Text size="md" weight="bold" style={[styles.cardSectionTitle, { textAlign: 'center' }]}>
            Como foi sua experiência?
          </Text>
          <Text size="sm" color="textSecondary" style={{ textAlign: 'center', marginBottom: 12 }}>
            Sua avaliação ajuda a manter a qualidade dos nossos motoristas parceiros.
          </Text>

          {isRating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
          ) : hasRated ? (
            <View style={styles.ratedContainer}>
              <ShieldCheck color={theme.colors.success} size={24} />
              <Text size="sm" color="success" weight="bold">
                Avaliação enviada com sucesso!
              </Text>
            </View>
          ) : (
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const isLit = n <= selectedRating;
                return (
                  <TouchableOpacity
                    key={n}
                    style={styles.starBtn}
                    onPress={() => handleRating(n)}
                    disabled={isRating || hasRated}
                  >
                    <Star
                      color={isLit ? '#F59E0B' : '#D1D5DB'}
                      fill={isLit ? '#F59E0B' : 'transparent'}
                      size={32}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>

        {/* Home Button */}
        <TouchableOpacity style={styles.btnHome} onPress={() => onNavigate('home')}>
          <Text style={styles.btnHomeText}>Voltar para o Início</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    padding: theme.spacing.lg,
    paddingTop: 50,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPlaceholder: { width: 40 },
  headerTitle: { color: theme.colors.white, fontSize: 18, fontWeight: 'bold' },
  content: { padding: theme.spacing.lg },
  successBanner: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  successTitle: { marginTop: theme.spacing.sm, color: theme.colors.text },
  successSub: { marginTop: 4, textAlign: 'center' },
  priceCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  priceText: { marginTop: 4 },
  card: { padding: theme.spacing.md, marginBottom: theme.spacing.md },
  cardSectionTitle: { color: theme.colors.text, marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeTextContainer: { flex: 1 },
  routeSeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
    marginLeft: 32,
  },
  driverInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surfaceAlt },
  driverMeta: { flex: 1 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#B45309' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 8 },
  starBtn: { padding: 4 },
  ratedContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  btnHome: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    ...theme.shadows.md,
  },
  btnHomeText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
});

export default FreightSummary;
