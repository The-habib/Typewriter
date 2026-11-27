package com.typewriter.keyboard.typewriter_keyboard

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View
import kotlin.random.Random

class SoundAndHapticsEngine(private val context: Context) {
    private val soundPool: SoundPool
    private val strikeIds = IntArray(4)
    private var backspaceId = 0
    private var spaceReturnId = 0
    private var modeId = 0
    @Volatile
    private var loaded = false

    private val workerThread = HandlerThread(
        "TypewriterAudioHaptic",
        Process.THREAD_PRIORITY_URGENT_AUDIO
    ).apply { start() }
    private val workerHandler = Handler(workerThread.looper)

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    init {
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        soundPool = SoundPool.Builder()
            .setMaxStreams(8)
            .setAudioAttributes(attrs)
            .build()

        strikeIds[0] = soundPool.load(context, R.raw.key_strike_1, 1)
        strikeIds[1] = soundPool.load(context, R.raw.key_strike_2, 1)
        strikeIds[2] = soundPool.load(context, R.raw.key_strike_3, 1)
        strikeIds[3] = soundPool.load(context, R.raw.key_strike_4, 1)
        backspaceId = soundPool.load(context, R.raw.key_backspace, 1)
        spaceReturnId = soundPool.load(context, R.raw.key_space_return, 1)
        modeId = soundPool.load(context, R.raw.key_mode, 1)
        loaded = true
    }

    fun playSound(type: String, volume: Float = 0.85f) {
        if (!loaded) return
        val vol = volume.coerceIn(0.0f, 1.0f)
        workerHandler.post {
            if (!loaded) return@post
            when (type) {
                "space", "return" -> {
                    soundPool.play(spaceReturnId, vol, vol, 2, 0, 1.0f)
                }
                "backspace" -> {
                    val rate = 0.97f + Random.nextFloat() * 0.06f
                    soundPool.play(backspaceId, vol, vol, 1, 0, rate)
                }
                "mode" -> {
                    soundPool.play(modeId, vol, vol, 1, 0, 1.0f)
                }
                else -> {
                    val id = strikeIds[Random.nextInt(strikeIds.size)]
                    val rate = 0.96f + Random.nextFloat() * 0.08f
                    soundPool.play(id, vol, vol, 1, 0, rate)
                }
            }
        }
    }

    fun haptic(level: Int, isHeavy: Boolean = false, view: View? = null) {
        if (level <= 0) return
        if (level == 1 && view != null) {
            val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                HapticFeedbackConstants.KEYBOARD_PRESS
            } else {
                HapticFeedbackConstants.KEYBOARD_TAP
            }
            view.performHapticFeedback(flag, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING)
            return
        }
        workerHandler.post {
            val vib = vibrator ?: return@post
            if (!vib.hasVibrator()) return@post
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val durationMs = when {
                    level >= 2 && isHeavy -> 22L
                    level >= 2 -> 14L
                    isHeavy -> 12L
                    else -> 8L
                }
                val amplitude = when {
                    level >= 2 && isHeavy -> 210
                    level >= 2 -> 150
                    else -> 95
                }
                vib.vibrate(VibrationEffect.createOneShot(durationMs, amplitude))
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(if (level >= 2) 14L else 8L)
            }
        }
    }

    fun release() {
        loaded = false
        workerHandler.removeCallbacksAndMessages(null)
        workerThread.quitSafely()
        soundPool.release()
    }
}
