import React from 'react';
import { View, Text, Button } from 'react-native';

export default function FeedScreen({ navigation }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Feed de atividades</Text>
      <Button title="Ver detalhe (exemplo)" onPress={() => navigation.navigate('ActivityDetail', { id: 1 })} />
    </View>
  );
}