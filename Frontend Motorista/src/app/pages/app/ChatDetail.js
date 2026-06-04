import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Text from '../../layouts/Components/Text';
import { theme } from '../../theme';
import { API_BASE_URL, WS_BASE_URL } from '../../../api/config';

export default function ChatDetail({ route, navigation }) {
  const { name, chatId } = route.params || { name: 'Chat', chatId: null };

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const ws = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ws/chat/${chatId}/historico?role=driver`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setMessages(data);
        }
      } catch (err) {
        console.error("Erro ao puxar mensagens do banco:", err);
      }
    };

    fetchHistory();

    const wsUrl = `${WS_BASE_URL}/ws/chat/${chatId}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("Motorista conectado ao chat:", wsUrl);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => {
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      } catch (e) {
        console.error("Erro no chat", e);
      }
    };

    return () => {
      ws.current?.close();
      setMessages([]);
    };
  }, [chatId]);



  const marcarCorridaConcluida = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/fretes/${chatId}/motorista-concluir`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao marcar corrida como concluída');
      alert('Corrida concluída. Agora você pode avaliar o cliente apenas uma vez.');
    } catch (e) { alert(e.message || 'Não foi possível marcar a corrida como concluída.'); }
  };

  const avaliarCliente = async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/fretes/${chatId}/avaliar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_avaliador: 'MOTORISTA', tipo_avaliado: 'CLIENTE', nota: 5, comentario: 'Cliente avaliado pelo motorista' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao avaliar cliente');
      alert(data?.resultado_pagamento?.liberado ? 'Cliente avaliado. As duas avaliações foram feitas e o saldo foi liberado.' : 'Cliente avaliado. O saldo será liberado quando o cliente também avaliar.');
    } catch (e) { alert(e.message || 'Não foi possível avaliar cliente.'); }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMsg = {
      text: inputText.trim(),
      sender: 'driver',
    };

    setInputText('');

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(newMsg));
    }
  };

  const renderMessage = ({ item: msg, index }) => {
    const isMe = msg.sender === 'driver';
    const time = msg.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowRight]}>
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextRight : styles.bubbleTextLeft]}>
            {msg.text}
          </Text>
          <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeRight : styles.bubbleTimeLeft]}>
            {time}{isMe ? ' ✓✓' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#f59e0bff" />

      {/* Header */}
      <View style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text weight="bold" style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
            </View>
            <View>
              <Text weight="bold" style={styles.headerTitle}>{name}</Text>
              <Text style={styles.headerSub}>Online agora</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Negotiation')} style={styles.actionBtn}>
            <Text style={{ fontSize: 18 }}>🤝</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat body */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, i) => item.id?.toString() || i.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptyHint}>Comece a conversa sobre o frete!</Text>
            </View>
          }
        />

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={marcarCorridaConcluida}><Text style={styles.quickBtnText}>Corrida concluída</Text></TouchableOpacity>
          <TouchableOpacity style={styles.quickBtnAlt} onPress={avaliarCliente}><Text style={styles.quickBtnAltText}>Avaliar cliente ⭐</Text></TouchableOpacity>
        </View>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            placeholder="Digite sua mensagem..."
            style={styles.input}
            placeholderTextColor="#BCBCBC"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            activeOpacity={0.7}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const HEADER_BG = '#f59e0bff';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },

  /* ─── Header ─── */
  headerSafe: {
    backgroundColor: HEADER_BG,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ─── Body ─── */
  body: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  /* ─── Empty state ─── */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#999',
  },
  emptyHint: {
    fontSize: 14,
    color: '#BCBCBC',
    marginTop: 4,
  },

  /* ─── Message bubbles ─── */
  msgRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  msgRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: HEADER_BG,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    elevation: 1,
    shadowColor: HEADER_BG,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  bubbleLeft: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextRight: {
    color: '#FFF',
  },
  bubbleTextLeft: {
    color: '#333',
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeRight: {
    color: 'rgba(255,255,255,0.7)',
  },
  bubbleTimeLeft: {
    color: '#AAA',
  },

  /* ─── Input bar ─── */
  quickActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, backgroundColor: '#FFF' },
  quickBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  quickBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  quickBtnAlt: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  quickBtnAltText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 44 : 42,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F1F3',
    borderRadius: 22,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#333',
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HEADER_BG,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: HEADER_BG,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#DDD',
    elevation: 0,
    shadowOpacity: 0,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});