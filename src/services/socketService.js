import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api/client';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    async connect(vendorId) {
        if (this.socket?.connected) {
            console.log('[SocketService] Socket already connected');
            return;
        }

        if (!vendorId) {
            console.log('[SocketService] No vendorId provided, cannot connect socket');
            return;
        }

        const SOCKET_URL = BASE_URL;
        console.log('[SocketService] Attempting to connect to:', SOCKET_URL, 'for vendor:', vendorId);

        try {
            this.socket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
            });

            this.socket.on('connect', () => {
                console.log('[SocketService] Socket connected:', this.socket.id);
                // Join vendor's personal room
                this.socket.emit('join', vendorId);
            });

            this.socket.on('disconnect', () => {
                console.log('[SocketService] Socket disconnected');
            });

            this.socket.on('connect_error', (error) => {
                console.error('[SocketService] Socket connection error:', error.message, error.description, error.context);
            });

        } catch (error) {
            console.error('[SocketService] Error connecting socket:', error);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.listeners.clear();
        }
    }

    on(eventName, callback) {
        if (!this.socket) return;
        this.socket.on(eventName, callback);
    }

    off(eventName, callback) {
        if (!this.socket) return;
        this.socket.off(eventName, callback);
    }

    emit(eventName, data) {
        if (!this.socket) return;
        this.socket.emit(eventName, data);
    }
}

const socketService = new SocketService();
export default socketService;
