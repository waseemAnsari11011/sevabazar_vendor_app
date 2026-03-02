package com.vendorapp

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeMap

class ActivityLauncherModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ActivityLauncher"
    }

    @ReactMethod
    fun bringToForeground(data: com.facebook.react.bridge.ReadableMap?) {
        try {
            val powerManager = reactApplicationContext.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
            val wakeLock = powerManager.newWakeLock(
                android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "VendorApp::BringToForegroundWakeLock"
            )
            wakeLock.acquire(3000L) // 3 seconds to wake the screen

            val intent = Intent(reactApplicationContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                addCategory(Intent.CATEGORY_LAUNCHER) 
                
                // Pass all data if provided
                data?.let {
                    val iterator = it.keySetIterator()
                    while (iterator.hasNextKey()) {
                        val key = iterator.nextKey()
                        try {
                            putExtra(key, it.getString(key))
                        } catch (e: Exception) {
                            // Fallback if not a string
                        }
                    }
                }
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e("ActivityLauncher", "Failed to start MainActivity", e)
        }
    }

    @ReactMethod
    fun getPendingTap(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("VendorAppPrefs", android.content.Context.MODE_PRIVATE)
            val tapType = prefs.getString("pending_tap_type", null)
            val orderId = prefs.getString("pending_tap_orderId", null)
            
            if (tapType != null && orderId != null) {
                val map = WritableNativeMap()
                map.putString("type", tapType)
                map.putString("orderId", orderId)
                map.putString("shortId", prefs.getString("pending_tap_shortId", ""))
                map.putString("vendorId", prefs.getString("pending_tap_vendorId", ""))
                map.putString("wasTapped", "true")
                // Clear after reading
                prefs.edit().remove("pending_tap_type").remove("pending_tap_orderId")
                    .remove("pending_tap_shortId").remove("pending_tap_vendorId")
                    .remove("pending_tap_wasTapped").apply()
                promise.resolve(map)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e("ActivityLauncher", "Failed to read pending tap", e)
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun clearNotification(id: Int) {
        try {
            val notificationManager = reactApplicationContext.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancel(id)
            Log.d("ActivityLauncher", "Notification $id cleared")
        } catch (e: Exception) {
            Log.e("ActivityLauncher", "Failed to clear notification $id", e)
        }
    }

    @ReactMethod
    fun clearAllNotifications() {
        try {
            val notificationManager = reactApplicationContext.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancelAll()
            Log.d("ActivityLauncher", "All notifications cleared")
        } catch (e: Exception) {
            Log.e("ActivityLauncher", "Failed to clear all notifications", e)
        }
    }

    @ReactMethod
    fun clearLockScreenFlags() {
        try {
            val activity = currentActivity as? MainActivity
            activity?.runOnUiThread {
                activity.clearLockScreenFlags()
            }
        } catch (e: Exception) {
            Log.e("ActivityLauncher", "Failed to clear lock screen flags", e)
        }
    }
}
