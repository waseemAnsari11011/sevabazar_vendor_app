import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidLaunchActivityFlag, EventType, AndroidVisibility, AuthorizationStatus } from '@notifee/react-native';
import Sound from 'react-native-sound';
import { Platform, Alert, Linking, NativeModules, AppState, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigate, push, navigationRef } from '../navigation/NavigationService';
import socketService from './socketService';

const { AppPermission } = NativeModules;

Sound.setCategory('Playback');

const ORDER_NOTIFICATION_ID = 'NEW_ORDER_ALERT';

class NotificationService {
    constructor() {
        this.ringtone = null;
        this.isRingtonePlaying = false;
        this.unsubscribeFCM = null;
    }

    async init() {
        // Create high-priority channel (v6 for forced system update)
        await notifee.createChannel({
            id: 'new_order_v6',
            name: '🚨 High Priority Order Alerts',
            importance: AndroidImportance.MAX,
            sound: 'order_call',
            vibration: true,
            bypassDnd: true,
            visibility: AndroidVisibility.PUBLIC,
        });

        // Create cancellation channel
        await notifee.createChannel({
            id: 'order_cancelled_channel',
            name: 'Order Cancellations',
            importance: AndroidImportance.HIGH,
            sound: 'order_cancelled', // res/raw/order_cancelled.mp3
            vibration: true,
        });

        return await notifee.requestPermission();
    }

    async checkPermissionStatus() {
        if (Platform.OS !== 'android') return { success: true };

        const settings = await notifee.getNotificationSettings();
        const isBatteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();

        const isAuth = settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
        const isNotOptimized = !isBatteryOptimizationEnabled;

        let overlayGranted = true;
        let specialPermsGranted = true;
        let fullScreenIntentGranted = true;
        let brand = 'generic';
        let manufacturer = 'generic';

        if (AppPermission) {
            try {
                brand = (await AppPermission.getDeviceBrand()) || 'generic';
                manufacturer = (await AppPermission.getDeviceManufacturer()) || 'generic';
                overlayGranted = await AppPermission.checkOverlayPermission();
                fullScreenIntentGranted = await AppPermission.canUseFullScreenIntent();
                specialPermsGranted = await AppPermission.checkSpecialPermissions();

                console.log(`[NotificationService] Brand: ${brand}, Mfr: ${manufacturer}, Overlay: ${overlayGranted}, Special: ${specialPermsGranted}`);
            } catch (e) {
                console.log('[NotificationService] Status check failed:', e);
            }
        }

        return {
            notifications: isAuth,
            batteryOptimization: isNotOptimized,
            overlay: overlayGranted,
            special: specialPermsGranted,
            fullScreenIntent: fullScreenIntentGranted,
            brand: brand,
            manufacturer: manufacturer,
            success: isAuth && isNotOptimized && overlayGranted && specialPermsGranted && fullScreenIntentGranted
        };
    }

    async openNotificationSettings() {
        console.log('[NotificationService] Requesting notification permission');
        const settings = await notifee.requestPermission();

        // If still not authorized, open the system settings for notifications
        if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
            console.log('[NotificationService] Not authorized, opening settings');
            await notifee.openNotificationSettings();
        }
    }

    async openBatterySettings() {
        console.log('[NotificationService] openBatterySettings clicked');
        if (Platform.OS === 'android' && AppPermission) {
            AppPermission.requestPermission('battery');
        } else if (Platform.OS === 'android') {
            await notifee.openBatteryOptimizationSettings();
        }
    }

    async openAppDetails() {
        console.log('[NotificationService] openAppDetails clicked');
        if (Platform.OS === 'android' && AppPermission) {
            AppPermission.openAppDetails();
        } else if (Platform.OS === 'android') {
            Linking.openSettings();
        }
    }

    async openOverlaySettings() {
        console.log('[NotificationService] openOverlaySettings clicked');
        if (Platform.OS === 'android' && AppPermission) {
            AppPermission.requestPermission('overlay');
        } else if (Platform.OS === 'android') {
            Linking.openSettings();
        }
    }

    async openSpecialSettings() {
        console.log('[NotificationService] openSpecialSettings clicked');
        if (Platform.OS === 'android' && AppPermission) {
            AppPermission.requestPermission('special');
        } else {
            this.openAppDetails();
        }
    }

    async openFullScreenIntentSettings() {
        console.log('[NotificationService] openFullScreenIntentSettings clicked');
        if (Platform.OS === 'android' && AppPermission) {
            AppPermission.requestPermission('fullscreen');
        } else if (Platform.OS === 'android') {
            Linking.openSettings();
        }
    }

    async requestOverlayPermission() {
        if (Platform.OS === 'android') {
            const hasBeenPrompted = await AsyncStorage.getItem('overlay_v6_prompted');
            if (hasBeenPrompted === 'true') return;

            Alert.alert(
                'Essential Setup Required 🛎️',
                'To see order alerts automatically over other apps (Like POCO/Xiaomi), please enable:\n\n1. Display over other apps (Overlay)\n2. Display pop-up windows while running in background\n3. Autostart\n4. Show on lock screen (VERY IMPORTANT)',
                [
                    { text: 'Later', style: 'cancel' },
                    {
                        text: 'Open App Info', onPress: () => {
                            AsyncStorage.setItem('overlay_v6_prompted', 'true');
                            Linking.openSettings();
                        }
                    }
                ]
            );
        }
    }

    playRingtone() {
        if (this.isRingtonePlaying) {
            console.log('[NotificationService] Ringtone already playing or loading. Skipping.');
            return;
        }

        this.isRingtonePlaying = true; // Set early to prevent parallel loads
        console.log('[NotificationService] Starting ringtone playback...');

        this.ringtone = new Sound('order_call.mp3', Sound.MAIN_BUNDLE, (error) => {
            if (error) {
                console.log('[NotificationService] Sound load error', error);
                this.isRingtonePlaying = false; // Reset on error
                return;
            }
            if (!this.isRingtonePlaying) {
                // Means stopRingtone was called while we were loading!
                this.ringtone.release();
                this.ringtone = null;
                return;
            }
            this.ringtone.setNumberOfLoops(-1);
            this.ringtone.setVolume(1.0);
            this.ringtone.play();
        });
    }

    async stopRingtone() {
        if (this.ringtone && this.isRingtonePlaying) {
            console.log('[NotificationService] Stopping ringtone...');
            this.ringtone.stop();
            this.ringtone.release();
            this.ringtone = null;
            this.isRingtonePlaying = false;
            console.log('[NotificationService] JS Ringtone released');
        }
        // Force vibration to stop as well
        Vibration.cancel();

        // Also cancel the native notification
        await this.cancelCallNotification();

        // CRITICAL: Clear lock screen flags to restore privacy
        try {
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher && ActivityLauncher.clearLockScreenFlags) {
                console.log('[NotificationService] Requesting native lock screen flag clear...');
                ActivityLauncher.clearLockScreenFlags();
            }
        } catch (e) {
            console.log('[NotificationService] Failed to clear lock screen flags:', e);
        }
    }

    async cancelCallNotification() {
        try {
            console.log('[NotificationService] Cancelling notification:', ORDER_NOTIFICATION_ID);
            await notifee.cancelNotification(ORDER_NOTIFICATION_ID);

            // CRITICAL: Also call native bridge to clear ONLY the call alert notification (ID: 1001)
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher && ActivityLauncher.clearNotification) {
                console.log('[NotificationService] Requesting native notification clear for ID 1001...');
                ActivityLauncher.clearNotification(1001);
            }
        } catch (e) {
            console.log('[NotificationService] Failed to cancel specific notifications:', e);
        }
    }

    async handleForegroundOrder(data) {
        console.log('[NotificationService] handleForegroundOrder logic entry:', data?.type, data?.shortId || data?.orderId);
        if (!data) {
            console.log('[NotificationService] handleForegroundOrder: No data provided');
            return;
        }

        // Vibrate to confirm JS is reached
        Vibration.vibrate(500);

        // Robust type detection
        const type = data.type || (data.orderId ? 'new_order' : null);
        const isCancelled = type === 'order_cancelled';
        const wasTapped = data.wasTapped === 'true';

        // 0. EXIT EARLY if we are already on the OrderAlert for this order
        if (navigationRef.isReady()) {
            const currentRoute = navigationRef.getCurrentRoute();
            if (currentRoute?.name === 'OrderAlert' && currentRoute?.params?.orderData?.orderId === data.orderId) {
                console.log('[NotificationService] Already viewing THIS order alert. Skipping redundant processing.');
                this.playRingtone(); // Just ensure sound
                return;
            }
        }

        if (isCancelled) {
            console.log('[NotificationService] Order Cancelled Alert Received:', data.shortId);

            // Play custom cancellation sound once (only if in foreground, native handles background)
            const cancelSound = new Sound('order_cancelled.mp3', Sound.MAIN_BUNDLE, (error) => {
                if (!error) cancelSound.play(() => cancelSound.release());
            });

            // If it was a tap, go to details immediately
            if (wasTapped) {
                try {
                    let vId = data.vendorId;
                    if (!vId) {
                        const vendorData = await AsyncStorage.getItem('vendorData');
                        if (vendorData) {
                            vId = JSON.parse(vendorData)._id;
                        }
                    }
                    if (vId) {
                        const screen = data.orderType === 'chat' ? 'ChatOrderDetails' : 'OrderDetails';
                        navigate(screen, { orderId: data.orderId, vendorId: vId });
                        return; // Done
                    }
                } catch (e) {
                    console.error('[NotificationService] Error during tap navigation:', e);
                }
            }

            // NOTE: Removed notifee.displayNotification here to prevent double notifications.
            // When app is in foreground, the sound above is sufficient feedback.
            // When app is in background, FCMWakeUpService.kt handles the visual notification.
            console.log('[NotificationService] Cancellation handled (sound played, no banner in foreground).');

            // If the Call Screen is currently open for THIS cancelled order, close it
            if (navigationRef.isReady()) {
                const currentRoute = navigationRef.getCurrentRoute();
                if (currentRoute?.name === 'OrderAlert' && currentRoute?.params?.orderData?.orderId === data.orderId) {
                    console.log('[NotificationService] OrderAlert is open for cancelled order. Closing it.');
                    this.stopRingtone();
                    this.cancelCallNotification();
                    navigate('Home');
                }
            }
            return;
        }

        console.log('[NotificationService] Processing Foreground Order:', data?.shortId || data?.orderId);

        // CRITICAL: Force app to foreground
        try {
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher) {
                console.log('[NotificationService] Requesting bringToForeground with data...');
                ActivityLauncher.bringToForeground(data);
            }
        } catch (e) {
            console.log('[NotificationService] ActivityLauncher failed:', e);
        }

        let retryCount = 0;
        const maxRetries = 10;

        const performNavigate = () => {
            console.log('[NotificationService] performNavigate called. Ready?', navigationRef.isReady());
            if (navigationRef.isReady()) {
                console.log('[NotificationService] Navigator is READY. Navigating to OrderAlert with ID:', data.shortId || data.orderId);

                // Use a combination of navigate/push to be extremely aggressive
                navigate('OrderAlert', { orderData: data });

                this.playRingtone();

                // Aggressive Fallback for Lock Screen/Foreground Race Conditions
                setTimeout(() => {
                    if (navigationRef.isReady()) {
                        const currentRoute = navigationRef.getCurrentRoute();
                        const isAlreadyOnOrderScreen = ['OrderAlert', 'OrderDetails', 'ChatOrderDetails'].includes(currentRoute?.name);

                        if (!isAlreadyOnOrderScreen) {
                            console.log('[NotificationService] App settled on non-order screen. Re-enforcing OrderAlert with PUSH...');
                            push('OrderAlert', { orderData: data });
                        } else {
                            console.log('[NotificationService] App already on order screen, skipping reinforcement.');
                        }
                    }
                }, 1000);

            } else {
                retryCount++;
                if (retryCount <= maxRetries) {
                    console.log(`[NotificationService] Navigator NOT ready (Retry ${retryCount}/${maxRetries})...`);
                    setTimeout(performNavigate, 800);
                } else {
                    console.error('[NotificationService] Navigator failed to become ready after max retries.');
                }
            }
        };

        performNavigate();
    }

    async setupForegroundHandlers(vendorId) {
        console.log('[NotificationService] Setting up foreground handlers for:', vendorId);

        // 1. Setup FCM foreground handler (Unsubscribe previous if exists)
        if (this.unsubscribeFCM) {
            this.unsubscribeFCM();
        }

        this.unsubscribeFCM = messaging().onMessage(async remoteMessage => {
            console.log('[NotificationService] FCM Foreground message:', remoteMessage.data?.shortId);
            this.handleForegroundOrder(remoteMessage.data);
        });

        // 2. Setup Socket handler
        if (vendorId) {
            // Disconnect existing socket before reconnecting with new ID
            socketService.disconnect();
            socketService.connect(vendorId);
            socketService.on('new_order', async (data) => {
                console.log('[NotificationService] Socket new_order:', data?.shortId);

                // If in background or inactive (locked), use high-priority notification to wake screen
                if (AppState.currentState !== 'active') {
                    console.log('[NotificationService] App in background, BUT suppressing notification per request. Relying on WakeUpService/ActivityLauncher.');
                    // await this.displayCallNotification(data); // Suppressed to avoid notification icon/banner
                }

                // ALWAYS trigger foreground handling (navigation + JS ringtone)
                // This will also bring the app to foreground via ActivityLauncher if needed
                this.handleForegroundOrder(data);
            });
        }
    }

    async displayCallNotification(data) {
        console.log('[NotificationService] Displaying Order Alert:', data.shortId);

        // BRIDGE: Ensure we bridge it before showing notification for clean wake-up
        try {
            await AsyncStorage.setItem('pending_order_alert', JSON.stringify(data));
            console.log('[NotificationService] [BG] Bridged order data to AsyncStorage');
        } catch (e) { }

        await this.init();

        // Cancel previous to ensure full-screen intent triggers every time
        await notifee.cancelNotification(ORDER_NOTIFICATION_ID);

        await notifee.displayNotification({
            id: ORDER_NOTIFICATION_ID,
            title: '🚨 INCOMING ORDER! 🛎️',
            body: `#${data.shortId} | Estimated Earning: ₹${data.totalAmount}`,
            data: { ...data, launchActivity: 'true' },
            android: {
                channelId: 'new_order_v7',
                importance: AndroidImportance.MAX,
                category: AndroidCategory.CALL,
                visibility: AndroidVisibility.PUBLIC,
                color: '#ff6600',
                ongoing: true,
                autoCancel: false,
                sound: 'order_call', // Explicitly specify sound for background
                fullScreenIntent: {
                    id: 'default',
                    launchActivity: 'com.vendorapp.MainActivity',
                },
                pressAction: {
                    id: 'default',
                    launchActivity: 'com.vendorapp.MainActivity',
                },
                launchActivityFlags: [
                    AndroidLaunchActivityFlag.SINGLE_TOP,
                    AndroidLaunchActivityFlag.CLEAR_TOP,
                    AndroidLaunchActivityFlag.NEW_TASK
                ],
                asForegroundService: true,
                actions: [
                    {
                        title: 'View Order',
                        pressAction: {
                            id: 'view_order',
                            launchActivity: 'com.vendorapp.MainActivity',
                        },
                    },
                ],
            },
        });

        // Trigger ringtone
        console.log('[NotificationService] Triggering JS Ringtone...');
        this.playRingtone();

        // Try to bring to foreground if in foreground context
        try {
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher) {
                try {
                    ActivityLauncher.bringToForeground(data);
                } catch (e) {
                    console.log('[NotificationService] Failed to launch activity:', e);
                }
            }
        } catch (e) {
            console.log('[NotificationService] ActivityLauncher not available in background');
        }
    }
}

const notificationService = new NotificationService();

export const backgroundHandler = async (remoteMessage) => {
    console.log('[FCM Background Handled]:', remoteMessage.data?.shortId);
    const data = remoteMessage.data;
    const type = data?.type;
    const isNewOrder = type === 'new_order' || type === 'delivery_order';
    const isCancelled = type === 'order_cancelled';

    if (isNewOrder) {
        // 1. Persist data for cold-start
        try {
            console.log('[NotificationService] Persisting pending order for cold-start...');
            await AsyncStorage.setItem('pending_order_alert', JSON.stringify(data));
        } catch (storageErr) {
            console.error('[NotificationService] Failed to persist:', storageErr);
        }

        // 2. Wake app
        try {
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher) {
                console.log('[NotificationService] Requesting bringToForeground...');
                ActivityLauncher.bringToForeground(data);
            }
        } catch (e) {
            console.log('[NotificationService] ActivityLauncher failed:', e);
        }

        // NOTE: Redundant DisplayCallNotification removed here to prevent double alerts.
        // Native FCMWakeUpService already showed a backup notification.
    } else if (isCancelled) {
        console.log('[NotificationService] Handling cancellation in background (cleanup only)...');

        // NOTE: Redundant Notifee notification removed here to prevent double alerts.
        // Native FCMWakeUpService already handles the visual alert for cancellations.

        // Clear any active ring notification
        await notificationService.cancelCallNotification();

        // Clear bridge data to prevent Call Screen from popping up if app is opened manually later
        await AsyncStorage.removeItem('pending_order_alert');
    }

    return Promise.resolve();
};

export const notifeeBackgroundHandler = async ({ type, detail }) => {
    if (type === EventType.PRESS) {
        console.log('[Notifee Background Interaction]:', detail.notification?.data?.shortId);

        // Persist data for AppNavigator or AppState listener to pick up
        if (detail.notification?.data) {
            try {
                await AsyncStorage.setItem('pending_order_alert', JSON.stringify(detail.notification.data));
            } catch (e) {
                console.error('[Notifee Background] Failed to persist:', e);
            }
        }

        // Try to bring app to foreground
        try {
            const { ActivityLauncher } = NativeModules;
            if (ActivityLauncher) ActivityLauncher.bringToForeground(detail.notification?.data);
        } catch (e) { }
    }
};

export default notificationService;
