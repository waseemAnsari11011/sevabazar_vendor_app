package com.vendorapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FCMWakeUpService : ReactNativeFirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val type = data["type"]
        val shortId = data["shortId"] ?: "Unknown"

        Log.d("FCMWakeUpService", "!!! NATIVE FCM RECEIVED !!! Type: $type, ID: $shortId")

        // 0. Acquire a temporary WakeLock to ensure the CPU is awake for processing
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val cpuWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "VendorApp::FCMWakeLock"
        )
        
        try {
            cpuWakeLock.acquire(10000L) // 10 seconds

            if (type == "new_order" || type == "NEW_ORDER_ALERT" || type == "delivery_order") {
                Log.d("FCMWakeUpService", "[WAKEUP] New order alert detected. Launching MainActivity...")
                
                val context: Context = this
                val intent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    for ((key, value) in data) { putExtra(key, value) }
                }
                
                try {
                    showBackupNotification(this, shortId, data)
                    context.startActivity(intent)
                    Log.d("FCMWakeUpService", "[WAKEUP] startActivity call performed.")
                } catch (e: Exception) {
                    Log.e("FCMWakeUpService", "[WAKEUP] Native launch failed: ${e.message}", e)
                }
                
                // For NEW ORDERS: call super so JS layer can handle state/navigation/ringtone
                super.onMessageReceived(remoteMessage)

            } else if (type == "order_cancelled") {
                Log.d("FCMWakeUpService", "[CANCELLATION] Showing cancellation notification natively.")
                // Show a native notification for the cancellation
                showCancellationNotification(this, shortId, data)
                
                // DO NOT call super.onMessageReceived for cancellations!
                // The JS backgroundHandler would run again and can cause a 2nd notification or unwanted behavior.
                // The native notification shown above is the ONLY one that should appear.
                Log.d("FCMWakeUpService", "[CANCELLATION] Handled fully natively. NOT calling super.")
                
            } else {
                // For other message types, pass through to JS layer
                super.onMessageReceived(remoteMessage)
            }

        } finally {
            try {
                if (cpuWakeLock.isHeld) { cpuWakeLock.release() }
            } catch (e: Exception) {}
        }
    }

    private fun showCancellationNotification(context: Context, shortId: String, data: Map<String, String>) {
        val channelId = "order_cancellations"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundResId = context.resources.getIdentifier("order_cancelled", "raw", context.packageName)
            val soundUri = if (soundResId != 0) {
                Uri.parse("android.resource://" + context.packageName + "/" + soundResId)
            } else {
                null
            }

            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()

            val channel = NotificationChannel(channelId, "Order Cancellations", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Cancelled Order Notifications"
                if (soundUri != null) setSound(soundUri, audioAttributes)
                enableLights(true)
                lightColor = Color.YELLOW
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            
            // Pass all data
            for ((key, value) in data) {
                putExtra(key, value)
            }
            // Add tapped flag
            putExtra("wasTapped", "true")
        }

        val pendingIntent = PendingIntent.getActivity(
            context, 2001, launchIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_menu_close_clear_cancel)
            .setContentTitle("Order #$shortId Cancelled")
            .setContentText("The customer has cancelled this order.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(2001, notification)
        Log.d("FCMWakeUpService", "[CANCELLATION] Custom cancellation notification shown with click action.")
    }

    private fun showBackupNotification(context: Context, shortId: String, data: Map<String, String>) {
        val channelId = "order_alerts"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Order Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New Order Notifications"
                enableLights(true)
                lightColor = Color.RED
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
            
            // CRITICAL: Must pass data here too for the fullScreenIntent launch!
            for ((key, value) in data) {
                putExtra(key, value)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("New Order #$shortId")
            .setContentText("Tap to open the app and accept.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(1001, notification)
        Log.d("FCMWakeUpService", "[BACKUP] Heads-up notification shown.")
    }
}
