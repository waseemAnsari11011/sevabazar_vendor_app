import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';

const ShopStatusToggle = () => {
    const [isOnline, setIsOnline] = useState(false); // Default to offline until fetched
    const [switching, setSwitching] = useState(false);
    const [vendorId, setVendorId] = useState(null);
    // Removed loading state to render immediately

    useFocusEffect(
        useCallback(() => {
            fetchStatus();
        }, [])
    );

    const fetchStatus = async () => {
        try {
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                setVendorId(vendor._id);

                // Fetch current status
                // Correct public endpoint: /vendors/customer/:id/details
                const response = await client.get(`/vendors/customer/${vendor._id}/details`);
                if (response.data) {
                    setIsOnline(response.data.isOnline);
                }
            }
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    const toggleShopStatus = async () => {
        if (!vendorId) {
            Alert.alert('Error', 'Vendor ID not found for toggling status.');
            return;
        }

        // Optimistic update
        const previousStatus = isOnline;
        const newStatus = !previousStatus;
        setIsOnline(newStatus);
        setSwitching(true);

        try {
            await client.patch(`/vendors/me/toggle-status/${vendorId}`);
        } catch (error) {
            console.error('Error toggling status:', error);
            // Revert on error
            setIsOnline(previousStatus);
            Alert.alert('Error', 'Failed to update shop status. Please try again.');
        } finally {
            setSwitching(false);
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor: isOnline ? '#E8F5E9' : '#FFEBEE' }
            ]}
            onPress={toggleShopStatus}
            disabled={switching}
        >
            <Text style={styles.headerLabel}>Shop Status</Text>
            {switching ? (
                <ActivityIndicator size="small" color={isOnline ? '#2E7D32' : '#C62828'} />
            ) : (
                <Text style={[styles.statusLabel, { color: isOnline ? '#2E7D32' : '#C62828' }]}>
                    {isOnline ? 'Open' : 'Closed'}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        marginRight: 10,
    },
    headerLabel: {
        fontSize: 9,
        color: 'rgba(0,0,0,0.5)',
        fontWeight: '600',
        marginBottom: 1,
        textTransform: 'uppercase',
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '800',
    },
});

export default ShopStatusToggle;
