import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Automatic BASE_URL detection for development
// For production, use: 'https://server.sevabazar.com/'
export let BASE_URL = 'https://server.sevabazar.com/';

if (__DEV__) {
    // Attempting to use the Hotspot Gateway as default
    BASE_URL = (Platform.OS === 'android' && DeviceInfo.isEmulatorSync())
        ? 'http://10.0.2.2:8000/'
        : 'http://192.168.137.1:8000/';
}

const client = axios.create({
    baseURL: BASE_URL,
});

client.interceptors.request.use(
    async config => {
        const token = await AsyncStorage.getItem('vendorToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    },
);

client.interceptors.response.use(
    async (response) => {
        // Check block status if we just updated an order status (where blocking happens)
        if (response.config.url.includes('/order/status') && response.config.method === 'put') {
            try {
                const vendorData = await AsyncStorage.getItem('vendorData');
                if (vendorData) {
                    const parsed = JSON.parse(vendorData);
                    const res = await axios.get(`${response.config.baseURL}vendors/customer/${parsed._id}/details`, {
                        headers: response.config.headers
                    });
                    if (res.data.isBlocked) {
                        const { reset } = require('../navigation/NavigationService');
                        reset('Blocked');
                    }
                }
            } catch (err) {
                console.log("Interceptor block check failed", err);
            }
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default client;
