import React from 'react';
import { View, Text, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/app/context/AuthContext';
import { Truck, History as HistoryIcon, MessageSquare, HelpCircle, User } from 'lucide-react-native';

// AUTH SCREENS
import Login from './src/app/pages/auth/Login';
import Register from './src/app/pages/auth/Register';
import ForgotPassword from './src/app/pages/auth/ForgotPassword';

// APP SCREENS
import Home from './src/app/pages/app/Home';
import History from './src/app/pages/app/History';
import Profile from './src/app/pages/app/Profile';
import Negotiation from './src/app/pages/app/Negotiation';
import Chat from './src/app/pages/app/Chat';
import ChatDetail from './src/app/pages/app/ChatDetail';
import ChatList from './src/app/pages/app/ChatList';
import RideDetail from './src/app/pages/app/RideDetail';
import FAQ from './src/app/pages/app/FAQ';

/* COLOCAR AS REQUISIÇÕES AXIOS AQUI */
import axios from 'axios';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          elevation: 5,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10
        },
        tabBarActiveTintColor: '#FF914D', // Orange
        tabBarInactiveTintColor: '#9CA3AF', // Gray
        tabBarLabelStyle: { fontSize: 11, fontWeight: 'bold' }
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarLabel: 'Fretes',
          tabBarIcon: ({ color, size }) => (
            <Truck color={color} size={size} />
          )
        }}
      />
      <Tab.Screen
        name="History"
        component={History}
        options={{
          tabBarLabel: 'Histórico',
          tabBarIcon: ({ color, size }) => (
            <HistoryIcon color={color} size={size} />
          )
        }}
      />
      <Tab.Screen
        name="ChatList"
        component={ChatList}
        options={{
          tabBarLabel: 'Conversas',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          )
        }}
      />
      <Tab.Screen
        name="FAQ"
        component={FAQ}
        options={{
          tabBarLabel: 'Ajuda',
          tabBarIcon: ({ color, size }) => (
            <HelpCircle color={color} size={size} />
          )
        }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          )
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              initialRouteName="Login"
              screenOptions={{
                headerShown: false,
              }}
            >
              {/* Auth */}
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="Register" component={Register} />
              <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

              {/* App */}
              <Stack.Screen name="Home" component={MainTabs} />
              <Stack.Screen name="Negotiation" component={Negotiation} />
              <Stack.Screen name="Chat" component={Chat} />
              <Stack.Screen name="ChatDetail" component={ChatDetail} />
              <Stack.Screen name="ChatList" component={ChatList} />
              <Stack.Screen name="RideDetail" component={RideDetail} />

            </Stack.Navigator>

            <StatusBar style="light" />
          </View>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
