import React from 'react';
import { View, Text, Button } from 'react-native';

export default function InterestedScreen({ navigation }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Lista de interessados</Text>
      <Button title="Abrir chat" onPress={() => navigation.navigate('Chat')} />
    </View>
  );
}