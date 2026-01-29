import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const ChatOrdersScreen = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendorId, setVendorId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchChatOrders();
        }, [])
    );

    const fetchChatOrders = async () => {
        try {
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                setVendorId(vendor._id);
                const response = await client.get(`/chat-order/vendor/${vendor._id}`);
                const activeChatOrders = (response.data.data || []).filter(order =>
                    !['Delivered', 'Cancelled'].includes(order.orderStatus)
                );
                setOrders(activeChatOrders);
            }
        } catch (error) {
            console.error('Error fetching chat orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ChatOrderDetails', { orderId: item.orderId, vendorId: vendorId })}
        >
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.orderId}>Order #{item.shortId}</Text>
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{item.orderStatus?.toUpperCase()}</Text>
                    </View>
                </View>
                {['In Review', 'in review'].includes(item.orderStatus) && (
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => navigation.navigate('CreateChatOrder', {
                            orderId: item.orderId,
                            vendorId: vendorId,
                            orderMsg: item.orderMessage
                        })}
                    >
                        <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.customerName}>Customer: {item.customer?.name || item.name}</Text>
            <Text style={styles.orderMessage} numberOfLines={1}>Message: {item.orderMessage}</Text>
            <View style={styles.cardFooter}>
                <View style={styles.footerActions}>
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`http://10.0.2.2:3000/chat-order/invoice/${item.orderId}`)}
                        style={styles.invoiceAction}
                    >
                        <Text style={styles.invoiceLink}>INVOICE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('ChatOrderDetails', { orderId: item.orderId, vendorId: vendorId })}>
                        <Text style={styles.detailsLink}>View Details</Text>
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
                    keyExtractor={item => item.orderId}
                    renderItem={renderOrderItem}
                    refreshing={loading}
                    onRefresh={fetchChatOrders}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.emptyText}>No chat orders found.</Text>}
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    createButton: {
        backgroundColor: '#ff6600',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#ff6600',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginRight: 8,
    },
    statusBadge: {
        backgroundColor: '#FFF3E0',
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
        color: '#EF6C00',
    },
    customerName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    orderMessage: {
        fontSize: 13,
        color: '#666',
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
    date: {
        fontSize: 12,
        color: '#8E8E93',
    },
    detailsLink: {
        fontSize: 12,
        color: '#ff6600',
        fontWeight: '600',
    },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    invoiceAction: {
        marginLeft: 16,
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
});

export default ChatOrdersScreen;
