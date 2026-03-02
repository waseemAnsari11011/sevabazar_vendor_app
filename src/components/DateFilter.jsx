import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const DateFilter = ({ selectedFilter, onFilterChange }) => {
    const filters = [
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'Date', value: 'custom' },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.filterWrapper}>
                {filters.map((filter) => (
                    <TouchableOpacity
                        key={filter.value}
                        style={[
                            styles.filterItem,
                            selectedFilter === filter.value && styles.activeFilterItem
                        ]}
                        onPress={() => onFilterChange(filter.value)}
                    >
                        <Text style={[
                            styles.filterLabel,
                            selectedFilter === filter.value && styles.activeFilterLabel
                        ]}>
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    filterWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    filterItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F2F2F7',
        marginHorizontal: 4,
    },
    activeFilterItem: {
        backgroundColor: '#ff6600',
    },
    filterLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
    },
    activeFilterLabel: {
        color: '#fff',
    },
});

export default DateFilter;
