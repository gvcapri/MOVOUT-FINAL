import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Keyboard, Image } from 'react-native';

import MapView, { Marker, Polyline } from 'react-native-maps';
import { ArrowLeft, Package, Weight, Timer, Zap, Calendar, Upload, Type, AlertCircle, CheckCircle, CreditCard, Smartphone, Check } from 'lucide-react-native';
import { theme } from '../../theme';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RequestFreight = ({ onNavigate }) => {
  const [selectedPriority, setSelectedPriority] = useState('today');
  const [objectDescription, setObjectDescription] = useState('');
  const [cargoWeight, setCargoWeight] = useState('50');
  const [isFragile, setIsFragile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiDetected, setAiDetected] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('pix');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistance, setRouteDistance] = useState(0); // meters -> km later

  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  // Localização do usuário para dar prioridade a resultados próximos
  const [userLocation, setUserLocation] = useState({ lat: -15.601, lon: -56.097 }); // Cuiabá como fallback

  const originDebounceRef = useRef(null);
  const destinationDebounceRef = useRef(null);

  const shortAddress = (value) => (value || '').trim().slice(0, 120);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // simple haversine formula fallback when we don't have a routed distance
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  };

  const calculatedDistance = useMemo(() => {
    // prefer routed distance when available
    if (routeDistance > 0) return routeDistance;
    if (!originCoords || !destinationCoords) return 0;
    return calculateDistance(originCoords.lat, originCoords.lon, destinationCoords.lat, destinationCoords.lon);
  }, [originCoords, destinationCoords, routeDistance]);

  const mapRegion = useMemo(() => {
    if (originCoords) {
      return {
        latitude: originCoords.lat,
        longitude: originCoords.lon,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }
    return {
      latitude: -15.601,
      longitude: -56.097,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [originCoords]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (originCoords && destinationCoords) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destinationCoords.lon},${destinationCoords.lat}?overview=full&geometries=geojson`;
          console.log('OSRM request', url, 'origin', originCoords, 'dest', destinationCoords);
          const response = await fetch(url);
          const data = await response.json();
          console.log('OSRM response', data);
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(coord => ({
              latitude: coord[1],
              longitude: coord[0]
            }));
            console.log('route coords count', coords.length);
            setRouteCoords(coords);
            // store routed distance (meters -> km)
            const dist = data.routes[0].distance || 0;
            setRouteDistance(Math.round((dist / 1000) * 100) / 100);
          }
        } catch (error) {
          console.error('Error fetching route:', error);
          setRouteCoords([]);
          setRouteDistance(0);
        }
      } else {
        setRouteCoords([]);
        setRouteDistance(0);
      }
    };
    fetchRoute();
  }, [originCoords, destinationCoords]);

  // Obter localização do usuário para bias de busca
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: current.coords.latitude, lon: current.coords.longitude });
        console.log('User location for search bias:', current.coords.latitude, current.coords.longitude);
      } catch (e) {
        console.warn('Could not get user location for search bias, using default', e);
      }
    };
    getUserLocation();
  }, []);

  // Load saved payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const stored = await AsyncStorage.getItem('paymentMethods');
        if (stored) {
          const methods = JSON.parse(stored);
          setPaymentMethods(methods);
          const defaultMethod = methods.find(m => m.isDefault);
          if (defaultMethod) setSelectedPaymentId(defaultMethod.id);
        }
      } catch (e) {
        console.warn('Error loading payment methods', e);
      }
    };
    loadPaymentMethods();
  }, []);

  // convert a Photon feature response into our suggestion format
  const mapPhotonFeature = (feature) => {
    const props = feature?.properties || {};
    const coord = feature?.geometry?.coordinates || [];
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const label = [
      props.name,
      props.street && props.housenumber ? `${props.street}, ${props.housenumber}` : props.street,
      props.district,
      props.city || props.county,
      props.state,
    ].filter(Boolean).join(' - ');

    return {
      label: shortAddress(label || props.name || 'Endereço selecionado'),
      lat,
      lon,
    };
  };

  const searchPhoton = async (query) => {
    // Passa lat/lon para o Photon priorizar resultados próximos ao usuário
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=pt&limit=5&lat=${userLocation.lat}&lon=${userLocation.lon}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map(mapPhotonFeature).filter(Boolean);
  };

  // direct Nominatim search, used as first attempt for suggestions
  const searchNominatim = async (query) => {
    // Cria um viewbox de ~100km ao redor da localização do usuário para priorizar resultados próximos
    const delta = 1.0; // ~111km em latitude
    const vbLeft = (userLocation.lon - delta).toFixed(4);
    const vbTop = (userLocation.lat + delta).toFixed(4);
    const vbRight = (userLocation.lon + delta).toFixed(4);
    const vbBottom = (userLocation.lat - delta).toFixed(4);
    const viewbox = `${vbLeft},${vbTop},${vbRight},${vbBottom}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&countrycodes=br`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        // Nominatim requires a User-Agent string identifying the application
        'User-Agent': 'MovoutApp/1.0 (movout@example.com)'
      },
    });
    if (!response.ok) {
      console.warn('Nominatim returned non-ok status', response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      return {
        label: shortAddress(item.display_name),
        lat,
        lon,
      };
    });
  };

  // helper that runs both geocoders in parallel and merges results
  // Photon tem melhor suporte a bias de localização, então vem primeiro
  const searchCombined = async (query) => {
    const results = [];
    try {
      const [n1, p1] = await Promise.all([
        searchNominatim(query).catch(e => { console.warn('nominatim error', e); return []; }),
        searchPhoton(query).catch(e => { console.warn('photon error', e); return []; }),
      ]);
      const seen = new Set();
      // Photon primeiro (melhor bias de localização), depois Nominatim
      for (const item of [...p1, ...n1]) {
        const key = `${item.lat}:${item.lon}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(item);
          if (results.length >= 6) break;
        }
      }
      // Ordenar por distância do usuário (mais perto primeiro)
      results.sort((a, b) => {
        const distA = Math.abs(a.lat - userLocation.lat) + Math.abs(a.lon - userLocation.lon);
        const distB = Math.abs(b.lat - userLocation.lat) + Math.abs(b.lon - userLocation.lon);
        return distA - distB;
      });
      // Limitar a 5 resultados
      results.splice(5);
    } catch (e) {
      console.warn('search combined failure', e);
    }
    return results;
  };

  const searchByDeviceGeocoder = async (query) => {
    try {
      const geocoded = await Location.geocodeAsync(query);
      if (!Array.isArray(geocoded) || geocoded.length === 0) return [];

      const unique = [];
      const seen = new Set();
      for (const item of geocoded.slice(0, 5)) {
        const lat = Number(item.latitude);
        const lon = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const key = `${lat.toFixed(5)}:${lon.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let label = shortAddress(query);
        try {
          const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          const first = reverse?.[0];
          if (first) {
            label = shortAddress([
              first.street,
              first.streetNumber,
              first.district,
              first.city || first.subregion,
              first.region,
            ].filter(Boolean).join(' - '));
          }
        } catch { }
        unique.push({
          label,
          lat,
          lon,
        });
      }
      return unique;
    } catch {
      return [];
    }
  };

  const searchAddress = (text, type) => {
    if (type === 'origin') {
      setOrigin(text);
      setOriginCoords(null);
      if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
      if (text.trim().length < 2) {
        setOriginSuggestions([]);
        return;
      }
      originDebounceRef.current = setTimeout(async () => {
        setIsSearchingOrigin(true);
        try {
          let results = await searchCombined(text.trim());
          if (results.length === 0) {
            results = await searchByDeviceGeocoder(text.trim());
          }
          console.log('origin results', text, results);
          if (results.length > 0) console.log('first suggestion coords', results[0].lat, results[0].lon);
          setOriginSuggestions(results);
        } catch (e) {
          console.warn('search error', e);
          setOriginSuggestions([]);
        } finally {
          setIsSearchingOrigin(false);
        }
      }, 350);
    } else {
      setDestination(text);
      setDestinationCoords(null);
      if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
      if (text.trim().length < 2) {
        setDestinationSuggestions([]);
        return;
      }
      destinationDebounceRef.current = setTimeout(async () => {
        setIsSearchingDest(true);
        try {
          let results = await searchCombined(text.trim());
          if (results.length === 0) {
            results = await searchByDeviceGeocoder(text.trim());
          }
          console.log('destination results', text, results);
          if (results.length > 0) console.log('first suggestion coords', results[0].lat, results[0].lon);
          setDestinationSuggestions(results);
        } catch (e) {
          console.warn('search error', e);
          setDestinationSuggestions([]);
        } finally {
          setIsSearchingDest(false);
        }
      }, 350);
    }
  };

  const handleSelectAddress = (item, type) => {
    if (type === 'origin') {
      setOrigin(item.label);
      setOriginCoords({ lat: item.lat, lon: item.lon });
      console.log('selected origin coords', item.lat, item.lon);
      setOriginSuggestions([]);
      return;
    }
    setDestination(item.label);
    setDestinationCoords({ lat: item.lat, lon: item.lon });
    console.log('selected destination coords', item.lat, item.lon);
    setDestinationSuggestions([]);
  };

  const resolveCoordsFromAddress = async (address) => {
    const geocoded = await Location.geocodeAsync(address);
    if (!geocoded || geocoded.length === 0) return null;
    return { lat: geocoded[0].latitude, lon: geocoded[0].longitude };
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permissão de localização negada.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = current.coords.latitude;
      const lon = current.coords.longitude;
      setOriginCoords({ lat, lon });

      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const first = reverse?.[0];
      if (first) {
        const label = [
          first.street,
          first.streetNumber,
          first.district,
          first.city || first.subregion,
          first.region,
        ].filter(Boolean).join(' - ');
        setOrigin(shortAddress(label || `${lat.toFixed(6)}, ${lon.toFixed(6)}`));
      } else {
        setOrigin(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
      }
      setOriginSuggestions([]);
    } catch {
      alert('Não foi possível obter sua localização.');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      analyzeObject(uri);
    }
  };

  const analyzeObject = async (uri) => {
    setIsAnalyzing(true);
    setAiError(null);
    setAiDetected(null);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: 'upload.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`${API_BASE_URL}/fretes/detectar-objeto`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();
      if (response.ok) {
        const finalValue = typeof data.objeto === 'string' ? data.objeto : JSON.stringify(data.objeto);
        setAiDetected(finalValue);
        setObjectDescription(finalValue);
      } else {
        setAiError(data.detail || 'Falha na IA');
      }
    } catch {
      setAiError('Erro de conexão com o servidor');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateFreight = async (selectedVehicle) => {
    setIsCreating(true);
    try {
      let resolvedOrigin = originCoords;
      let resolvedDestination = destinationCoords;

      if (!resolvedOrigin && origin?.trim()) {
        resolvedOrigin = await resolveCoordsFromAddress(origin.trim());
        if (resolvedOrigin) setOriginCoords(resolvedOrigin);
      }
      if (!resolvedDestination && destination?.trim()) {
        resolvedDestination = await resolveCoordsFromAddress(destination.trim());
        if (resolvedDestination) setDestinationCoords(resolvedDestination);
      }

      // ensure we actually have coordinates
      if (!resolvedOrigin || !resolvedDestination) {
        alert('Não foi possível obter coordenadas válidas para origem ou destino. Use uma sugestão da lista.');
        setIsCreating(false);
        return;
      }

      const computedDistance = (resolvedOrigin && resolvedDestination)
        ? calculateDistance(resolvedOrigin.lat, resolvedOrigin.lon, resolvedDestination.lat, resolvedDestination.lon)
        : 0;

      const selectedPayment = paymentMethods.find(m => m.id === selectedPaymentId);
      let loggedUser = null;
      try {
        const storedUser = (await AsyncStorage.getItem('userData')) || (await AsyncStorage.getItem('user'));
        loggedUser = storedUser ? JSON.parse(storedUser) : null;
      } catch (e) {
        console.warn('Não foi possível ler usuário logado para criar frete', e);
      }

      const freightData = {
        descricao: objectDescription || (aiDetected ? `${aiDetected}` : 'Frete enviado via app'),
        cliente_email: loggedUser?.email || null,
        id_cliente: loggedUser?.id_cliente || null,
        id_pessoa: loggedUser?.id_pessoa || null,
        peso_estimado: parseFloat(cargoWeight) || 0,
        status: 'aberto',
        origem: shortAddress(origin),
        destino: shortAddress(destination),
        origem_lat: resolvedOrigin ? resolvedOrigin.lat : null,
        origem_lng: resolvedOrigin ? resolvedOrigin.lon : null,
        destino_lat: resolvedDestination ? resolvedDestination.lat : null,
        destino_lng: resolvedDestination ? resolvedDestination.lon : null,
        distancia_km: computedDistance || 0,
        tipo_veiculo: selectedVehicle ? selectedVehicle.name : null,
        objeto_ia: aiDetected || null,
        prioridade: selectedPriority,
        fragil: isFragile,
        metodo_pagamento: selectedPaymentId === 'pix'
          ? { tipo: 'pix', label: 'PIX' }
          : selectedPayment ? { tipo: selectedPayment.type, label: selectedPayment.label } : null,
      };

      const response = await fetch(`${API_BASE_URL}/fretes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(freightData),
      });

      if (response.ok) {
        const data = await response.json();
        onNavigate('negotiation', { freightId: data.id });
      } else {
        alert('Erro ao criar frete no servidor');
      }
    } catch {
      alert('Não foi possível conectar ao servidor para criar o frete');
    } finally {
      setIsCreating(false);
    }
  };

  const priorities = [
    { id: 'urgent', label: 'Urgente', subtitle: 'até 20 min', icon: Zap, color: '#F97316' },
    { id: 'today', label: 'Mesmo dia', subtitle: 'hoje', icon: Timer, color: '#F4A259' },
    { id: 'schedule', label: 'Agendar', subtitle: 'escolher data', icon: Calendar, color: '#EAB308' },
  ];

  const vehicles = [
    { name: 'Carro', icon: '🚗', capacity: 'Até 100kg', price: 'Cálculo automático', time: '45 min' },
    { name: 'Van', icon: '🚐', capacity: 'Até 500kg', price: 'Cálculo automático', time: '1h' },
    { name: 'Caminhão', icon: '🚚', capacity: 'Até 3 ton', price: 'Cálculo automático', time: '1h 30min' },
  ];

  const getPaymentIcon = (type) => {
    switch (type) {
      case 'credit': return '💳';
      case 'debit': return '💳';
      case 'pix': return '⚡'
      default: return '💰';
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'credit': return 'Crédito';
      case 'debit': return 'Débito';
      case 'pix': return 'PIX';
      default: return type;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Novo Frete</Text>
        <Text style={styles.headerSubtitle}>Solicite seu transporte</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40, paddingTop: theme.spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={styles.addressCard}>
          <View style={styles.addressItem}>
            <View style={[styles.dot, styles.dotOrigin]} />
            <View style={styles.addressContent}>
              <View style={styles.addressHeaderRow}>
                <Text style={styles.addressLabel}>Origem (Coleta)</Text>
                <TouchableOpacity style={styles.useLocationBtn} onPress={handleUseCurrentLocation}>
                  <Text style={styles.useLocationText}>Usar localização</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.addressInput}
                value={origin}
                onChangeText={(text) => searchAddress(text, 'origin')}
                placeholder="Digite o endereço de coleta"
              />
              {isSearchingOrigin && <Text style={styles.searchingText}>Buscando...</Text>}
              {originSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {originSuggestions.map((item, idx) => (
                    <TouchableOpacity key={`${item.label}-${idx}`} style={styles.suggestionItem} onPress={() => handleSelectAddress(item, 'origin')}>
                      <Text style={styles.suggestionText} numberOfLines={2}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.addressItem}>
            <View style={[styles.dot, styles.dotDest]} />
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Destino (Entrega)</Text>
              <TextInput
                style={styles.addressInput}
                value={destination}
                onChangeText={(text) => searchAddress(text, 'destination')}
                placeholder="Digite o endereço de entrega"
              />
              {isSearchingDest && <Text style={styles.searchingText}>Buscando...</Text>}
              {destinationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {destinationSuggestions.map((item, idx) => (
                    <TouchableOpacity key={`${item.label}-${idx}`} style={styles.suggestionItem} onPress={() => handleSelectAddress(item, 'destination')}>
                      <Text style={styles.suggestionText} numberOfLines={2}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rota no mapa</Text>
          <MapView style={styles.mapPreview} region={mapRegion}>
            {originCoords && <Marker coordinate={{ latitude: originCoords.lat, longitude: originCoords.lon }} title="Origem" pinColor="black" />}
            {destinationCoords && <Marker coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lon }} title="Destino" pinColor="#F97316" />}
            {originCoords && destinationCoords && routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#1E3A8A"
                strokeWidth={4}
              />
            )}
          </MapView>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package color="#F4A259" size={20} />
            <Text style={styles.cardTitle}>Informações da Carga</Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Weight color="#4B5563" size={16} />
                <Text style={styles.infoLabel}>Peso</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={styles.weightInput}
                  value={cargoWeight}
                  onChangeText={setCargoWeight}
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoLabel}>Distância</Text>
              </View>
              <Text style={styles.infoValue}>{calculatedDistance > 0 ? `${calculatedDistance} km` : '-- km'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.fragileButton, isFragile && styles.fragileActive]}
            onPress={() => setIsFragile(!isFragile)}
          >
            <AlertCircle color={isFragile ? '#DC2626' : '#7E22CE'} size={18} />
            <Text style={[styles.fragileText, isFragile && styles.fragileTextActive]}>
              {isFragile ? 'Carga Frágil' : 'Marcar como Frágil'}
            </Text>
          </TouchableOpacity>

          {isFragile && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>Requer manuseio delicado e cuidadoso</Text>
            </View>
          )}

          <View style={styles.uploadSection}>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                aiDetected && styles.uploadButtonSuccess,
                aiError && styles.uploadButtonError,
              ]}
              onPress={handlePickImage}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <Text style={styles.uploadText}>Analisando objeto... (Mantenha o app aberto)</Text>
              ) : aiError ? (
                <>
                  <AlertCircle color="#EF4444" size={18} />
                  <Text style={[styles.uploadText, { color: '#EF4444' }]}>{aiError}. Tentar novamente?</Text>
                </>
              ) : aiDetected ? (
                <>
                  <CheckCircle color="#10B981" size={18} />
                  <Text style={[styles.uploadText, { color: '#10B981' }]}>IA Detectou: {aiDetected}</Text>
                </>
              ) : (
                <>
                  <Upload color="#F4A259" size={18} />
                  <Text style={styles.uploadText}>Anexar Foto para IA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.descSection}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Type color="#F4A259" size={18} />
              <Text style={styles.descLabel}>Descrever tipo de objeto</Text>
            </View>
            <TextInput
              style={styles.descInput}
              value={objectDescription}
              onChangeText={setObjectDescription}
              placeholder="Ex: Eletrônicos frágeis, etc."
              multiline
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Prioridade do frete</Text>
          <View style={styles.priorityGrid}>
            {priorities.map((p) => {
              const isSelected = selectedPriority === p.id;
              const Icon = p.icon;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.priorityOption,
                    isSelected && styles.prioritySelected,
                    isSelected && {
                      borderColor: p.color,
                      backgroundColor: p.id === 'urgent' ? '#FFF7ED' : '#EFF6FF',
                    },
                  ]}
                  onPress={() => setSelectedPriority(p.id)}
                >
                  <View style={[styles.priorityIcon, { backgroundColor: p.color }]}>
                    <Icon color="#fff" size={20} />
                  </View>
                  <Text style={[styles.priorityLabel, isSelected && { color: p.color }]}>{p.label}</Text>
                  <Text style={styles.prioritySubtitle}>{p.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionTitle, { marginLeft: 4, marginBottom: 16 }]}>Escolha o veículo</Text>
          {vehicles.map((v, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.vehicleCard, isCreating && { opacity: 0.5 }]}
              onPress={() => handleCreateFreight(v)}
              disabled={isCreating}
            >
              <View style={[styles.vehicleIcon, { backgroundColor: '#F4A259' }]}>
                <Text style={{ fontSize: 24 }}>{v.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>{v.name}</Text>
                <Text style={styles.vehicleDetails}>{v.capacity} • {v.time}</Text>
              </View>
              <Text style={styles.vehiclePrice}>{v.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Método de Pagamento */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CreditCard color="#F4A259" size={20} />
            <Text style={styles.cardTitle}>Método de Pagamento</Text>
          </View>

          <View style={styles.paymentList}>
            {/* PIX Option (always available) */}
            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedPaymentId === 'pix' && styles.paymentOptionSelected,
              ]}
              onPress={() => setSelectedPaymentId('pix')}
              activeOpacity={0.7}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={[styles.paymentIconBox, { backgroundColor: '#E0F2F1' }]}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                </View>
                <View>
                  <Text style={styles.paymentLabel}>PIX</Text>
                  <Text style={styles.paymentType}>Pagamento instantâneo</Text>
                </View>
              </View>
              {selectedPaymentId === 'pix' && (
                <View style={styles.paymentCheck}>
                  <Check color="#fff" size={14} />
                </View>
              )}
            </TouchableOpacity>

            {/* Registered card methods */}
            {paymentMethods.map((method) => {
              const isSelected = selectedPaymentId === method.id;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentOption,
                    isSelected && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setSelectedPaymentId(method.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentOptionLeft}>
                    <View style={[
                      styles.paymentIconBox,
                      method.type === 'credit' && { backgroundColor: '#EDE7F6' },
                      method.type === 'debit' && { backgroundColor: '#E3F2FD' },
                    ]}>
                      <Text style={{ fontSize: 18 }}>{getPaymentIcon(method.type)}</Text>
                    </View>
                    <View>
                      <Text style={styles.paymentLabel}>{method.label}</Text>
                      <Text style={styles.paymentType}>{getPaymentTypeLabel(method.type)}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View style={styles.paymentCheck}>
                      <Check color="#fff" size={14} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.addMorePaymentBtn}
              onPress={() => onNavigate('payments')}
            >
              <Text style={styles.addMorePaymentText}>+ Gerenciar cartões</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingTop: 50, paddingBottom: theme.spacing.lg, backgroundColor: theme.colors.primary },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.white, marginBottom: 8 },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: theme.spacing.lg },
  addressCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    zIndex: 10,
  },
  addressItem: { flexDirection: 'row', gap: 12, zIndex: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  dotOrigin: { backgroundColor: theme.colors.accent },
  dotDest: { backgroundColor: theme.colors.primary },
  addressContent: { flex: 1 },
  addressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressLabel: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 },
  addressInput: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },

  content: { flex: 1 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    marginTop: 0,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  mapPreview: { height: 180, borderRadius: theme.borderRadius.lg, overflow: 'hidden', marginTop: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: theme.colors.text, fontWeight: 'bold' },
  infoGrid: { flexDirection: 'row', gap: 12 },
  infoItem: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoHeader: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  infoLabel: { fontSize: 12, color: theme.colors.textSecondary },
  weightInput: { fontSize: 16, fontWeight: '600', color: theme.colors.text, width: 60, padding: 0 },
  unitText: { fontSize: 12, color: theme.colors.textSecondary, marginLeft: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },

  fragileButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    marginTop: theme.spacing.md,
    backgroundColor: '#F3E8FF',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  fragileActive: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  fragileText: { color: '#7E22CE', fontWeight: '600' },
  fragileTextActive: { color: theme.colors.error },
  warningBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    borderRadius: 4,
  },
  warningText: { color: '#991B1B', fontSize: 12 },

  uploadSection: { marginVertical: theme.spacing.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  uploadButtonSuccess: { backgroundColor: '#ECFDF5', borderColor: theme.colors.success, borderStyle: 'solid' },
  uploadButtonError: { backgroundColor: '#FEF2F2', borderColor: theme.colors.error, borderStyle: 'solid' },
  uploadText: { color: theme.colors.text, fontSize: 13, fontWeight: '500', flex: 1 },

  descSection: { marginBottom: 10 },
  descLabel: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  descInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg, padding: 12, height: 80, textAlignVertical: 'top', color: theme.colors.text },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  priorityGrid: { flexDirection: 'row', gap: 8 },
  priorityOption: {
    flex: 1,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
  },
  prioritySelected: {},
  priorityIcon: { width: 40, height: 40, borderRadius: theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  priorityLabel: { fontSize: 12, color: theme.colors.text, marginBottom: 2, fontWeight: '600' },
  prioritySubtitle: { fontSize: 10, color: theme.colors.textSecondary },

  vehicleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  vehicleIcon: { width: 56, height: 56, borderRadius: theme.borderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  vehicleName: { fontSize: 16, color: theme.colors.text, fontWeight: '500' },
  vehicleDetails: { fontSize: 12, color: theme.colors.textSecondary },
  vehiclePrice: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 16 },

  useLocationBtn: { backgroundColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.sm },
  useLocationText: { color: theme.colors.white, fontSize: 10, fontWeight: 'bold' },
  searchingText: { color: theme.colors.textSecondary, fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  suggestionsContainer: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.lg,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 200,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
  },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  suggestionText: { fontSize: 13, color: theme.colors.text },

  // Payment method styles
  noPaymentBox: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  noPaymentText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 10,
  },
  addPaymentBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
  },
  addPaymentBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  paymentList: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  paymentOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFBEB',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  paymentType: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  paymentCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePaymentBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  addMorePaymentText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});

export default RequestFreight;
