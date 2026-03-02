import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { formatPrice } from '../utils/currencyUtils';

const CancelledOrdersScreen = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchCancelledOrders();
        }, [])
    );

    const fetchCancelledOrders = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                setVendorId(vendor._id);
                const response = await client.get(`/order/vendor/${vendor._id}`);
                const allOrders = response.data.data || [];

                // Filter only Cancelled orders from TODAY
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const cancelled = allOrders.filter(item => {
                    const orderDate = new Date(item.createdAt);
                    return item.vendors?.orderStatus === 'Cancelled' && orderDate >= today;
                });
                setOrders(cancelled);
            }
        } catch (error) {
            console.error('Error fetching cancelled orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetails', {
                orderId: item._id,
                vendorId: vendorId
            })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.shortId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.statusText, { color: '#D32F2F' }]}>
                        CANCELLED
                    </Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.amount}>{formatPrice(item.totalAmount || 0)}</Text>
                <View style={styles.footerActions}>
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString()} | {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" color="#ff6600" style={styles.loader} />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item._id}
                    renderItem={renderOrderItem}
                    refreshing={loading}
                    onRefresh={fetchCancelledOrders}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No cancelled orders found.</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    listContainer: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ff6600',
    },
    date: {
        fontSize: 12,
        color: '#8E8E93',
    },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#8E8E93',
        fontSize: 16,
    },
    loader: {
        marginTop: 40,
    },
});

export default CancelledOrdersScreen;
