/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, NativeModules } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backgroundHandler, notifeeBackgroundHandler } from './src/services/notificationService';

// Register background handlers
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Explicitly call native module from here ONLY for new orders
    const { ActivityLauncher } = NativeModules;
    const isNewOrder = remoteMessage.data?.type === 'new_order';

    if (isNewOrder) {
        // BRIDGE: Set AsyncStorage BEFORE bringing to foreground
        // This ensures AppNavigator sees it on boot
        try {
            await AsyncStorage.setItem('pending_order_alert', JSON.stringify(remoteMessage.data));
            console.log('[Index.js] Bridged order data to AsyncStorage');
        } catch (e) {
            console.error('[Index.js] Failed to bridge order data:', e);
        }

        if (ActivityLauncher) {
            try {
                ActivityLauncher.bringToForeground(remoteMessage.data);
            } catch (e) {
                console.log('[Index.js] Failed to launch activity:', e);
            }
        }
    }

    // Continue with normal handler
    await backgroundHandler(remoteMessage);
});
notifee.onBackgroundEvent(notifeeBackgroundHandler);

AppRegistry.registerComponent(appName, () => App);
