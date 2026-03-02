import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import ShopStatusToggle from '../components/ShopStatusToggle';
import { formatPrice } from '../utils/currencyUtils';

const HomeScreen = ({ navigation }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState(null);
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [rejectionCount, setRejectionCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const parsedVendor = JSON.parse(vendorData);
                setVendor(parsedVendor);

                const response = await client.get(`/order/vendor/${parsedVendor._id}`);
                const allOrders = response.data.data || [];

                // Filter only Cancelled orders from TODAY
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const cancelled = allOrders.filter(item => {
                    const orderDate = new Date(item.createdAt);
                    return item.vendors?.orderStatus === 'Cancelled' && orderDate >= today;
                });
                setCancelledOrders(cancelled);

                // Fetch latest vendor details for rejection count
                const vendorRes = await client.get(`/vendors/customer/${parsedVendor._id}/details`);
                if (vendorRes.data) {
                    setRejectionCount(vendorRes.data.rejectionCount || 0);
                    if (vendorRes.data.isBlocked) {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Blocked' }],
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };



    const renderOrderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetails', { orderId: item._id, vendorId: vendor?._id })}
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
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.profileSection}>
                    <View style={styles.avatar}>
                        {(vendor?.documents?.shopPhoto?.[0] || vendor?.shopPhoto) ? (
                            <Image
                                source={{ uri: vendor?.documents?.shopPhoto?.[0] || vendor?.shopPhoto }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarText}>{vendor?.name?.charAt(0) || 'V'}</Text>
                        )}
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <Text style={styles.vendorName}>{vendor?.name || 'Vendor'}</Text>
                        <Text style={styles.shopName}>{vendor?.vendorInfo?.businessName || 'My Shop'}</Text>
                    </View>
                </View>
                <ShopStatusToggle />
            </View>

            {
                rejectionCount > 0 && (
                    <View style={styles.warningBanner}>
                        <Icon name="alert-circle-outline" size={24} color="#fff" />
                        <View style={styles.warningContent}>
                            <Text style={styles.warningTitle}>Warning: High Rejection Rate</Text>
                            <Text style={styles.warningText}>
                                You have rejected {rejectionCount} orders today. 3 rejections will lead to a temporary block.
                            </Text>
                        </View>
                    </View>
                )
            }

            {
                loading ? (
                    <ActivityIndicator size="large" color="#ff6600" style={{ marginTop: 20 }} />
                ) : (
                    <View style={styles.dashboardContent}>
                        {/* Cancelled Orders Card */}
                        <TouchableOpacity
                            style={styles.summaryCard}
                            onPress={() => navigation.navigate('CancelledOrders')}
                        >
                            <View style={styles.summaryIconContainer}>
                                <Icon name="close-circle-outline" size={32} color="#D32F2F" />
                            </View>
                            <View style={styles.summaryTextContainer}>
                                <Text style={styles.summaryTitle}>Cancelled Orders</Text>
                                <Text style={styles.summaryCount}>{rejectionCount}</Text>
                            </View>
                            <Icon name="chevron-right" size={24} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>
                )
            }


        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ff6600',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    profileInfo: {
        justifyContent: 'center',
    },
    greeting: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 2,
    },
    vendorName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
        lineHeight: 20,
    },
    shopName: {
        fontSize: 12,
        color: '#8E8E93',
    },
    chatButton: {
        backgroundColor: '#1A1A1A',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 4,
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
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#8E8E93',
        fontSize: 14,
    },

    dashboardContent: {
        padding: 16,
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F2F2F7',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    summaryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFEBEE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    summaryTextContainer: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    summaryCount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#D32F2F',
    },
    warningBanner: {
        backgroundColor: '#FF3B30',
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 0,
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    warningContent: {
        marginLeft: 12,
        flex: 1,
    },
    warningTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 2,
    },
    warningText: {
        color: '#fff',
        fontSize: 12,
        lineHeight: 16,
    },
});

export default HomeScreen;
