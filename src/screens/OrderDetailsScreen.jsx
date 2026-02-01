import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import client from '../api/client';

const formatAddress = (addr) => {
    if (!addr) return 'Pickup from Shop';
    if (typeof addr === 'string') return addr;

    const parts = [
        addr.landmark,
        addr.addressLine2,
        addr.postalCode
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Pickup from Shop';
};

const OrderDetailsScreen = ({ route }) => {
    const { orderId, vendorId } = route.params;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrderDetails();
    }, []);

    const fetchOrderDetails = async () => {
        try {
            const url = `/order/${orderId}/vendor/${vendorId}`;
            const response = await client.get(url);
            setOrder(response.data.data);
        } catch (error) {
            console.error('Error fetching order details:', error);
            Alert.alert('Error', 'Failed to fetch order details.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus, otp = null) => {
        try {
            setLoading(true);
            const payload = { newStatus };
            if (otp) payload.pickupOtp = otp;

            const response = await client.put(`/order/status/${orderId}/vendor/${vendorId}`, payload);
            fetchOrderDetails();
            Alert.alert('Success', `Order status updated to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCourier = async () => {
        try {
            setLoading(true);
            const payload = {
                orderId: order.orderId,
                vendorId: vendorId,
                radius: 10
            };
            const response = await client.post('/drivers/nearest', payload);
            fetchOrderDetails();
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
                            <Text style={styles.infoText}>
                                <Text style={styles.infoLabel}>Name:</Text>{' '}
                                {order.customer?.name || order.shippingAddress?.name || order.customerNameFallback || 'Walk-in'}
                            </Text>
                            <Text style={styles.infoText}>
                                <Text style={styles.infoLabel}>Phone:</Text>{' '}
                                {order.shippingAddress?.phone || order.customer?.contactNumber || 'N/A'}
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Delivery Address</Text>
                            <Text style={styles.infoText}>
                                {order.shippingAddress?.address || formatAddress(order.shippingAddress)}
                            </Text>
                        </View>

                        {order.driverId && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Rider Information</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {order.riderName || 'Assigning...'}</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Phone:</Text> {order.riderContact || 'N/A'}</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Order Items</Text>
                            {order.items?.map((item, index) => (
                                <View key={index} style={styles.itemContainer}>
                                    <View style={styles.itemRow}>
                                        {item.image && (
                                            <Image source={{ uri: item.image }} style={styles.itemImage} />
                                        ) || <View style={[styles.itemImage, { backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 10, color: '#8E8E93' }}>No Img</Text></View>}
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                                            {item.variations && item.variations.length > 0 && (
                                                <Text style={styles.variationText}>
                                                    {item.variations.map(v =>
                                                        v.attributes?.map(a => `${a.name}: ${a.value}`).join(', ')
                                                    ).filter(Boolean).join(' | ')}
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={styles.itemPrice}>₹{item.totalAmount || (item.price * item.quantity)}</Text>
                                    </View>
                                </View>
                            ))}
                            <View style={styles.divider} />

                            <View style={[styles.totalRow, { marginTop: 8 }]}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalValue}>₹{order.totalAmount}</Text>
                            </View>
                        </View>
                    </View>
                )}
                keyExtractor={item => item.key}
                contentContainerStyle={{ paddingBottom: 40 }}
            />

            <View style={styles.footer}>
                {order.orderStatus === 'Pending' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() => handleUpdateStatus('Processing')}
                        >
                            <Text style={styles.btnText}>Accept Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => handleUpdateStatus('Cancelled')}
                        >
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {order.orderStatus === 'Processing' && !order.driverId && (
                    <TouchableOpacity
                        style={[styles.fullBtn, styles.courierBtn]}
                        onPress={handleRequestCourier}
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
    itemContainer: {
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    variationText: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
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
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ff6600',
    },
    smallLabel: {
        fontSize: 14,
        color: '#8E8E93',
    },
    smallValue: {
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '500',
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
    fullBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    courierBtn: {
        backgroundColor: '#ff6600',
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default OrderDetailsScreen;
