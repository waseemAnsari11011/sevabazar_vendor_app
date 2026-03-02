import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, NativeModules, AppState } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ChatOrderDetailsScreen from '../screens/ChatOrderDetailsScreen';
import CreateChatOrderScreen from '../screens/CreateChatOrderScreen';
import MainTabNavigator from './MainTabNavigator';
import SupportTicketScreen from '../screens/SupportTicketScreen';
import BlockedScreen from '../screens/BlockedScreen';
import CancelledOrdersScreen from '../screens/CancelledOrdersScreen';
import client from '../api/client';
import { navigationRef, navigate, push } from './NavigationService';
import OrderAlertScreen from '../screens/OrderAlertScreen';
import PermissionScreen from '../screens/PermissionScreen';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

const Stack = createStackNavigator();

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = useState(null);
    const [initialOrderData, setInitialOrderData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeFCM;
        let unsubscribeNotifee;

        const setupEvents = async () => {
            console.log('[AppNavigator] Setting up foreground listeners...');

            // 1. Handle background to foreground transition (FCM)
            messaging().onNotificationOpenedApp(remoteMessage => {
                console.log('[AppNavigator] App opened from background state via FCM:', remoteMessage.notification);
                notificationService.handleForegroundOrder(remoteMessage.data);
            });

            // 2. Handle Notifee foreground events (clicks)
            unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
                if (type === EventType.PRESS) {
                    console.log('[AppNavigator] Notifee Foreground Press:', detail.notification);
                    notificationService.handleForegroundOrder(detail.notification?.data);
                }
            });
        };

        const checkLogin = async () => {
            try {
                console.log('[AppNavigator] Starting checkLogin...');
                // Check permissions first
                const permStatus = await notificationService.checkPermissionStatus();
                // ... existing checkLogin logic ...
                console.log('[AppNavigator] Permission Status Result:', permStatus);

                if (!permStatus.success) {
                    console.log('[AppNavigator] Redirecting to Permissions');
                    setInitialRoute('Permissions');
                    setLoading(false);
                    return;
                }
                const token = await AsyncStorage.getItem('vendorToken');
                if (token) {
                    const vendorData = await AsyncStorage.getItem('vendorData');
                    if (vendorData) {
                        const parsed = JSON.parse(vendorData);

                        // Unified setup
                        await notificationService.init();
                        await setupEvents();
                        await notificationService.setupForegroundHandlers(parsed._id);

                        // CRITICAL: Check for pending order/taps BEFORE setting initial route
                        let orderData = null;
                        let targetRoute = 'Home';

                        // 0. Check native SharedPreferences (from tapping native Android notification on cold start)
                        try {
                            const tapData = await NativeModules.ActivityLauncher?.getPendingTap?.();
                            if (tapData?.orderId) {
                                orderData = tapData;
                                console.log('[AppNavigator] Native tap detected in checkLogin:', tapData.orderId);
                            }
                        } catch (e) {
                            console.log('[AppNavigator] No native pending tap:', e);
                        }

                        // 1. Check Notifee (Cold start from tap)
                        if (!orderData) {
                            const notifeeInitial = await notifee.getInitialNotification();
                            if (notifeeInitial?.notification?.data) {
                                orderData = notifeeInitial.notification.data;
                                console.log('[AppNavigator] Notifee tap detected in checkLogin:', orderData.shortId);
                            }
                        }

                        // 2. Check FCM (Standard fallback)
                        if (!orderData) {
                            const initialFCM = await messaging().getInitialNotification();
                            if (initialFCM?.data) {
                                orderData = initialFCM.data;
                                console.log('[AppNavigator] FCM tap detected in checkLogin');
                            }
                        }

                        // 3. Check AsyncStorage bridge
                        if (!orderData) {
                            const pendingOrderStr = await AsyncStorage.getItem('pending_order_alert');
                            if (pendingOrderStr) {
                                try {
                                    orderData = JSON.parse(pendingOrderStr);
                                    console.log('[AppNavigator] AsyncStorage order detected in checkLogin:', orderData.shortId);
                                } catch (e) { }
                            }
                        }

                        if (orderData) {
                            // Ensure vendorId is present (backend might omit it for cancellations)
                            if (!orderData.vendorId && parsed?._id) {
                                orderData.vendorId = parsed._id;
                            }

                            setInitialOrderData(orderData);
                            const wasTapped = orderData.wasTapped === 'true';
                            const isCancelled = orderData.type === 'order_cancelled';

                            if (wasTapped || isCancelled) {
                                // If it's a tap or a cancellation (which we want to show details for)
                                targetRoute = orderData.orderType === 'chat' ? 'ChatOrderDetails' : 'OrderDetails';
                                // Clear it so we don't handle it again in handleNavigatorReady
                                await AsyncStorage.removeItem('pending_order_alert');
                            } else {
                                // New incoming order -> Call Screen
                                targetRoute = 'OrderAlert';
                            }
                        }

                        // Refresh Device Token
                        try {
                            const deviceToken = await messaging().getToken();
                            if (deviceToken) {
                                await client.post('/vendors/me/save-device-token', { deviceToken });
                            }
                        } catch (tokenErr) {
                            console.error('Failed to refresh device token:', tokenErr);
                        }

                        // Check block status
                        try {
                            const res = await client.get(`/vendors/customer/${parsed._id}/details`);
                            if (res.data.isBlocked) {
                                setInitialRoute('Blocked');
                            } else {
                                setInitialRoute(targetRoute);
                            }
                        } catch (apiError) {
                            setInitialRoute(targetRoute);
                        }
                    } else {
                        setInitialRoute('Login');
                    }
                } else {
                    setInitialRoute('Login');
                }
            } catch (error) {
                setInitialRoute('Login');
            } finally {
                setLoading(false);
            }
        };

        checkLogin();

        // Re-check permissions and handle pending notifications on app resume
        const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('[AppNavigator] App resumed to ACTIVE state. checking for alerts...');

                // 0. Check for native SharedPreferences tap (from tapping native Android notification)
                try {
                    const { ActivityLauncher } = NativeModules;
                    if (ActivityLauncher?.getPendingTap) {
                        const tapData = await ActivityLauncher.getPendingTap();
                        if (tapData && tapData.orderId) {
                            console.log('[AppNavigator] Resumed: Native pending tap found:', tapData.orderId);
                            let vId = tapData.vendorId;
                            if (!vId) {
                                const vData = await AsyncStorage.getItem('vendorData');
                                if (vData) vId = JSON.parse(vData)._id;
                            }
                            if (vId && navigationRef.isReady()) {
                                const screen = tapData.orderType === 'chat' ? 'ChatOrderDetails' : 'OrderDetails';
                                push(screen, { orderId: tapData.orderId, vendorId: vId });
                            }
                            return; // Done, skip AsyncStorage check
                        }
                    }
                } catch (tapErr) {
                    console.error('[AppNavigator] Error reading native pending tap:', tapErr);
                }

                // 1. Check for pending notifications from background tap
                try {
                    const pendingStr = await AsyncStorage.getItem('pending_order_alert');
                    if (pendingStr) {
                        console.log('[AppNavigator] Resumed: Handling pending notification from Storage bridge');
                        const data = JSON.parse(pendingStr);
                        await AsyncStorage.removeItem('pending_order_alert');

                        const isCancelled = data.type === 'order_cancelled';
                        const wasTapped = data.wasTapped === 'true';

                        if (isCancelled && wasTapped) {
                            // Direct navigation for cancellation taps — skip handleForegroundOrder
                            console.log('[AppNavigator] Resumed: Navigating to OrderDetails for tapped cancellation');
                            try {
                                let vId = data.vendorId;
                                if (!vId) {
                                    const vData = await AsyncStorage.getItem('vendorData');
                                    if (vData) vId = JSON.parse(vData)._id;
                                }
                                if (vId && navigationRef.isReady()) {
                                    const screen = data.orderType === 'chat' ? 'ChatOrderDetails' : 'OrderDetails';
                                    push(screen, { orderId: data.orderId, vendorId: vId });
                                }
                            } catch (navErr) {
                                console.error('[AppNavigator] Error navigating cancellation tap:', navErr);
                            }
                        } else {
                            notificationService.handleForegroundOrder(data);
                        }
                    }
                } catch (e) {
                    console.error('[AppNavigator] Error checking pending alert on resume:', e);
                }

                // 2. Refresh permission status
                const permStatus = await notificationService.checkPermissionStatus();
                if (!permStatus.success) {
                    if (navigationRef.isReady()) {
                        const currentRoute = navigationRef.getCurrentRoute();
                        if (currentRoute?.name !== 'Permissions') {
                            console.log('[AppNavigator] Permissions lost on resume, redirecting...');
                            navigate('Permissions');
                        }
                    }
                }
            }
        });

        return () => {
            if (unsubscribeFCM) unsubscribeFCM();
            if (unsubscribeNotifee) unsubscribeNotifee();
            socketService.disconnect();
            appStateSubscription.remove();
        };
    }, []);

    const handleNavigatorReady = async () => {
        console.log('[AppNavigator] Navigator READY.');
        // Clear bridge data after a short delay just in case it wasn't cleared in checkLogin
        setTimeout(async () => {
            try {
                // If initialRoute was a detail screen, we already handled it.
                if (['OrderDetails', 'ChatOrderDetails', 'OrderAlert'].includes(initialRoute)) {
                    console.log('[AppNavigator] Initial notification already handled via initialRoute:', initialRoute);
                    await AsyncStorage.removeItem('pending_order_alert');
                    return;
                }

                // Fallback for cases where checkLogin might have missed something (rare)
                const pendingOrderStr = await AsyncStorage.getItem('pending_order_alert');
                if (pendingOrderStr) {
                    console.log('[AppNavigator] Handling missed pending order from AsyncStorage bridge');
                    const pendingData = JSON.parse(pendingOrderStr);
                    await AsyncStorage.removeItem('pending_order_alert');
                    notificationService.handleForegroundOrder(pendingData);
                }
            } catch (err) {
                console.error('[AppNavigator] Error in handleNavigatorReady cleanup:', err);
            }
        }, 500);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ff6600" />
            </View>
        );
    }

    return (
        <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
            <Stack.Navigator initialRouteName={initialRoute}>
                <Stack.Screen name="Permissions" component={PermissionScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Home" component={MainTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen
                    name="OrderDetails"
                    component={OrderDetailsScreen}
                    options={{ title: 'Order Details' }}
                    initialParams={initialRoute === 'OrderDetails' ? { orderId: initialOrderData?.orderId, vendorId: initialOrderData?.vendorId } : null}
                />
                <Stack.Screen
                    name="ChatOrderDetails"
                    component={ChatOrderDetailsScreen}
                    options={{ title: 'Chat Order Details' }}
                    initialParams={initialRoute === 'ChatOrderDetails' ? { orderId: initialOrderData?.orderId, vendorId: initialOrderData?.vendorId } : null}
                />
                <Stack.Screen name="CreateChatOrder" component={CreateChatOrderScreen} options={{ title: 'Create Order' }} />
                <Stack.Screen name="SupportTicket" component={SupportTicketScreen} options={{ title: 'Support Ticket' }} />
                <Stack.Screen name="Blocked" component={BlockedScreen} options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="CancelledOrders" component={CancelledOrdersScreen} options={{ title: 'Cancelled Orders' }} />
                <Stack.Screen
                    name="OrderAlert"
                    component={OrderAlertScreen}
                    options={{ headerShown: false, presentation: 'fullScreenModal' }}
                    initialParams={initialOrderData ? { orderData: initialOrderData } : null}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
