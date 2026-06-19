import React from 'react';
import { View, Text, Button } from 'react-native';

export default function ActivityDetailScreen({ navigation, route }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Detalhe da atividade #{route.params?.id}</Text>
      <Button title="Ver interessados" onPress={() => navigation.navigate('Interested')} />
      <Button title="Voltar" onPress={() => navigation.goBack()} />
    </View>
  );
}