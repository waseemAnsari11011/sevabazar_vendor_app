import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use 10.0.2.2 for Android Emulator to access localhost
const BASE_URL = 'http://10.0.2.2:8000';
// const BASE_URL = 'https://server.sevabazar.com'; // For real device (replace with your IP)

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
