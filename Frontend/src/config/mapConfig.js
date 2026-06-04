// Configuração da API do Mapa
// Em React Native (Expo), configure suas variáveis de ambiente ou use expo-constants se necessário.
// Certifique-se de configurar a API key no app.json para Android/iOS nativo.

export const MAP_CONFIG = {
    // Google Maps
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',

    // Mapbox (alternativa)
    mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || '',

    // Configurações padrão do mapa
    defaultCenter: {
        lat: -15.7942, // Brasília
        lng: -47.8822
    },
    defaultZoom: 13
};
