import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';

import { ArrowLeft, Clock, DollarSign, Star, CheckCircle, MessageCircle } from 'lucide-react-native';
import { theme } from '../../theme';
import { API_BASE_URL } from '../../api/config';

const Negotiation = ({ onNavigate, freightId }) => {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [counterOffer, setCounterOffer] = useState('0,00');

    useEffect(() => {
        let intervalId;

        const loadNegotiation = async () => {
            if (!freightId) {
                setErrorMsg('ID do frete não informado.');
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/fretes/${freightId}/propostas`);
                const data = await response.json();

                if (response.ok && data && data.length > 0) {
                    const proposal = data[data.length - 1];

                    const formattedPrice = `R$ ${proposal.valor.toFixed(2)}`.replace('.', ',');
                    const suggestedVal = proposal.valor * 0.9;
                    const formattedSuggested = `R$ ${suggestedVal.toFixed(2)}`.replace('.', ',');

                    setDriver({
                        name: proposal.nome_motorista,
                        rating: proposal.rating || 5.0,
                        trips: 12,
                        vehicle: "Veículo",
                        plate: "ABC-1234",
                        photo: "https://randomuser.me/api/portraits/men/32.jpg",
                        price: formattedPrice,
                        rawPrice: proposal.valor,
                        rawId: proposal.motorista_id,
                        time: proposal.tempo_estimado,
                        suggestedPrice: formattedSuggested
                    });

                    setCounterOffer(suggestedVal.toFixed(2).replace('.', ','));
                    setLoading(false);
                    setErrorMsg('');

                    if (intervalId) clearInterval(intervalId);
                } else {
                    setErrorMsg('Aguardando proposta do motorista...');
                    setLoading(false);
                }
            } catch (error) {
                console.error("Erro ao carregar negociacao:", error);
                if (!driver) {
                    setErrorMsg('Buscando propostas...');
                }
            }
        };

        loadNegotiation();
        intervalId = setInterval(loadNegotiation, 3000);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [freightId]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => onNavigate('request')} style={styles.backButton}>
                    <ArrowLeft color={theme.colors.white} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Proposta Disponível</Text>
                <Text style={styles.headerSubtitle}>Motorista encontrou seu pedido</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
                ) : errorMsg ? (
                    <Text style={styles.errorText}>{errorMsg}</Text>
                ) : driver && (
                    <>
                        {/* Driver Card */}
                        <View style={styles.card}>
                            <View style={styles.driverHeader}>
                                <Image source={{ uri: driver.photo }} style={styles.driverPhoto} />
                                <View style={styles.driverInfo}>
                                    <Text style={styles.driverName}>{driver.name}</Text>
                                    <View style={styles.ratingRow}>
                                        <Star color={theme.colors.primary} size={16} fill={theme.colors.primary} />
                                        <Text style={styles.ratingText}>{driver.rating} ({driver.trips} viagens)</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.vehicleInfo}>
                                <Text style={styles.vehicleText}>{driver.vehicle} • {driver.plate}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.proposalDetails}>
                                <View style={styles.proposalItem}>
                                    <DollarSign color={theme.colors.success} size={24} />
                                    <View>
                                        <Text style={styles.proposalLabel}>Preço Oferecido</Text>
                                        <Text style={styles.proposalValue}>{driver.price}</Text>
                                    </View>
                                </View>

                                <View style={styles.proposalItem}>
                                    <Clock color={theme.colors.secondary} size={24} />
                                    <View>
                                        <Text style={styles.proposalLabel}>Tempo Estimado</Text>
                                        <Text style={styles.proposalValue}>{driver.time}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.suggestedBox}>
                                <Text style={styles.suggestedLabel}>Valor sugerido pelo App:</Text>
                                <Text style={styles.suggestedValue}>{driver.suggestedPrice}</Text>
                            </View>
                        </View>

                        {/* Counter Offer Section */}
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Contraproposta</Text>
                            <Text style={styles.description}>
                                A contraproposta do motorista é {driver.price}. Você pode aceitar ou sugerir um novo valor.
                            </Text>

                            <View style={styles.counterInputContainer}>
                                <Text style={styles.currencyPrefix}>R$</Text>
                                <View style={styles.inputWrapper}>
                                    <Text style={{ color: theme.colors.textSecondary }}>Valor da sua oferta:</Text>
                                    <Text style={styles.inputValue}>{counterOffer}</Text>
                                </View>
                                <View style={styles.counterButtons}>
                                    <TouchableOpacity onPress={() => setCounterOffer(prev => (parseFloat(prev.replace(',', '.')) - 5).toFixed(2).replace('.', ','))} style={styles.counterBtn}>
                                        <Text style={styles.counterBtnText}>-5</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setCounterOffer(prev => (parseFloat(prev.replace(',', '.')) + 5).toFixed(2).replace('.', ','))} style={styles.counterBtn}>
                                        <Text style={styles.counterBtnText}>+5</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </>
                )}

            </ScrollView>

            {/* Action Buttons */}
            {driver && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={async () => {
                            try {
                                const url = `${API_BASE_URL}/fretes/${freightId}/aceitar-proposta?motorista_id=${driver?.rawId || driver?.id || 0}`;
                                const resp = await fetch(url, { method: 'POST' });
                                if (!resp.ok) {
                                    throw new Error('erro ao chamar backend ' + resp.status);
                                }
                                onNavigate('accepted', { freightId });
                            } catch (e) {
                                console.error('Falha ao aceitar proposta no servidor', e);
                                Alert.alert('Erro', 'Não foi possível aceitar a proposta. Tente novamente.');
                            }
                        }}
                    >
                        <CheckCircle color={theme.colors.white} size={24} />
                        <Text style={styles.acceptButtonText}>Aceitar Contraproposta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={async () => {
                            try {
                                await fetch(`${API_BASE_URL}/fretes/${freightId}/cancelar`, { method: 'POST' });
                                onNavigate('history');
                            } catch (e) {
                                console.error('Falha ao cancelar negociação', e);
                            }
                        }}
                    >
                        <Text style={styles.acceptButtonText}>Recusar / cancelar</Text>
                    </TouchableOpacity>
                </View>
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        padding: theme.spacing.lg,
        paddingTop: 50,
        paddingBottom: theme.spacing.xl,
        borderBottomLeftRadius: theme.borderRadius.xxl,
        borderBottomRightRadius: theme.borderRadius.xxl,
        backgroundColor: theme.colors.primary,
    },
    backButton: {
        width: 44, height: 44,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.white },
    headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
    errorText: { textAlign: 'center', marginTop: 40, color: theme.colors.error, fontSize: 16 },

    content: { padding: theme.spacing.lg },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
    },

    driverHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: theme.spacing.md },
    driverPhoto: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.surfaceAlt },
    driverInfo: { flex: 1 },
    driverName: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { color: theme.colors.textSecondary, fontSize: 14 },

    vehicleInfo: { backgroundColor: theme.colors.surfaceAlt, padding: 12, borderRadius: theme.borderRadius.lg, alignItems: 'center' },
    vehicleText: { color: theme.colors.textSecondary, fontWeight: '500' },

    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md },

    proposalDetails: { flexDirection: 'row', justifyContent: 'space-around' },
    proposalItem: { alignItems: 'center', gap: 8 },
    proposalLabel: { fontSize: 12, color: theme.colors.textSecondary },
    proposalValue: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },

    suggestedBox: {
        marginTop: theme.spacing.md,
        backgroundColor: theme.colors.secondaryLight,
        padding: 12,
        borderRadius: theme.borderRadius.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    suggestedLabel: { color: theme.colors.secondary, fontSize: 14 },
    suggestedValue: { color: theme.colors.secondary, fontWeight: 'bold', fontSize: 16 },

    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
    description: { color: theme.colors.textSecondary, lineHeight: 20, marginBottom: theme.spacing.md },

    counterInputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.borderRadius.xl,
        padding: 12, borderWidth: 1, borderColor: theme.colors.border,
    },
    currencyPrefix: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginRight: 8 },
    inputWrapper: { flex: 1 },
    inputValue: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text },
    counterButtons: { flexDirection: 'row', gap: 8 },
    counterBtn: {
        backgroundColor: theme.colors.accent,
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    counterBtnText: { color: theme.colors.white, fontWeight: 'bold' },

    footer: {
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
        gap: 10,
    },
    actionButton: {
        flex: 1, flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center',
        gap: 8, padding: theme.spacing.md, borderRadius: theme.borderRadius.xl,
    },
    cancelButton: { backgroundColor: '#EF4444' },
    acceptButton: {
        backgroundColor: theme.colors.accent,
        ...theme.shadows.md,
    },
    acceptButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
});

export default Negotiation;
