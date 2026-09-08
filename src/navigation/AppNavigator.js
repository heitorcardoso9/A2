import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import FeedScreen from '../screens/FeedScreen';
import ChatsListScreen from '../screens/ChatsListScreen';
import CreateActivityScreen from '../screens/CreateActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import { colors } from '../constants/theme';

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
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerBackTitleVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#8B958F',
        tabBarPressOpacity: 1,
        tabBarPressColor: 'transparent',
        tabBarIcon: ({ color, size }) => (
          <View pointerEvents="none">
            <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Feed' }} />
      <Tab.Screen name="Chats" component={ChatsListScreen} options={{ title: 'Conversas' }} />
      <Tab.Screen name="Criar" component={CreateActivityScreen} options={{ title: 'Criar atividade' }} />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Perfil',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('EditProfile')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Ionicons name="create-outline" size={24} color={colors.primary} style={{ marginRight: 8 }} />
            </TouchableOpacity>
          ),
        })}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ isLoggedIn }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ActivityDetail"
            component={ActivityDetailScreen}
            options={{ headerShown: true, headerBackTitle: 'Voltar', title: 'Atividade', headerTitleAlign: 'center' }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: true, headerBackTitle: 'Voltar', headerTitleAlign: 'center' }}
          />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, headerBackTitle: 'Voltar', title: 'Editar perfil' }} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: true, headerBackTitle: 'Voltar', title: 'Perfil' }} />
          <Stack.Screen name="EditActivity" component={CreateActivityScreen} options={{ headerShown: true, headerBackTitle: 'Voltar', title: 'Editar atividade' }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}