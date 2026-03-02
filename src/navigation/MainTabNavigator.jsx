import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import NewOrderNavigator from './NewOrderNavigator';
import ShopStatusToggle from '../components/ShopStatusToggle';
import HistoryScreen from '../screens/HistoryScreen';
import EarningsScreen from '../screens/EarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const Tab = createBottomTabNavigator();

const checkBlockStatus = async (navigation) => {
    try {
        const vendorData = await AsyncStorage.getItem('vendorData');
        if (vendorData) {
            const parsed = JSON.parse(vendorData);
            const res = await client.get(`/vendors/customer/${parsed._id}/details`);
            if (res.data.isBlocked) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Blocked' }],
                });
            }
        }
    } catch (err) {
        console.log("Tab focus block check failed", err);
    }
};

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenListeners={({ navigation }) => ({
                state: () => {
                    checkBlockStatus(navigation);
                },
            })}
            screenOptions={{
                tabBarActiveTintColor: '#ff6600',
                tabBarInactiveTintColor: '#8E8E93',
                headerShown: true,
                headerStyle: {
                    backgroundColor: '#fff',
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F2F2F7',
                },
                headerTintColor: '#000',
                headerTitleStyle: {
                    fontWeight: '700',
                    fontSize: 18,
                },
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#F2F2F7',
                    backgroundColor: '#fff',
                    height: 60,
                    paddingBottom: 5,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 5,
                }
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{
                    headerShown: false,
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="home-variant" color={color} size={size} />
                    ),
                }}
            />
            <Tab.Screen
                name="NewOrder"
                component={NewOrderNavigator}
                options={({ navigation }) => ({
                    title: 'Orders',
                    tabBarLabel: 'Orders',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Dashboard')}
                            style={{ marginLeft: 15 }}
                        >
                            <Icon name="arrow-left" size={24} color="#000" />
                        </TouchableOpacity>
                    ),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="package-variant-closed" color={color} size={size} />
                    ),
                })}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    title: 'History',
                    tabBarLabel: 'History',
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="history" color={color} size={size} />
                    ),
                }}
            />
            <Tab.Screen
                name="Earnings"
                component={EarningsScreen}
                options={{
                    title: 'Earnings',
                    tabBarLabel: 'Earnings',
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="cash-multiple" color={color} size={size} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Profile',
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="account-outline" color={color} size={size} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export default MainTabNavigator;
