import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import client from '../api/client';

const OrderDetailsScreen = ({ route }) => {
    const { orderId, vendorId } = route.params;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [otpInput, setOtpInput] = useState('');

    useEffect(() => {
        fetchOrderDetails();
    }, []);

    const fetchOrderDetails = async () => {
        try {
            const response = await client.get(`/order/${orderId}/vendor/${vendorId}`);
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
            fetchOrderDetails(); // Re-fetch details to update UI
            Alert.alert('Success', `Order status updated to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating status:', error);
            const errorMsg = error.response?.data?.error || 'Failed to update status';
            Alert.alert('Error', errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestCourier = async () => {
        try {
            setLoading(true);
            // In a real app, we'd use the vendor's current location from GPS
            // For now, we'll use a placeholder or the order's shipping address as a hint
            const payload = {
                orderId: order._id,
                latitude: 26.1209, // Placeholder for Muzaffarpur center
                longitude: 85.3647,
                radius: 10
            };
            const response = await client.post('/drivers/nearest', payload);
            fetchOrderDetails();
            const driverCount = response.data.count || 0;
            const driverNames = response.data.drivers?.map(d => d.name).join(', ') || 'None';
            Alert.alert('Success', `${driverCount} delivery partner(s) found: [${driverNames}]. They have been notified.`);
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
                <ActivityIndicator size="large" color="#0000ff" />
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
                    <View>
                        <View style={styles.section}>
                            <Text style={styles.header}>Order #{order.orderId}</Text>
                            <Text>Status: {order.orderStatus}</Text>
                            <Text>Date: {new Date(order.createdAt).toLocaleDateString()}</Text>
                        </View>

                        {order.driverId && order.pickupOtp && (
                            <View style={[styles.section, styles.otpCard]}>
                                <Text style={styles.otpLabel}>Pickup OTP</Text>
                                <Text style={styles.otpCode}>{order.pickupOtp}</Text>
                                <Text style={styles.otpSubtext}>Tell this OTP to the delivery partner for pickup.</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Customer Details</Text>
                            <Text>Name: {order.customer?.name || order.customerNameFallback || 'Walk-in Customer'}</Text>
                            <Text>Phone: {order.customer?.phone || 'N/A'}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Shipping Address</Text>
                            <Text>{order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}</Text>
                            <Text>{order.shippingAddress?.state} - {order.shippingAddress?.postalCode}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Items</Text>
                            {order.items?.map((item, index) => (
                                <View key={index} style={styles.itemRow}>
                                    <Text style={styles.itemName}>{item.name} (x{item.quantity})</Text>
                                    <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={[styles.section, styles.totalSection]}>
                            <Text style={styles.totalLabel}>Total Amount</Text>
                            <Text style={styles.totalAmount}>₹{order.totalAmount}</Text>
                        </View>
                    </View>
                )}
                keyExtractor={item => item.key}
            />

            <View style={styles.footer}>
                {order.orderStatus === 'Pending' && (
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.acceptButton]}
                            onPress={() => handleUpdateStatus('Processing')}
                        >
                            <Text style={styles.buttonText}>Accept Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.rejectButton]}
                            onPress={() => handleUpdateStatus('Cancelled')}
                        >
                            <Text style={styles.buttonText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {order.orderStatus === 'Processing' && !order.driverId && (
                    <View>
                        <Text style={styles.findingText}>We are finding nearest driver for this order...</Text>
                        <TouchableOpacity
                            style={[styles.button, styles.courierButton]}
                            onPress={handleRequestCourier}
                        >
                            <Text style={styles.buttonText}>Request Delivery Partner</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {order.orderStatus === 'Processing' && order.driverId && (
                    <View style={styles.handoverSection}>
                        <Text style={styles.handoverTitle}>Handover to Delivery Partner</Text>
                        <TextInput
                            style={styles.otpInput}
                            placeholder="Enter 4-digit Pickup OTP"
                            keyboardType="numeric"
                            maxLength={4}
                            value={otpInput}
                            onChangeText={setOtpInput}
                        />
                        <TouchableOpacity
                            style={[styles.button, styles.shippedButton]}
                            onPress={() => handleUpdateStatus('Shipped', otpInput)}
                        >
                            <Text style={styles.buttonText}>Verify OTP & Ship Order</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {order.orderStatus === 'Shipped' && (
                    <TouchableOpacity
                        style={[styles.button, styles.deliveredButton]}
                        onPress={() => handleUpdateStatus('Delivered')}
                    >
                        <Text style={styles.buttonText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
        borderRadius: 8,
        marginHorizontal: 12,
        marginTop: 12,
        elevation: 2,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#555',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 4,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemName: {
        fontSize: 16,
        color: '#444',
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    totalSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        paddingVertical: 20,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    totalAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2e7d32',
    },
    otpCard: {
        backgroundColor: '#fff3e0',
        borderColor: '#ff9800',
        borderWidth: 1,
        alignItems: 'center',
        paddingVertical: 20,
    },
    otpLabel: {
        fontSize: 16,
        color: '#e65100',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    otpCode: {
        fontSize: 48,
        fontWeight: '900',
        color: '#333',
        letterSpacing: 4,
        marginVertical: 10,
    },
    otpSubtext: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    button: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    acceptButton: {
        backgroundColor: '#4caf50',
        flex: 2,
        marginRight: 8,
    },
    rejectButton: {
        backgroundColor: '#f44336',
        flex: 1,
    },
    shippedButton: {
        backgroundColor: '#2196f3',
        width: '100%',
    },
    courierButton: {
        backgroundColor: '#ff9800',
        width: '100%',
        marginTop: 10,
    },
    findingText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#666',
        textAlign: 'center',
        marginBottom: 5,
    },
    deliveredButton: {
        backgroundColor: '#9c27b0',
        width: '100%',
    },
    handoverSection: {
        alignItems: 'center',
        marginTop: 10,
    },
    handoverTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    otpInput: {
        width: '100%',
        height: 50,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 12,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
});

export default OrderDetailsScreen;
