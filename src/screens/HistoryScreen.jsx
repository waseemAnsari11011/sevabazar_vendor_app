import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const HistoryScreen = ({ navigation }) => {
    const [allHistory, setAllHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                const vId = vendor._id;

                const normalRes = await client.get(`/order/vendor/${vId}`);
                const normalHistory = (normalRes.data.data || []).filter(o =>
                    ['Delivered', 'Cancelled'].includes(o.vendors?.orderStatus)
                ).map(o => ({ ...o, type: 'normal' }));

                const chatRes = await client.get(`/chat-order/vendor/${vId}`);
                const chatHistory = (chatRes.data.data || []).filter(o =>
                    ['Delivered', 'Cancelled'].includes(o.orderStatus)
                ).map(o => ({ ...o, type: 'chat' }));

                const combined = [...normalHistory, ...chatHistory].sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );

                setAllHistory(combined);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                if (item.type === 'normal') {
                    navigation.navigate('OrderDetails', { orderId: item._id, vendorId: item.vendors.vendor._id });
                } else {
                    navigation.navigate('ChatOrderDetails', { orderId: item.orderId });
                }
            }}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.shortId}</Text>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: (item.orderStatus === 'Cancelled' || item.vendors?.orderStatus === 'Cancelled') ? '#FFF1F0' : '#E8F5E9' }
                ]}>
                    <Text style={[
                        styles.statusText,
                        { color: (item.orderStatus === 'Cancelled' || item.vendors?.orderStatus === 'Cancelled') ? '#FF3B30' : '#2E7D32' }
                    ]}>
                        {(item.type === 'chat' ? item.orderStatus : item.vendors?.orderStatus)?.toUpperCase()}
                    </Text>
                </View>
            </View>
            <Text style={styles.customerName}>{item.customer?.name || item.name || 'Walk-in'}</Text>
            <Text style={styles.typeText}>{item.type === 'chat' ? 'Chat Order' : 'Regular Order'}</Text>
            <View style={styles.cardFooter}>
                <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.amount}>₹{item.totalAmount || 0}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" color="#ff6600" style={styles.loader} />
            ) : (
                <FlatList
                    data={allHistory}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderItem}
                    onRefresh={fetchHistory}
                    refreshing={loading}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.empty}>No history found.</Text>}
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
    customerName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    typeText: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F2F2F7',
        paddingTop: 10,
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
    empty: {
        textAlign: 'center',
        marginTop: 50,
        color: '#8E8E93',
        fontSize: 16,
    },
    loader: {
        marginTop: 40,
    },
});

export default HistoryScreen;
