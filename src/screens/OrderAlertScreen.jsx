import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Vibration, Platform, Modal, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import notificationService from '../services/notificationService';
import { formatPrice } from '../utils/currencyUtils';
import client from '../api/client';

const REJECTION_REASONS = [
    { id: 1, label: 'Medical Issue', value: 'medical_issue' },
    { id: 2, label: 'Too Busy', value: 'too_busy' },
    { id: 3, label: 'Unable to Deliver', value: 'unable_to_deliver' },
    { id: 4, label: 'Incorrect Order Details', value: 'incorrect_order' },
    { id: 5, label: 'Other', value: 'other' },
];

const OrderAlertScreen = ({ route, navigation }) => {
    console.log('[OrderAlertScreen] Mounted with params:', JSON.stringify(route.params));

    if (!route.params || !route.params.orderData) {
        console.error('[OrderAlertScreen] Error: orderData missing in route.params');
        // If we landed here without data, go back to home to avoid crash
        setTimeout(() => navigation.navigate('Home'), 500);
        return (
            <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ff6600" />
                <Text style={{ color: '#fff', marginTop: 10 }}>Loading Order Data...</Text>
            </View>
        );
    }

    const { orderData } = route.params;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState(null);
    const [customReason, setCustomReason] = useState('');
    const vibrationIntervalRef = useRef(null);

    useEffect(() => {
        // Dismiss the persistent notification (Retry a few times to beat race conditions from native layer)
        notificationService.cancelCallNotification();
        let clearAttempts = 0;
        const clearNotificationInterval = setInterval(() => {
            notificationService.cancelCallNotification();
            clearAttempts++;
            if (clearAttempts >= 5) clearInterval(clearNotificationInterval); // Try 5 times over 2 seconds
        }, 400);

        // Ensure ringtone is playing (resumes if killed by an aggressive remount)
        notificationService.playRingtone();

        // Start pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Continuous vibration
        vibrationIntervalRef.current = setInterval(() => {
            Vibration.vibrate([0, 400, 200, 400]);
        }, 1200);

        return () => {
            if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
            Vibration.cancel();
            notificationService.stopRingtone();
        };
    }, []);

    const handleUpdateStatus = async (newStatus, otp = null, rejectionReason = null) => {
        try {
            console.log(`[OrderAlertScreen] Updating order status to: ${newStatus}`);
            setLoading(true);
            if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
            notificationService.stopRingtone();
            Vibration.cancel();

            const payload = { newStatus };
            if (otp) payload.pickupOtp = otp;
            if (rejectionReason) payload.rejectionReason = rejectionReason;
            if (newStatus === 'Cancelled') payload.cancelledBy = 'vendor';

            const isChatOrder = orderData.isChatOrder === true || orderData.isChatOrder === 'true';

            if (isChatOrder) {
                await client.put(`/chat-order/status/${orderData.orderId}/vendor/`, { newStatus, ...payload });
            } else {
                await client.put(`/order/status/${orderData.orderId}/vendor/${orderData.vendorId}`, payload);
            }

            if (newStatus === 'Processing') {
                if (isChatOrder) {
                    navigation.replace('ChatOrderDetails', {
                        orderId: orderData.orderId,
                        vendorId: orderData.vendorId
                    });
                } else {
                    navigation.replace('OrderDetails', {
                        orderId: orderData.orderId,
                        vendorId: orderData.vendorId
                    });
                }
            } else {
                navigation.goBack();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update order status');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = () => {
        console.log('[OrderAlertScreen] Accept button pressed');
        const isChatOrder = orderData.isChatOrder === true || orderData.isChatOrder === 'true';
        if (isChatOrder) {
            if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
            notificationService.stopRingtone();
            Vibration.cancel();
            navigation.replace('ChatOrderDetails', {
                orderId: orderData.orderId,
                vendorId: orderData.vendorId
            });
        } else {
            handleUpdateStatus('Processing');
        }
    };

    const handleDecline = () => {
        setShowRejectModal(true);
    };

    const confirmReject = () => {
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
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                    <Icon name="bell-ring" size={70} color="#fff" />
                </Animated.View>
                <Text style={styles.title}>INCOMING ORDER!</Text>
                <View style={styles.orderIdBadge}>
                    <Text style={styles.orderIdText}>#{orderData.shortId}</Text>
                </View>
            </View>

            <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>ITEMS</Text>
                        <Text style={styles.detailValue}>{orderData.itemCount || '1'}</Text>
                    </View>
                    <View style={styles.vLine} />
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>EARNING</Text>
                        <Text style={[styles.detailValue, { color: '#4CAF50' }]}>{formatPrice(orderData.totalAmount)}</Text>
                    </View>
                </View>

                <View style={styles.hLine} />

                <View style={styles.infoRow}>
                    <Icon name="account" size={20} color="#ff6600" />
                    <Text style={[styles.infoText, { fontWeight: 'bold' }]}>
                        {orderData.customerName || 'Customer'}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Icon name="package-variant" size={20} color="#ff6600" />
                    <Text style={styles.infoText} numberOfLines={2}>
                        {orderData.productSummary || 'Loading items...'}
                    </Text>
                </View>

                {orderData.customerAddress && (
                    <View style={styles.infoRow}>
                        <Icon name="map-marker" size={20} color="#ff6600" />
                        <Text style={styles.infoText} numberOfLines={1}>{orderData.customerAddress}</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.actionButton, styles.declineBtn]} onPress={handleDecline}>
                    <Icon name="close" size={32} color="#fff" />
                    <Text style={styles.actionText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, styles.acceptBtn]} onPress={handleAccept}>
                    <Icon name="check-bold" size={36} color="#fff" />
                    <Text style={styles.actionText}>
                        {(orderData.isChatOrder === true || orderData.isChatOrder === 'true') ? 'View Request' : 'Accept'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Rejection Reason Modal */}
            <Modal
                transparent={true}
                visible={showRejectModal}
                animationType="slide"
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
                                        selectedReason === reason.value && styles.selectedReasonItem
                                    ]}
                                    onPress={() => setSelectedReason(reason.value)}
                                >
                                    <Icon
                                        name={selectedReason === reason.value ? "radiobox-marked" : "radiobox-blank"}
                                        size={24}
                                        color={selectedReason === reason.value ? "#ff6600" : "#888"}
                                    />
                                    <Text style={[
                                        styles.reasonLabel,
                                        selectedReason === reason.value && styles.selectedReasonLabel
                                    ]}>
                                        {reason.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                            {selectedReason === 'other' && (
                                <TextInput
                                    style={styles.customInput}
                                    placeholder="Enter custom reason..."
                                    placeholderTextColor="#888"
                                    value={customReason}
                                    onChangeText={setCustomReason}
                                    multiline
                                />
                            )}
                        </ScrollView>

                        <View style={styles.modalButtons}>
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
                                onPress={confirmReject}
                            >
                                <Text style={styles.confirmBtnText}>Confirm Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#ff6600" />
                    <Text style={styles.loadingText}>Updating Order...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#151515',
        justifyContent: 'space-between',
        paddingVertical: 50,
        paddingHorizontal: 25,
    },
    header: {
        alignItems: 'center',
        marginTop: 30,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#ff6600',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 25,
        elevation: 15,
        shadowColor: '#ff6600',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        position: 'relative',
    },
    timerBadge: {
        position: 'absolute',
        bottom: -10,
        right: -10,
        backgroundColor: '#fff',
        borderRadius: 15,
        paddingHorizontal: 12,
        paddingVertical: 6,
        elevation: 5,
    },
    timerText: {
        color: '#ff6600',
        fontWeight: '900',
        fontSize: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
    },
    orderIdBadge: {
        backgroundColor: '#2a2a2a',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 10,
        marginTop: 10,
    },
    orderIdText: {
        fontSize: 18,
        color: '#ff6600',
        fontWeight: 'bold',
    },
    detailsCard: {
        backgroundColor: '#222',
        borderRadius: 25,
        padding: 25,
        width: '100%',
        borderWidth: 1,
        borderColor: '#333',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    detailItem: {
        flex: 1,
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: '#888',
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 1.5,
    },
    detailValue: {
        fontSize: 24,
        color: '#fff',
        fontWeight: '900',
    },
    vLine: {
        width: 1,
        height: '100%',
        backgroundColor: '#444',
    },
    hLine: {
        height: 1,
        width: '100%',
        backgroundColor: '#444',
        marginVertical: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 5,
    },
    infoText: {
        fontSize: 16,
        color: '#eee',
        marginLeft: 12,
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    actionButton: {
        width: '46%',
        height: 100,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
    },
    acceptBtn: {
        backgroundColor: '#2E7D32',
    },
    declineBtn: {
        backgroundColor: '#C62828',
    },
    actionText: {
        color: '#fff',
        marginTop: 10,
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 1,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#222',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
    },
    reasonsList: {
        marginBottom: 20,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    selectedReasonItem: {
        backgroundColor: 'rgba(255, 102, 0, 0.1)',
    },
    reasonLabel: {
        fontSize: 16,
        color: '#eee',
        marginLeft: 15,
    },
    selectedReasonLabel: {
        color: '#ff6600',
        fontWeight: 'bold',
    },
    customInput: {
        backgroundColor: '#333',
        borderRadius: 10,
        padding: 15,
        color: '#fff',
        marginTop: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalBtn: {
        width: '48%',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#444',
    },
    confirmBtn: {
        backgroundColor: '#ff6600',
    },
    cancelBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    confirmBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // Loading Styles
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        color: '#fff',
        marginTop: 15,
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default OrderAlertScreen;
