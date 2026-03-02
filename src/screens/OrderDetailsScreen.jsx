import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, Image, Modal, ScrollView, TextInput, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import client from '../api/client';
import socketService from '../services/socketService';
import { formatPrice } from '../utils/currencyUtils';

const formatAddress = (addr) => {
    if (!addr) return 'Pickup from Shop';
    if (typeof addr === 'string') return addr;
    if (addr.fullAddress) return addr.fullAddress;

    const parts = [
        addr.landmark,
        addr.addressLine2,
        addr.postalCode
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Pickup from Shop';
};

const REJECTION_REASONS = [
    { id: 1, label: 'Medical Issue', value: 'medical_issue' },
    { id: 2, label: 'Too Busy', value: 'too_busy' },
    { id: 3, label: 'Unable to Deliver', value: 'unable_to_deliver' },
    { id: 4, label: 'Incorrect Order Details', value: 'incorrect_order' },
    { id: 5, label: 'Other', value: 'other' },
];

const OrderDetailsScreen = ({ route }) => {
    const { orderId, vendorId } = route.params;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);
    const [customReason, setCustomReason] = useState('');

    useEffect(() => {
        fetchOrderDetails();

        // Listen for status updates for this order
        const handleStatusUpdate = (data) => {
            if (data.orderId === orderId) {
                console.log('[OrderDetails] Real-time status update received:', data);
                fetchOrderDetails();
            }
        };

        socketService.on('order_status_update', handleStatusUpdate);

        return () => {
            socketService.off('order_status_update', handleStatusUpdate);
        };
    }, []);

    const makeCall = (phone) => {
        if (!phone || phone === 'N/A') {
            Alert.alert('Error', 'Phone number not available');
            return;
        }
        Linking.openURL(`tel:${phone}`);
    };

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

    const handleUpdateStatus = async (newStatus, otp = null, rejectionReason = null) => {
        try {
            setLoading(true);
            const payload = { newStatus };
            if (otp) payload.pickupOtp = otp;
            if (rejectionReason) payload.rejectionReason = rejectionReason;
            // Tell backend this cancellation is by the vendor (not customer)
            if (newStatus === 'Cancelled') payload.cancelledBy = 'vendor';

            const response = await client.put(`/order/status/${orderId}/vendor/${vendorId}`, payload);
            await fetchOrderDetails();
            Alert.alert('Success', `Order status updated to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectOrder = () => {
        if (!selectedReason) {
            Alert.alert('Error', 'Please select a reason for rejection');
            return;
        }
        if (selectedReason === 'other' && !customReason.trim()) {
            Alert.alert('Error', 'Please enter a custom reason');
            return;
        }
        setShowRejectModal(false);
        const finalReason = selectedReason === 'other' ? customReason.trim() : selectedReason;
        handleUpdateStatus('Cancelled', null, finalReason);
        setSelectedReason(null);
        setCustomReason('');
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
            await fetchOrderDetails();
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
                                <Text style={styles.headerTitle}>#{order.orderId}</Text>
                                <View style={styles.statusBadge}>
                                    <Text style={styles.statusText}>{order.orderStatus?.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.dateText}>{new Date(order.createdAt).toLocaleString()}</Text>
                            {order.orderStatus === 'Cancelled' && (
                                <View style={styles.reasonCard}>
                                    <Icon name="information-outline" size={18} color="#D32F2F" />
                                    <Text style={styles.reasonText}>
                                        <Text style={{ fontWeight: 'bold' }}>Reason: </Text>
                                        {/* Standard orders have reasons in vendors array, but controller should have hydrated it or we check vendors */}
                                        {order.cancellationReason || (order.vendors && order.vendors.find(v => (v.vendor === vendorId || v.vendor?._id === vendorId))?.cancellationReason) || 'N/A'}
                                    </Text>
                                </View>
                            )}
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
                            <View style={styles.contactRow}>
                                <Text style={styles.infoText}>
                                    <Text style={styles.infoLabel}>Phone:</Text>{' '}
                                    {order.shippingAddress?.phone || order.customer?.contactNumber || 'N/A'}
                                </Text>
                                {(order.shippingAddress?.phone || order.customer?.contactNumber) && (
                                    <TouchableOpacity
                                        style={styles.callIconBtn}
                                        onPress={() => makeCall(order.shippingAddress?.phone || order.customer?.contactNumber)}
                                    >
                                        <Icon name="phone" size={20} color="#4CAF50" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Delivery Address</Text>
                            <Text style={styles.infoText}>
                                {order.shippingAddress?.fullAddress || order.shippingAddress?.address || formatAddress(order.shippingAddress)}
                            </Text>
                        </View>

                        {order.driverId && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Rider Information</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {order.driverId.personalDetails?.name || 'Assigning...'}</Text>
                                <View style={styles.contactRow}>
                                    <Text style={styles.infoText}>
                                        <Text style={styles.infoLabel}>Phone:</Text>{' '}
                                        {order.driverId.personalDetails?.phone || 'N/A'}
                                    </Text>
                                    {order.driverId.personalDetails?.phone && (
                                        <TouchableOpacity
                                            style={styles.callIconBtn}
                                            onPress={() => makeCall(order.driverId.personalDetails?.phone)}
                                        >
                                            <Icon name="phone" size={20} color="#4CAF50" />
                                        </TouchableOpacity>
                                    )}
                                </View>
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
                                        <Text style={styles.itemPrice}>{formatPrice(item.totalAmount || (item.price * item.quantity))}</Text>
                                    </View>
                                </View>
                            ))}
                            <View style={styles.divider} />

                            <View style={[styles.totalRow, { marginTop: 8 }]}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalValue}>{formatPrice(order.totalAmount)}</Text>
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
                            onPress={() => setShowRejectModal(true)}
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

            {/* Rejection Reason Modal */}
            <Modal
                visible={showRejectModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowRejectModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Select Rejection Reason</Text>
                        <Text style={styles.modalSubtitle}>Please choose a reason for rejecting this order</Text>

                        <ScrollView style={styles.reasonsList}>
                            {REJECTION_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason.id}
                                    style={[
                                        styles.reasonItem,
                                        selectedReason === reason.value && styles.reasonItemSelected
                                    ]}
                                    onPress={() => setSelectedReason(reason.value)}
                                >
                                    <View style={[
                                        styles.radioButton,
                                        selectedReason === reason.value && styles.radioButtonSelected
                                    ]}>
                                        {selectedReason === reason.value && (
                                            <View style={styles.radioButtonInner} />
                                        )}
                                    </View>
                                    <Text style={[
                                        styles.reasonText,
                                        selectedReason === reason.value && styles.reasonTextSelected
                                    ]}>
                                        {reason.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {selectedReason === 'other' && (
                            <View style={styles.customReasonContainer}>
                                <Text style={styles.customReasonLabel}>Enter your reason:</Text>
                                <TextInput
                                    style={styles.customReasonInput}
                                    placeholder="Type your reason here..."
                                    placeholderTextColor="#8E8E93"
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => {
                                    setShowRejectModal(false);
                                    setSelectedReason(null);
                                    setCustomReason('');
                                }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.confirmBtn]}
                                onPress={handleRejectOrder}
                            >
                                <Text style={styles.confirmBtnText}>Confirm Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        marginBottom: 8,
    },
    reasonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    reasonText: {
        fontSize: 14,
        color: '#D32F2F',
        marginLeft: 8,
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    callIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
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
        alignItems: 'flex-start',
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        marginRight: 16,
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 20,
        textAlign: 'center',
    },
    reasonsList: {
        maxHeight: 250,
        marginBottom: 20,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#F2F2F7',
        marginBottom: 6,
        backgroundColor: '#fff',
    },
    reasonItemSelected: {
        borderColor: '#ff6600',
        backgroundColor: '#FFF3E0',
    },
    radioButton: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#D1D1D6',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioButtonSelected: {
        borderColor: '#ff6600',
    },
    radioButtonInner: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#ff6600',
    },
    reasonText: {
        fontSize: 13,
        color: '#1A1A1A',
        fontWeight: '500',
        flex: 1,
    },
    reasonTextSelected: {
        color: '#ff6600',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#F2F2F7',
        borderWidth: 1,
        borderColor: '#D1D1D6',
    },
    confirmBtn: {
        backgroundColor: '#FF3B30',
    },
    cancelBtnText: {
        color: '#1A1A1A',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    customReasonContainer: {
        marginBottom: 20,
        paddingTop: 10,
    },
    customReasonLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    customReasonInput: {
        borderWidth: 1.5,
        borderColor: '#ff6600',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: '#1A1A1A',
        backgroundColor: '#FFF3E0',
        minHeight: 70,
        maxHeight: 90,
    },
});

export default OrderDetailsScreen;
