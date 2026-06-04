import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Text from '../../layouts/Components/Text';
import Card from '../../layouts/Components/Card';
import AppLayout from '../../layouts/Layouts/AppLayout';
import { theme } from '../../theme';

const perguntas = [
  { q: 'O pagamento não caiu. O que faço?', a: 'Confira se você marcou a corrida como concluída e se o cliente confirmou a conclusão. Após a confirmação, o saldo aparece na carteira.' },
  { q: 'Quando o chat é liberado?', a: 'Depois que o cliente aceita uma proposta ou você aceita o valor do cliente. Cada frete tem uma conversa separada.' },
  { q: 'Posso enviar contraproposta?', a: 'Sim. O cliente recebe a contraproposta e decide se aceita ou cancela.' },
  { q: 'O frete sumiu dos disponíveis.', a: 'Isso é esperado quando o frete entra em negociação ou é aceito. Fretes aceitos aparecem no histórico e nas conversas.' },
  { q: 'Como confirmo que finalizei?', a: 'Na tela da corrida, toque em “Corrida concluída”. Depois o cliente confirma a conclusão.' },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <AppLayout title="Tira-dúvidas" scrollable>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Perguntas frequentes</Text>
        {perguntas.map((item, i) => (
          <Card key={i} style={styles.card}>
            <TouchableOpacity style={styles.q} onPress={() => setOpen(open === i ? null : i)}>
              <Text style={styles.question}>{item.q}</Text>
              <Text style={styles.arrow}>{open === i ? '⌃' : '⌄'}</Text>
            </TouchableOpacity>
            {open === i && <Text style={styles.answer}>{item.a}</Text>}
          </Card>
        ))}
      </ScrollView>
    </AppLayout>
  );
}
const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.md, paddingBottom: 30 },
  title: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 14 },
  card: { padding: theme.spacing.md, marginBottom: 12 },
  q: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  question: { flex: 1, fontSize: 15, fontWeight: 'bold', color: theme.colors.text },
  arrow: { fontSize: 22, color: theme.colors.primary, marginLeft: 10 },
  answer: { marginTop: 12, color: theme.colors.textSecondary, lineHeight: 20 },
});
