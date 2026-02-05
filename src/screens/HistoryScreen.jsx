import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Modal, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import DateFilter from '../components/DateFilter';
import { getDateRange } from '../utils/dateUtils';

const HistoryScreen = ({ navigation }) => {
    const [allHistory, setAllHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('today');
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [activeTab, setActiveTab] = useState('normal');
    const [vendorId, setVendorId] = useState(null);

    useFocusEffect(
        useCallback(() => {
            fetchHistory(selectedFilter, customStart, customEnd, activeTab);
        }, [selectedFilter, customStart, customEnd, activeTab])
    );

    const fetchHistory = async (filter, start, end, tab) => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                const vId = vendor._id;
                setVendorId(vId);

                const { startDate, endDate } = getDateRange(filter, start, end);
                const params = {};
                if (startDate && endDate) {
                    params.startDate = startDate;
                    params.endDate = endDate;
                }

                if (tab === 'normal') {
                    const normalRes = await client.get(`/order/vendor/${vId}`, { params });
                    const normalHistory = (normalRes.data.data || []).filter(o =>
                        ['Delivered', 'Cancelled'].includes(o.vendors?.orderStatus)
                    ).map(o => ({ ...o, type: 'normal' }));
                    setAllHistory(normalHistory);
                } else {
                    const chatRes = await client.get(`/chat-order/vendor/${vId}`, { params });
                    const chatHistory = (chatRes.data.data || []).filter(o =>
                        ['Delivered', 'Cancelled'].includes(o.orderStatus)
                    ).map(o => ({ ...o, type: 'chat' }));
                    setAllHistory(chatHistory);
                }
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (filter) => {
        if (filter === 'custom') {
            setShowRangeModal(true);
        } else {
            setSelectedFilter(filter);
        }
    };

    const applyCustomRange = () => {
        if (!customStart || !customEnd) {
            Alert.alert('Error', 'Please enter both start and end dates (YYYY-MM-DD)');
            return;
        }
        setShowRangeModal(false);
        setSelectedFilter('custom');
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => item.type === 'normal'
                ? navigation.navigate('OrderDetails', { orderId: item._id, vendorId })
                : navigation.navigate('ChatOrderDetails', { orderId: item._id, vendorId })
            }
        >
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.orderId}>#{item.shortId || item.orderId}</Text>
                    <Text style={styles.typeTag}>{item.type === 'normal' ? 'Normal Order' : 'Chat Order'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (item.vendors?.orderStatus || item.orderStatus) === 'Delivered' ? '#E8F5E9' : '#FFEBEE' }]}>
                    <Text style={[styles.statusText, { color: (item.vendors?.orderStatus || item.orderStatus) === 'Delivered' ? '#2E7D32' : '#C62828' }]}>
                        {(item.vendors?.orderStatus || item.orderStatus)?.toUpperCase()}
                    </Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.amount}>₹{item.totalAmount || 0}</Text>
                <View style={styles.footerActions}>
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <TouchableOpacity
                        onPress={() => Linking.openURL(item.type === 'normal'
                            ? `http://10.0.2.2:3000/order/invoice/${item._id}`
                            : `http://10.0.2.2:3000/chat-order/invoice/${item._id}`)}
                        style={styles.invoiceAction}
                    >
                        <Text style={styles.invoiceLink}>INVOICE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    const CustomTabBar = () => (
        <View style={styles.tabBarContainer}>
            <TouchableOpacity
                onPress={() => setActiveTab('normal')}
                style={[styles.tabItem, activeTab === 'normal' && styles.activeTabItem]}
            >
                <Text style={[styles.tabLabel, activeTab === 'normal' ? styles.activeTabLabel : styles.inactiveTabLabel]}>
                    Normal Order
                </Text>
                {activeTab === 'normal' && <View style={styles.indicator} />}
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => setActiveTab('chat')}
                style={[styles.tabItem, activeTab === 'chat' && styles.activeTabItem]}
            >
                <Text style={[styles.tabLabel, activeTab === 'chat' ? styles.activeTabLabel : styles.inactiveTabLabel]}>
                    Chat Order
                </Text>
                {activeTab === 'chat' && <View style={styles.indicator} />}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <CustomTabBar />
            <DateFilter
                selectedFilter={selectedFilter}
                onFilterChange={handleFilterChange}
            />
            {loading ? (
                <ActivityIndicator size="large" color="#ff6600" style={styles.loader} />
            ) : (
                <FlatList
                    data={allHistory}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={renderItem}
                    onRefresh={() => fetchHistory(selectedFilter, customStart, customEnd, activeTab)}
                    refreshing={loading}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.empty}>No history found.</Text>}
                />
            )}

            <Modal
                visible={showRangeModal}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Date Range</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Start Date (YYYY-MM-DD)"
                            value={customStart}
                            onChangeText={setCustomStart}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="End Date (YYYY-MM-DD)"
                            value={customEnd}
                            onChangeText={setCustomEnd}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowRangeModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.applyButton]} onPress={applyCustomRange}>
                                <Text style={styles.applyButtonText}>Apply</Text>
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
    listContainer: {
        padding: 16,
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
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    typeTag: {
        fontSize: 10,
        color: '#8E8E93',
        marginTop: 2,
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
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    invoiceAction: {
        marginLeft: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#F2F2F7',
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    invoiceLink: {
        fontSize: 10,
        color: '#555',
        fontWeight: '700',
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        color: '#8E8E93',
        fontSize: 16,
    },
    loader: {
        marginTop: 40,
    },
    tabBarContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
        height: 50,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    activeTabLabel: {
        color: '#ff6600',
        fontWeight: '700',
    },
    inactiveTabLabel: {
        color: '#8E8E93',
    },
    indicator: {
        position: 'absolute',
        bottom: 0,
        height: 3,
        backgroundColor: '#ff6600',
        width: '60%',
        borderRadius: 3,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#F2F2F7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    cancelButton: {
        backgroundColor: '#F2F2F7',
    },
    applyButton: {
        backgroundColor: '#ff6600',
    },
    cancelButtonText: {
        color: '#8E8E93',
        fontWeight: '600',
    },
    applyButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

export default HistoryScreen;
