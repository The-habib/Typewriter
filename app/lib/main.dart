import 'package:material_ui/material_ui.dart';
import 'app/companion_app.dart';
import 'keyboard/keyboard_bridge.dart';
import 'keyboard/typewriter_keyboard_widget.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TypewriterCompanionApp());
}

/// Dedicated Dart entrypoint launched inside Android's TypewriterInputMethodService.
@pragma('vm:entry-point')
void imeMain() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _ImeRootApp());
}

class _ImeRootApp extends StatefulWidget {
  const _ImeRootApp();

  @override
  State<_ImeRootApp> createState() => _ImeRootAppState();
}

class _ImeRootAppState extends State<_ImeRootApp> {
  final AndroidImeBridge _bridge = AndroidImeBridge();
  final GlobalKey<TypewriterKeyboardWidgetState> _kbKey = GlobalKey();
  KeyboardPreferences _prefs = const KeyboardPreferences();
  EditorContextState _editorCtx = const EditorContextState();
  double _bottomInsetDp = 0.0;

  @override
  void initState() {
    super.initState();
    _bridge.setCallbacks(
      onEditorContext: (ctx) {
        _editorCtx = ctx;
        _kbKey.currentState?.updateEditorContext(ctx);
      },
      onPreferencesUpdated: (prefs) {
        _prefs = prefs;
        _kbKey.currentState?.updatePreferences(prefs);
      },
      onVisibilityChanged: (visible) {
        _kbKey.currentState?.setImeVisible(visible);
      },
      onBottomInsetChanged: (bottomDp) {
        if (mounted && (_bottomInsetDp - bottomDp).abs() > 0.5) {
          setState(() => _bottomInsetDp = bottomDp);
        }
      },
    );
    _loadInitialState();
  }

  Future<void> _loadInitialState() async {
    final prefs = await _bridge.getPreferences();
    if (!mounted) return;
    setState(() {
      _prefs = prefs;
    });
    _kbKey.currentState?.updatePreferences(prefs);
    await _bridge.requestEditorContext();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        canvasColor: Colors.transparent,
      ),
      home: Material(
        color: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: TypewriterKeyboardWidget(
                  key: _kbKey,
                  bridge: _bridge,
                  initialPreferences: _prefs,
                  initialEditorContext: _editorCtx,
                  showCompanionShortcut: true,
                ),
              ),
            ),
            if (_bottomInsetDp > 0)
              Container(
                height: _bottomInsetDp,
                width: double.infinity,
                color: const Color(0xFFD4D5E0),
              ),
          ],
        ),
      ),
    );
  }
}
