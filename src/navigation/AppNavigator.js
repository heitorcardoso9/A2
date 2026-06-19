import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import FeedScreen from '../screens/FeedScreen';
import ChatsListScreen from '../screens/ChatsListScreen';
import CreateActivityScreen from '../screens/CreateActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import InterestedScreen from '../screens/InterestedScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Feed: 'home',
  Chats: 'chatbubble-ellipses',
  Criar: 'add-circle',
  Perfil: 'person',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0E5C46',
        tabBarInactiveTintColor: '#8B958F',
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Chats" component={ChatsListScreen} />
      <Tab.Screen name="Criar" component={CreateActivityScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ isLoggedIn }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
          <Stack.Screen name="Interested" component={InterestedScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}