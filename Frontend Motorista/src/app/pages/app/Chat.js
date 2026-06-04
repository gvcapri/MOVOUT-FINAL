import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from '../../layouts/Components/Text';
import AppLayout from '../../layouts/Layouts/AppLayout';
import { theme } from '../../theme';

export default function Chat({ navigation, route }) {
  const chatId = route?.params?.chatId || route?.params?.freteId;
  const name = route?.params?.name || 'Cliente';
  return (
    <AppLayout title="Chat">
      <View style={styles.container}>
        <Text style={styles.emoji}>💬</Text>
        <Text style={styles.title}>Chat real do frete</Text>
        <Text style={styles.description}>Esta tela antiga foi substituída para evitar mensagens mockadas. O chat real usa WebSocket e salva no banco.</Text>
        <TouchableOpacity style={styles.button} onPress={() => chatId ? navigation.navigate('ChatDetail', { chatId, name }) : navigation.navigate('ChatList')}>
          <Text style={styles.buttonText}>{chatId ? 'Abrir chat real' : 'Voltar para conversas'}</Text>
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 54, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
  description: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  button: { marginTop: 20, backgroundColor: theme.colors.primary, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  buttonText: { color: '#FFF', fontWeight: 'bold' },
});
