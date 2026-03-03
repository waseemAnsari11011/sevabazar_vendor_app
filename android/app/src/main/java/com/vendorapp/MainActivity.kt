package com.vendorapp

import android.os.Bundle
import android.os.Build
import android.view.WindowManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    // CRITICAL: Call this early before content is set
    handleIntentFlags(intent)
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntentFlags(intent)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Reinforce flags when window is attached
    handleIntentFlags(intent)
  }

  private fun handleIntentFlags(intent: Intent?) {
    val type = intent?.getStringExtra("type")
    val orderId = intent?.getStringExtra("orderId")
    val wasTapped = intent?.getStringExtra("wasTapped")
    val action = intent?.action
    
    // Improved detection: Check for multiple order-related types or just presence of orderId
    val isOrderAlert = type == "new_order" || 
                       type == "delivery_order" || 
                       type == "NEW_ORDER_ALERT" || 
                       type == "new_order_offer" ||
                       (orderId != null && type != "order_cancelled")
    
    Log.d("MainActivity", "!!! handleIntentFlags !!! Action: $action, Type: $type, ID: $orderId, wasTapped: $wasTapped, isOrderAlert: $isOrderAlert")

    // If this is a tapped cancellation notification, bridge data to SharedPreferences for JS
    if (type == "order_cancelled" && wasTapped == "true" && orderId != null) {
        Log.d("MainActivity", ">>> CANCELLED ORDER TAP: Bridging to SharedPreferences for JS")
        try {
            val shortId = intent?.getStringExtra("shortId") ?: ""
            val vendorId = intent?.getStringExtra("vendorId") ?: ""
            val prefs = getSharedPreferences("VendorAppPrefs", android.content.Context.MODE_PRIVATE)
            prefs.edit()
                .putString("pending_tap_type", type)
                .putString("pending_tap_orderId", orderId)
                .putString("pending_tap_shortId", shortId)
                .putString("pending_tap_vendorId", vendorId)
                .putString("pending_tap_wasTapped", "true")
                .apply()
        } catch (e: Exception) {
            Log.e("MainActivity", "Error bridging tap: ${e.message}")
        }
    }

    if (isOrderAlert) {
      Log.d("MainActivity", ">>> ORDER DETECTED: Applying Lock Screen Flags")
      try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
              setShowWhenLocked(true)
              setTurnScreenOn(true)
          }
          turnScreenOnAndUnlock()
      } catch (e: Exception) {
          Log.e("MainActivity", "Error setting flags: ${e.message}")
      }
    } else {
      // For any other launch (manual open), disable these flags to maintain lock screen privacy
      Log.d("MainActivity", ">>> NOT AN ORDER: Clearing Lock Screen Flags")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          setShowWhenLocked(false)
          setTurnScreenOn(false)
      }
      window.clearFlags(
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
  }

  private fun turnScreenOnAndUnlock() {
    // Acquire WakeLock to forcefully turn screen on
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or 
        PowerManager.ACQUIRE_CAUSES_WAKEUP or 
        PowerManager.ON_AFTER_RELEASE,
        "VendorApp::OrderAlertWakeLock"
    )
    wakeLock?.acquire(10 * 60 * 1000L) // 10 minutes max

    window.addFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
    )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        keyguardManager.requestDismissKeyguard(this, null)
    }
  }

  fun clearLockScreenFlags() {
      Log.d("MainActivity", "!!! clearLockScreenFlags called !!!")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          setShowWhenLocked(false)
          setTurnScreenOn(false)
      }
      window.clearFlags(
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
      
      try {
          if (wakeLock?.isHeld == true) {
              wakeLock?.release()
          }
      } catch (e: Exception) {
          Log.e("MainActivity", "Error releasing wakeLock: ${e.message}")
      }
      wakeLock = null
  }

  override fun onDestroy() {
    super.onDestroy()
    wakeLock?.release()
  }

  override fun getMainComponentName(): String = "vendorApp"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
