import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    BackHandler,
    TouchableOpacity,
    Linking,
    StatusBar,
    Animated,
    ActivityIndicator,
    ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import client from '../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import socketService from '../services/socketService';

const BlockedScreen = () => {
    const navigation = useNavigation();
    const [rejectionCount, setRejectionCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Animation specific
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();

        const backAction = () => {
            // Prevent going back
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        // Initial check
        checkStatus();

        // Auto-check every 30 seconds
        const interval = setInterval(checkStatus, 30000);

        return () => {
            backHandler.remove();
            clearInterval(interval);
        };
    }, []);

    const checkStatus = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (!vendorData) return;

            const parsed = JSON.parse(vendorData);
            const vendorId = parsed._id;

            // Updated path to match backend route: /vendors/customer/:id/details
            const response = await client.get(`/vendors/customer/${vendorId}/details`);
            const vendor = response.data;

            if (vendor) {
                // Check isBlocked status
                // Note: fetch might return isBlocked=undefined if not set, handled as false
                if (!vendor.isBlocked) {
                    // Unblocked! Go to Home
                    navigation.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{ name: 'Home' }],
                        })
                    );
                } else {
                    setRejectionCount(vendor.rejectionCount || 3);
                }
            }
        } catch (error) {
            console.log("Error checking status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleContactAdmin = () => {
        Linking.openURL('tel:+919876543210'); // Replace with actual admin number
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('vendorToken');
            await AsyncStorage.removeItem('vendorData');

            // Explicitly disconnect socket
            socketService.disconnect();

            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                })
            );
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#B00020" barStyle="light-content" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    <View style={styles.iconContainer}>
                        <Icon name="store-remove" size={60} color="#B00020" />
                    </View>

                    <Text style={styles.title}>Account Blocked</Text>

                    <Text style={styles.subtitle}>
                        Your shop has been temporarily blocked due to multiple order rejections.
                    </Text>

                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Rejections Today</Text>
                            <Text style={styles.value}>{rejectionCount}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <Text style={styles.label}>Status</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>BLOCKED</Text>
                            </View>
                        </View>

                        <View style={styles.infoBox}>
                            <Icon name="information-outline" size={18} color="#666" style={{ marginRight: 6 }} />
                            <Text style={styles.infoText}>
                                Automated System will unblock your account at <Text style={styles.bold}>12:00 AM</Text> tonight.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.adminButton}
                        onPress={handleContactAdmin}
                    >
                        <Icon name="phone" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Contact Admin</Text>
                    </TouchableOpacity>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.smallButton, styles.refreshButton]}
                            onPress={checkStatus}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#666" size="small" />
                            ) : (
                                <>
                                    <Icon name="refresh" size={18} color="#666" style={{ marginRight: 6 }} />
                                    <Text style={styles.refreshText}>Refresh</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.smallButton, styles.logoutButton]}
                            onPress={handleLogout}
                        >
                            <Icon name="logout" size={18} color="#D32F2F" style={{ marginRight: 6 }} />
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    content: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        backgroundColor: '#FFE5E5',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    card: {
        width: '100%',
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5E5',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    value: {
        fontSize: 16,
        color: '#1A1A1A',
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: '#FFE5E5',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeText: {
        color: '#D32F2F',
        fontWeight: 'bold',
        fontSize: 12,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        color: '#0D47A1',
        fontSize: 14,
        lineHeight: 20,
    },
    bold: {
        fontWeight: 'bold',
    },
    adminButton: {
        backgroundColor: '#1A1A1A',
        width: '100%',
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 12,
    },
    smallButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    refreshButton: {
        backgroundColor: '#F2F2F7',
        borderWidth: 1,
        borderColor: '#D1D1D6',
    },
    logoutButton: {
        backgroundColor: '#FFF1F0',
        borderWidth: 1,
        borderColor: '#FFD1CF',
    },
    refreshText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    },
    logoutText: {
        color: '#D32F2F',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default BlockedScreen;
