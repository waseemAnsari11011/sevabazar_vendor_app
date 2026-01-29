import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native';
import client from '../api/client';

const ChatOrderDetailsScreen = ({ route }) => {
    const { orderId, vendorId } = route.params;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChatOrderDetails();
    }, []);

    const fetchChatOrderDetails = async () => {
        try {
            const response = await client.get(`/chat-order/${orderId}`);
            setOrder(response.data);
        } catch (error) {
            console.error('Error fetching chat order details:', error);
            Alert.alert('Error', 'Failed to fetch order details.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        try {
            setLoading(true);
            const response = await client.put(`/chat-order/status/${orderId}/vendor/`, { newStatus });
            fetchChatOrderDetails();
            Alert.alert('Success', `Order status updated to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating chat order status:', error);
            Alert.alert('Error', 'Failed to update status.');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCourier = async () => {
        try {
            setLoading(true);
            const payload = {
                orderId: order.orderId, // This is the numeric orderId
                vendorId: vendorId,
                radius: 10
            };
            const response = await client.post('/drivers/nearest', payload);
            fetchChatOrderDetails();
            Alert.alert('Success', 'Delivery partner search initiated. You will be notified when someone accepts.');
        } catch (error) {
            console.error('Error requesting courier:', error);
            Alert.alert('Error', 'Failed to request delivery partner');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#ff6600" />
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.centered}>
                <Text>Order not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={[{ key: 'details' }]}
                renderItem={() => (
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.headerTitle}>Order #{order.orderId}</Text>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>{order.orderStatus?.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.dateText}>{new Date(order.createdAt).toLocaleString()}</Text>
                        </View>

                        {order.driverId && order.pickupOtp && (
                            <View style={styles.otpCard}>
                                <Text style={styles.otpLabel}>Pickup OTP</Text>
                                <Text style={styles.otpCode}>{order.pickupOtp}</Text>
                                <Text style={styles.otpSubtext}>Share this with the driver upon arrival.</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Customer Information</Text>
                            <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {order.customer?.name || order.name}</Text>
                            <Text style={styles.infoText}><Text style={styles.infoLabel}>Phone:</Text> {order.customer?.contactNumber || order.shippingAddress?.phone || 'N/A'}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Shipping Address</Text>
                            <Text style={styles.infoText}>{order.shippingAddress?.address || 'N/A'}</Text>
                        </View>

                        {order.driverId && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Rider Information</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {order.driverId.personalDetails?.name || 'Assigning...'}</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Phone:</Text> {order.driverId.personalDetails?.phone || 'N/A'}</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Order Message</Text>
                            <View style={styles.messageBox}>
                                <Text style={styles.messageText}>{order.orderMessage}</Text>
                            </View>
                        </View>

                        {order.products && order.products.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Order Items</Text>
                                {order.products.map((item, index) => (
                                    <View key={index} style={styles.itemRow}>
                                        <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                                        <Text style={styles.itemPrice}>₹{item.totalAmount || (item.price * item.quantity)}</Text>
                                    </View>
                                ))}
                                <View style={styles.divider} />
                                <View style={[styles.totalRow, { marginTop: 8 }]}>
                                    <Text style={styles.grandLabel}>Total Amount</Text>
                                    <Text style={styles.grandValue}>₹{order.totalAmount}</Text>
                                </View>
                                <Text style={styles.paymentStatus}>Payment: {order.paymentStatus}</Text>
                            </View>
                        )}
                    </View>
                )}
                keyExtractor={item => item.key}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            <View style={styles.footer}>
                {(['pending', 'Pending', 'In Review', 'in review'].includes(order.orderStatus) && order.products?.length > 0) && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() => handleUpdateStatus('Processing')}
                            disabled={loading}
                        >
                            <Text style={styles.btnText}>Accept Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => handleUpdateStatus('Cancelled')}
                            disabled={loading}
                        >
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {['processing', 'Processing'].includes(order.orderStatus) && !order.driverId && (
                    <TouchableOpacity
                        style={[styles.fullBtn, styles.courierBtn]}
                        onPress={handleRequestCourier}
                        disabled={loading}
                    >
                        <Text style={styles.btnText}>Request Delivery Partner</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
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
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    statusBadge: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#EF6C00',
    },
    dateText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 15,
        color: '#1A1A1A',
        marginBottom: 6,
    },
    infoLabel: {
        fontWeight: '600',
        color: '#555',
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemName: {
        fontSize: 15,
        color: '#1A1A1A',
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    divider: {
        height: 1,
        backgroundColor: '#F2F2F7',
        marginVertical: 12,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    totalLabel: {
        fontSize: 15,
        color: '#555',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    smallLabel: {
        fontSize: 13,
        color: '#8E8E93',
    },
    smallValue: {
        fontSize: 14,
        color: '#4CAF50',
    },
    grandLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    grandValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ff6600',
    },
    paymentStatus: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 8,
        fontStyle: 'italic',
    },
    explanationRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: -4,
        marginBottom: 4,
    },
    explanationText: {
        fontSize: 10,
        color: '#8E8E93',
        fontStyle: 'italic',
    },
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F2F2F7',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: '#4CAF50',
        marginRight: 8,
    },
    rejectBtn: {
        backgroundColor: '#FF3B30',
        marginLeft: 8,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    otpCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    otpLabel: {
        fontSize: 12,
        color: '#ff6600',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    otpCode: {
        fontSize: 40,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 4,
    },
    otpSubtext: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 8,
    },
    fullBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    courierBtn: {
        backgroundColor: '#ff6600',
    },
    messageBox: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6600',
    },
    messageText: {
        fontSize: 15,
        color: '#1A1A1A',
        lineHeight: 22,
    },
});

export default ChatOrderDetailsScreen;
