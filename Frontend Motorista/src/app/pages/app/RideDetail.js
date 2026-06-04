import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import Text from '../../layouts/Components/Text';
import AppLayout from '../../layouts/Layouts/AppLayout';
import Card from '../../layouts/Components/Card';
import Button from '../../layouts/Components/button';
import { theme } from '../../theme';
import axios from 'axios';
import { API_BASE_URL, WS_BASE_URL } from '../../../api/config';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export default function RideDetail({ navigation, route }) {
    const { rideId } = route?.params || { rideId: null };
    const [frete, setFrete] = useState(null);
    const [loading, setLoading] = useState(true);
    const [originPoint, setOriginPoint] = useState(null);
    const [destinationPoint, setDestinationPoint] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [routeDriverOrigin, setRouteDriverOrigin] = useState([]);
    const [driverLocation, setDriverLocation] = useState(null);

    const { user } = useAuth();
    const ws = useRef(null);
    const trackingSubscription = useRef(null);

    const fetchFrete = useCallback(async () => {
        if (!rideId) {
            setLoading(false);
            return;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/fretes/${rideId}`);
            setFrete(response.data);
        } catch (error) {
            console.error('Erro ao buscar detalhes do frete:', error);
        } finally {
            setLoading(false);
        }
    }, [rideId]);

    useEffect(() => {
        fetchFrete();
    }, [fetchFrete]);

    useEffect(() => {
        const resolvePoint = async (lat, lng, textAddress) => {
            const latitude = Number(lat);
            const longitude = Number(lng);
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                return { latitude, longitude };
            }
            if (!textAddress) return null;
            try {
                const points = await Location.geocodeAsync(textAddress);
                if (Array.isArray(points) && points.length > 0) {
                    return { latitude: points[0].latitude, longitude: points[0].longitude };
                }
            } catch { }
            return null;
        };

        const loadPoints = async () => {
            if (!frete) return;
            const [o, d] = await Promise.all([
                resolvePoint(frete?.origem_lat, frete?.origem_lng, frete?.origem),
                resolvePoint(frete?.destino_lat, frete?.destino_lng, frete?.destino),
            ]);
            setOriginPoint(o);
            setDestinationPoint(d);
        };

        loadPoints();
    }, [frete]);

    useEffect(() => {
        const fetchRoute = async () => {
            if (originPoint && destinationPoint) {
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${originPoint.longitude},${originPoint.latitude};${destinationPoint.longitude},${destinationPoint.latitude}?overview=full&geometries=geojson`;
                    console.log('RideDetail OSRM request', url);
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log('RideDetail OSRM response', data);
                    if (data.routes && data.routes.length > 0) {
                        const coords = data.routes[0].geometry.coordinates.map(coord => ({
                            latitude: coord[1],
                            longitude: coord[0]
                        }));
                        setRouteCoords(coords);
                    }
                } catch (error) {
                    console.error('Error fetching route:', error);
                    setRouteCoords([]);
                }
            } else {
                setRouteCoords([]);
            }
        };
        // new effect for driver->origin
        const fetchDriverRoute = async () => {
            if (driverLocation && originPoint) {
                try {
                    const url2 = `https://router.project-osrm.org/route/v1/driving/${driverLocation.longitude},${driverLocation.latitude};${originPoint.longitude},${originPoint.latitude}?overview=full&geometries=geojson`;
                    console.log('RideDetail OSRM driver->origin', url2);
                    const resp2 = await fetch(url2);
                    const d2 = await resp2.json();
                    console.log('RideDetail OSRM driver->origin response', d2);
                    if (d2.routes && d2.routes.length > 0) {
                        const coords2 = d2.routes[0].geometry.coordinates.map(coord => ({
                            latitude: coord[1],
                            longitude: coord[0]
                        }));
                        setRouteDriverOrigin(coords2);
                    }
                } catch (err) {
                    console.error('Error fetching driver->origin route:', err);
                    setRouteDriverOrigin([]);
                }
            } else {
                setRouteDriverOrigin([]);
            }
        };

        fetchRoute();
        fetchDriverRoute();
        // running fetchRoute twice was leftover, removed duplicate
    }, [originPoint, destinationPoint]);

    // whenever driver moves update driver->origin segment
    useEffect(() => {
        const updateDriverSegment = async () => {
            if (driverLocation && originPoint) {
                try {
                    const url2 = `https://router.project-osrm.org/route/v1/driving/${driverLocation.longitude},${driverLocation.latitude};${originPoint.longitude},${originPoint.latitude}?overview=full&geometries=geojson`;
                    console.log('RideDetail OSRM driver move', url2);
                    const resp = await fetch(url2);
                    const data = await resp.json();
                    if (data.routes && data.routes.length > 0) {
                        const coords2 = data.routes[0].geometry.coordinates.map(coord => ({ latitude: coord[1], longitude: coord[0] }));
                        setRouteDriverOrigin(coords2);
                    }
                } catch (err) {
                    console.error('Error updating driver->origin route:', err);
                    setRouteDriverOrigin([]);
                }
            }
        };
        updateDriverSegment();
    }, [driverLocation, originPoint]);

    useEffect(() => {
        if (!frete || !['aceito', 'em andamento'].includes(frete.status?.toLowerCase())) {
            return;
        }

        const runTracking = async () => {
            const motoristaId = user?.id_motorista || user?.id || 1;
            const wsUrl = `${WS_BASE_URL}/ws/motoristas/${motoristaId}`;
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => console.log("Motorista conectado ao rastreamento WS:", wsUrl);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log("Permissão de GPS negada");
                return;
            }

            trackingSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 3000,
                    distanceInterval: 5,
                },
                (location) => {
                    const currentPoint = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    };
                    setDriverLocation(currentPoint);
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        try {
                            ws.current.send(JSON.stringify({
                                latitude: currentPoint.latitude,
                                longitude: currentPoint.longitude,
                                frete_id: rideId
                            }));
                            console.log("-> GPS enviado");
                        } catch (e) {
                            console.error("Erro enviando GPS via WS", e);
                        }
                    }
                }
            );
        };

        runTracking();

        return () => {
            if (trackingSubscription.current) {
                trackingSubscription.current.remove();
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [frete?.status, rideId, user]);

    if (loading) {
        return (
            <AppLayout title="Detalhes da Corrida" onBack={() => navigation.goBack()}>
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Carregando detalhes...</Text>
                </View>
            </AppLayout>
        );
    }

    if (!frete) {
        return (
            <AppLayout title="Detalhes da Corrida" onBack={() => navigation.goBack()}>
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                    <Text style={{ fontSize: 48 }}>❌</Text>
                    <Text style={{ fontSize: 16, color: theme.colors.textSecondary, marginTop: 12 }}>
                        Frete não encontrado
                    </Text>
                </View>
            </AppLayout>
        );
    }

    const getStatusColor = (status) => {
        if (status === 'aceito') return theme.colors.success;
        if (status === 'cancelado') return '#EF4444';
        if (status === 'aberto') return theme.colors.primary;
        return theme.colors.textSecondary;
    };

    const handleMarkCompleted = async () => {
        try {
            const motoristaId = user?.id_motorista || user?.id || 1;
            const response = await axios.post(`${API_BASE_URL}/fretes/${rideId}/motorista-concluir?motorista_id=${motoristaId}`);
            alert('Corrida concluída. Agora você pode avaliar o cliente apenas uma vez.');
            fetchFrete();
        } catch (error) {
            alert(error.response?.data?.detail || 'Não foi possível marcar a corrida como concluída.');
        }
    };

    const handleOpenExternalRoute = async () => {
        if (!frete?.origem || !frete?.destino) return;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
            frete.origem
        )}&destination=${encodeURIComponent(frete.destino)}&travelmode=driving`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    return (
        <AppLayout title="Detalhes da Corrida" onBack={() => navigation.goBack()} scrollable>
            <View style={styles.content}>

                {/* Status Header */}
                <View style={styles.statusHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(frete.status) }]}>
                        <Text style={styles.statusText}>{frete.status.toUpperCase()}</Text>
                    </View>
                    {frete.tipo_veiculo && (
                        <Text style={styles.dateText}>Veículo: {frete.tipo_veiculo}</Text>
                    )}
                </View>

                <Card style={styles.mainCard}>
                    <Text style={styles.title}>{frete.descricao}</Text>

                    {frete.objeto_ia && (
                        <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>🤖 IA Detectou:</Text>
                            <Text style={styles.aiValue}>{frete.objeto_ia}</Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>PESO</Text>
                            <Text style={styles.infoValue}>{frete.peso_estimado} Kg</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>PRIORIDADE</Text>
                            <Text style={styles.infoValue}>{frete.prioridade_entrega || frete.prioridade || '—'}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <Text style={styles.infoLabel}>MÉTODO DE PAGAMENTO</Text>
                    <Text style={styles.infoValue}>{frete.pagamento_descricao || frete.metodo_pagamento || 'Não informado'}</Text>
                </Card>

                <Text style={styles.sectionTitle}>ROTA</Text>
                <Card style={styles.mapCard}>
                    <MapView
                        style={styles.map}
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
                            <Marker coordinate={driverLocation} title="Motorista" pinColor="#1E3A8A" />
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
                        {routeDriverOrigin.length > 0 && (
                            <Polyline
                                coordinates={routeDriverOrigin}
                                strokeColor="#10B981"
                                strokeWidth={3}
                                lineDashPattern={[6, 4]}
                            />
                        )}
                        {(typeof driverLocation !== 'undefined' && driverLocation) && originPoint && (
                            <Polyline
                                coordinates={[driverLocation, originPoint]}
                                strokeColor="#1E3A8A"
                                strokeWidth={2}
                                lineDashPattern={[5, 10]}
                            />
                        )}
                    </MapView>
                </Card>
                <Card style={styles.routeCard}>
                    <View style={styles.routePoint}>
                        <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                        <View style={styles.routeInfo}>
                            <Text style={styles.routeLabel}>ORIGEM</Text>
                            <Text style={styles.routeText}>{frete.origem || 'Não informado'}</Text>
                        </View>
                    </View>
                    <View style={styles.routeConnector} />
                    <View style={styles.routePoint}>
                        <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        <View style={styles.routeInfo}>
                            <Text style={styles.routeLabel}>DESTINO</Text>
                            <Text style={styles.routeText}>{frete.destino || 'Não informado'}</Text>
                        </View>
                    </View>
                </Card>

                {/* Propostas */}
                {frete.propostas && frete.propostas.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>PROPOSTAS ({frete.propostas.length})</Text>
                        {frete.propostas.map((p, idx) => (
                            <Card key={idx} style={styles.proposalCard}>
                                <View style={styles.proposalRow}>
                                    <Text style={styles.proposalName}>{p.nome_motorista}</Text>
                                    <Text style={styles.proposalValue}>R$ {p.valor.toFixed(2).replace('.', ',')}</Text>
                                </View>
                                <Text style={styles.proposalTime}>Tempo: {p.tempo_estimado} • ⭐ {p.rating}</Text>
                            </Card>
                        ))}
                    </>
                )}

                {frete.fragil && (
                    <View style={styles.fragilBadge}>
                        <Text style={styles.fragilText}>⚠️ Objeto marcado como FRÁGIL</Text>
                    </View>
                )}

                <Button
                    title="Abrir rota no mapa"
                    onPress={handleOpenExternalRoute}
                    style={{ marginTop: theme.spacing.md }}
                />

                <Button
                    title="Corrida concluída"
                    onPress={handleMarkCompleted}
                    style={{ marginTop: theme.spacing.md }}
                />

                <Button
                    title="Abrir chat"
                    variant="secondary"
                    onPress={() => navigation.navigate('ChatDetail', { chatId: rideId, name: 'Cliente' })}
                    style={{ marginTop: theme.spacing.md }}
                />

                <Button
                    title="Relatar um Problema"
                    variant="secondary"
                    onPress={() => alert('Suporte acionado.')}
                    style={{ marginTop: theme.spacing.lg, marginBottom: 40 }}
                />
            </View>
        </AppLayout>
    );
}

const styles = StyleSheet.create({
    content: { paddingTop: theme.spacing.md },
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.round,
    },
    statusText: {
        color: theme.colors.white,
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateText: {
        fontSize: theme.typography.fontSizes.xs,
        color: theme.colors.black,
        fontWeight: 'bold',
    },
    mainCard: {
        padding: theme.spacing.lg,
    },
    title: {
        fontSize: theme.typography.fontSizes.xl,
        fontWeight: theme.typography.fontWeights.extraBold,
        color: theme.colors.black,
        marginBottom: theme.spacing.md,
    },
    aiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        backgroundColor: '#ECFDF5',
        padding: 8,
        borderRadius: 8,
    },
    aiLabel: {
        fontSize: 12,
        color: '#065F46',
        fontWeight: 'bold',
        marginRight: 6,
    },
    aiValue: {
        fontSize: 12,
        color: '#065F46',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginBottom: theme.spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 30,
        backgroundColor: theme.colors.border,
    },
    infoItem: {
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 10,
        color: theme.colors.textSecondary,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: theme.typography.fontSizes.lg,
        fontWeight: theme.typography.fontWeights.bold,
        color: theme.colors.black,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: theme.colors.black,
        marginLeft: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
        textTransform: 'uppercase',
        marginTop: theme.spacing.lg,
    },
    routeCard: {
        padding: theme.spacing.lg,
    },
    mapCard: {
        padding: theme.spacing.sm,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: 220,
        borderRadius: 12,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
        marginRight: theme.spacing.md,
    },
    routeInfo: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
        marginBottom: 2,
    },
    routeText: {
        fontSize: theme.typography.fontSizes.sm,
        color: theme.colors.text,
        fontWeight: 'bold',
    },
    routeConnector: {
        width: 2,
        height: 20,
        backgroundColor: theme.colors.border,
        marginLeft: 4,
        marginVertical: 2,
    },
    proposalCard: {
        padding: theme.spacing.md,
        marginBottom: theme.spacing.xs,
    },
    proposalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    proposalName: {
        fontSize: theme.typography.fontSizes.md,
        fontWeight: 'bold',
        color: theme.colors.black,
    },
    proposalValue: {
        fontSize: theme.typography.fontSizes.lg,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    proposalTime: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        marginTop: 4,
    },
    fragilBadge: {
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 8,
        marginTop: theme.spacing.lg,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    fragilText: {
        color: '#92400E',
        fontWeight: 'bold',
        fontSize: 13,
    },
});
