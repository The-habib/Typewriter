import 'dart:async';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/scheduler.dart';
import 'keyboard_bake_cache.dart';
import 'keyboard_bridge.dart';
import 'keyboard_geometry.dart';
import 'keyboard_icons.dart';
import 'keyboard_physics.dart';
import 'prediction_engine.dart';
import 'typewriter_painter.dart';

class TypewriterKeyboardWidget extends StatefulWidget {
  final KeyboardBridge bridge;
  final KeyboardPreferences initialPreferences;
  final EditorContextState initialEditorContext;
  final ValueChanged<KeyboardPreferences>? onPreferencesChanged;
  final bool showCompanionShortcut;

  const TypewriterKeyboardWidget({
    super.key,
    required this.bridge,
    this.initialPreferences = const KeyboardPreferences(),
    this.initialEditorContext = const EditorContextState(),
    this.onPreferencesChanged,
    this.showCompanionShortcut = true,
  });

  @override
  State<TypewriterKeyboardWidget> createState() => TypewriterKeyboardWidgetState();
}

class TypewriterKeyboardWidgetState extends State<TypewriterKeyboardWidget>
    with SingleTickerProviderStateMixin {
  late final KeyboardPhysicsController _physics;
  late final KeyboardBakeCache _bakeCache;
  late final Ticker _ticker;
  Duration? _lastTickTime;

  late KeyboardPreferences _prefs;
  late EditorContextState _editorCtx;
  String _shadowBeforeCursor = '';
  late final ValueNotifier<PredictionResult> _predictionsNotifier;

  KeyboardLayer _layer = KeyboardLayer.abc;
  bool _shifted = false;
  bool _capsLock = false;
  DateTime? _lastShiftTap;
  DateTime? _lastSpaceTap;

  bool _emojiOpen = false;
  bool _quickMenuOpen = false;
  bool _clipboardOpen = false;
  List<String> _clipboardItems = const [];
  int _emojiCategoryIndex = 1; // 0: Recent, 1: Faces, 2: Hands, 3: Hearts, 4: Nature, 5: Objects
  final List<String> _recentEmojis = [];
  Timer? _emojiBkspTimer;

  // Autocorrect undo & prediction smart punctuation tracking
  String? _lastAutoCorrectRaw;
  String? _lastAutoCorrectReplaced;
  bool _lastCommitWasPredictionSpace = false;

  // Multi-touch pointer tracking
  final Map<int, String> _pointerToKey = {};
  final Map<int, Timer> _longPressTimers = {};
  Timer? _backspaceRepeatTimer;
  int _backspaceRepeatCount = 0;

  // Backspace swipe-left word deletion
  int? _backspacePointerId;
  double _backspaceLastX = 0.0;
  double _backspaceDragAccum = 0.0;
  bool _backspaceDidSwipe = false;

  // Chorded Shift-drag / 123-drag state
  int? _chordPointerId;
  String? _chordKeyId;
  KeyboardLayer? _chordOriginLayer;
  String? _chordHoverKeyId;

  // Spacebar trackpad state
  int? _spacePointerId;
  DateTime? _spaceDownTime;
  Offset _spaceDownPos = Offset.zero;
  double _spaceLastX = 0.0;
  double _spaceDragAccum = 0.0;
  bool _spaceDidDrag = false;
  bool _spaceInsertedProvisional = false;

  // Accent long-press popup state
  String? _accentOwnerKeyId;
  int? _accentPointerId;
  List<String> _accentOptions = const [];
  int _accentSelectedIndex = 0;
  Offset _accentAnchorDesign = Offset.zero;

  static const List<({String label, List<String> items})> _emojiCategories = [
    (label: 'Recent', items: []),
    (
      label: 'Faces',
      items: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰',
        '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
        '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
        '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯',
        '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
        '😭', '😤', '😠', '😡', '🤬', '😈', '💀', '🤡', '👻', '👽', '🤖', '💩',
      ],
    ),
    (
      label: 'Hands',
      items: [
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
        '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶',
        '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '👀', '👁️', '🧠', '👂', '👃',
      ],
    ),
    (
      label: 'Hearts',
      items: [
        '❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🖤', '🩶', '🤍', '🤎', '💔', '❤️‍🔥',
        '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '✨', '💫', '⭐', '🌟',
        '💥', '💢', '💦', '💨', '🔥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎯', '✅',
      ],
    ),
    (
      label: 'Nature',
      items: [
        '🌞', '🌝', '🌙', '⭐', '☀️', '⛅', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '⚡', '🌈', '🌊',
        '🔥', '💧', '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵',
        '🍀', '🍁', '🍂', '🍃', '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁',
        '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦉', '🦋', '🐝', '🐞', '🐢', '🐬',
      ],
    ),
    (
      label: 'Objects',
      items: [
        '⌨️', '🖋️', '🖊️', '✏️', '📝', '📄', '📖', '📚', '💼', '📌', '📎', '✂️', '🔑', '🔒',
        '🔓', '🔔', '🔕', '💡', '🔦', '📱', '💻', '🖥️', '🖨️', '📷', '🎥', '🎬', '🎧', '🎤',
        '🎵', '🎶', '🎸', '🎹', '☕', '🍵', '🧋', '🍕', '🍔', '🍟', '🌮', '🍣', '🍩', '🍪',
        '🎂', '🍰', '🍷', '🍺', '🚗', '✈️', '🚀', '🛸', '⌚', '⏰', '🧭', '💎', '🪙', '💳',
      ],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _prefs = widget.initialPreferences;
    _editorCtx = widget.initialEditorContext;
    _shadowBeforeCursor = _editorCtx.textBeforeCursor;
    _physics = KeyboardPhysicsController()..slowMo = _prefs.slowMo;
    _bakeCache = KeyboardBakeCache();
    _predictionsNotifier = ValueNotifier(_computePredictions());
    _ticker = createTicker(_onTick);
    _applyAutoCapsIfNeeded();
    unawaited(
      PredictionEngine.ensureLoaded().then((_) {
        if (mounted) _refreshPredictions();
      }),
    );
  }

  @override
  void didUpdateWidget(covariant TypewriterKeyboardWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialPreferences != widget.initialPreferences) {
      _prefs = widget.initialPreferences;
      _physics.slowMo = _prefs.slowMo;
      _refreshPredictions();
    }
    if (oldWidget.initialEditorContext != widget.initialEditorContext) {
      updateEditorContext(widget.initialEditorContext);
    }
  }

  void setImeVisible(bool visible) {
    if (!visible) {
      for (final t in _longPressTimers.values) {
        t.cancel();
      }
      _longPressTimers.clear();
      _backspaceRepeatTimer?.cancel();
      _backspaceRepeatTimer = null;
      _pointerToKey.clear();
      _spacePointerId = null;
      _physics.releaseAll();
      if (_ticker.isActive) {
        _ticker.stop();
        _lastTickTime = null;
      }
    }
  }

  void updatePreferences(KeyboardPreferences prefs) {
    if (!mounted) return;
    setState(() {
      _prefs = prefs;
      _physics.slowMo = prefs.slowMo;
    });
    _refreshPredictions();
  }

  void updateEditorContext(EditorContextState ctx) {
    if (!mounted) return;
    final wasNumeric = _editorCtx.isNumeric;
    final prevAction = _editorCtx.actionLabel;
    final prevNoSug = _editorCtx.noSuggestions;

    _editorCtx = ctx;
    _shadowBeforeCursor = ctx.textBeforeCursor;
    _refreshPredictions();

    final prevShifted = _shifted;
    if (_prefs.autoCaps && !_capsLock && _layer == KeyboardLayer.abc) {
      _shifted = ctx.shouldCapitalize;
    }

    final layerSwitch = (ctx.isNumeric && !wasNumeric) ||
        (!ctx.isNumeric && wasNumeric && _layer == KeyboardLayer.num);

    if (layerSwitch ||
        prevShifted != _shifted ||
        prevAction != ctx.actionLabel ||
        prevNoSug != ctx.noSuggestions) {
      setState(() {
        if (ctx.isNumeric && !wasNumeric) {
          _layer = KeyboardLayer.num;
        } else if (!ctx.isNumeric && wasNumeric && _layer == KeyboardLayer.num) {
          _layer = KeyboardLayer.abc;
        }
      });
    }
  }

  PredictionResult _computePredictions() {
    if (_editorCtx.noSuggestions) {
      return const PredictionResult(items: ['', '', ''], highlightIndex: -1);
    }
    return PredictionEngine.predict(
      _shadowBeforeCursor,
      enabled: _prefs.predictionsEnabled,
    );
  }

  void _refreshPredictions() {
    _predictionsNotifier.value = _computePredictions();
  }

  void _applyShadowCommit(String text) {
    _shadowBeforeCursor = '$_shadowBeforeCursor$text';
    if (_shadowBeforeCursor.length > 80) {
      _shadowBeforeCursor = _shadowBeforeCursor.substring(_shadowBeforeCursor.length - 80);
    }
    _refreshPredictions();
  }

  void _applyShadowBackspace(int count) {
    if (_shadowBeforeCursor.isEmpty) return;
    final chars = _shadowBeforeCursor.characters;
    final keep = (chars.length - count).clamp(0, chars.length);
    _shadowBeforeCursor = chars.take(keep).toString();
    _refreshPredictions();
  }

  void _applyShadowDeleteWord() {
    if (_shadowBeforeCursor.isEmpty) return;
    var idx = _shadowBeforeCursor.length;
    while (idx > 0 && _shadowBeforeCursor[idx - 1].trim().isEmpty) {
      idx--;
    }
    while (idx > 0 && _shadowBeforeCursor[idx - 1].trim().isNotEmpty) {
      idx--;
    }
    _shadowBeforeCursor = _shadowBeforeCursor.substring(0, idx);
    _refreshPredictions();
  }

  void _applyShadowReplaceWord(String replacement) {
    final m = RegExp(r"[A-Za-z'’]+$").firstMatch(_shadowBeforeCursor);
    final start = m != null ? m.start : _shadowBeforeCursor.length;
    _shadowBeforeCursor = '${_shadowBeforeCursor.substring(0, start)}$replacement';
    if (_shadowBeforeCursor.length > 80) {
      _shadowBeforeCursor = _shadowBeforeCursor.substring(_shadowBeforeCursor.length - 80);
    }
    _refreshPredictions();
  }

  void _applyAutoCapsIfNeeded() {
    if (!_prefs.autoCaps || _capsLock) return;
    if (_layer != KeyboardLayer.abc) return;
    _shifted = _editorCtx.shouldCapitalize;
  }

  /// Programmatic key press for demo playback inside the companion app.
  void simulateKeyPress(String id, {bool hold = true, bool triggerAction = true}) {
    _physics.pressKey(id);
    _ensureTickerRunning();
    if (triggerAction) {
      _executeKeyAction(id);
    }
    if (!hold) {
      _physics.releaseKey(id);
    }
  }

  void simulateKeyRelease(String id) {
    _physics.releaseKey(id);
    _ensureTickerRunning();
  }

  void resetToDefaultLayer() {
    if (!mounted) return;
    _shadowBeforeCursor = '';
    _refreshPredictions();
    setState(() {
      _layer = KeyboardLayer.abc;
      _shifted = false;
      _capsLock = false;
      _emojiOpen = false;
      _quickMenuOpen = false;
    });
  }

  void _ensureTickerRunning() {
    if (!_ticker.isActive) {
      _lastTickTime = null;
      _ticker.start();
    }
  }

  void _onTick(Duration elapsed) {
    final prev = _lastTickTime;
    _lastTickTime = elapsed;
    if (prev == null) return;
    final dt = (elapsed - prev).inMicroseconds / 1000000.0;
    final stillActive = _physics.step(dt);
    if (!stillActive) {
      _ticker.stop();
      _lastTickTime = null;
    }
  }

  void _dispatchKeyAction({
    required String action,
    String text = '',
    int count = 1,
    int delta = 0,
    String sound = 'key',
    bool playSound = true,
    bool heavy = false,
  }) {
    unawaited(
      widget.bridge.keyAction(
        action: action,
        text: text,
        count: count,
        delta: delta,
        sound: sound,
        playSound: playSound && _prefs.soundEnabled,
        volume: _prefs.soundVolume,
        hapticsLevel: _prefs.hapticsLevel,
        heavy: heavy,
      ),
    );
  }

  String _resolveKeyChar(String id) {
    final cfg = kKeyboardLayers[_layer]!;
    String ch = '';
    if (id.startsWith('r1_')) {
      ch = cfg.r1[int.parse(id.substring(3))];
    } else if (id.startsWith('r2_')) {
      ch = cfg.r2[int.parse(id.substring(3))];
    } else if (id.startsWith('r3_')) {
      ch = cfg.r3[int.parse(id.substring(3))];
    }
    if (_layer == KeyboardLayer.abc && ch.isNotEmpty) {
      ch = (_shifted || _capsLock) ? ch.toUpperCase() : ch.toLowerCase();
    }
    return ch;
  }

  void _executeKeyAction(String id) {
    if (id == 'space') {
      _commitSpaceInstant();
      return;
    }
    if (id == 'backspace') {
      if (_lastAutoCorrectRaw != null &&
          _lastAutoCorrectReplaced != null &&
          _shadowBeforeCursor.endsWith(_lastAutoCorrectReplaced!)) {
        final raw = _lastAutoCorrectRaw!;
        final delLen = _lastAutoCorrectReplaced!.length;
        _lastAutoCorrectRaw = null;
        _lastAutoCorrectReplaced = null;
        _lastCommitWasPredictionSpace = false;
        _applyShadowBackspace(delLen);
        _applyShadowCommit(raw);
        _dispatchKeyAction(action: 'backspace', count: delLen, sound: 'backspace');
        unawaited(widget.bridge.commitText(raw));
        return;
      }
      _lastAutoCorrectRaw = null;
      _lastAutoCorrectReplaced = null;
      _lastCommitWasPredictionSpace = false;
      _applyShadowBackspace(1);
      _dispatchKeyAction(action: 'backspace', count: 1, sound: 'backspace');
      if (_prefs.autoCaps && !_capsLock && _layer == KeyboardLayer.abc) {
        final nextCap = _shadowBeforeCursor.isEmpty ||
            RegExp(r'[.!?]\s+$|\n$').hasMatch(_shadowBeforeCursor);
        if (nextCap != _shifted) {
          setState(() => _shifted = nextCap);
        }
      }
      return;
    }
    if (id == 'return') {
      _lastAutoCorrectRaw = null;
      _lastAutoCorrectReplaced = null;
      _lastCommitWasPredictionSpace = false;
      _applyShadowCommit('\n');
      _dispatchKeyAction(action: 'return', sound: 'return', heavy: true);
      if (_prefs.autoCaps && !_capsLock && _layer == KeyboardLayer.abc && !_shifted) {
        setState(() => _shifted = true);
      }
      return;
    }
    if (id == 'mode') {
      _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
      setState(() {
        _layer = _layer == KeyboardLayer.abc ? KeyboardLayer.num : KeyboardLayer.abc;
        _emojiOpen = false;
        _quickMenuOpen = false;
        _clipboardOpen = false;
      });
      return;
    }
    if (id == 'shift') {
      _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
      final now = DateTime.now();
      setState(() {
        if (_layer == KeyboardLayer.abc) {
          if (_capsLock) {
            _capsLock = false;
            _shifted = false;
          } else if (_lastShiftTap != null &&
              now.difference(_lastShiftTap!).inMilliseconds < 320) {
            _capsLock = true;
            _shifted = true;
          } else {
            _shifted = !_shifted;
          }
          _lastShiftTap = now;
        } else if (_layer == KeyboardLayer.num) {
          _layer = KeyboardLayer.sym;
        } else {
          _layer = KeyboardLayer.num;
        }
      });
      return;
    }
    if (id == 'emoji') {
      _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
      setState(() {
        _emojiOpen = !_emojiOpen;
        _quickMenuOpen = false;
        _clipboardOpen = false;
        if (_emojiOpen && _recentEmojis.isNotEmpty && _emojiCategoryIndex == 1) {
          _emojiCategoryIndex = 0;
        }
      });
      return;
    }

    final ch = _resolveKeyChar(id);
    if (ch.isEmpty) return;

    _lastAutoCorrectRaw = null;
    _lastAutoCorrectReplaced = null;
    const stripPunct = {'.', ',', '?', '!', ';', ':'};
    if (_lastCommitWasPredictionSpace &&
        stripPunct.contains(ch) &&
        _shadowBeforeCursor.endsWith(' ')) {
      _applyShadowBackspace(1);
      _dispatchKeyAction(action: 'backspace', count: 1, playSound: false);
    }
    _lastCommitWasPredictionSpace = false;

    _applyShadowCommit(ch);
    _dispatchKeyAction(action: 'commit', text: ch, sound: 'key');

    if (_layer == KeyboardLayer.abc && _shifted && !_capsLock) {
      setState(() {
        _shifted = false;
      });
    }
  }

  void _commitSpaceInstant() {
    final now = DateTime.now();
    if (_prefs.doubleSpacePeriod &&
        _lastSpaceTap != null &&
        now.difference(_lastSpaceTap!).inMilliseconds < 340 &&
        _shadowBeforeCursor.length >= 2 &&
        _shadowBeforeCursor.endsWith(' ') &&
        RegExp(r'[A-Za-z0-9]$')
            .hasMatch(_shadowBeforeCursor.substring(0, _shadowBeforeCursor.length - 1))) {
      _lastAutoCorrectRaw = null;
      _lastAutoCorrectReplaced = null;
      _lastCommitWasPredictionSpace = false;
      _applyShadowBackspace(1);
      _applyShadowCommit('. ');
      _dispatchKeyAction(action: 'backspace', count: 1, sound: 'space', heavy: true);
      unawaited(widget.bridge.commitText('. '));
      _lastSpaceTap = null;
      _spaceInsertedProvisional = false;
      if (_prefs.autoCaps && !_capsLock && _layer == KeyboardLayer.abc && !_shifted) {
        setState(() => _shifted = true);
      }
      return;
    }

    _lastSpaceTap = now;
    _spaceInsertedProvisional = true;
    _lastCommitWasPredictionSpace = false;

    final tokenMatch = RegExp(r"([A-Za-z'’]+)$").firstMatch(_shadowBeforeCursor);
    if (_prefs.autoCorrectOnSpace &&
        !_editorCtx.isPassword &&
        !_editorCtx.noSuggestions &&
        tokenMatch != null) {
      final rawWord = tokenMatch.group(1)!;
      final suggestion = PredictionEngine.autoCorrectSuggestion(_shadowBeforeCursor);
      if (suggestion != null && suggestion != rawWord) {
        final replaced = '$suggestion ';
        _applyShadowReplaceWord(replaced);
        _dispatchKeyAction(
          action: 'replaceWord',
          text: replaced,
          sound: 'space',
          heavy: true,
        );
        PredictionEngine.learnWord(suggestion);
        _lastAutoCorrectRaw = rawWord;
        _lastAutoCorrectReplaced = replaced;
        return;
      }
    }

    if (tokenMatch != null && tokenMatch.group(1)!.length >= 2) {
      PredictionEngine.learnWord(tokenMatch.group(1)!);
    }
    _lastAutoCorrectRaw = null;
    _lastAutoCorrectReplaced = null;
    _applyShadowCommit(' ');
    _dispatchKeyAction(action: 'commit', text: ' ', sound: 'space', heavy: true);
  }

  void _onPointerDown(PointerDownEvent e, double sx, double sy) {
    final designPos = Offset(e.localPosition.dx / sx, e.localPosition.dy / sy);
    final id = _physics.hitTest(designPos);
    if (id == null) return;

    _pointerToKey[e.pointer] = id;
    _physics.pressKey(id);
    _ensureTickerRunning();

    if (id == 'space') {
      _spacePointerId = e.pointer;
      _spaceDownTime = DateTime.now();
      _spaceDownPos = e.localPosition;
      _spaceLastX = e.localPosition.dx;
      _spaceDragAccum = 0.0;
      _spaceDidDrag = false;
      _commitSpaceInstant();
      return;
    }

    if (id == 'shift' || id == 'mode') {
      _chordPointerId = e.pointer;
      _chordKeyId = id;
      _chordOriginLayer = _layer;
      _chordHoverKeyId = null;
    } else if (id == 'backspace') {
      _backspacePointerId = e.pointer;
      _backspaceLastX = e.localPosition.dx;
      _backspaceDragAccum = 0.0;
      _backspaceDidSwipe = false;
    }

    _executeKeyAction(id);

    _longPressTimers[e.pointer]?.cancel();
    if (id == 'backspace') {
      _backspaceRepeatCount = 0;
      _longPressTimers[e.pointer] = Timer(const Duration(milliseconds: 360), () {
        if (!_pointerToKey.containsKey(e.pointer)) return;
        _backspaceRepeatTimer?.cancel();
        _backspaceRepeatTimer = Timer.periodic(const Duration(milliseconds: 60), (timer) {
          if (!_pointerToKey.containsValue('backspace')) {
            timer.cancel();
            return;
          }
          _backspaceRepeatCount++;
          if (_backspaceRepeatCount > 18 && _backspaceRepeatCount % 2 == 0) {
            _applyShadowDeleteWord();
            _dispatchKeyAction(action: 'deleteWord', sound: 'backspace');
          } else {
            _applyShadowBackspace(1);
            _dispatchKeyAction(action: 'backspace', count: 1, sound: 'backspace');
          }
        });
      });
    } else if (id == 'shift' && _layer == KeyboardLayer.abc) {
      _longPressTimers[e.pointer] = Timer(const Duration(milliseconds: 450), () {
        if (!_pointerToKey.containsKey(e.pointer)) return;
        _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode', heavy: true);
        setState(() {
          _capsLock = true;
          _shifted = true;
        });
      });
    } else {
      final rawCh = _resolveKeyChar(id);
      final alts = kAccentAlternates[rawCh.toUpperCase()] ?? kAccentAlternates[rawCh];
      if (alts != null && alts.isNotEmpty) {
        final keyDef = kKeyDefs.firstWhere((k) => k.id == id);
        _longPressTimers[e.pointer] = Timer(const Duration(milliseconds: 380), () {
          if (!_pointerToKey.containsKey(e.pointer) || !mounted) return;
          final formatted = alts.map((a) {
            if (_layer == KeyboardLayer.abc && !(_shifted || _capsLock)) {
              return a.toLowerCase();
            }
            return a;
          }).toList();
          _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
          setState(() {
            _accentOwnerKeyId = id;
            _accentPointerId = e.pointer;
            _accentOptions = formatted;
            _accentSelectedIndex = 0;
            _accentAnchorDesign = Offset(keyDef.x, keyDef.y);
          });
        });
      }
    }
  }

  void _onPointerMove(PointerMoveEvent e, double sx, double sy) {
    if (e.pointer == _chordPointerId) {
      final designPos = Offset(e.localPosition.dx / sx, e.localPosition.dy / sy);
      final hitId = _physics.hitTest(designPos);
      if (hitId != null && hitId != _chordKeyId && hitId != 'shift' && hitId != 'mode') {
        if (hitId != _chordHoverKeyId) {
          if (_chordHoverKeyId != null) {
            _physics.releaseKey(_chordHoverKeyId!);
          }
          _chordHoverKeyId = hitId;
          _physics.pressKey(hitId);
          _ensureTickerRunning();
        }
      } else if (hitId == _chordKeyId && _chordHoverKeyId != null) {
        _physics.releaseKey(_chordHoverKeyId!);
        _chordHoverKeyId = null;
      }
      return;
    }

    if (e.pointer == _backspacePointerId) {
      final dx = e.localPosition.dx - _backspaceLastX;
      _backspaceLastX = e.localPosition.dx;
      if (dx < 0 || _backspaceDidSwipe) {
        _backspaceDragAccum += dx;
        final stepPx = 38.0 * sx;
        if (_backspaceDragAccum <= -stepPx) {
          _longPressTimers.remove(e.pointer)?.cancel();
          _backspaceRepeatTimer?.cancel();
          _backspaceRepeatTimer = null;
          _backspaceDidSwipe = true;
          while (_backspaceDragAccum <= -stepPx) {
            _backspaceDragAccum += stepPx;
            _applyShadowDeleteWord();
            _dispatchKeyAction(action: 'deleteWord', sound: 'backspace');
          }
        }
      }
      return;
    }

    if (e.pointer == _spacePointerId && _prefs.spacebarTrackpad) {
      final totalDx = (e.localPosition.dx - _spaceDownPos.dx).abs();
      final totalDy = (e.localPosition.dy - _spaceDownPos.dy).abs();
      final heldMs = _spaceDownTime != null
          ? DateTime.now().difference(_spaceDownTime!).inMilliseconds
          : 0;

      if (!_spaceDidDrag &&
          heldMs >= 100 &&
          totalDx > 36.0 * sx &&
          totalDx > totalDy * 1.5) {
        _spaceDidDrag = true;
        _spaceDragAccum = 0.0;
        _spaceLastX = e.localPosition.dx;
        if (_spaceInsertedProvisional) {
          _spaceInsertedProvisional = false;
          _applyShadowBackspace(1);
          unawaited(widget.bridge.backspace(count: 1));
        }
      }

      if (_spaceDidDrag) {
        final dx = e.localPosition.dx - _spaceLastX;
        _spaceLastX = e.localPosition.dx;
        _spaceDragAccum += dx;
        final stepPx = 18.0 * sx;
        if (_spaceDragAccum.abs() >= stepPx) {
          final steps = (_spaceDragAccum / stepPx).truncate();
          _spaceDragAccum -= steps * stepPx;
          if (steps != 0) {
            _dispatchKeyAction(
              action: 'moveCursor',
              delta: steps,
              playSound: false,
            );
          }
        }
      }
      return;
    }

    if (e.pointer == _accentPointerId && _accentOptions.isNotEmpty) {
      final designX = e.localPosition.dx / sx;
      const cellW = 86.0;
      final totalW = _accentOptions.length * cellW;
      final startX = (_accentAnchorDesign.dx - totalW / 2)
          .clamp(36.0, KeyboardMetrics.designWidth - totalW - 36.0);
      final idx = ((designX - startX) / cellW).floor().clamp(0, _accentOptions.length - 1);
      if (idx != _accentSelectedIndex) {
        setState(() {
          _accentSelectedIndex = idx;
        });
      }
    }
  }

  void _onPointerEnd(int pointer, {bool cancelled = false}) {
    _longPressTimers.remove(pointer)?.cancel();
    final id = _pointerToKey.remove(pointer);

    if (pointer == _chordPointerId) {
      final hoverId = _chordHoverKeyId;
      final originLayer = _chordOriginLayer;
      final chordKey = _chordKeyId;
      _chordPointerId = null;
      _chordKeyId = null;
      _chordOriginLayer = null;
      _chordHoverKeyId = null;
      if (!cancelled && hoverId != null) {
        _executeKeyAction(hoverId);
        _physics.releaseKey(hoverId);
        if (chordKey == 'mode' && originLayer != null && _layer != originLayer) {
          setState(() => _layer = originLayer);
        } else if (chordKey == 'shift' && _layer == KeyboardLayer.abc && !_capsLock && _shifted) {
          setState(() => _shifted = false);
        }
      } else if (hoverId != null) {
        _physics.releaseKey(hoverId);
      }
    }

    if (pointer == _backspacePointerId) {
      _backspacePointerId = null;
      _backspaceDragAccum = 0.0;
      _backspaceDidSwipe = false;
    }

    if (pointer == _spacePointerId) {
      _spacePointerId = null;
      _spaceDownTime = null;
      _spaceDragAccum = 0.0;
      _spaceDidDrag = false;
      _spaceInsertedProvisional = false;
    }

    if (pointer == _accentPointerId) {
      final chosen = (!cancelled && _accentSelectedIndex < _accentOptions.length)
          ? _accentOptions[_accentSelectedIndex]
          : null;
      setState(() {
        _accentOwnerKeyId = null;
        _accentPointerId = null;
        _accentOptions = const [];
      });
      if (chosen != null) {
        _applyShadowBackspace(1);
        _applyShadowCommit(chosen);
        _dispatchKeyAction(action: 'backspace', count: 1, sound: 'key');
        unawaited(widget.bridge.commitText(chosen));
      }
    }

    if (id != null) {
      if (id == 'backspace') {
        _backspaceRepeatTimer?.cancel();
        _backspaceRepeatTimer = null;
      }
      _physics.releaseKey(id);
      _ensureTickerRunning();
    }
  }

  Future<void> _updatePref(String key, Object value, KeyboardPreferences updated) async {
    setState(() {
      _prefs = updated;
      _physics.slowMo = updated.slowMo;
    });
    _refreshPredictions();
    widget.onPreferencesChanged?.call(updated);
    await widget.bridge.setPreference(key, value);
  }

  @override
  void dispose() {
    for (final t in _longPressTimers.values) {
      t.cancel();
    }
    _backspaceRepeatTimer?.cancel();
    _emojiBkspTimer?.cancel();
    _ticker.dispose();
    _physics.dispose();
    _bakeCache.dispose();
    _predictionsNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight.isFinite && constraints.maxHeight > 0
            ? constraints.maxHeight
            : w * KeyboardMetrics.aspectRatio;
        final sx = w / KeyboardMetrics.designWidth;
        final sy = h / KeyboardMetrics.designHeight;
        final u = sx;

        return SizedBox(
          width: w,
          height: h,
          child: ClipRRect(
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(60 * u),
              topRight: Radius.circular(60 * u),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // 3D Mechanical Keyboard Canvas (baked GPU sprite cache + RepaintBoundary)
                Positioned.fill(
                  child: RepaintBoundary(
                    child: Listener(
                      behavior: HitTestBehavior.opaque,
                      onPointerDown: (e) => _onPointerDown(e, sx, sy),
                      onPointerMove: (e) => _onPointerMove(e, sx, sy),
                      onPointerUp: (e) => _onPointerEnd(e.pointer),
                      onPointerCancel: (e) => _onPointerEnd(e.pointer, cancelled: true),
                      child: CustomPaint(
                        isComplex: true,
                        willChange: true,
                        painter: TypewriterKeyboardPainter(
                          physics: _physics,
                          cache: _bakeCache,
                          devicePixelRatio: dpr,
                          layer: _layer,
                          shifted: _shifted,
                          capsLock: _capsLock,
                          actionLabel: _editorCtx.actionLabel,
                          mechanismView: _prefs.viewMode,
                        ),
                      ),
                    ),
                  ),
                ),

                // Predictive Text Bar Overlay (isolated ValueListenableBuilder — zero full rebuilds!)
                Positioned(
                  top: 22 * sy,
                  left: 0,
                  right: 0,
                  height: 112 * sy,
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 30 * u),
                    child: Row(
                      children: [
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
                            setState(() {
                              _quickMenuOpen = !_quickMenuOpen;
                              _emojiOpen = false;
                              _clipboardOpen = false;
                            });
                          },
                          child: SizedBox(
                            width: 96 * u,
                            height: 96 * sy,
                            child: Center(
                              child: CustomPaint(
                                size: Size(42 * u, 42 * u),
                                painter: GridMenuIconPainter(
                                  color: _quickMenuOpen
                                      ? const Color(0xFF242730)
                                      : const Color(0xFF5C5F6A),
                                ),
                              ),
                            ),
                          ),
                        ),
                        _buildPredDivider(u, sy),
                        Expanded(
                          child: ValueListenableBuilder<PredictionResult>(
                            valueListenable: _predictionsNotifier,
                            builder: (context, predictions, _) {
                              return Row(
                                children: [
                                  Expanded(
                                    child: _buildPredSlot(predictions.items[0],
                                        predictions.highlightIndex == 0, u, sy),
                                  ),
                                  _buildPredDivider(u, sy),
                                  Expanded(
                                    child: _buildPredSlot(predictions.items[1],
                                        predictions.highlightIndex == 1, u, sy),
                                  ),
                                  _buildPredDivider(u, sy),
                                  Expanded(
                                    child: _buildPredSlot(predictions.items[2],
                                        predictions.highlightIndex == 2, u, sy),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Accent Popover Overlay
                if (_accentOwnerKeyId != null && _accentOptions.isNotEmpty)
                  _buildAccentPopover(u, sy),

                // Emoji Drawer Overlay
                if (_emojiOpen) _buildEmojiDrawer(u, sy),

                // Clipboard Drawer Overlay
                if (_clipboardOpen) _buildClipboardDrawer(u, sy),

                // Quick Studio Menu Overlay
                if (_quickMenuOpen) _buildQuickMenu(u, sy),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPredDivider(double u, double sy) {
    return Container(
      width: (2.0 * u).clamp(1.0, 1.5),
      height: 52 * sy,
      margin: EdgeInsets.symmetric(horizontal: 8 * u),
      color: const Color(0xFF8A8D9A).withValues(alpha: 0.34),
    );
  }

  Widget _buildPredSlot(String label, bool highlighted, double u, double sy) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: label.trim().isEmpty
          ? null
          : () {
              final raw = label.replaceAll('“', '').replaceAll('”', '').trim();
              if (raw.isEmpty) return;
              _lastAutoCorrectRaw = null;
              _lastAutoCorrectReplaced = null;
              _lastCommitWasPredictionSpace = true;
              PredictionEngine.learnWord(raw);
              final hasPartial =
                  RegExp(r"[A-Za-z'’]+$").hasMatch(_shadowBeforeCursor);
              if (hasPartial) {
                _applyShadowReplaceWord('$raw ');
                _dispatchKeyAction(
                  action: 'replaceWord',
                  text: '$raw ',
                  sound: 'key',
                );
              } else {
                _applyShadowCommit('$raw ');
                _dispatchKeyAction(
                  action: 'commit',
                  text: '$raw ',
                  sound: 'key',
                );
              }
              if (_shifted && !_capsLock) {
                setState(() => _shifted = false);
              }
            },
      child: Container(
        height: 98 * sy,
        margin: EdgeInsets.symmetric(horizontal: 10 * u),
        padding: EdgeInsets.symmetric(horizontal: 14 * u),
        decoration: BoxDecoration(
          color: highlighted
              ? const Color(0xFF9C9FAC).withValues(alpha: 0.30)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20 * u),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 46 * u,
            fontWeight: highlighted ? FontWeight.w500 : FontWeight.w400,
            color: highlighted ? const Color(0xFF1F2127) : const Color(0xFF2C2E36),
            letterSpacing: -0.2 * u,
          ),
        ),
      ),
    );
  }

  Widget _buildAccentPopover(double u, double sy) {
    final cellW = 86.0 * u;
    final cellH = 112.0 * sy;
    final totalW = _accentOptions.length * cellW + 16 * u;
    final anchorX = _accentAnchorDesign.dx * u;
    final left = (anchorX - totalW / 2)
        .clamp(24 * u, KeyboardMetrics.designWidth * u - totalW - 24 * u);
    final top = (_accentAnchorDesign.dy * sy - 190 * sy).clamp(16 * sy, 700 * sy);

    return Positioned(
      left: left,
      top: top,
      width: totalW,
      height: cellH + 16 * sy,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 8 * u, vertical: 8 * sy),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F9),
          borderRadius: BorderRadius.circular(28 * u),
          border: Border.all(color: Colors.white, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF141826).withValues(alpha: 0.28),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_accentOptions.length, (i) {
            final selected = i == _accentSelectedIndex;
            return Container(
              width: cellW,
              height: cellH,
              decoration: BoxDecoration(
                color: selected ? const Color(0xFF242730) : Colors.transparent,
                borderRadius: BorderRadius.circular(20 * u),
              ),
              alignment: Alignment.center,
              child: Text(
                _accentOptions[i],
                style: TextStyle(
                  fontFamily: 'Arvo',
                  fontSize: 56 * u,
                  color: selected ? Colors.white : const Color(0xFF22242C),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _buildEmojiDrawer(double u, double sy) {
    final activeCategory = _emojiCategories[_emojiCategoryIndex];
    final items = _emojiCategoryIndex == 0 ? _recentEmojis : activeCategory.items;

    return Positioned(
      left: 36 * u,
      right: 36 * u,
      top: 138 * sy,
      height: 830 * sy,
      child: Container(
        padding: EdgeInsets.all(26 * u),
        decoration: BoxDecoration(
          color: const Color(0xFFE2E3EC).withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(44 * u),
          border: Border.all(color: Colors.white.withValues(alpha: 0.75), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF141826).withValues(alpha: 0.22),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Emoji (${activeCategory.label})',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 34 * u,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF3A3D47),
                    ),
                  ),
                ),
                SizedBox(width: 12 * u),
                Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        _applyShadowBackspace(1);
                        _dispatchKeyAction(
                          action: 'backspace',
                          count: 1,
                          sound: 'backspace',
                        );
                      },
                      onLongPressStart: (_) {
                        _emojiBkspTimer?.cancel();
                        _emojiBkspTimer = Timer.periodic(
                          const Duration(milliseconds: 70),
                          (_) {
                            _applyShadowBackspace(1);
                            _dispatchKeyAction(
                              action: 'backspace',
                              count: 1,
                              sound: 'backspace',
                            );
                          },
                        );
                      },
                      onLongPressEnd: (_) {
                        _emojiBkspTimer?.cancel();
                        _emojiBkspTimer = null;
                      },
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 22 * u, vertical: 10 * sy),
                        margin: EdgeInsets.only(right: 14 * u),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD61C33),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Icon(Icons.backspace_outlined, size: 38 * u, color: Colors.white),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
                        setState(() => _emojiOpen = false);
                      },
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 10 * sy),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'ABC',
                          style: TextStyle(
                            fontSize: 34 * u,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF25272E),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: 14 * sy),
            SizedBox(
              height: 62 * sy,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _emojiCategories.length,
                separatorBuilder: (_, _) => SizedBox(width: 10 * u),
                itemBuilder: (context, idx) {
                  final selected = idx == _emojiCategoryIndex;
                  return GestureDetector(
                    onTap: () => setState(() => _emojiCategoryIndex = idx),
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 8 * sy),
                      decoration: BoxDecoration(
                        color: selected
                            ? const Color(0xFF20222A)
                            : Colors.white.withValues(alpha: 0.72),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _emojiCategories[idx].label,
                        style: TextStyle(
                          fontSize: 28 * u,
                          fontWeight: FontWeight.w600,
                          color: selected ? Colors.white : const Color(0xFF2E313A),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            SizedBox(height: 14 * sy),
            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Text(
                        'Tap any emoji to pin it to Recent',
                        style: TextStyle(
                          fontSize: 34 * u,
                          color: const Color(0xFF646876),
                        ),
                      ),
                    )
                  : GridView.builder(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        mainAxisSpacing: 10 * sy,
                        crossAxisSpacing: 10 * u,
                      ),
                      itemCount: items.length,
                      itemBuilder: (context, index) {
                        final em = items[index];
                        return GestureDetector(
                          onTap: () {
                            _lastAutoCorrectRaw = null;
                            _lastAutoCorrectReplaced = null;
                            _lastCommitWasPredictionSpace = false;
                            _applyShadowCommit(em);
                            _dispatchKeyAction(action: 'commit', text: em, sound: 'key');
                            setState(() {
                              _recentEmojis.remove(em);
                              _recentEmojis.insert(0, em);
                              if (_recentEmojis.length > 35) {
                                _recentEmojis.removeRange(35, _recentEmojis.length);
                              }
                            });
                          },
                          child: Center(
                            child: Text(em, style: TextStyle(fontSize: 62 * u)),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClipboardDrawer(double u, double sy) {
    return Positioned(
      left: 36 * u,
      right: 36 * u,
      top: 138 * sy,
      height: 830 * sy,
      child: Container(
        padding: EdgeInsets.all(28 * u),
        decoration: BoxDecoration(
          color: const Color(0xFFE6E7F0).withValues(alpha: 0.97),
          borderRadius: BorderRadius.circular(44 * u),
          border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF141826).withValues(alpha: 0.22),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Clipboard History',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 36 * u,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF25272E),
                    ),
                  ),
                ),
                SizedBox(width: 12 * u),
                Row(
                  children: [
                    if (_clipboardItems.isNotEmpty)
                      GestureDetector(
                        onTap: () async {
                          final b = widget.bridge;
                          if (b is ClipboardCapableBridge) {
                            await b.clearClipboardItems();
                          }
                          if (!mounted) return;
                          setState(() => _clipboardItems = const []);
                        },
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 22 * u, vertical: 10 * sy),
                          margin: EdgeInsets.only(right: 12 * u),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD61C33).withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Clear',
                            style: TextStyle(
                              fontSize: 30 * u,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFFB91C32),
                            ),
                          ),
                        ),
                      ),
                    GestureDetector(
                      onTap: () => setState(() => _clipboardOpen = false),
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 10 * sy),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Done',
                          style: TextStyle(
                            fontSize: 34 * u,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF25272E),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            SizedBox(height: 18 * sy),
            Expanded(
              child: _clipboardItems.isEmpty
                  ? Center(
                      child: Text(
                        'Copied text clips will appear here',
                        style: TextStyle(
                          fontSize: 34 * u,
                          color: const Color(0xFF646876),
                        ),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _clipboardItems.length,
                      separatorBuilder: (_, _) => SizedBox(height: 12 * sy),
                      itemBuilder: (context, index) {
                        final clip = _clipboardItems[index];
                        return GestureDetector(
                          onTap: () {
                            _lastAutoCorrectRaw = null;
                            _lastAutoCorrectReplaced = null;
                            _lastCommitWasPredictionSpace = false;
                            _applyShadowCommit(clip);
                            final b = widget.bridge;
                            if (b is ClipboardCapableBridge) {
                              unawaited(b.pasteText(text: clip));
                              _dispatchKeyAction(action: 'feedbackOnly', sound: 'key');
                            } else {
                              _dispatchKeyAction(action: 'commit', text: clip, sound: 'key');
                            }
                            setState(() => _clipboardOpen = false);
                          },
                          child: Container(
                            padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 18 * sy),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(24 * u),
                              border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
                            ),
                            child: Text(
                              clip,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 32 * u,
                                color: const Color(0xFF1F2229),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickMenu(double u, double sy) {
    return Positioned(
      left: 36 * u,
      right: 36 * u,
      top: 138 * sy,
      height: 830 * sy,
      child: Container(
        padding: EdgeInsets.all(30 * u),
        decoration: BoxDecoration(
          color: const Color(0xFFE6E7F0).withValues(alpha: 0.97),
          borderRadius: BorderRadius.circular(44 * u),
          border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF141826).withValues(alpha: 0.22),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Typewriter Studio Controls',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 36 * u,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF25272E),
                    ),
                  ),
                ),
                SizedBox(width: 12 * u),
                GestureDetector(
                  onTap: () => setState(() => _quickMenuOpen = false),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 10 * sy),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Done',
                      style: TextStyle(
                        fontSize: 34 * u,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF25272E),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 22 * sy),
            Expanded(
              child: GridView.count(
                crossAxisCount: 2,
                childAspectRatio: 3.6,
                mainAxisSpacing: 12 * sy,
                crossAxisSpacing: 16 * u,
                children: [
                  _quickTile(
                    u,
                    sy,
                    icon: _prefs.soundEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                    title: 'Typewriter Sound',
                    subtitle: _prefs.soundEnabled ? 'Bell & Clack On' : 'Muted',
                    active: _prefs.soundEnabled,
                    onTap: () {
                      final next = !_prefs.soundEnabled;
                      _updatePref('soundEnabled', next, _prefs.copyWith(soundEnabled: next));
                      if (next) widget.bridge.playSound('key', _prefs.soundVolume);
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.vibration_rounded,
                    title: 'Haptic Tactility',
                    subtitle: _prefs.hapticsLevel == 0
                        ? 'Off'
                        : (_prefs.hapticsLevel == 1 ? 'Crisp' : 'Heavy Mechanical'),
                    active: _prefs.hapticsLevel > 0,
                    onTap: () {
                      final next = (_prefs.hapticsLevel + 1) % 3;
                      _updatePref('hapticsLevel', next, _prefs.copyWith(hapticsLevel: next));
                      if (next > 0) widget.bridge.hapticTick(next, heavy: next == 2);
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.auto_awesome_rounded,
                    title: 'Predictions',
                    subtitle: _prefs.predictionsEnabled ? 'Bar Enabled' : 'Hidden',
                    active: _prefs.predictionsEnabled,
                    onTap: () {
                      final next = !_prefs.predictionsEnabled;
                      _updatePref(
                        'predictionsEnabled',
                        next,
                        _prefs.copyWith(predictionsEnabled: next),
                      );
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.precision_manufacturing_rounded,
                    title: 'Mechanism View',
                    subtitle: switch (_prefs.viewMode) {
                      MechanismView.classic => 'Classic Opaque',
                      MechanismView.crystal => 'Crystal Glass',
                      MechanismView.blueprint => 'Blueprint Cutaway',
                    },
                    active: _prefs.mechanismView != 0,
                    onTap: () {
                      final next = (_prefs.mechanismView + 1) % 3;
                      _updatePref(
                        'mechanismView',
                        next,
                        _prefs.copyWith(mechanismView: next),
                      );
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.slow_motion_video_rounded,
                    title: 'Slow-Mo Physics',
                    subtitle: _prefs.slowMo ? '0.25× Inspection' : 'Real-Time 1.0×',
                    active: _prefs.slowMo,
                    onTap: () {
                      final next = !_prefs.slowMo;
                      _updatePref('slowMo', next, _prefs.copyWith(slowMo: next));
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.space_bar_rounded,
                    title: 'Space Trackpad',
                    subtitle: _prefs.spacebarTrackpad ? 'Slide Cursor On' : 'Off',
                    active: _prefs.spacebarTrackpad,
                    onTap: () {
                      final next = !_prefs.spacebarTrackpad;
                      _updatePref(
                        'spacebarTrackpad',
                        next,
                        _prefs.copyWith(spacebarTrackpad: next),
                      );
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.content_paste_rounded,
                    title: 'Clipboard',
                    subtitle: 'Recent Copied Clips',
                    active: false,
                    onTap: () async {
                      _dispatchKeyAction(action: 'feedbackOnly', sound: 'mode');
                      final b = widget.bridge;
                      final clips = b is ClipboardCapableBridge
                          ? await b.getClipboardItems()
                          : const <String>[];
                      if (!mounted) return;
                      setState(() {
                        _clipboardItems = clips;
                        _quickMenuOpen = false;
                        _emojiOpen = false;
                        _clipboardOpen = true;
                      });
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.language_rounded,
                    title: 'Switch Keyboard',
                    subtitle: 'Change Input Method',
                    active: false,
                    onTap: () {
                      setState(() => _quickMenuOpen = false);
                      widget.bridge.switchKeyboard(picker: true);
                    },
                  ),
                  _quickTile(
                    u,
                    sy,
                    icon: Icons.mic_none_rounded,
                    title: 'Voice Dictation',
                    subtitle: 'Speak to Type',
                    active: false,
                    onTap: () {
                      setState(() => _quickMenuOpen = false);
                      widget.bridge.openVoiceInput();
                    },
                  ),
                  if (widget.showCompanionShortcut)
                    _quickTile(
                      u,
                      sy,
                      icon: Icons.tune_rounded,
                      title: 'All Settings',
                      subtitle: 'Open Studio App',
                      active: false,
                      onTap: () {
                        setState(() => _quickMenuOpen = false);
                        widget.bridge.openCompanionApp();
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickTile(
    double u,
    double sy, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 24 * u, vertical: 14 * sy),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF20222A) : Colors.white.withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(26 * u),
          border: Border.all(
            color: active ? const Color(0xFF20222A) : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 46 * u,
              color: active ? Colors.white : const Color(0xFF2B2E36),
            ),
            SizedBox(width: 18 * u),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 32 * u,
                      fontWeight: FontWeight.w600,
                      color: active ? Colors.white : const Color(0xFF1F2229),
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 25 * u,
                      color: active
                          ? Colors.white.withValues(alpha: 0.75)
                          : const Color(0xFF666A78),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
