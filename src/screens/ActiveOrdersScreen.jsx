import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import DateFilter from '../components/DateFilter';
import { getDateRange } from '../utils/dateUtils';

const ActiveOrdersScreen = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [])
    );

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                setVendorId(vendor._id);

                const response = await client.get(`/order/vendor/${vendor._id}`);
                const activeOrders = (response.data.data || []).filter(item =>
                    item.vendors?.orderStatus && !['Delivered', 'Cancelled'].includes(item.vendors.orderStatus)
                );
                setOrders(activeOrders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetails', { orderId: item._id, vendorId: vendorId })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.shortId}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.vendors?.orderStatus === 'completed' ? '#E8F5E9' : '#FFF3E0' }]}>
                    <Text style={[styles.statusText, { color: item.vendors?.orderStatus === 'completed' ? '#2E7D32' : '#EF6C00' }]}>
                        {item.vendors?.orderStatus?.toUpperCase() || 'PENDING'}
                    </Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.amount}>₹{item.totalAmount || 0}</Text>
                <View style={styles.footerActions}>
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`http://10.0.2.2:3000/order/invoice/${item._id}`)}
                        style={styles.invoiceAction}
                    >
                        <Text style={styles.invoiceLink}>INVOICE</Text>
                    </TouchableOpacity>
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
                    onRefresh={() => fetchOrders()}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No active orders found.</Text>}
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
    invoiceAction: {
        marginLeft: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#F2F2F7',
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    invoiceLink: {
        fontSize: 10,
        color: '#555',
        fontWeight: '700',
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
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#F2F2F7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    cancelButton: {
        backgroundColor: '#F2F2F7',
    },
    applyButton: {
        backgroundColor: '#ff6600',
    },
    cancelButtonText: {
        color: '#8E8E93',
        fontWeight: '600',
    },
    applyButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default ActiveOrdersScreen;
