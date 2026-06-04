import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from './Text';
import Card from './Card';
import { theme } from '../../theme';

export default function FreightCard({
    title,
    weight,
    distance,
    price,
    oldPrice,
    clientName = 'Cliente não informado',
    origin,
    destination,
    onPress,
    tags = [],
    status = 'available'
}) {
    return (
        <Card style={styles.cardContainer}>
            {tags.length > 0 && (
                <View style={styles.tagsRow}>
                    {tags.map((tag, index) => {
                        let tagColor = theme.colors.primaryLight;
                        let tagTextColor = theme.colors.accent;

                        if (tag === 'Urgente') {
                            tagColor = theme.colors.error;
                            tagTextColor = theme.colors.white;
                        }
                        if (tag === 'Aceito' || tag === 'Concluído') {
                            tagColor = theme.colors.success;
                            tagTextColor = theme.colors.white;
                        }
                        if (tag === 'Cancelado') {
                            tagColor = '#FEE2E2';
                            tagTextColor = theme.colors.error;
                        }

                        return (
                            <View key={index} style={[styles.tag, { backgroundColor: tagColor }]}>
                                <Text style={[styles.tagText, { color: tagTextColor }]}>{tag}</Text>
                            </View>
                        );
                    })}
                </View>
            )}

            <View style={styles.header}>
                <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subTitle}>{clientName}</Text>
                </View>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Preço Médio</Text>
                    {oldPrice && (
                        <Text style={styles.oldPrice}>R${oldPrice}</Text>
                    )}
                    <Text style={styles.price}>R$ {price}</Text>
                </View>
            </View>

            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <Text style={styles.icon}>👜</Text>
                    <Text style={styles.infoText}>{weight} Kg</Text>
                </View>
                <View style={styles.infoItem}>
                    <View style={styles.dotIcon} />
                    <Text style={styles.infoText}>{distance} Km</Text>
                </View>
            </View>

            <View style={styles.routeContainer}>
                <View style={styles.routePill}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} />
                    <View>
                        <Text style={styles.routeLabel}>Origem</Text>
                        <Text style={styles.routeText} numberOfLines={1}>{origin}</Text>
                    </View>
                </View>
                <View style={[styles.routePill, { marginTop: theme.spacing.sm }]}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
                    <View>
                        <Text style={styles.routeLabel}>Destino</Text>
                        <Text style={styles.routeText} numberOfLines={1}>{destination}</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={onPress}>
                <Text style={styles.actionButtonText}>
                    {status === 'history' ? "Ver Detalhes" : "Ver negociação"}
                </Text>
            </TouchableOpacity>
        </Card>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.xl,
        marginBottom: theme.spacing.md,
        backgroundColor: theme.colors.surface,
    },
    tagsRow: {
        flexDirection: 'row',
        marginBottom: theme.spacing.md,
        flexWrap: 'wrap'
    },
    tag: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.round,
        marginRight: theme.spacing.xs,
        marginBottom: theme.spacing.xs
    },
    tagText: {
        fontSize: theme.typography.fontSizes.xs,
        fontWeight: theme.typography.fontWeights.bold,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
    },
    title: {
        fontSize: theme.typography.fontSizes.md,
        fontWeight: theme.typography.fontWeights.bold,
        color: theme.colors.text,
        marginBottom: 2
    },
    subTitle: {
        fontSize: theme.typography.fontSizes.xs,
        color: theme.colors.textSecondary,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceLabel: {
        fontSize: 10,
        fontWeight: theme.typography.fontWeights.bold,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
    },
    oldPrice: {
        fontSize: theme.typography.fontSizes.sm,
        color: theme.colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    price: {
        fontSize: theme.typography.fontSizes.xl,
        fontWeight: theme.typography.fontWeights.bold,
        color: theme.colors.accent,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: theme.spacing.md,
        alignItems: 'center'
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: theme.spacing.lg
    },
    icon: {
        fontSize: 14,
        marginRight: 4
    },
    dotIcon: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
        marginRight: 6
    },
    infoText: {
        fontSize: theme.typography.fontSizes.sm,
        color: theme.colors.textSecondary,
        fontWeight: theme.typography.fontWeights.medium
    },
    routeContainer: {
        marginBottom: theme.spacing.lg,
    },
    routePill: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceAlt,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    routeLabel: {
        fontSize: 10,
        color: theme.colors.textSecondary,
        fontWeight: theme.typography.fontWeights.bold,
        textTransform: 'uppercase'
    },
    routeText: {
        fontSize: theme.typography.fontSizes.sm,
        color: theme.colors.text,
        fontWeight: theme.typography.fontWeights.bold
    },
    actionButton: {
        backgroundColor: theme.colors.accent,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.xl,
        alignItems: 'center',
        ...theme.shadows.md,
    },
    actionButtonText: {
        color: theme.colors.white,
        fontSize: theme.typography.fontSizes.md,
        fontWeight: theme.typography.fontWeights.bold
    }
});
