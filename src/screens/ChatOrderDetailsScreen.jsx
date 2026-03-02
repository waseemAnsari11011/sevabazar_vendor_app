import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, Linking, Image, Modal, ScrollView, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import socketService from '../services/socketService';
import { formatPrice } from '../utils/currencyUtils';

const formatAddress = (addr) => {
    if (!addr) return 'N/A';
    if (typeof addr === 'string') return addr;
    if (addr.fullAddress) return addr.fullAddress;

    const parts = [
        addr.landmark,
        addr.addressLine2,
        addr.postalCode
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'N/A';
};

const REJECTION_REASONS = [
    { id: 1, label: 'Medical Issue', value: 'medical_issue' },
    { id: 2, label: 'Too Busy', value: 'too_busy' },
    { id: 3, label: 'Unable to Deliver', value: 'unable_to_deliver' },
    { id: 4, label: 'Incorrect Order Details', value: 'incorrect_order' },
    { id: 5, label: 'Other', value: 'other' },
];

const ChatOrderDetailsScreen = ({ route, navigation }) => {
    const { orderId, vendorId } = route.params;
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localVendorId, setLocalVendorId] = useState(vendorId);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);
    const [customReason, setCustomReason] = useState('');

    const makeCall = (phone) => {
        if (!phone || phone === 'N/A') {
            Alert.alert('Error', 'Phone number not available');
            return;
        }
        Linking.openURL(`tel:${phone}`);
    };

    useFocusEffect(
        useCallback(() => {
            fetchChatOrderDetails();
        }, [])
    );

    useEffect(() => {
        // Listen for status updates for this order
        const handleStatusUpdate = (data) => {
            if (data.orderId === orderId) {
                console.log('[ChatOrderDetails] Real-time status update received:', data);
                fetchChatOrderDetails();
            }
        };

        socketService.on('order_status_update', handleStatusUpdate);

        return () => {
            socketService.off('order_status_update', handleStatusUpdate);
        };
    }, []);

    const fetchChatOrderDetails = async () => {
        try {
            if (!localVendorId) {
                const vendorData = await AsyncStorage.getItem('vendorData');
                if (vendorData) {
                    const vendor = JSON.parse(vendorData);
                    setLocalVendorId(vendor._id);
                }
            }
            const response = await client.get(`/chat-order/${orderId}`);
            setOrder(response.data);
        } catch (error) {
            console.error('Error fetching chat order details:', error);
            Alert.alert('Error', 'Failed to fetch order details.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus, rejectionReason = null) => {
        try {
            setLoading(true);
            const payload = { newStatus };
            if (rejectionReason) payload.cancellationReason = rejectionReason;
            // Tell backend this cancellation is by the vendor (for rejection count)
            if (newStatus === 'Cancelled') payload.cancelledBy = 'vendor';

            const response = await client.put(`/chat-order/status/${orderId}/vendor/`, payload);
            await fetchChatOrderDetails();
            Alert.alert('Success', `Order status updated to ${newStatus}.`);
        } catch (error) {
            console.error('Error updating chat order status:', error);
            Alert.alert('Error', 'Failed to update status.');
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
        handleUpdateStatus('Cancelled', finalReason);
        setSelectedReason(null);
        setCustomReason('');
    };

    const handleRequestCourier = async () => {
        try {
            setLoading(true);
            const payload = {
                orderId: order.orderId, // This is the numeric orderId
                vendorId: localVendorId,
                radius: 10
            };
            const response = await client.post('/drivers/nearest', payload);
            await fetchChatOrderDetails();
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
                            {order.orderStatus === 'Cancelled' && order.cancellationReason && (
                                <View style={styles.reasonCard}>
                                    <Icon name="information-outline" size={18} color="#D32F2F" />
                                    <Text style={styles.reasonText}>
                                        <Text style={{ fontWeight: 'bold' }}>Reason: </Text>
                                        {order.cancellationReason}
                                    </Text>
                                </View>
                            )}
                            {['In Review', 'in review'].includes(order.orderStatus) && (
                                <TouchableOpacity
                                    style={styles.createBtn}
                                    onPress={() => navigation.navigate('CreateChatOrder', {
                                        orderId: order.orderId,
                                        vendorId: localVendorId,
                                        orderMsg: order.orderMessage
                                    })}
                                >
                                    <Text style={styles.createBtnText}>Create Order</Text>
                                </TouchableOpacity>
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
                                {order.customer?.name || order.shippingAddress?.name || order.customerNameFallback || order.name || 'Walk-in'}
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
                            <Text style={styles.sectionTitle}>Shipping Address</Text>
                            <Text style={styles.infoText}>
                                {order.shippingAddress?.fullAddress || order.shippingAddress?.address || formatAddress(order.shippingAddress)}
                            </Text>
                        </View>

                        {order.driverId && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Rider Information</Text>
                                <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {order.driverId.personalDetails?.name || 'Assigning...'}</Text>
                                <View style={styles.contactRow}>
                                    <Text style={styles.infoText}><Text style={styles.infoLabel}>Phone:</Text> {order.driverId.personalDetails?.phone || 'N/A'}</Text>
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
                            <Text style={styles.sectionTitle}>Order Message</Text>
                            <View style={styles.messageBox}>
                                <Text style={styles.messageText}>{order.orderMessage}</Text>
                            </View>
                        </View>

                        {order.products && order.products.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Order Items</Text>
                                {order.products.map((item, index) => (
                                    <View key={index} style={styles.itemContainer}>
                                        <View style={styles.itemRow}>
                                            <View style={styles.itemMainInfo}>
                                                {item.image && (
                                                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                                                ) || <View style={[styles.itemImage, { backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 10, color: '#8E8E93' }}>No Img</Text></View>}
                                                <View style={styles.itemTextContainer}>
                                                    <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                                                    <Text style={styles.itemPrice}>{formatPrice(item.totalAmount || (item.price * item.quantity))}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                                <View style={styles.divider} />
                                <View style={[styles.totalRow, { marginTop: 8 }]}>
                                    <Text style={styles.grandLabel}>Total Amount</Text>
                                    <Text style={styles.grandValue}>{formatPrice(order.totalAmount)}</Text>
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
                            onPress={() => setShowRejectModal(true)}
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

            {/* Rejection Modal */}
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
        justifyContent: 'space-between',
    },
    itemMainInfo: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'flex-start',
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        marginRight: 16,
    },
    itemTextContainer: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ff6600',
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
        fontSize: 22,
        color: '#1A1A1A',
        lineHeight: 30,
        fontWeight: 'bold',
    },
    createBtn: {
        backgroundColor: '#ff6600',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    createBtnText: {
        color: '#fff',
        fontSize: 14,
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
        padding: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#F2F2F7',
        marginBottom: 8,
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
        fontSize: 14,
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

export default ChatOrderDetailsScreen;
