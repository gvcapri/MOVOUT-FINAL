import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, Send } from 'lucide-react-native';
import { theme } from '../../theme';
import { API_BASE_URL, WS_BASE_URL } from '../../api/config';
import { Text } from '../ui/Text';

const Chat = ({ onNavigate, freteId, route }) => {
  const currentFreteId = route?.params?.freteId || freteId || route?.params?.freightId;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const ws = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!currentFreteId) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/ws/chat/${currentFreteId}/historico?role=user`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setMessages(data);
      } catch (err) { console.error('Erro buscando histórico do chat:', err); }
    };
    fetchHistory();
    ws.current = new WebSocket(`${WS_BASE_URL}/ws/chat/${currentFreteId}`);
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => prev.some((m) => String(m.id) === String(data.id)) ? prev : [...prev, data]);
      } catch (e) { console.error('Erro no WebSocket do chat:', e); }
    };
    return () => ws.current?.close();
  }, [currentFreteId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ text, sender: 'user' }));
    setInputText('');
  };

  const renderItem = ({ item }) => {
    const mine = item.sender === 'user' || item.tipo_remetente === 'CLIENTE';
    return (
      <View style={[styles.row, mine && styles.rowRight]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.messageText, mine && styles.messageMine]}>{item.text || item.conteudo}</Text>
          <Text style={[styles.timeText, mine && styles.timeMine]}>{item.time || ''}{mine ? ' ✓✓' : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('history')} style={styles.backButton}>
          <ArrowLeft color={theme.colors.white} size={24} />
        </TouchableOpacity>
        <View>
          <Text size="lg" weight="bold" style={styles.headerTitle}>Chat do Frete</Text>
          <Text size="sm" style={styles.headerSubtitle}>Frete #{currentFreteId}</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => String(item.id || item.id_mensagem || index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<View style={styles.empty}><Text color="textSecondary">Nenhuma mensagem ainda.</Text></View>}
        />
        <View style={styles.inputBar}>
          <TextInput value={inputText} onChangeText={setInputText} placeholder="Digite sua mensagem..." placeholderTextColor={theme.colors.textSecondary} style={styles.input} multiline />
          <TouchableOpacity style={[styles.sendButton, !inputText.trim() && styles.sendDisabled]} onPress={handleSend} disabled={!inputText.trim()}>
            <Send color={theme.colors.white} size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 50, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: theme.borderRadius.xxl, borderBottomRightRadius: theme.borderRadius.xxl },
  backButton: { width: 44, height: 44, borderRadius: theme.borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: theme.colors.white },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)' },
  body: { flex: 1 },
  list: { padding: theme.spacing.lg, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  row: { flexDirection: 'row', marginBottom: 10 },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: theme.colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  messageText: { color: theme.colors.text, fontSize: 14 },
  messageMine: { color: theme.colors.white },
  timeText: { fontSize: 10, color: theme.colors.textSecondary, alignSelf: 'flex-end', marginTop: 4 },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: theme.spacing.md, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 42 : 44, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  input: { flex: 1, maxHeight: 110, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.borderRadius.xl, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.text },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  sendDisabled: { opacity: 0.45 },
});
export default Chat;
