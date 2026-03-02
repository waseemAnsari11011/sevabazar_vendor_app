package com.vendorapp

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.app.AppOpsManager

class AppPermissionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AppPermission"
    }

    @ReactMethod
    fun getDeviceBrand(promise: Promise) {
        promise.resolve(Build.BRAND)
    }

    @ReactMethod
    fun getDeviceManufacturer(promise: Promise) {
        promise.resolve(Build.MANUFACTURER)
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                val method = notificationManager.javaClass.getMethod("canUseFullScreenIntent")
                val result = method.invoke(notificationManager) as Boolean
                promise.resolve(result)
            } catch (e: Exception) {
                promise.resolve(true)
            }
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun checkSpecialPermissions(promise: Promise) {
        if (Build.BRAND.equals("Xiaomi", ignoreCase = true) || 
            Build.BRAND.equals("Redmi", ignoreCase = true) || 
            Build.BRAND.equals("POCO", ignoreCase = true)) {
            try {
                val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
                val opCodeBackground = 10021 // OP_BACKGROUND_START_ACTIVITY
                val opCodeLockScreen = 10020 // OP_SHOW_WHEN_LOCKED
                val method = AppOpsManager::class.java.getMethod("checkOpNoThrow", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java)
                
                val resultBackground = method.invoke(appOps, opCodeBackground, android.os.Process.myUid(), reactApplicationContext.packageName) as Int
                val resultLockScreen = method.invoke(appOps, opCodeLockScreen, android.os.Process.myUid(), reactApplicationContext.packageName) as Int
                
                promise.resolve(resultBackground == AppOpsManager.MODE_ALLOWED && resultLockScreen == AppOpsManager.MODE_ALLOWED)
            } catch (e: Exception) {
                promise.resolve(false) // Fallback to false so user is prompted to check it if we can't verify
            }
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                val uri = Uri.fromParts("package", reactApplicationContext.packageName, null)
                intent.data = uri
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactApplicationContext.startActivity(intent)
            } catch (e: Exception) {
                openAppDetails()
            }
        }
    }

    @ReactMethod
    fun openAppDetails() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            val uri = Uri.fromParts("package", reactApplicationContext.packageName, null)
            intent.data = uri
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Should not happen
        }
    }

    @ReactMethod
    fun requestPermission(type: String) {
        println("AppPermission: requestPermission called for type: $type")
        when (type) {
            "battery" -> {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    currentActivity?.startActivity(intent) ?: reactApplicationContext.startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        currentActivity?.startActivity(intent) ?: reactApplicationContext.startActivity(intent)
                    } catch (ex: Exception) {
                        openAppDetails()
                    }
                }
            }
            "overlay" -> {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                    intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    currentActivity?.startActivity(intent) ?: reactApplicationContext.startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        currentActivity?.startActivity(intent) ?: reactApplicationContext.startActivity(intent)
                    } catch (ex: Exception) {
                        openAppDetails()
                    }
                }
            }
            "fullscreen" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                        val uri = Uri.fromParts("package", reactApplicationContext.packageName, null)
                        intent.data = uri
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        reactApplicationContext.startActivity(intent)
                    } catch (e: Exception) {
                        openAppDetails()
                    }
                } else {
                    openAppDetails()
                }
            }
            "special" -> {
                if (Build.BRAND.equals("Xiaomi", ignoreCase = true) || 
                    Build.BRAND.equals("Redmi", ignoreCase = true) || 
                    Build.BRAND.equals("POCO", ignoreCase = true)) {
                    try {
                        val intent = Intent("miui.intent.action.APP_PERM_EDITOR")
                        intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
                        intent.putExtra("extra_pkgname", reactApplicationContext.packageName)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        reactApplicationContext.startActivity(intent)
                    } catch (e: Exception) {
                        openAppDetails()
                    }
                } else {
                    openAppDetails()
                }
            }
            else -> openAppDetails()
        }
    }
}
