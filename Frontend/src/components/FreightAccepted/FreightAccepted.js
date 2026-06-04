import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { MessageCircle, Phone, Star, Shield, Home } from 'lucide-react-native';
import { theme } from '../../theme';
import { API_BASE_URL, WS_BASE_URL } from '../../api/config';


const FreightAccepted = ({ onNavigate, freightId }) => {
  const idDoFrete = freightId || 1;
  const ws = useRef(null);

  const [drvLocation, setDrvLocation] = useState(null); // renamed to avoid conflicts
  const [userLocation, setUserLocation] = useState(null);
  const [motorista, setMotorista] = useState(null);
  const [statusCorrida, setStatusCorrida] = useState('Buscando motorista...');
  const [objetoConfirmadoIA, setObjetoConfirmadoIA] = useState(null);
  const [originLocation, setOriginLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDriverOrigin, setRouteDriverOrigin] = useState([]); // street route from driver to pickup

  useEffect(() => {
    const wsUrl = `${WS_BASE_URL}/ws/fretes/${idDoFrete}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const dados = JSON.parse(event.data);

      if (dados.latitude && dados.longitude) {
        setDrvLocation({ latitude: dados.latitude, longitude: dados.longitude });
      }

      if (dados.status === 'ACEITO' && dados.motorista) {
        setStatusCorrida('Motorista a caminho');
        setMotorista(dados.motorista);
      }

      if (dados.tipo === 'DETECCAO_OBJETO') {
        setObjetoConfirmadoIA(dados.objeto);
      }
    };

    return () => ws.current?.close();
  }, [idDoFrete]);

  useEffect(() => {
    let subscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );
    })();

    return () => subscription && subscription.remove();
  }, []);

  useEffect(() => {
    const geocodeAddress = async (address) => {
      if (!address) return null;
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&lang=pt&limit=1`;
        const photonResp = await fetch(photonUrl, { headers: { Accept: 'application/json' } });
        if (photonResp.ok) {
          const photonJson = await photonResp.json();
          const feat = photonJson?.features?.[0];
          const coords = feat?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              return { latitude: lat, longitude: lon };
            }
          }
        }
      } catch {}

      try {
        const geocoded = await Location.geocodeAsync(address);
        if (Array.isArray(geocoded) && geocoded.length > 0) {
          return { latitude: geocoded[0].latitude, longitude: geocoded[0].longitude };
        }
      } catch {}

      return null;
    };

    const toPointIfValid = (lat, lng) => {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    };

    const loadRoute = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/fretes/${idDoFrete}`);
        if (!response.ok) return;
        const frete = await response.json();

        const originFromFrete = toPointIfValid(frete?.origem_lat, frete?.origem_lng);
        const destinationFromFrete = toPointIfValid(frete?.destino_lat, frete?.destino_lng);

        const [origin, destination] = await Promise.all([
          originFromFrete ? Promise.resolve(originFromFrete) : geocodeAddress(frete?.origem),
          destinationFromFrete ? Promise.resolve(destinationFromFrete) : geocodeAddress(frete?.destino),
        ]);

        setOriginLocation(origin);
        setDestinationLocation(destination);
        console.log('FreightAccepted geocoded points', { origin, destination });

        // fetch OSRM route once we have both points
        if (origin && destination) {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
            console.log('FreightAccepted OSRM request', url);
            const r2 = await fetch(url);
            const d2 = await r2.json();
            console.log('FreightAccepted OSRM response', d2);
            if (d2.routes && d2.routes.length > 0) {
              const coords = d2.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
              setRouteCoords(coords);
            }
          } catch (err) {
            console.warn('FreightAccepted could not fetch route', err);
            setRouteCoords([]);
          }
        }

        // also fetch driver->origin route whenever drvLocation or originLocation changes
        if (drvLocation && originLocation) {
          try {
            const url2 = `https://router.project-osrm.org/route/v1/driving/${drvLocation.longitude},${drvLocation.latitude};${originLocation.longitude},${originLocation.latitude}?overview=full&geometries=geojson`;
            console.log('FreightAccepted OSRM driver->origin', url2);
            const r3 = await fetch(url2);
            const d3 = await r3.json();
            if (d3.routes && d3.routes.length > 0) {
              const coords2 = d3.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
              setRouteDriverOrigin(coords2);
            }
          } catch (err) {
            console.warn('FreightAccepted could not fetch driver->origin route', err);
            setRouteDriverOrigin([]);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar rota do frete:', error);
      }
    };

    loadRoute();
  }, [idDoFrete]);

  // recalc driver->origin whenever driver moves or origin known
  useEffect(() => {
    const fetchSegment = async () => {
      if (drvLocation && originLocation) {
        console.log('fetchSegment triggered', { drvLocation, originLocation });
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${drvLocation.longitude},${drvLocation.latitude};${originLocation.longitude},${originLocation.latitude}?overview=full&geometries=geojson`;
          console.log('FreightAccepted driver move OSRM', url);
          const resp = await fetch(url);
          const js = await resp.json();
          console.log('FreightAccepted driver move response', js);
          if (js.routes && js.routes.length > 0) {
            const coords = js.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            setRouteDriverOrigin(coords);
            console.log('Updated routeDriverOrigin with', coords.length, 'points');
          }
        } catch (e) {
          console.warn('error updating driver->origin route', e);
          setRouteDriverOrigin([]);
        }
      }
    };
    fetchSegment();
  }, [drvLocation, originLocation]);



  const liberarPagamentoCliente = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/fretes/${idDoFrete}/cliente-confirmar-conclusao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacao: 'Confirmar conclusão pelo cliente no aplicativo' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao liberar pagamento');
      Alert.alert('Corrida confirmada', 'A conclusão foi confirmada e o pagamento foi liberado para o motorista.');
      setStatusCorrida('Corrida concluída e pagamento liberado');
    } catch (e) { Alert.alert('Erro', e.message || 'Não foi possível liberar o pagamento.'); }
  };

  const avaliarMotorista = async (nota = 5) => {
    try {
      const res = await fetch(`${API_BASE_URL}/fretes/${idDoFrete}/avaliar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo_avaliador: 'CLIENTE', tipo_avaliado: 'MOTORISTA', nota, comentario: 'Avaliação feita pelo cliente' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao avaliar');
      Alert.alert('Avaliação enviada', `Você avaliou o motorista com ${nota} estrelas.`);
    } catch (e) { Alert.alert('Erro', e.message || 'Não foi possível avaliar.'); }
  };

  const distanceKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  useEffect(() => {
    if (!drvLocation || !originLocation || !destinationLocation) return;

    const toOrigin = distanceKm(drvLocation, originLocation);
    const toDestination = distanceKm(drvLocation, destinationLocation);

    if (toOrigin !== null && toOrigin <= 0.2) {
      setStatusCorrida('Motorista indo para o destino');
    } else if (toDestination !== null && toDestination <= 0.2) {
      setStatusCorrida('Entrega chegando ao destino');
    } else {
      setStatusCorrida('Motorista a caminho da coleta');
    }
  }, [drvLocation, originLocation, destinationLocation]);

  const mapRegion = useMemo(() => {
    // guard against undefined just in case bundle messes up
    if (typeof drvLocation !== 'undefined' && drvLocation) {
      return { ...drvLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    if (userLocation) {
      return { ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    return { latitude: -15.601, longitude: -56.097, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  }, [drvLocation, userLocation]);

  if (!userLocation) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Obtendo localizacao...</Text>
      </View>
    );
  }

  // if we have a routed line use it, otherwise fall back to straight segments
  const baseCoords = routeCoords.length > 0 ? routeCoords : [];
  const fallbackCoords = [];
  if (typeof drvLocation !== 'undefined' && drvLocation) fallbackCoords.push(drvLocation);
  if (originLocation) fallbackCoords.push(originLocation);
  if (destinationLocation) fallbackCoords.push(destinationLocation);

  // compute final polyline: if we know both segments, stitch them together
  let polylineCoords = baseCoords.length > 0 ? baseCoords : fallbackCoords;
  if (routeDriverOrigin.length >= 2 && baseCoords.length >= 1) {
    // combine driver->origin then origin->destination
    polylineCoords = [...routeDriverOrigin, ...baseCoords];
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={mapRegion}
        showsUserLocation
        followsUserLocation
      >
        <Marker coordinate={userLocation} title="Voce" />

        {drvLocation && (
          <Marker coordinate={drvLocation} title="Motorista">
            <View style={styles.driverMarker}><Text>TRK</Text></View>
          </Marker>
        )}

        {originLocation && (
          <Marker coordinate={originLocation} title="Origem">
            <View style={styles.routeMarker}><Text style={styles.routeMarkerText}>O</Text></View>
          </Marker>
        )}

        {destinationLocation && (
          <Marker coordinate={destinationLocation} title="Destino">
            <View style={[styles.routeMarker, styles.destinationMarker]}><Text style={styles.routeMarkerText}>D</Text></View>
          </Marker>
        )}

        {routeDriverOrigin.length >= 2 && (
          <Polyline coordinates={routeDriverOrigin} strokeColor="#10B981" strokeWidth={3} lineDashPattern={[6,4]} />
        )}
        {polylineCoords.length >= 2 && (
          <Polyline coordinates={polylineCoords} strokeColor="#1E3A8A" strokeWidth={4} />
        )}
      </MapView>

      <View style={styles.overlay}>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>{statusCorrida}</Text>
          <Text style={styles.statusSubtitle}>Acompanhe em tempo real</Text>
        </View>

        {objetoConfirmadoIA && (
          <View style={styles.aiNotification}>
            <Shield color="white" size={16} />
            <Text style={styles.aiText}>Objeto confirmado: {objetoConfirmadoIA}</Text>
          </View>
        )}

        {motorista && (
          <View style={styles.card}>
            <View style={styles.driverHeader}>
              <Image source={{ uri: motorista.foto }} style={styles.avatar} />
              <View style={styles.driverInfo}>
                <Text style={styles.name}>{motorista.nome}</Text>
                <View style={styles.ratingContainer}>
                  <Star color="#F59E0B" size={14} fill="#F59E0B" />
                  <Text style={styles.rating}>{motorista.nota}</Text>
                </View>
                <Text style={styles.vehicle}>{motorista.veiculo} - {motorista.placa}</Text>
              </View>
              <View style={styles.plateContainer}><Text style={styles.plate}>{motorista.placa}</Text></View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.chatBtn]}
                onPress={() => onNavigate('chat', { freightId: idDoFrete })}
              >
                <MessageCircle color="white" size={20} />
                <Text style={styles.chatText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.phoneBtn]}
                onPress={() => Linking.openURL(`tel:${motorista.telefone}`)}
              >
                <Phone color="#4B5563" size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.paymentActions}>
              <Text style={styles.infoHint}>Para concluir, confirmar pagamento e avaliar, acesse Histórico → Detalhes.</Text>
            </View>
          </View>
        )}

        {/* always-available chat access */}
        <TouchableOpacity
          style={styles.floatingChat}
          onPress={() => onNavigate('chat', { freightId: idDoFrete })}
        >
          <MessageCircle color="white" size={24} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.homeBtn}>
          <Home color="white" size={20} />
          <Text style={styles.homeText}>Voltar ao inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  driverMarker: {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  routeMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationMarker: { backgroundColor: theme.colors.error },
  routeMarkerText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 11 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  statusBox: {
    backgroundColor: theme.colors.secondary,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  statusTitle: { color: theme.colors.white, fontWeight: 'bold' },
  statusSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
    marginBottom: 12,
  },
  aiNotification: {
    backgroundColor: theme.colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
    alignSelf: 'center',
    ...theme.shadows.md,
  },
  aiText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 13 },
  driverHeader: { flexDirection: 'row', gap: 12, marginBottom: theme.spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.surfaceAlt },
  driverInfo: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 12, color: theme.colors.textSecondary },
  vehicle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  plateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    height: 24,
  },
  plate: { fontSize: 12, fontWeight: 'bold', color: theme.colors.text },
  paymentActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  infoHint: { flex: 1, color: theme.colors.textSecondary, fontSize: 12, textAlign: 'center' },
  releaseBtn: { flex: 1.3, backgroundColor: theme.colors.success, paddingVertical: 12, borderRadius: theme.borderRadius.lg, alignItems: 'center' },
  releaseText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 12 },
  reviewBtn: { flex: 1, backgroundColor: theme.colors.surfaceAlt, paddingVertical: 12, borderRadius: theme.borderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  reviewText: { color: theme.colors.text, fontWeight: 'bold', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chatBtn: { backgroundColor: theme.colors.accent, flex: 2 },
  chatText: { color: theme.colors.white, fontWeight: 'bold' },
  phoneBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    padding: 12,
    borderRadius: theme.borderRadius.round,
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.md,
  },
  floatingChat: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  homeText: { color: theme.colors.white, fontSize: 14, fontWeight: 'bold' },
});

export default FreightAccepted;
