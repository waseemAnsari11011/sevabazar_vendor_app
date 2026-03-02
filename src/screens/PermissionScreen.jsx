import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    AppState,
    Platform,
    SafeAreaView,
    StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from '../services/notificationService';

const PermissionScreen = ({ navigation }) => {
    const [statuses, setStatuses] = useState({
        notifications: false,
        batteryOptimization: false,
        overlay: false,
        special: false,
        fullScreenIntent: false,
    });
    const [brandInfo, setBrandInfo] = useState({ brand: 'generic', manufacturer: 'generic' });
    const [loading, setLoading] = useState(true);

    const checkAllPermissions = useCallback(async () => {
        setLoading(true);
        const results = await notificationService.checkPermissionStatus();

        setStatuses({
            notifications: results.notifications,
            batteryOptimization: results.batteryOptimization,
            overlay: results.overlay,
            special: results.special,
            fullScreenIntent: results.fullScreenIntent,
        });
        setBrandInfo({
            brand: (results.brand || 'generic').toLowerCase(),
            manufacturer: (results.manufacturer || 'generic').toLowerCase()
        });

        if (results.success) {
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                const token = await AsyncStorage.getItem('vendorToken');
                navigation.replace(token ? 'Home' : 'Login');
            }
        }
        setLoading(false);
    }, [navigation]);

    useEffect(() => {
        checkAllPermissions();
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') checkAllPermissions();
        });
        return () => subscription.remove();
    }, [checkAllPermissions]);

    const isXiaomiDevice = brandInfo.manufacturer.includes('xiaomi') ||
        brandInfo.manufacturer.includes('redmi') ||
        brandInfo.manufacturer.includes('poco') ||
        brandInfo.brand.includes('xiaomi') ||
        brandInfo.brand.includes('redmi') ||
        brandInfo.brand.includes('poco');

    const relevantKeys = isXiaomiDevice
        ? ['notifications', 'batteryOptimization', 'overlay', 'special', 'fullScreenIntent']
        : ['notifications', 'batteryOptimization', 'overlay', 'fullScreenIntent'];

    const completedCount = relevantKeys.filter(key => statuses[key]).length;
    const totalCount = relevantKeys.length;
    const progress = totalCount > 0 ? completedCount / totalCount : 0;

    const PermissionCard = ({ title, subtitle, icon, status, onPress, buttonLabel }) => (
        <View style={[styles.card, status && styles.cardSuccess]}>
            <View style={styles.cardHeader}>
                <View style={[styles.iconWrapper, { backgroundColor: status ? '#4CAF5015' : '#ff660010' }]}>
                    <Icon name={icon} size={22} color={status ? '#4CAF50' : '#ff6600'} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
                </View>
                {status ? (
                    <View style={styles.successBadge}>
                        <Icon name="check" size={14} color="#4CAF50" />
                    </View>
                ) : (
                    <TouchableOpacity style={styles.miniEnableButton} onPress={onPress}>
                        <Text style={styles.miniEnableButtonText}>{buttonLabel || 'Set'}</Text>
                        <Icon name="chevron-right" size={14} color="#ff6600" />
                    </TouchableOpacity>
                )}
            </View>
            {/* Subtle top glow for glass effect */}
            <View style={styles.glassHighlight} />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.logoBadge}>
                        <Icon name="shield-check-outline" size={28} color="#ff6600" />
                    </View>
                    <Text style={styles.title}>Essential Setup</Text>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{completedCount} of {totalCount} completed</Text>
                    </View>
                </View>

                <View style={styles.cardsContainer}>
                    <PermissionCard
                        title="Notification Alerts"
                        subtitle="Required for Order Sound"
                        icon="bell-outline"
                        status={statuses.notifications}
                        onPress={async () => {
                            await notificationService.openNotificationSettings();
                            checkAllPermissions();
                        }}
                        buttonLabel="Allow"
                    />
                    <PermissionCard
                        title="Battery Saving"
                        subtitle="Allow Background Running"
                        icon="battery-check-outline"
                        status={statuses.batteryOptimization}
                        onPress={async () => {
                            await notificationService.openBatterySettings();
                            checkAllPermissions();
                        }}
                        buttonLabel="Allow"
                    />
                    <PermissionCard
                        title="Display Over Apps"
                        subtitle="Required for Call Intent"
                        icon="layers-outline"
                        status={statuses.overlay}
                        onPress={async () => {
                            await notificationService.openOverlaySettings();
                            checkAllPermissions();
                        }}
                        buttonLabel="Enable"
                    />
                    {isXiaomiDevice && (
                        <PermissionCard
                            title="Background Pop-up"
                            subtitle="Enable 'Display pop-up windows' & 'Show on Lock screen'"
                            icon="window-maximize"
                            status={statuses.special}
                            onPress={async () => {
                                await notificationService.openSpecialSettings();
                                checkAllPermissions();
                            }}
                            buttonLabel="Enable"
                        />
                    )}
                    <PermissionCard
                        title="Full-Screen Alerts"
                        subtitle="Required to wake up phone"
                        icon="monitor-screenshot"
                        status={statuses.fullScreenIntent}
                        onPress={async () => {
                            await notificationService.openFullScreenIntentSettings();
                            checkAllPermissions();
                        }}
                        buttonLabel="Enable"
                    />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.refreshButton, loading && styles.disabledButton]}
                        onPress={checkAllPermissions}
                        disabled={loading}
                    >
                        <Text style={styles.refreshButtonText}>
                            {loading ? 'Checking...' : 'Check All Permissions'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.footerNote}>
                        Please enable permissions to ensure you receive order alerts reliably.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 15,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 5,
    },
    logoBadge: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#ff660015',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ff660030',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 12,
    },
    progressBarBg: {
        width: '60%',
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#ff6600',
    },
    progressText: {
        fontSize: 10,
        color: '#666',
        marginTop: 6,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    cardsContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 10,
    },
    card: {
        backgroundColor: '#161616',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#252525',
        position: 'relative',
        overflow: 'hidden',
    },
    cardSuccess: {
        borderColor: '#4CAF5040',
        backgroundColor: '#0F1610',
    },
    glassHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#E0E0E0',
    },
    cardSubtitle: {
        fontSize: 11,
        color: '#707070',
        marginTop: 2,
    },
    successBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#4CAF5015',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4CAF5030',
    },
    miniEnableButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6600',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    miniEnableButtonText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 12,
        marginRight: 2,
    },
    footer: {
        alignItems: 'center',
    },
    refreshButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#ff6600',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ff6600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    disabledButton: {
        backgroundColor: '#444',
        elevation: 0,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    footerNote: {
        fontSize: 10,
        color: '#444',
        textAlign: 'center',
        marginTop: 10,
        paddingHorizontal: 20,
    }
});

export default PermissionScreen;
