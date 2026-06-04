import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function Logo({ size = 'md' }) {
    const getDimensions = () => {
        switch (size) {
            case 'lg':
                return { width: 300, height: 215 };
            case 'sm':
                return { width: 160, height: 48 };
            case 'md':
            default:
                return { width: 240, height: 170 };
        }
    };

    const { width, height } = getDimensions();

    return (
        <View style={styles.container}>
            <Image
                source={require('../../../../assets/logo.png')}
                style={{ width, height }}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
