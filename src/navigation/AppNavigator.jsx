import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ChatOrderDetailsScreen from '../screens/ChatOrderDetailsScreen';
import CreateChatOrderScreen from '../screens/CreateChatOrderScreen';
import MainTabNavigator from './MainTabNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkLogin = async () => {
            try {
                const token = await AsyncStorage.getItem('vendorToken');
                setInitialRoute(token ? 'Home' : 'Login');
            } catch (error) {
                setInitialRoute('Login');
            } finally {
                setLoading(false);
            }
        };

        checkLogin();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={initialRoute}>
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Home" component={MainTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Details' }} />
                <Stack.Screen name="ChatOrderDetails" component={ChatOrderDetailsScreen} options={{ title: 'Chat Order Details' }} />
                <Stack.Screen name="CreateChatOrder" component={CreateChatOrderScreen} options={{ title: 'Create Order' }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
