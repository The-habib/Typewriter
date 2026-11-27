package com.typewriter.keyboard.typewriter_keyboard

import android.content.Context
import android.content.SharedPreferences

object PrefsStore {
    private const val PREFS_NAME = "typewriter_keyboard_prefs"

    const val KEY_SOUND_ENABLED = "soundEnabled"
    const val KEY_SOUND_VOLUME = "soundVolume"
    const val KEY_HAPTICS_LEVEL = "hapticsLevel"
    const val KEY_AUTO_CAPS = "autoCaps"
    const val KEY_PREDICTIONS_ENABLED = "predictionsEnabled"
    const val KEY_AUTO_CORRECT = "autoCorrectOnSpace"
    const val KEY_SPACEBAR_TRACKPAD = "spacebarTrackpad"
    const val KEY_DOUBLE_SPACE_PERIOD = "doubleSpacePeriod"
    const val KEY_SLOW_MO = "slowMo"
    const val KEY_MECHANISM_VIEW = "mechanismView"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun readAll(context: Context): Map<String, Any> {
        val p = prefs(context)
        return mapOf(
            KEY_SOUND_ENABLED to p.getBoolean(KEY_SOUND_ENABLED, true),
            KEY_SOUND_VOLUME to p.getFloat(KEY_SOUND_VOLUME, 0.85f).toDouble(),
            KEY_HAPTICS_LEVEL to p.getInt(KEY_HAPTICS_LEVEL, 1),
            KEY_AUTO_CAPS to p.getBoolean(KEY_AUTO_CAPS, true),
            KEY_PREDICTIONS_ENABLED to p.getBoolean(KEY_PREDICTIONS_ENABLED, true),
            KEY_AUTO_CORRECT to p.getBoolean(KEY_AUTO_CORRECT, true),
            KEY_SPACEBAR_TRACKPAD to p.getBoolean(KEY_SPACEBAR_TRACKPAD, true),
            KEY_DOUBLE_SPACE_PERIOD to p.getBoolean(KEY_DOUBLE_SPACE_PERIOD, true),
            KEY_SLOW_MO to p.getBoolean(KEY_SLOW_MO, false),
            KEY_MECHANISM_VIEW to p.getInt(KEY_MECHANISM_VIEW, 0)
        )
    }

    fun writeValue(context: Context, key: String, value: Any?) {
        val editor = prefs(context).edit()
        when (value) {
            is Boolean -> editor.putBoolean(key, value)
            is Int -> editor.putInt(key, value)
            is Long -> editor.putInt(key, value.toInt())
            is Double -> editor.putFloat(key, value.toFloat())
            is Float -> editor.putFloat(key, value)
            is String -> editor.putString(key, value)
        }
        editor.apply()
    }
}
