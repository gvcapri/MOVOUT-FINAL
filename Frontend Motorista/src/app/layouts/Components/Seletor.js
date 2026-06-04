import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import Text from './Text';

export default function Seletor({ titulo, opcoes, valorSelecionado, aoSelecionar }) {
  return (
    <View style={styles.container}>
      {titulo && <Text size="md" weight="bold" color="text" style={styles.title}>{titulo}</Text>}
      <View style={styles.optionsContainer}>
        {opcoes.map((opcao) => {
          const isSelected = valorSelecionado === opcao;
          return (
            <TouchableOpacity
              key={opcao}
              style={[
                styles.option,
                isSelected && styles.selectedOption
              ]}
              onPress={() => aoSelecionar(opcao)}
            >
              <View style={[styles.radioCircle, isSelected && styles.selectedRadioCircle]}>
                {isSelected && <View style={styles.selectedInnerCircle} />}
              </View>
              <Text
                size="sm"
                weight={isSelected ? 'medium' : 'regular'}
                color={isSelected ? 'secondary' : 'textSecondary'}
              >
                {opcao}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  title: {
    marginBottom: theme.spacing.sm,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: theme.borderRadius.xl,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedOption: {
    backgroundColor: '#E0EDFF',
    borderColor: theme.colors.secondary,
  },
  radioCircle: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  selectedRadioCircle: {
    borderColor: theme.colors.secondary,
  },
  selectedInnerCircle: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.secondary,
  },
});