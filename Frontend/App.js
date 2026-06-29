import React, { useState, useEffect } from 'react';

// ensure any accidental references to driverLocation don't crash
// this variable is not used directly by the client, but some
// components from the sibling project (in the workspace) might
// still reference it when Metro bundles everything. Declaring
// it here prevents `ReferenceError: Property 'driverLocation' doesn't exist`.
// if other code needs it, they can assign to global.driverLocation.
var driverLocation; // intentionally uninitialized
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Placeholder imports - will be replaced as components are migrated
import Splash from './src/components/Splash/Splash';
import Login from './src/components/Login/Login';
import Register from './src/components/Register/Register';
import ForgotPassword from './src/components/ForgotPassword/ForgotPassword';
import Home from './src/components/Home/Home';
import RequestFreight from './src/components/RequestFreight/RequestFreight';
import Negotiation from './src/components/Negotiation/Negotiation';
import FreightAccepted from './src/components/FreightAccepted/FreightAccepted';
import FreightDetails from './src/components/FreightDetails/FreightDetails';
import History from './src/components/History/History';
import Chat from './src/components/Chat/Chat';
import Profile from './src/components/Profile/Profile';
import PaymentMethods from './src/components/Profile/PaymentMethods';
import EditProfile from './src/components/Profile/EditProfile';
import FAQ from './src/components/FAQ/FAQ';
import FreightSummary from './src/components/FreightSummary/FreightSummary';

// Tipos de telas disponíveis
export const Screen = {
  SPLASH: 'splash',
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT: 'forgot',
  HOME: 'home',
  REQUEST: 'request',
  NEGOTIATION: 'negotiation',
  ACCEPTED: 'accepted',
  FREIGHT_DETAILS: 'freightDetails',
  HISTORY: 'history',
  CHAT: 'chat',
  PROFILE: 'profile',
  PAYMENTS: 'payments',
  EDIT_PROFILE: 'editProfile',
  FAQ: 'faq',
  SUMMARY: 'summary',
};

function App() {
  const [currentScreen, setCurrentScreen] = useState(Screen.SPLASH);
  const [screenParams, setScreenParams] = useState({});
  console.log('--- [APP] Renderizando App. Tela atual:', currentScreen, 'Params:', screenParams);

  useEffect(() => {
    console.log('--- [APP] useEffect iniciado. Iniciando timer de 2.6s... ---');
    // Aguarda o Splash terminar (2.5s) antes de verificar autenticação
    const splashTimer = setTimeout(async () => {
      console.log('--- [APP] Timer de 2.6s finalizado. Verificando AsyncStorage... ---');
      try {
// Login sempre manual para testes: o Splash direciona para a tela de login.
      } catch (e) {
        console.error(e);
      }
    }, 2600);

    return () => clearTimeout(splashTimer);
  }, []);

  const handleNavigate = (screen, params = {}) => {
    setScreenParams(params);
    setCurrentScreen(screen);
  };

  const handleLogin = async (userData) => {
    // Avoid duplicate storing or just keep in sync. Login.js already stored it anyway.
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
    setCurrentScreen(Screen.HOME);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('userToken'); // Clean token too
    setCurrentScreen(Screen.LOGIN);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.SPLASH:
        return <Splash onNavigate={handleNavigate} />;
      case Screen.LOGIN:
        return <Login onNavigate={handleNavigate} onLogin={handleLogin} />;
      case Screen.REGISTER:
        return <Register onNavigate={handleNavigate} onLogin={handleLogin} />;
      case Screen.FORGOT:
        return <ForgotPassword onNavigate={handleNavigate} />;
      case Screen.HOME:
        return <Home onNavigate={handleNavigate} />;
      case Screen.REQUEST:
        return <RequestFreight onNavigate={handleNavigate} />;
      case Screen.NEGOTIATION:
        return <Negotiation onNavigate={handleNavigate} freightId={screenParams.freightId} />;
      case Screen.ACCEPTED:
        return <FreightAccepted onNavigate={handleNavigate} freightId={screenParams.freightId} />;
      case Screen.FREIGHT_DETAILS:
        return <FreightDetails onNavigate={handleNavigate} freightId={screenParams.freightId} />;
      case Screen.HISTORY:
        return <History onNavigate={handleNavigate} />;
      case Screen.CHAT:
        return <Chat onNavigate={handleNavigate} freteId={screenParams.freightId} />;
      case Screen.PROFILE:
        return <Profile onNavigate={handleNavigate} onLogout={handleLogout} />;
      case Screen.PAYMENTS:
        return <PaymentMethods onNavigate={handleNavigate} from={screenParams?.from} />;
      case Screen.SUMMARY:
        return <FreightSummary onNavigate={handleNavigate} freightId={screenParams.freightId} />;
      case Screen.EDIT_PROFILE:
        return <EditProfile onNavigate={handleNavigate} />;
      case Screen.FAQ:
        return <FAQ onNavigate={handleNavigate} />;
      default:
        return <Splash onNavigate={handleNavigate} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;
