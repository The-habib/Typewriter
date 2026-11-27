package com.typewriter.keyboard.typewriter_keyboard

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "com.typewriter.keyboard/app"
    private var soundEngine: SoundAndHapticsEngine? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        soundEngine = SoundAndHapticsEngine(applicationContext)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getImeStatus" -> {
                        result.success(readImeStatus())
                    }
                    "openInputMethodSettings" -> {
                        val intent = Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                        result.success(true)
                    }
                    "showInputMethodPicker" -> {
                        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                        imm.showInputMethodPicker()
                        result.success(true)
                    }
                    "getPreferences" -> {
                        result.success(PrefsStore.readAll(applicationContext))
                    }
                    "setPreference" -> {
                        val key = call.argument<String>("key")
                        val value = call.argument<Any>("value")
                        if (key != null && value != null) {
                            PrefsStore.writeValue(applicationContext, key, value)
                        }
                        result.success(true)
                    }
                    "playSound" -> {
                        val type = call.argument<String>("type") ?: "key"
                        val vol = (call.argument<Double>("volume") ?: 0.85).toFloat()
                        soundEngine?.playSound(type, vol)
                        result.success(true)
                    }
                    "hapticTick" -> {
                        val level = call.argument<Int>("level") ?: 1
                        val heavy = call.argument<Boolean>("heavy") ?: false
                        soundEngine?.haptic(level, heavy, window?.decorView)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun readImeStatus(): Map<String, Any> {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        val expectedComponent = ComponentName(this, TypewriterInputMethodService::class.java)
        val expectedId = expectedComponent.flattenToShortString()
        val fullId = expectedComponent.flattenToString()

        val enabled = imm.enabledInputMethodList.any { info ->
            info.packageName == packageName &&
                (info.id == expectedId || info.id == fullId || info.serviceName == TypewriterInputMethodService::class.java.name)
        }

        val currentDefault = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD
        ) ?: ""
        val selected = currentDefault == expectedId ||
            currentDefault == fullId ||
            currentDefault.startsWith("$packageName/")

        return mapOf(
            "isEnabled" to enabled,
            "isSelected" to selected
        )
    }

    override fun onDestroy() {
        soundEngine?.release()
        soundEngine = null
        super.onDestroy()
    }
}
