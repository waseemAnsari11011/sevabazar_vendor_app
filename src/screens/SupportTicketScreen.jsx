import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import client from '../api/client';

const SupportTicketScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [vendor, setVendor] = useState(null);

    const COOLDOWN_DURATION = 5 * 60; // 5 minutes in seconds

    useEffect(() => {
        loadVendor();
        checkCooldown();
    }, []);

    const loadVendor = async () => {
        const data = await AsyncStorage.getItem('vendorData');
        if (data) setVendor(JSON.parse(data));
    };

    const checkCooldown = async () => {
        const lastTime = await AsyncStorage.getItem('last_vendor_ticket_time');
        if (lastTime) {
            const diff = Math.floor((Date.now() - parseInt(lastTime)) / 1000);
            if (diff < COOLDOWN_DURATION) {
                startCooldown(COOLDOWN_DURATION - diff);
            }
        }
    };

    const startCooldown = (seconds) => {
        setCooldown(seconds);
        const timer = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSubmit = async () => {
        if (!vendor) return;
        setLoading(true);
        try {
            const response = await client.post('/tickets/create', {
                vendorId: vendor._id,
                userType: 'Vendor',
                reason: "Vendor Support Request"
            });

            if (response.data && response.data.success) {
                await AsyncStorage.setItem('last_vendor_ticket_time', Date.now().toString());
                startCooldown(COOLDOWN_DURATION);
                Alert.alert("Success", "Support ticket generated! Our team will contact you soon.");
            } else {
                Alert.alert("Error", response.data?.message || "Failed to generate ticket.");
            }
        } catch (error) {
            console.error("Ticket error:", error);
            Alert.alert("Error", "Something went wrong. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    <Icon name="headset" size={60} color="#ff6600" />
                </View>
                <Text style={styles.title}>Need Support?</Text>
                <Text style={styles.subtitle}>
                    Click below to generate a support ticket. Our team will get back to you shortly.
                </Text>

                {cooldown > 0 ? (
                    <View style={styles.cooldownContainer}>
                        <Text style={styles.cooldownText}>
                            Please wait {formatTime(cooldown)} before generating another ticket.
                        </Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Generate Support Ticket</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

export default SupportTicketScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF5F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    button: {
        backgroundColor: '#ff6600',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    cooldownContainer: {
        backgroundColor: '#FEE2E2',
        padding: 15,
        borderRadius: 12,
        width: '100%',
    },
    cooldownText: {
        color: '#DC2626',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: 14,
    },
});
