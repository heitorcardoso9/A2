import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import useUserProfile from '../hooks/useUserProfile';

export default function UserAvatar({ userId, fallbackEmail, size = 38 }) {
    const profile = useUserProfile(userId);
    const email = profile?.email || fallbackEmail || '';
    const iniciais = email.slice(0, 2).toUpperCase() || '?';
    const photoUrl = profile?.profilePhotoUrl;
    const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

    if (photoUrl) {
        return <Image source={{ uri: photoUrl }} style={dimensionStyle} />;
    }
    return (
        <View style={[styles.placeholder, dimensionStyle]}>
            <Text style={[styles.text, { fontSize: size * 0.34 }]}>{iniciais}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    placeholder: { backgroundColor: '#E3F0EA', alignItems: 'center', justifyContent: 'center' },
    text: { fontWeight: '700', color: '#0A4334' },
});