import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, TouchableOpacity, ScrollView, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socketService';
import { reset } from '../navigation/NavigationService';

const ProfileScreen = ({ navigation }) => {
    const [vendor, setVendor] = useState(null);

    useEffect(() => {
        loadVendor();
    }, []);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => navigation.navigate('Dashboard')}
                    style={{ marginLeft: 15 }}
                >
                    <Icon name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    const loadVendor = async () => {
        const data = await AsyncStorage.getItem('vendorData');
        if (data) setVendor(JSON.parse(data));
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('vendorToken');
            await AsyncStorage.removeItem('vendorData');

            // Explicitly disconnect socket
            socketService.disconnect();

            // Reliable navigation reset to Login
            reset('Login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (!vendor) return null;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    {(vendor.documents?.shopPhoto?.[0] || vendor.shopPhoto) ? (
                        <Image
                            source={{ uri: vendor.documents?.shopPhoto?.[0] || vendor.shopPhoto }}
                            style={styles.avatarImage}
                        />
                    ) : (
                        <Text style={styles.avatarText}>{vendor.name?.charAt(0)}</Text>
                    )}
                </View>
                <Text style={styles.name}>{vendor.name}</Text>
                <Text style={styles.email}>{vendor.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Business Info</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Business Type</Text>
                        <Text style={styles.value}>{vendor.category?.name || vendor.vendorInfo?.businessName || vendor.businessType || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Contact Phone</Text>
                        <Text style={styles.value}>{vendor.vendorInfo?.contactNumber || vendor.phone || vendor.contactNumber || 'N/A'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Address</Text>
                        <Text style={[styles.value, { textAlign: 'right', flex: 1, marginLeft: 20 }]}>
                            {vendor.location?.address?.addressLine1 || vendor.address?.addressLine1 || vendor.shopAddress || 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support & Help</Text>
                <TouchableOpacity
                    style={styles.supportBtn}
                    onPress={() => navigation.navigate('SupportTicket')}
                >
                    <Icon name="headset" size={24} color="#ff6600" />
                    <Text style={styles.supportBtnText}>Contact Support</Text>
                    <Icon name="chevron-right" size={24} color="#8E8E93" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Icon name="logout" size={20} color="#FF3B30" style={{ marginRight: 8 }} />
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
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
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
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
        flexDirection: 'row',
        justifyContent: 'center',
    },
    logoutText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: '700',
    },
    supportBtn: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    supportBtnText: {
        fontSize: 16,
        color: '#1A1A1A',
        fontWeight: '600',
        marginLeft: 12,
    },
});

export default ProfileScreen;
