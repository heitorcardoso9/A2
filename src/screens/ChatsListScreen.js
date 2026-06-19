import React from 'react';
import { View, Text, Button } from 'react-native';

export default function ChatsListScreen({ navigation }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Lista de conversas</Text>
      <Button title="Abrir chat (exemplo)" onPress={() => navigation.navigate('Chat')} />
    </View>
  );
}