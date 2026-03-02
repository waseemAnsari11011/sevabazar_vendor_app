package com.vendorapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class OrderAlertReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Launch MainActivity with special flags to bring it to foreground
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            
            // Pass order data
            putExtras(intent.extras ?: return)
        }
        
        context.startActivity(launchIntent)
    }
}
