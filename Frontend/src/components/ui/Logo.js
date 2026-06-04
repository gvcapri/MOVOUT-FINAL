import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export const Logo = ({ size = 'md' }) => {
    // Define sizes based on prop
    const getDimensions = () => {
        switch (size) {
            case 'lg':
                // Aspect ratio 1123/794 ~= 1.41
                return { width: 300, height: 215 };
            case 'sm':
                return { width: 180, height: 55 };
            case 'md':
            default:
                return { width: 240, height: 170 };
        }
    };

    const { width, height } = getDimensions();

    return (
        <View style={styles.container}>
            <Image
                source={require('../../../assets/logo.png')}
                style={{ width, height }}
                resizeMode="contain"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
