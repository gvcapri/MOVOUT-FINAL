import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react-native';
import { theme } from '../../theme';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';

const perguntas = [
  { q: 'O que faço se o pagamento não caiu?', a: 'Confira se o frete foi concluído e se o cliente confirmou a conclusão. Se continuar pendente, abra o chat do frete e combine com o motorista. Em uma versão final, essa etapa seria integrada ao gateway de pagamento.' },
  { q: 'Quando o chat é liberado?', a: 'O chat é liberado após o aceite da proposta e a atribuição do motorista ao frete.' },
  { q: 'Posso cancelar uma contraproposta?', a: 'Sim. Enquanto a proposta não for aceita, o cliente pode cancelar a negociação ou aguardar outra proposta.' },
  { q: 'Como o valor do frete é calculado?', a: 'O valor usa uma tarifa base, distância, peso e tipo de veículo. Veículos maiores têm custo maior.' },
  { q: 'O que acontece quando o motorista conclui a corrida?', a: 'O cliente recebe a etapa de confirmação. Após confirmar, o frete é concluído e o pagamento é liberado na carteira do motorista.' },
  { q: 'Posso avaliar o motorista?', a: 'Sim. Depois do frete aceito/concluído, o cliente pode avaliar o motorista e o motorista pode avaliar o cliente.' },
];

export default function FAQ({ onNavigate }) {
  const [open, setOpen] = useState(null);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={styles.backButton}><ArrowLeft color={theme.colors.white} size={24} /></TouchableOpacity>
        <HelpCircle color={theme.colors.white} size={26} />
        <Text size="xxl" weight="bold" style={styles.title}>Tira-dúvidas</Text>
        <Text size="sm" style={styles.subtitle}>Perguntas comuns sobre fretes, pagamento e chat</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {perguntas.map((item, i) => (
          <Card key={i} style={styles.card}>
            <TouchableOpacity style={styles.question} onPress={() => setOpen(open === i ? null : i)}>
              <Text size="md" weight="bold" color="text" style={{ flex: 1 }}>{item.q}</Text>
              {open === i ? <ChevronUp color={theme.colors.primary} size={20} /> : <ChevronDown color={theme.colors.primary} size={20} />}
            </TouchableOpacity>
            {open === i && <Text size="sm" color="textSecondary" style={styles.answer}>{item.a}</Text>}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingTop: 50, backgroundColor: theme.colors.primary, borderBottomLeftRadius: theme.borderRadius.xxl, borderBottomRightRadius: theme.borderRadius.xxl },
  backButton: { width: 44, height: 44, borderRadius: theme.borderRadius.lg, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: theme.colors.white, marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  content: { padding: theme.spacing.lg },
  card: { padding: theme.spacing.md, marginBottom: theme.spacing.md },
  question: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  answer: { marginTop: 12, lineHeight: 20 },
});
