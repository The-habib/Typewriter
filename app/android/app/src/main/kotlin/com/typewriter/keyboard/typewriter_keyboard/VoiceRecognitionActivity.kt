package com.typewriter.keyboard.typewriter_keyboard

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.Toast
import java.util.Locale

class VoiceRecognitionActivity : Activity() {
    companion object {
        private const val REQ_SPEECH = 9021
        const val ACTION_VOICE_RESULT = "com.typewriter.keyboard.VOICE_RESULT"
        const val EXTRA_TEXT = "recognized_text"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Dictate with Typewriter")
        }
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, REQ_SPEECH)
        } catch (_: Exception) {
            Toast.makeText(this, "Speech recognition unavailable on this device", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_SPEECH && resultCode == RESULT_OK && data != null) {
            val matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val text = matches?.firstOrNull()?.trim()
            if (!text.isNullOrEmpty()) {
                val broadcast = Intent(ACTION_VOICE_RESULT).apply {
                    setPackage(packageName)
                    putExtra(EXTRA_TEXT, text)
                }
                sendBroadcast(broadcast)
            }
        }
        finish()
    }
}
