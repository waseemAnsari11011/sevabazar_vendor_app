import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Automatic BASE_URL detection for development
// For production, use: 'https://server.sevabazar.com'
let BASE_URL = 'https://server.sevabazar.com';

if (__DEV__) {
    BASE_URL = (Platform.OS === 'android' && DeviceInfo.isEmulatorSync())
        ? 'http://10.0.2.2:8000'
        : 'http://192.168.137.1:8000';
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

export default client;
