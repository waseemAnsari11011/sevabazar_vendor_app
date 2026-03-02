import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Modal, Alert, Pressable } from 'react-native';
import DatePicker from 'react-native-date-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { getDateRange } from '../utils/dateUtils';
import { formatPrice } from '../utils/currencyUtils';

const HistoryScreen = ({ navigation }) => {
    const [allHistory, setAllHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('today');
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [activeTab, setActiveTab] = useState('normal');
    const [vendorId, setVendorId] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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
            headerRight: () => (
                <TouchableOpacity
                    onPress={() => setShowFilterDropdown(true)}
                    style={{ marginRight: 15 }}
                >
                    <Icon name="filter-variant" size={24} color="#000" />
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

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
                    params.dateField = 'createdAt'; // Use createdAt to include cancelled orders
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
                <Text style={styles.amount}>{formatPrice(item.totalAmount || 0)}</Text>
                <View style={styles.footerActions}>
                    <Text style={styles.date}>
                        {new Date(item.deliveredAt || item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.deliveredAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Text style={customStart ? styles.dateValue : styles.datePlaceholder}>
                                {customStart || 'Start Date (YYYY-MM-DD)'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Text style={customEnd ? styles.dateValue : styles.datePlaceholder}>
                                {customEnd || 'End Date (YYYY-MM-DD)'}
                            </Text>
                        </TouchableOpacity>

                        <DatePicker
                            modal
                            open={showStartPicker}
                            date={customStart ? new Date(customStart) : new Date()}
                            mode="date"
                            onConfirm={(date) => {
                                setShowStartPicker(false);
                                setCustomStart(date.toISOString().split('T')[0]);
                            }}
                            onCancel={() => {
                                setShowStartPicker(false);
                            }}
                        />

                        <DatePicker
                            modal
                            open={showEndPicker}
                            date={customEnd ? new Date(customEnd) : new Date()}
                            mode="date"
                            onConfirm={(date) => {
                                setShowEndPicker(false);
                                setCustomEnd(date.toISOString().split('T')[0]);
                            }}
                            onCancel={() => {
                                setShowEndPicker(false);
                            }}
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

            {/* Filter Dropdown Modal */}
            <Modal
                visible={showFilterDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowFilterDropdown(false)}
            >
                <Pressable
                    style={styles.dropdownOverlay}
                    onPress={() => setShowFilterDropdown(false)}
                >
                    <View style={styles.dropdownMenu}>
                        <TouchableOpacity
                            style={[styles.dropdownItem, selectedFilter === 'today' && styles.activeDropdownItem]}
                            onPress={() => {
                                handleFilterChange('today');
                                setShowFilterDropdown(false);
                            }}
                        >
                            <Icon name="calendar-today" size={20} color={selectedFilter === 'today' ? '#ff6600' : '#555'} />
                            <Text style={[styles.dropdownText, selectedFilter === 'today' && styles.activeDropdownText]}>Today</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dropdownItem, selectedFilter === 'yesterday' && styles.activeDropdownItem]}
                            onPress={() => {
                                handleFilterChange('yesterday');
                                setShowFilterDropdown(false);
                            }}
                        >
                            <Icon name="calendar-arrow-left" size={20} color={selectedFilter === 'yesterday' ? '#ff6600' : '#555'} />
                            <Text style={[styles.dropdownText, selectedFilter === 'yesterday' && styles.activeDropdownText]}>Yesterday</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dropdownItem, selectedFilter === 'custom' && styles.activeDropdownItem]}
                            onPress={() => {
                                handleFilterChange('custom');
                                setShowFilterDropdown(false);
                            }}
                        >
                            <Icon name="calendar-range" size={20} color={selectedFilter === 'custom' ? '#ff6600' : '#555'} />
                            <Text style={[styles.dropdownText, selectedFilter === 'custom' && styles.activeDropdownText]}>Select Date</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
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
    dateInput: {
        borderWidth: 1,
        borderColor: '#F2F2F7',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        height: 50,
        justifyContent: 'center',
    },
    datePlaceholder: {
        color: '#8E8E93',
        fontSize: 14,
    },
    dateValue: {
        color: '#1A1A1A',
        fontSize: 14,
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
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    dropdownMenu: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 60,
        marginRight: 10,
        width: 160,
        paddingVertical: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    activeDropdownItem: {
        backgroundColor: '#FFF5F0',
    },
    dropdownText: {
        fontSize: 14,
        color: '#333',
        marginLeft: 12,
        fontWeight: '500',
    },
    activeDropdownText: {
        color: '#ff6600',
        fontWeight: '700',
    },
});

export default HistoryScreen;
