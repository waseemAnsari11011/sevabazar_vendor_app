import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator, // Assuming ActivityManager was a typo for ActivityIndicator
    Dimensions,
    Linking,
    Alert,
    Modal,
    Image,
    Animated,
    Share,
    Pressable
} from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import client from '../api/client';
import { formatPrice } from '../utils/currencyUtils';
import { getDateRange } from '../utils/dateUtils';

const EarningsScreen = ({ navigation }) => {
    const [dailyEarnings, setDailyEarnings] = useState([]);
    const [loading, setLoading] = useState(true);
    // Modal state
    const [selectedDateOrders, setSelectedDateOrders] = useState([]);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [selectedDateLabel, setSelectedDateLabel] = useState('');
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedBillImage, setSelectedBillImage] = useState(null);

    // Zoom and Pan state
    const scale = useRef(new Animated.Value(1)).current;
    const lastScale = useRef(1);
    const translateX = useRef(new Animated.Value(0)).current;
    const lastTranslateX = useRef(0);
    const translateY = useRef(new Animated.Value(0)).current;
    const lastTranslateY = useRef(0);

    const panRef = useRef(null);
    const pinchRef = useRef(null);

    const onPinchGestureEvent = Animated.event(
        [{ nativeEvent: { scale: scale } }],
        { useNativeDriver: true }
    );

    const onPinchHandlerStateChange = (event) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            lastScale.current *= event.nativeEvent.scale;
            // Limit minimum scale to 1
            if (lastScale.current < 1) lastScale.current = 1;
            scale.setValue(lastScale.current);
        }
    };

    const onPanGestureEvent = Animated.event(
        [
            {
                nativeEvent: {
                    translationX: translateX,
                    translationY: translateY,
                },
            },
        ],
        { useNativeDriver: true }
    );

    const onPanHandlerStateChange = (event) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            lastTranslateX.current += event.nativeEvent.translationX;
            lastTranslateY.current += event.nativeEvent.translationY;
            translateX.setOffset(lastTranslateX.current);
            translateX.setValue(0);
            translateY.setOffset(lastTranslateY.current);
            translateY.setValue(0);
        }
    };

    const resetZoom = () => {
        lastScale.current = 1;
        scale.setValue(1);
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        translateX.setOffset(0);
        translateX.setValue(0);
        translateY.setOffset(0);
        translateY.setValue(0);
    };

    // Filter states
    const [selectedFilter, setSelectedFilter] = useState('today');
    const [showRangeModal, setShowRangeModal] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
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
            fetchEarnings();
        }, [selectedFilter, customStart, customEnd])
    );

    const fetchEarnings = async () => {
        try {
            setLoading(true);
            const vendorData = await AsyncStorage.getItem('vendorData');
            if (vendorData) {
                const vendor = JSON.parse(vendorData);
                const vId = vendor._id;

                const { startDate, endDate } = getDateRange(selectedFilter, customStart, customEnd);
                const params = {};
                if (startDate && endDate) {
                    params.startDate = startDate;
                    params.endDate = endDate;
                    params.dateField = 'deliveredAt'; // Filter by delivery date
                }

                // Fetch both normal and chat orders (include all statuses to count completed/incomplete)
                const [normalRes, chatRes] = await Promise.all([
                    client.get(`/order/vendor/${vId}`, { params }),
                    client.get(`/chat-order/vendor/${vId}`, { params })
                ]);

                const normalOrders = (normalRes.data.data || []).map(o => ({
                    ...o,
                    type: 'Normal',
                    status: o.vendors?.orderStatus,
                    amount: o.totalAmount || 0,
                    paymentStatus: o.vendorPaymentStatus || 'Pending',
                    vendorBillFile: o.vendorBillFile || null
                }));

                const chatOrders = (chatRes.data.data || []).map(o => ({
                    ...o,
                    type: 'Chat',
                    status: o.orderStatus,
                    amount: o.totalAmount || 0,
                    paymentStatus: o.vendorPaymentStatus || 'Pending',
                    vendorBillFile: o.vendorBillFile || null
                }));

                const allOrders = [...normalOrders, ...chatOrders];

                // Group by date
                const grouped = allOrders.reduce((acc, order) => {
                    const dateObj = new Date(order.deliveredAt || order.createdAt);
                    const date = dateObj.toISOString().split('T')[0];
                    if (!acc[date]) {
                        acc[date] = {
                            date,
                            totalAmount: 0,
                            count: 0,
                            completedCount: 0,
                            incompleteCount: 0,
                            orders: [],
                            allPaid: true,
                            billFile: null
                        };
                    }

                    if (order.status === 'Delivered') {
                        acc[date].totalAmount += order.amount;
                        if (order.paymentStatus === 'Paid') {
                            acc[date].paidCount = (acc[date].paidCount || 0) + 1;
                        } else {
                            acc[date].pendingCount = (acc[date].pendingCount || 0) + 1;
                            acc[date].allPaid = false;
                        }

                        if (order.vendorBillFile && !acc[date].billFile) {
                            acc[date].billFile = order.vendorBillFile;
                        }
                    } else {
                        // Skip non-delivered orders as they shouldn't count towards earnings
                        return acc;
                    }

                    acc[date].count += 1;
                    acc[date].orders.push(order);
                    return acc;
                }, {});

                // Convert to array and sort by date descending
                const earningsArray = Object.values(grouped).sort((a, b) =>
                    new Date(b.date) - new Date(a.date)
                );

                setDailyEarnings(earningsArray);
            }
        } catch (error) {
            console.error('Error fetching earnings:', error);
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
            Alert.alert('Error', 'Please enter both start and end dates');
            return;
        }
        setShowRangeModal(false);
        setSelectedFilter('custom');
    };

    const handleCardPress = (item) => {
        setSelectedDateOrders(item.orders);
        setSelectedDateLabel(new Date(item.date).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }));
        setShowOrdersModal(true);
    };

    const handleViewBill = (item) => {
        if (item.billFile) {
            const isImage = item.billFile.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|avif)$/);
            if (isImage) {
                resetZoom();
                setSelectedBillImage(item.billFile);
                setShowImageModal(true);
            } else {
                Linking.openURL(item.billFile).catch((err) => {
                    console.error('An error occurred', err);
                    Alert.alert('Error', 'Could not open the bill URL.');
                });
            }
        } else {
            Alert.alert(
                'Bill Not Available',
                'Admin has not uploaded the bill for this payment yet. Please check back later.'
            );
        }
    };

    const handleShareBill = async () => {
        try {
            if (!selectedBillImage) return;
            await Share.share({
                url: selectedBillImage,
                message: `Bill Receipt: ${selectedBillImage}`,
            });
        } catch (error) {
            console.error('Error sharing bill:', error);
        }
    };

    const getTimeBadge = (dateStr) => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (dateStr === today) return 'TODAY';
        if (dateStr === yesterday) return 'YESTERDAY';

        return new Date(dateStr).toLocaleDateString([], { weekday: 'long' }).toUpperCase();
    };

    const renderEarningsCard = ({ item }) => {
        const dateObj = new Date(item.date);
        const month = dateObj.toLocaleDateString([], { month: 'short' }).toUpperCase();
        const day = dateObj.getDate();
        const timeBadge = getTimeBadge(item.date);

        return (
            <TouchableOpacity style={styles.card} onPress={() => handleCardPress(item)}>
                {/* Top Section */}
                <View style={styles.cardHeader}>
                    <View style={styles.calendarBadge}>
                        <View style={styles.calendarMonth}>
                            <Text style={styles.monthText}>{month}</Text>
                        </View>
                        <View style={styles.calendarDay}>
                            <Text style={styles.dayText}>{day}</Text>
                        </View>
                    </View>

                    <View style={styles.orderInfoContainer}>
                        <Text style={styles.orderTitle}>Total Orders: {item.count}</Text>
                        <View style={styles.statusRow}>
                            <View style={styles.statusDotLabel}>
                                <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                                <Text style={styles.statusLabelText}>{item.paidCount || 0} Paid</Text>
                            </View>
                            <View style={[styles.statusDotLabel, { marginLeft: 12 }]}>
                                <View style={[styles.dot, { backgroundColor: (item.pendingCount || 0) > 0 ? '#ff6600' : '#BDBDBD' }]} />
                                <Text style={styles.statusLabelText}>{item.pendingCount || 0} Pending</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statusBadgeContainer}>
                        <View style={[styles.statusBadge, item.allPaid ? styles.completedBadge : styles.pendingBadge]}>
                            <Icon
                                name={item.allPaid ? "check-circle" : "clock-outline"}
                                size={12}
                                color={item.allPaid ? "#4CAF50" : "#ff6600"}
                            />
                            <Text style={[styles.statusBadgeText, { color: item.allPaid ? "#4CAF50" : "#ff6600" }]}>
                                {item.allPaid ? "COMPLETED" : "IN PROGRESS"}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Divider Line */}
                <View style={styles.divider} />

                {/* Bottom Section */}
                <View style={styles.cardFooter}>
                    <TouchableOpacity
                        style={[styles.viewBillButton, !item.billFile && item.allPaid && item.completedCount > 0 && { opacity: 0.6 }]}
                        onPress={() => handleViewBill(item)}
                        activeOpacity={0.7}
                    >
                        <Icon
                            name={item.billFile ? "file-check-outline" : "file-document-outline"}
                            size={16}
                            color={item.billFile ? "#4CAF50" : "#2196F3"}
                        />
                        <Text style={[styles.viewBillText, item.billFile && { color: "#4CAF50" }]}>
                            {item.billFile ? "View Bill" : "Bill Pending"}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.earningsContainer}>
                        <Text style={styles.earningsLabel}>EARNINGS</Text>
                        <Text style={styles.earningsValue}>{formatPrice(item.totalAmount)}</Text>
                    </View>
                </View>

                {/* Paid indicator handled in header badge */}
            </TouchableOpacity>
        );
    };

    const renderOrderListItem = ({ item }) => (
        <View style={styles.orderItem}>
            <View style={{ flex: 1 }}>
                <Text style={styles.orderId}>#{item.shortId || item.orderId}</Text>
                <Text style={styles.orderType}>{item.type} Order</Text>
                <Text style={styles.orderDate}>
                    {new Date(item.deliveredAt || item.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })} | {new Date(item.deliveredAt || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={[styles.miniStatusBadge, { backgroundColor: item.paymentStatus === 'Paid' ? '#E8F5E9' : '#FFF5EF', marginLeft: 0, flexDirection: 'row', alignItems: 'center' }]}>
                    {item.paymentStatus === 'Paid' && <Icon name="check-circle" size={10} color="#2E7D32" style={{ marginRight: 2 }} />}
                    <Text style={[styles.miniStatusText, { color: item.paymentStatus === 'Paid' ? '#2E7D32' : '#ff6600' }]}>
                        {item.paymentStatus === 'Paid' ? 'Paid' : 'Pending'}
                    </Text>
                </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.orderAmount}>{formatPrice(item.amount)}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" color="#ff6600" style={styles.loader} />
            ) : (
                <FlatList
                    data={dailyEarnings}
                    keyExtractor={(item) => item.date}
                    renderItem={renderEarningsCard}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={<Text style={styles.empty}>No earnings records found.</Text>}
                    onRefresh={fetchEarnings}
                    refreshing={loading}
                />
            )}

            <Modal
                visible={showOrdersModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOrdersModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Orders on {selectedDateLabel}</Text>
                            <TouchableOpacity onPress={() => setShowOrdersModal(false)}>
                                <Icon name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={selectedDateOrders}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={renderOrderListItem}
                            contentContainerStyle={styles.modalList}
                        />
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showRangeModal}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.rangeModalContainer}>
                    <View style={styles.rangeModalContent}>
                        <Text style={styles.rangeModalTitle}>Select Date Range</Text>
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

            {/* Image Preview Modal */}
            <Modal
                visible={showImageModal}
                transparent={true}
                onRequestClose={() => setShowImageModal(false)}
                animationType="fade"
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={styles.imageModalContainer}>
                        <View style={styles.imageModalHeader}>
                            <TouchableOpacity
                                style={styles.imageHeaderBtn}
                                onPress={handleShareBill}
                            >
                                <Icon name="share-variant" size={26} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.imageHeaderBtn}
                                onPress={() => setShowImageModal(false)}
                            >
                                <Icon name="close" size={30} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <PanGestureHandler
                            ref={panRef}
                            simultaneousHandlers={[pinchRef]}
                            onGestureEvent={onPanGestureEvent}
                            onHandlerStateChange={onPanHandlerStateChange}
                            minPointers={1}
                            maxPointers={1}
                        >
                            <Animated.View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                <PinchGestureHandler
                                    ref={pinchRef}
                                    simultaneousHandlers={[panRef]}
                                    onGestureEvent={onPinchGestureEvent}
                                    onHandlerStateChange={onPinchHandlerStateChange}
                                >
                                    <Animated.View
                                        style={{
                                            transform: [
                                                { scale: scale },
                                                { translateX: translateX },
                                                { translateY: translateY },
                                            ],
                                        }}
                                        collapsable={false}
                                    >
                                        <Image
                                            source={{ uri: selectedBillImage }}
                                            style={styles.fullBillImage}
                                            resizeMode="contain"
                                            collapsable={false}
                                        />
                                    </Animated.View>
                                </PinchGestureHandler>
                            </Animated.View>
                        </PanGestureHandler>

                        <View style={styles.zoomHintContainer}>
                            <Text style={styles.zoomHintText}>Pinch to zoom • Drag to pan</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.resetZoomBtn}
                            onPress={resetZoom}
                        >
                            <Text style={styles.resetZoomText}>Reset Zoom</Text>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
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
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F9',
    },
    listContainer: {
        padding: 16,
    },
    loader: {
        marginTop: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        position: 'relative',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    calendarBadge: {
        width: 50,
        height: 60,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F5F5F7',
        alignItems: 'center',
        elevation: 1,
    },
    calendarMonth: {
        backgroundColor: '#E53935',
        width: '100%',
        paddingVertical: 2,
        alignItems: 'center',
    },
    monthText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    calendarDay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1A1A1A',
    },
    orderInfoContainer: {
        flex: 1,
        marginLeft: 16,
    },
    orderTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDotLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusLabelText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4A4A4A',
    },
    statusBadgeContainer: {
        alignSelf: 'flex-start',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    completedBadge: {
        backgroundColor: '#E8F5E9',
        borderColor: '#81C784',
    },
    pendingBadge: {
        backgroundColor: '#FFF3E0',
        borderColor: '#FFB74D',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        marginLeft: 4,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 12,
    },
    viewBillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F9FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E1E9F5',
    },
    viewBillText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#4A4A4A',
    },
    earningsContainer: {
        alignItems: 'flex-end',
    },
    earningsLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#8E8E93',
        marginBottom: 2,
    },
    earningsValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1A1A1A',
    },
    paidBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        color: '#8E8E93',
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    modalList: {
        paddingBottom: 20,
    },
    orderItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    orderId: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    orderType: {
        fontSize: 11,
        color: '#8E8E93',
        marginTop: 2,
    },
    orderDate: {
        fontSize: 10,
        color: '#ff6600',
        marginTop: 2,
        fontWeight: '500',
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ff6600',
    },
    miniStatusBadge: {
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    miniStatusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    // Range Modal Styles
    rangeModalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    rangeModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    rangeModalTitle: {
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
    // Image Modal Styles
    imageModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageModalHeader: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    imageHeaderBtn: {
        padding: 10,
        marginLeft: 15,
    },
    fullBillImage: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height * 0.7,
    },
    zoomHintContainer: {
        position: 'absolute',
        bottom: 100,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    zoomHintText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '500',
    },
    resetZoomBtn: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#ff6600',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
    },
    resetZoomText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
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

export default EarningsScreen;
