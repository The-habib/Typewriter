import 'package:flutter/services.dart';
import 'keyboard_geometry.dart';

class KeyboardPreferences {
  final bool soundEnabled;
  final double soundVolume;
  final int hapticsLevel; // 0: Off, 1: Crisp, 2: Mechanical
  final bool autoCaps;
  final bool predictionsEnabled;
  final bool autoCorrectOnSpace;
  final bool spacebarTrackpad;
  final bool doubleSpacePeriod;
  final bool slowMo;
  final int mechanismView; // 0: classic, 1: crystal, 2: blueprint

  const KeyboardPreferences({
    this.soundEnabled = true,
    this.soundVolume = 0.85,
    this.hapticsLevel = 1,
    this.autoCaps = true,
    this.predictionsEnabled = true,
    this.autoCorrectOnSpace = true,
    this.spacebarTrackpad = true,
    this.doubleSpacePeriod = true,
    this.slowMo = false,
    this.mechanismView = 0,
  });

  MechanismView get viewMode => MechanismView.values[mechanismView.clamp(0, 2)];

  factory KeyboardPreferences.fromMap(Map<dynamic, dynamic> map) {
    return KeyboardPreferences(
      soundEnabled: (map['soundEnabled'] as bool?) ?? true,
      soundVolume: ((map['soundVolume'] as num?) ?? 0.85).toDouble(),
      hapticsLevel: (map['hapticsLevel'] as int?) ?? 1,
      autoCaps: (map['autoCaps'] as bool?) ?? true,
      predictionsEnabled: (map['predictionsEnabled'] as bool?) ?? true,
      autoCorrectOnSpace: (map['autoCorrectOnSpace'] as bool?) ?? true,
      spacebarTrackpad: (map['spacebarTrackpad'] as bool?) ?? true,
      doubleSpacePeriod: (map['doubleSpacePeriod'] as bool?) ?? true,
      slowMo: (map['slowMo'] as bool?) ?? false,
      mechanismView: ((map['mechanismView'] as int?) ?? 0).clamp(0, 2),
    );
  }

  KeyboardPreferences copyWith({
    bool? soundEnabled,
    double? soundVolume,
    int? hapticsLevel,
    bool? autoCaps,
    bool? predictionsEnabled,
    bool? autoCorrectOnSpace,
    bool? spacebarTrackpad,
    bool? doubleSpacePeriod,
    bool? slowMo,
    int? mechanismView,
  }) {
    return KeyboardPreferences(
      soundEnabled: soundEnabled ?? this.soundEnabled,
      soundVolume: soundVolume ?? this.soundVolume,
      hapticsLevel: hapticsLevel ?? this.hapticsLevel,
      autoCaps: autoCaps ?? this.autoCaps,
      predictionsEnabled: predictionsEnabled ?? this.predictionsEnabled,
      autoCorrectOnSpace: autoCorrectOnSpace ?? this.autoCorrectOnSpace,
      spacebarTrackpad: spacebarTrackpad ?? this.spacebarTrackpad,
      doubleSpacePeriod: doubleSpacePeriod ?? this.doubleSpacePeriod,
      slowMo: slowMo ?? this.slowMo,
      mechanismView: mechanismView ?? this.mechanismView,
    );
  }
}

class EditorContextState {
  final String textBeforeCursor;
  final bool shouldCapitalize;
  final bool isNumeric;
  final bool isPassword;
  final bool noSuggestions;
  final String actionLabel;

  const EditorContextState({
    this.textBeforeCursor = '',
    this.shouldCapitalize = false,
    this.isNumeric = false,
    this.isPassword = false,
    this.noSuggestions = false,
    this.actionLabel = 'newline',
  });

  factory EditorContextState.fromMap(Map<dynamic, dynamic> map) {
    return EditorContextState(
      textBeforeCursor: (map['textBeforeCursor'] as String?) ?? '',
      shouldCapitalize: (map['shouldCapitalize'] as bool?) ?? false,
      isNumeric: (map['isNumeric'] as bool?) ?? false,
      isPassword: (map['isPassword'] as bool?) ?? false,
      noSuggestions: (map['noSuggestions'] as bool?) ?? false,
      actionLabel: (map['actionLabel'] as String?) ?? 'newline',
    );
  }
}

abstract class KeyboardBridge {
  Future<void> keyAction({
    required String action, // 'commit' | 'replaceWord' | 'backspace' | 'deleteWord' | 'moveCursor' | 'return' | 'feedbackOnly'
    String text = '',
    int count = 1,
    int delta = 0,
    String sound = 'key',
    bool playSound = true,
    double volume = 0.85,
    int hapticsLevel = 1,
    bool heavy = false,
  });

  Future<void> commitText(String text);
  Future<void> replaceCurrentWord(String replacement);
  Future<void> backspace({int count = 1});
  Future<void> deleteWordBeforeCursor();
  Future<void> moveCursor(int delta);
  Future<void> performReturn();
  Future<void> switchKeyboard({bool picker = false});
  Future<void> openVoiceInput();
  Future<void> openCompanionApp();
  Future<void> playSound(String type, double volume);
  Future<void> hapticTick(int level, {bool heavy = false});
  Future<KeyboardPreferences> getPreferences();
  Future<void> setPreference(String key, Object value);
}

abstract interface class ClipboardCapableBridge implements KeyboardBridge {
  Future<List<String>> getClipboardItems();
  Future<void> clearClipboardItems();
  Future<void> pasteText({String? text});
  Future<void> selectAll();
}

/// Real Android InputMethodService MethodChannel bridge.
class AndroidImeBridge implements KeyboardBridge, ClipboardCapableBridge {
  static const MethodChannel _channel = MethodChannel('com.typewriter.keyboard/ime');

  void setCallbacks({
    required void Function(EditorContextState ctx) onEditorContext,
    required void Function(KeyboardPreferences prefs) onPreferencesUpdated,
    void Function(bool visible)? onVisibilityChanged,
    void Function(double bottomDp)? onBottomInsetChanged,
  }) {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onEditorContext' && call.arguments is Map) {
        onEditorContext(EditorContextState.fromMap(call.arguments as Map));
      } else if (call.method == 'onPreferencesUpdated' && call.arguments is Map) {
        onPreferencesUpdated(KeyboardPreferences.fromMap(call.arguments as Map));
      } else if (call.method == 'onVisibilityChanged' && call.arguments is bool) {
        onVisibilityChanged?.call(call.arguments as bool);
      } else if (call.method == 'onBottomInsetChanged' && call.arguments is num) {
        onBottomInsetChanged?.call((call.arguments as num).toDouble());
      }
    });
  }

  Future<void> requestEditorContext() async {
    await _channel.invokeMethod('getEditorContext');
  }

  @override
  Future<void> keyAction({
    required String action,
    String text = '',
    int count = 1,
    int delta = 0,
    String sound = 'key',
    bool playSound = true,
    double volume = 0.85,
    int hapticsLevel = 1,
    bool heavy = false,
  }) =>
      _channel.invokeMethod('keyAction', {
        'action': action,
        'text': text,
        'count': count,
        'delta': delta,
        'sound': sound,
        'playSound': playSound,
        'volume': volume,
        'hapticsLevel': hapticsLevel,
        'heavy': heavy,
      });

  @override
  Future<void> commitText(String text) =>
      _channel.invokeMethod('commitText', {'text': text});

  @override
  Future<void> replaceCurrentWord(String replacement) =>
      _channel.invokeMethod('replaceCurrentWord', {'text': replacement});

  @override
  Future<void> backspace({int count = 1}) =>
      _channel.invokeMethod('backspace', {'count': count});

  @override
  Future<void> deleteWordBeforeCursor() =>
      _channel.invokeMethod('deleteWordBeforeCursor');

  @override
  Future<void> moveCursor(int delta) =>
      _channel.invokeMethod('moveCursor', {'delta': delta});

  @override
  Future<void> performReturn() => _channel.invokeMethod('performReturn');

  @override
  Future<void> switchKeyboard({bool picker = false}) =>
      _channel.invokeMethod('switchKeyboard', {'picker': picker});

  @override
  Future<void> openVoiceInput() => _channel.invokeMethod('openVoiceInput');

  @override
  Future<void> openCompanionApp() => _channel.invokeMethod('openCompanionApp');

  @override
  Future<void> playSound(String type, double volume) =>
      _channel.invokeMethod('playSound', {'type': type, 'volume': volume});

  @override
  Future<void> hapticTick(int level, {bool heavy = false}) =>
      _channel.invokeMethod('hapticTick', {'level': level, 'heavy': heavy});

  @override
  Future<KeyboardPreferences> getPreferences() async {
    final map = await _channel.invokeMapMethod<dynamic, dynamic>('getPreferences');
    return KeyboardPreferences.fromMap(map ?? const {});
  }

  @override
  Future<void> setPreference(String key, Object value) =>
      _channel.invokeMethod('setPreference', {'key': key, 'value': value});

  @override
  Future<List<String>> getClipboardItems() async {
    try {
      final list = await _channel.invokeListMethod<String>('getClipboardItems');
      return list ?? const [];
    } catch (_) {
      return const [];
    }
  }

  @override
  Future<void> clearClipboardItems() async {
    try {
      await _channel.invokeMethod('clearClipboardItems');
    } catch (_) {}
  }

  @override
  Future<void> pasteText({String? text}) async {
    try {
      await _channel.invokeMethod('pasteText', text == null ? const {} : {'text': text});
    } catch (_) {}
  }

  @override
  Future<void> selectAll() async {
    try {
      await _channel.invokeMethod('selectAll');
    } catch (_) {}
  }
}

/// Companion App MethodChannel bridge for IME setup status and audio/prefs testing.
class CompanionAppBridge {
  static const MethodChannel _channel = MethodChannel('com.typewriter.keyboard/app');

  static Future<({bool isEnabled, bool isSelected})> getImeStatus() async {
    try {
      final map = await _channel.invokeMapMethod<dynamic, dynamic>('getImeStatus');
      return (
        isEnabled: (map?['isEnabled'] as bool?) ?? false,
        isSelected: (map?['isSelected'] as bool?) ?? false,
      );
    } catch (_) {
      return (isEnabled: false, isSelected: false);
    }
  }

  static Future<void> openInputMethodSettings() async {
    await _channel.invokeMethod('openInputMethodSettings');
  }

  static Future<void> showInputMethodPicker() async {
    await _channel.invokeMethod('showInputMethodPicker');
  }

  static Future<KeyboardPreferences> getPreferences() async {
    try {
      final map = await _channel.invokeMapMethod<dynamic, dynamic>('getPreferences');
      return KeyboardPreferences.fromMap(map ?? const {});
    } catch (_) {
      return const KeyboardPreferences();
    }
  }

  static Future<void> setPreference(String key, Object value) async {
    await _channel.invokeMethod('setPreference', {'key': key, 'value': value});
  }

  static Future<void> playSound(String type, double volume) async {
    try {
      await _channel.invokeMethod('playSound', {'type': type, 'volume': volume});
    } catch (_) {}
  }

  static Future<void> hapticTick(int level, {bool heavy = false}) async {
    try {
      await _channel.invokeMethod('hapticTick', {'level': level, 'heavy': heavy});
    } catch (_) {}
  }
}
