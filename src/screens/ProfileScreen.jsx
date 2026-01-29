import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfileScreen = ({ navigation }) => {
    const [vendor, setVendor] = useState(null);

    useEffect(() => {
        loadVendor();
    }, []);

    const loadVendor = async () => {
        const data = await AsyncStorage.getItem('vendorData');
        if (data) setVendor(JSON.parse(data));
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('vendorToken');
        await AsyncStorage.removeItem('vendorData');
        navigation.getParent()?.replace('Login');
    };

    if (!vendor) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{vendor.name?.charAt(0)}</Text>
                </View>
                <Text style={styles.name}>{vendor.name}</Text>
                <Text style={styles.email}>{vendor.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Business Info</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Business Type</Text>
                        <Text style={styles.value}>{vendor.businessType || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Contact Phone</Text>
                        <Text style={styles.value}>{vendor.phone || vendor.contactNumber || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Address</Text>
                        <Text style={[styles.value, { textAlign: 'right', flex: 1, marginLeft: 20 }]}>
                            {vendor.shopAddress || 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginVertical: 32,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ff6600',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '700',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    email: {
        fontSize: 16,
        color: '#8E8E93',
    },
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8E8E93',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginLeft: 4,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    label: {
        fontSize: 14,
        color: '#8E8E93',
    },
    value: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#F2F2F7',
        marginHorizontal: -16,
    },
    logoutBtn: {
        marginTop: 40,
        backgroundColor: '#FFF1F0',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ProfileScreen;
