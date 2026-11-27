package com.typewriter.keyboard.typewriter_keyboard

import android.content.BroadcastReceiver
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.SystemClock
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.ExtractedTextRequest
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import io.flutter.FlutterInjector
import io.flutter.embedding.android.FlutterSurfaceView
import io.flutter.embedding.android.FlutterView
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlin.math.min
import kotlin.math.roundToInt

class TypewriterInputMethodService : InputMethodService() {
    companion object {
        private const val CHANNEL_NAME = "com.typewriter.keyboard/ime"
        private const val KEYBOARD_ASPECT_RATIO = 1040.0 / 1320.0
        private const val PREFS_NAME = "typewriter_keyboard_prefs"
        private const val MAX_CLIPBOARD_ITEMS = 15
        private const val MAX_CLIPBOARD_TEXT_LENGTH = 4000
    }

    private var flutterEngine: FlutterEngine? = null
    private var flutterView: FlutterView? = null
    private var rootContainer: FrameLayout? = null
    private var methodChannel: MethodChannel? = null
    private var soundEngine: SoundAndHapticsEngine? = null
    private var clipboardManager: ClipboardManager? = null
    private val clipboardHistory = mutableListOf<String>()
    private var sharedPrefs: SharedPreferences? = null
    private var prefsListenerRegistered = false
    private var clipListenerRegistered = false
    private var voiceReceiverRegistered = false
    private var lastLocalEditTimeMs = 0L
    private var navBottomPx = 0

    private val clipChangedListener = ClipboardManager.OnPrimaryClipChangedListener {
        captureCurrentPrimaryClip()
    }

    private val prefsChangedListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        methodChannel?.invokeMethod("onPreferencesUpdated", PrefsStore.readAll(applicationContext))
    }

    private val voiceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != VoiceRecognitionActivity.ACTION_VOICE_RESULT) return
            val text = intent.getStringExtra(VoiceRecognitionActivity.EXTRA_TEXT) ?: return
            val ic = currentInputConnection ?: return
            val before = ic.getTextBeforeCursor(1, 0)?.toString() ?: ""
            val prefix = if (before.isNotEmpty() && !before.last().isWhitespace()) " " else ""
            ic.commitText("$prefix$text ", 1)
            pushEditorContext()
        }
    }

    override fun onCreate() {
        setTheme(R.style.TypewriterImeTheme)
        super.onCreate()
        soundEngine = SoundAndHapticsEngine(applicationContext)

        val loader = FlutterInjector.instance().flutterLoader()
        if (!loader.initialized()) {
            loader.startInitialization(applicationContext)
        }
        loader.ensureInitializationComplete(applicationContext, null)

        val engine = FlutterEngine(this)
        engine.dartExecutor.executeDartEntrypoint(
            DartExecutor.DartEntrypoint(loader.findAppBundlePath(), "imeMain")
        )
        flutterEngine = engine

        methodChannel = MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL_NAME).apply {
            setMethodCallHandler { call, result -> handleMethodCall(call, result) }
        }

        val filter = IntentFilter(VoiceRecognitionActivity.ACTION_VOICE_RESULT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(voiceReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(voiceReceiver, filter)
        }
        voiceReceiverRegistered = true

        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        try {
            clipboardManager?.addPrimaryClipChangedListener(clipChangedListener)
            clipListenerRegistered = true
        } catch (_: Exception) {
        }
        captureCurrentPrimaryClip()

        sharedPrefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).also {
            it.registerOnSharedPreferenceChangeListener(prefsChangedListener)
            prefsListenerRegistered = true
        }
    }

    override fun onEvaluateFullscreenMode(): Boolean {
        return false
    }

    override fun onConfigureWindow(win: Window, isFullscreen: Boolean, isCandidatesOnly: Boolean) {
        super.onConfigureWindow(win, isFullscreen, isCandidatesOnly)
        win.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        clearImeWindowChrome(win)
    }

    override fun onCreateInputView(): View {
        if (navBottomPx == 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val wm = getSystemService(WindowManager::class.java)
            navBottomPx = wm?.currentWindowMetrics?.windowInsets
                ?.getInsets(WindowInsets.Type.navigationBars())?.bottom ?: 0
        }

        clearImeWindowChrome(window?.window)

        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            elevation = 0f
            outlineProvider = null
            clipChildren = false
            clipToPadding = false
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        // FlutterSurfaceView(renderTransparently = true) renders directly to Hardware Composer
        // with zero TextureView copy/HWUI overhead while preserving transparent 60u top corners.
        val surfaceView = FlutterSurfaceView(this, true).apply {
            setBackgroundColor(Color.TRANSPARENT)
            elevation = 0f
            outlineProvider = null
            holder.setFormat(PixelFormat.TRANSLUCENT)
        }
        val fView = FlutterView(this, surfaceView).apply {
            setBackgroundColor(Color.TRANSPARENT)
            elevation = 0f
            outlineProvider = null
            clipChildren = false
            clipToPadding = false
        }
        val kbHeight = computeKeyboardHeightPx()
        val fvParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            kbHeight + navBottomPx,
            Gravity.BOTTOM
        )
        container.addView(fView, fvParams)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            container.setOnApplyWindowInsetsListener { _, insets ->
                val navBottom = insets.getInsets(WindowInsets.Type.navigationBars()).bottom
                if (navBottomPx != navBottom) {
                    navBottomPx = navBottom
                    val lp = fView.layoutParams as FrameLayout.LayoutParams
                    val targetH = computeKeyboardHeightPx() + navBottom
                    if (lp.height != targetH) {
                        lp.height = targetH
                        fView.layoutParams = lp
                    }
                    methodChannel?.invokeMethod("onBottomInsetChanged", navBottom / resources.displayMetrics.density)
                }
                insets
            }
        }

        flutterEngine?.let { engine ->
            fView.attachToFlutterEngine(engine)
        }

        flutterView = fView
        rootContainer = container
        setCandidatesViewShown(false)
        container.post { clearImeWindowChrome(window?.window) }
        return container
    }

    override fun onComputeInsets(outInsets: Insets) {
        super.onComputeInsets(outInsets)
        val container = rootContainer
        if (container != null && container.visibility == View.VISIBLE && container.height > 0) {
            val loc = IntArray(2)
            container.getLocationInWindow(loc)
            val top = loc[1].coerceAtLeast(0)
            outInsets.contentTopInsets = top
            outInsets.visibleTopInsets = top
            outInsets.touchableInsets = Insets.TOUCHABLE_INSETS_VISIBLE
        }
    }

    private fun clearImeWindowChrome(win: Window?) {
        if (win == null) return
        win.setFormat(PixelFormat.TRANSLUCENT)
        win.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        win.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        win.setDimAmount(0f)
        @Suppress("DEPRECATION")
        win.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            win.isNavigationBarContrastEnforced = false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            win.setBackgroundBlurRadius(0)
        }

        val decor = win.decorView
        decor.background = null
        decor.elevation = 0f
        decor.outlineProvider = null
        decor.clipToOutline = false
        decor.setPadding(0, 0, 0, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            decor.isForceDarkAllowed = false
        }
        if (decor is ViewGroup) {
            decor.clipChildren = false
            decor.clipToPadding = false
        }

        val candidatesArea = decor.findViewById<View>(android.R.id.candidatesArea)
        candidatesArea?.apply {
            visibility = View.GONE
            background = null
            elevation = 0f
        }
        val extractArea = decor.findViewById<View>(android.R.id.extractArea)
        extractArea?.apply {
            visibility = View.GONE
            background = null
            elevation = 0f
        }
        val inputArea = decor.findViewById<View>(android.R.id.inputArea)
        inputArea?.apply {
            background = null
            elevation = 0f
            outlineProvider = null
            setPadding(0, 0, 0, 0)
            if (this is ViewGroup) {
                clipChildren = false
                clipToPadding = false
            }
        }

        var parent = rootContainer?.parent
        while (parent is View) {
            parent.background = null
            parent.elevation = 0f
            parent.outlineProvider = null
            parent.clipToOutline = false
            if (parent is ViewGroup) {
                parent.clipChildren = false
                parent.clipToPadding = false
            }
            parent = parent.parent
        }
    }

    private fun computeKeyboardHeightPx(): Int {
        val metrics = resources.displayMetrics
        val widthPx = metrics.widthPixels
        val heightPx = metrics.heightPixels
        val isLandscape = resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val ideal = (widthPx * KEYBOARD_ASPECT_RATIO).roundToInt()
        val maxAllowed = if (isLandscape) (heightPx * 0.58).roundToInt() else (heightPx * 0.52).roundToInt()
        return min(ideal, maxAllowed)
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        clearImeWindowChrome(window?.window)
        setCandidatesViewShown(false)
        flutterView?.let { fv ->
            val lp = fv.layoutParams
            val targetH = computeKeyboardHeightPx() + navBottomPx
            if (lp != null && lp.height != targetH) {
                lp.height = targetH
                fv.layoutParams = lp
            }
        }
        flutterEngine?.lifecycleChannel?.appIsResumed()
        pushEditorContext(info)
    }

    override fun onWindowShown() {
        super.onWindowShown()
        clearImeWindowChrome(window?.window)
        setCandidatesViewShown(false)
        flutterEngine?.lifecycleChannel?.appIsResumed()
        methodChannel?.invokeMethod("onVisibilityChanged", true)
        if (navBottomPx > 0) {
            methodChannel?.invokeMethod(
                "onBottomInsetChanged",
                navBottomPx / resources.displayMetrics.density
            )
        }
        methodChannel?.invokeMethod("onPreferencesUpdated", PrefsStore.readAll(applicationContext))
        captureCurrentPrimaryClip()
        pushEditorContext()
    }

    override fun onWindowHidden() {
        super.onWindowHidden()
        methodChannel?.invokeMethod("onVisibilityChanged", false)
        flutterEngine?.lifecycleChannel?.appIsPaused()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        methodChannel?.invokeMethod("onVisibilityChanged", false)
        flutterEngine?.lifecycleChannel?.appIsPaused()
    }

    override fun onUpdateSelection(
        oldSelStart: Int,
        oldSelEnd: Int,
        newSelStart: Int,
        newSelEnd: Int,
        candidatesStart: Int,
        candidatesEnd: Int
    ) {
        super.onUpdateSelection(
            oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd
        )
        // Skip redundant Binder IPC + Dart rebuild immediately after our own keystrokes
        if (SystemClock.elapsedRealtime() - lastLocalEditTimeMs < 140L) {
            return
        }
        pushEditorContext()
    }

    private fun pushEditorContext(editorInfo: EditorInfo? = currentInputEditorInfo) {
        val ic = currentInputConnection
        val before = ic?.getTextBeforeCursor(64, 0)?.toString() ?: ""
        val inputType = editorInfo?.inputType ?: InputType.TYPE_CLASS_TEXT
        val imeOptions = editorInfo?.imeOptions ?: EditorInfo.IME_ACTION_UNSPECIFIED

        val inputClass = inputType and InputType.TYPE_MASK_CLASS
        val variation = inputType and InputType.TYPE_MASK_VARIATION
        val isNumeric = inputClass == InputType.TYPE_CLASS_NUMBER ||
            inputClass == InputType.TYPE_CLASS_PHONE ||
            inputClass == InputType.TYPE_CLASS_DATETIME
        val isPassword = inputClass == InputType.TYPE_CLASS_TEXT && (
            variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
                variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
            )
        val noSuggestions = isPassword ||
            (inputType and InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS) != 0 ||
            variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
            variation == InputType.TYPE_TEXT_VARIATION_URI
        val isMultiline = (inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0 ||
            (inputType and InputType.TYPE_TEXT_FLAG_IME_MULTI_LINE) != 0

        val capsMode = ic?.getCursorCapsMode(inputType) ?: 0
        val shouldCap = capsMode != 0

        val actionId = imeOptions and EditorInfo.IME_MASK_ACTION
        val noEnterAction = (imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        val actionLabel = if (noEnterAction || isMultiline) {
            "newline"
        } else {
            when (actionId) {
                EditorInfo.IME_ACTION_SEARCH -> "search"
                EditorInfo.IME_ACTION_SEND -> "send"
                EditorInfo.IME_ACTION_GO -> "go"
                EditorInfo.IME_ACTION_NEXT -> "next"
                EditorInfo.IME_ACTION_DONE -> "done"
                else -> "newline"
            }
        }

        methodChannel?.invokeMethod(
            "onEditorContext",
            mapOf(
                "textBeforeCursor" to before,
                "shouldCapitalize" to shouldCap,
                "isNumeric" to isNumeric,
                "isPassword" to isPassword,
                "noSuggestions" to noSuggestions,
                "actionLabel" to actionLabel
            )
        )
    }

    private fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "keyAction" -> {
                val action = call.argument<String>("action") ?: "commit"
                val text = call.argument<String>("text") ?: ""
                val count = (call.argument<Int>("count") ?: 1).coerceAtLeast(1)
                val delta = call.argument<Int>("delta") ?: 0
                val sound = call.argument<String>("sound") ?: "key"
                val playSound = call.argument<Boolean>("playSound") ?: true
                val vol = (call.argument<Double>("volume") ?: 0.85).toFloat()
                val hapticsLevel = call.argument<Int>("hapticsLevel") ?: 1
                val heavy = call.argument<Boolean>("heavy") ?: false

                if (playSound) {
                    soundEngine?.playSound(sound, vol)
                }
                if (hapticsLevel > 0) {
                    soundEngine?.haptic(hapticsLevel, heavy, flutterView)
                }

                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                when (action) {
                    "commit" -> currentInputConnection?.commitText(text, 1)
                    "replaceWord" -> performReplaceCurrentWord(text)
                    "backspace" -> performBackspace(count, pushContext = false)
                    "deleteWord" -> performDeleteWord(pushContext = false)
                    "moveCursor" -> performMoveCursor(delta, pushContext = false)
                    "return" -> performReturnAction(pushContext = false)
                    "pasteText" -> performPasteText(text)
                    "selectAll" -> currentInputConnection?.performContextMenuAction(android.R.id.selectAll)
                    "feedbackOnly" -> {}
                }
                result.success(true)
            }
            "commitText" -> {
                val text = call.argument<String>("text") ?: ""
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                currentInputConnection?.commitText(text, 1)
                result.success(true)
            }
            "pasteText" -> {
                val text = call.argument<String>("text")
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performPasteText(text)
                result.success(true)
            }
            "selectAll" -> {
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                currentInputConnection?.performContextMenuAction(android.R.id.selectAll)
                result.success(true)
            }
            "getClipboardItems" -> {
                captureCurrentPrimaryClip()
                val items = synchronized(clipboardHistory) { ArrayList(clipboardHistory) }
                result.success(items)
            }
            "clearClipboardItems" -> {
                synchronized(clipboardHistory) {
                    clipboardHistory.clear()
                }
                result.success(true)
            }
            "replaceCurrentWord" -> {
                val replacement = call.argument<String>("text") ?: ""
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performReplaceCurrentWord(replacement)
                result.success(true)
            }
            "backspace" -> {
                val count = (call.argument<Int>("count") ?: 1).coerceAtLeast(1)
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performBackspace(count, pushContext = false)
                result.success(true)
            }
            "deleteWordBeforeCursor" -> {
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performDeleteWord(pushContext = false)
                result.success(true)
            }
            "moveCursor" -> {
                val delta = call.argument<Int>("delta") ?: 0
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performMoveCursor(delta, pushContext = false)
                result.success(true)
            }
            "performReturn" -> {
                lastLocalEditTimeMs = SystemClock.elapsedRealtime()
                performReturnAction(pushContext = false)
                result.success(true)
            }
            "switchKeyboard" -> {
                val showPicker = call.argument<Boolean>("picker") ?: false
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                if (showPicker) {
                    imm.showInputMethodPicker()
                } else {
                    val token = window?.window?.attributes?.token
                    val switched = if (token != null) {
                        @Suppress("DEPRECATION")
                        imm.switchToNextInputMethod(token, false)
                    } else {
                        false
                    }
                    if (!switched) {
                        imm.showInputMethodPicker()
                    }
                }
                result.success(true)
            }
            "openVoiceInput" -> {
                val intent = Intent(this, VoiceRecognitionActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
                result.success(true)
            }
            "openCompanionApp" -> {
                val intent = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
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
                soundEngine?.haptic(level, heavy, flutterView)
                result.success(true)
            }
            "getPreferences" -> {
                result.success(PrefsStore.readAll(applicationContext))
            }
            "setPreference" -> {
                val key = call.argument<String>("key")
                val value = call.argument<Any>("value")
                if (key != null) {
                    PrefsStore.writeValue(applicationContext, key, value)
                }
                result.success(true)
            }
            "getEditorContext" -> {
                pushEditorContext()
                result.success(true)
            }
            else -> result.notImplemented()
        }
    }

    private fun performReplaceCurrentWord(replacement: String) {
        val ic = currentInputConnection ?: return
        val before = ic.getTextBeforeCursor(64, 0)?.toString() ?: ""
        val match = Regex("[A-Za-z'’]+$").find(before)
        ic.beginBatchEdit()
        if (match != null && match.value.isNotEmpty()) {
            ic.deleteSurroundingText(match.value.length, 0)
        }
        ic.commitText(replacement, 1)
        ic.endBatchEdit()
    }

    private fun performBackspace(count: Int, pushContext: Boolean = true) {
        val ic = currentInputConnection ?: return
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) {
            ic.commitText("", 1)
            if (pushContext) pushEditorContext()
            return
        }

        val before = ic.getTextBeforeCursor(16, 0)?.toString() ?: ""
        if (before.isEmpty()) {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
            if (pushContext) pushEditorContext()
            return
        }

        var deleteLen = 0
        var remaining = count
        var idx = before.length
        while (remaining > 0 && idx > 0) {
            val cp = Character.codePointBefore(before, idx)
            val charCount = Character.charCount(cp)
            deleteLen += charCount
            idx -= charCount
            remaining--
        }
        if (deleteLen > 0) {
            ic.deleteSurroundingText(deleteLen, 0)
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
        }
        if (pushContext) pushEditorContext()
    }

    private fun performDeleteWord(pushContext: Boolean = true) {
        val ic = currentInputConnection ?: return
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) {
            ic.commitText("", 1)
            if (pushContext) pushEditorContext()
            return
        }
        val before = ic.getTextBeforeCursor(64, 0)?.toString() ?: ""
        if (before.isEmpty()) {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_DEL)
            return
        }
        var idx = before.length
        while (idx > 0 && before[idx - 1].isWhitespace()) idx--
        while (idx > 0 && !before[idx - 1].isWhitespace()) idx--
        val deleteLen = (before.length - idx).coerceAtLeast(1)
        ic.deleteSurroundingText(deleteLen, 0)
        if (pushContext) pushEditorContext()
    }

    private fun captureCurrentPrimaryClip() {
        val cm = clipboardManager ?: return
        try {
            val clip = cm.primaryClip ?: return
            if (clip.itemCount <= 0) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val isSensitive = clip.description?.extras
                    ?.getBoolean(ClipDescription.EXTRA_IS_SENSITIVE, false) == true
                if (isSensitive) return
            }
            val raw = clip.getItemAt(0).coerceToText(this)?.toString() ?: return
            if (raw.isBlank()) return
            val normalized = if (raw.length > MAX_CLIPBOARD_TEXT_LENGTH) {
                raw.substring(0, MAX_CLIPBOARD_TEXT_LENGTH)
            } else {
                raw
            }
            synchronized(clipboardHistory) {
                clipboardHistory.remove(normalized)
                clipboardHistory.add(0, normalized)
                while (clipboardHistory.size > MAX_CLIPBOARD_ITEMS) {
                    clipboardHistory.removeAt(clipboardHistory.lastIndex)
                }
            }
        } catch (_: Exception) {
            // Android 10+ restricts clipboard reads without focus; fail safely.
        }
    }

    private fun performPasteText(text: String?) {
        val ic = currentInputConnection ?: return
        if (!text.isNullOrEmpty()) {
            ic.commitText(text, 1)
        } else {
            ic.performContextMenuAction(android.R.id.paste)
        }
    }

    private fun performMoveCursor(delta: Int, pushContext: Boolean = true) {
        if (delta == 0) return
        val ic = currentInputConnection ?: return
        val extracted = try {
            ic.getExtractedText(ExtractedTextRequest(), 0)
        } catch (_: Exception) {
            null
        }
        if (extracted != null && extracted.text != null && extracted.selectionStart >= 0) {
            val base = if (delta < 0) {
                extracted.selectionStart
            } else {
                extracted.selectionEnd.coerceAtLeast(extracted.selectionStart)
            }
            val target = (base + delta).coerceIn(0, extracted.text.length)
            if (target != extracted.selectionStart || target != extracted.selectionEnd) {
                ic.setSelection(target, target)
            }
            if (pushContext) pushEditorContext()
            return
        }
        // Fallback cleanly when WebView/Chrome does not expose ExtractedText.
        val hasSelection = !ic.getSelectedText(0).isNullOrEmpty()
        if (!hasSelection) {
            if (delta < 0) {
                val before = ic.getTextBeforeCursor(1, 0)
                if (before != null && before.isEmpty()) {
                    if (pushContext) pushEditorContext()
                    return
                }
            } else {
                val after = ic.getTextAfterCursor(1, 0)
                if (after != null && after.isEmpty()) {
                    if (pushContext) pushEditorContext()
                    return
                }
            }
        }
        val keyCode = if (delta < 0) KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_RIGHT
        val steps = kotlin.math.abs(delta).coerceAtMost(32)
        repeat(steps) {
            sendDownUpKeyEvents(keyCode)
        }
        if (pushContext) pushEditorContext()
    }

    private fun performReturnAction(pushContext: Boolean = true) {
        val ic = currentInputConnection ?: return
        val info = currentInputEditorInfo
        if (info != null) {
            val imeOptions = info.imeOptions
            val inputType = info.inputType
            val isMultiline = (inputType and InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0 ||
                (inputType and InputType.TYPE_TEXT_FLAG_IME_MULTI_LINE) != 0
            val noEnterAction = (imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
            val action = imeOptions and EditorInfo.IME_MASK_ACTION
            if (!isMultiline && !noEnterAction &&
                action != EditorInfo.IME_ACTION_NONE &&
                action != EditorInfo.IME_ACTION_UNSPECIFIED
            ) {
                if (ic.performEditorAction(action)) {
                    if (pushContext) pushEditorContext()
                    return
                }
            }
        }
        ic.commitText("\n", 1)
        if (pushContext) pushEditorContext()
    }

    override fun onDestroy() {
        if (voiceReceiverRegistered) {
            try {
                unregisterReceiver(voiceReceiver)
            } catch (_: Exception) {
            }
            voiceReceiverRegistered = false
        }
        if (clipListenerRegistered) {
            try {
                clipboardManager?.removePrimaryClipChangedListener(clipChangedListener)
            } catch (_: Exception) {
            }
            clipListenerRegistered = false
        }
        clipboardManager = null
        if (prefsListenerRegistered) {
            try {
                sharedPrefs?.unregisterOnSharedPreferenceChangeListener(prefsChangedListener)
            } catch (_: Exception) {
            }
            prefsListenerRegistered = false
        }
        sharedPrefs = null
        flutterView?.detachFromFlutterEngine()
        flutterView = null
        rootContainer = null
        methodChannel?.setMethodCallHandler(null)
        methodChannel = null
        flutterEngine?.destroy()
        flutterEngine = null
        soundEngine?.release()
        soundEngine = null
        super.onDestroy()
    }
}
