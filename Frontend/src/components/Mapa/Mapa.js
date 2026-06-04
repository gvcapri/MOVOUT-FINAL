import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const Mapa = ({ onLocationSelect }) => {
    return (
        <View style={styles.container}>
            <MapView style={styles.map} />
        </View>
    );
};
const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { width: '100%', height: '100%' }
});
export default Mapa;
