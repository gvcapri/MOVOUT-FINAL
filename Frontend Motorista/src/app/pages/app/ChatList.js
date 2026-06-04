import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../../layouts/Components/Text';
import AppLayout from '../../layouts/Layouts/AppLayout';
import { API_BASE_URL } from '../../../api/config';
import { useAuth } from '../../context/AuthContext';

export default function ChatList({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    const motoristaId = user?.id_motorista || user?.id || user?.id_pessoa || 1;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/motoristas/${motoristaId}/chats`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setChats(data);
      } else {
        setChats([]);
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const renderItem = ({ item }) => {
    const title = item.cliente || `Frete #${item.id}`;
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('ChatDetail', { chatId: item.id, name: title })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{title.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.row}>
            <Text style={styles.name}>{title}</Text>
            <Text style={styles.time}>{String(item.status || '').toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.origem || 'Origem'} → {item.destino || 'Destino'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AppLayout title="Conversas">
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color="#FF914D" />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Carregando conversas...</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 48 }}>💬</Text>
              <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 12 }}>
                Nenhuma conversa liberada ainda
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>
                As conversas aparecem depois que o frete é aceito.
              </Text>
            </View>
          }
        />
      )}
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 10 },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    backgroundColor: '#FF914D'
  },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  chatInfo: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  time: { fontSize: 12, color: '#999' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1, marginRight: 10 },
});
