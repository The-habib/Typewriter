import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:typewriter_keyboard/app/companion_app.dart';
import 'package:typewriter_keyboard/keyboard/keyboard_bridge.dart';
import 'package:typewriter_keyboard/keyboard/keyboard_geometry.dart';
import 'package:typewriter_keyboard/keyboard/keyboard_physics.dart';
import 'package:typewriter_keyboard/keyboard/prediction_engine.dart';
import 'package:typewriter_keyboard/keyboard/typewriter_keyboard_widget.dart';

class _TestBridge implements ClipboardCapableBridge {
  final TextEditingController controller;
  List<String> clips = ['Hello from clipboard', '482910'];
  int deleteWordCalls = 0;

  _TestBridge(this.controller);

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
  }) async {
    switch (action) {
      case 'commit':
        await commitText(text);
        break;
      case 'replaceWord':
        await replaceCurrentWord(text);
        break;
      case 'backspace':
        await backspace(count: count);
        break;
      case 'deleteWord':
        await deleteWordBeforeCursor();
        break;
      case 'return':
        await performReturn();
        break;
      default:
        break;
    }
  }

  @override
  Future<void> commitText(String text) async {
    controller.text += text;
  }

  @override
  Future<void> replaceCurrentWord(String replacement) async {
    final m = RegExp(r"[A-Za-z'’]+$").firstMatch(controller.text);
    final start = m != null ? m.start : controller.text.length;
    controller.text = '${controller.text.substring(0, start)}$replacement';
  }

  @override
  Future<void> backspace({int count = 1}) async {
    if (controller.text.isEmpty) return;
    final chars = controller.text.characters;
    final keep = (chars.length - count).clamp(0, chars.length);
    controller.text = chars.take(keep).toString();
  }

  @override
  Future<void> deleteWordBeforeCursor() async {
    deleteWordCalls++;
    var t = controller.text;
    while (t.isNotEmpty && t.endsWith(' ')) {
      t = t.substring(0, t.length - 1);
    }
    while (t.isNotEmpty && !t.endsWith(' ')) {
      t = t.substring(0, t.length - 1);
    }
    controller.text = t;
  }

  @override
  Future<List<String>> getClipboardItems() async => List.of(clips);

  @override
  Future<void> clearClipboardItems() async => clips.clear();

  @override
  Future<void> pasteText({String? text}) async {
    if (text != null && text.isNotEmpty) {
      await commitText(text);
    }
  }

  @override
  Future<void> selectAll() async {}

  @override
  Future<void> moveCursor(int delta) async {}

  @override
  Future<void> performReturn() => commitText('\n');

  @override
  Future<void> switchKeyboard({bool picker = false}) async {}

  @override
  Future<void> openVoiceInput() async {}

  @override
  Future<void> openCompanionApp() async {}

  @override
  Future<void> playSound(String type, double volume) async {}

  @override
  Future<void> hapticTick(int level, {bool heavy = false}) async {}

  @override
  Future<KeyboardPreferences> getPreferences() async => const KeyboardPreferences();

  @override
  Future<void> setPreference(String key, Object value) async {}
}

void main() {
  group('KeyboardGeometry & Physics', () {
    test('All 32 keys have valid hit rects and non-overlapping centers', () {
      expect(kKeyDefs.length, 32);
      final physics = KeyboardPhysicsController();
      for (final def in kKeyDefs) {
        final hit = physics.hitTest(Offset(def.x, def.y));
        expect(hit, def.id, reason: 'Center of ${def.id} must hit itself');
      }
      // Gap tap between Row 1 'T' (596, 360) and Row 2 'G' (660, 502) snaps to nearest key
      expect(physics.hitTest(const Offset(596, 415)), 'r1_4');
      expect(physics.hitTest(const Offset(660, 450)), 'r2_4');
      physics.dispose();
    });

    test('Key press plunges to full bottom-out and springs back to rest', () {
      final physics = KeyboardPhysicsController();
      physics.pressKey('r1_4'); // T
      for (int i = 0; i < 6; i++) {
        physics.step(0.016);
      }
      expect(physics.keys['r1_4']!.p, closeTo(1.0, 0.05));
      expect(physics.bars[7]!.p, greaterThan(0.5));

      physics.releaseKey('r1_4');
      for (int i = 0; i < 20; i++) {
        physics.step(0.016);
      }
      expect(physics.keys['r1_4']!.p, closeTo(0.0, 0.01));
      expect(physics.bars[7]!.p, closeTo(0.0, 0.02));
      physics.dispose();
    });
  });

  group('PredictionEngine', () {
    test('Matches reference video predictions and general English prefixes', () {
      final p1 = PredictionEngine.predict('typewr');
      expect(p1.items, ['“typewr”', 'typer', 'typewriter']);
      expect(p1.highlightIndex, 1);

      final p2 = PredictionEngine.predict('swi');
      expect(p2.items, ['“swi”', 'swim', 'swing']);
      expect(p2.highlightIndex, 1);

      final p3 = PredictionEngine.predict('mecha');
      expect(p3.items[0], '“mecha”');
      expect(p3.items[1], 'mechanical');
    });

    test('4,700+ bundled corpus, word learning, and autocorrect heuristics', () {
      PredictionEngine.loadFromRawText('definitely separate receive\nquasarquantum\n');
      expect(PredictionEngine.autoCorrectSuggestion('teh'), 'the');
      expect(PredictionEngine.autoCorrectSuggestion('definately'), 'definitely');
      expect(PredictionEngine.autoCorrectSuggestion('dont'), "don't");
      expect(PredictionEngine.autoCorrectSuggestion('h1'), isNull);
      expect(PredictionEngine.autoCorrectSuggestion('the'), isNull);

      PredictionEngine.learnWord('Quasar');
      final learned = PredictionEngine.predict('qua');
      expect(learned.items.map((e) => e.toLowerCase()), contains('quasar'));
      final bigram = PredictionEngine.predict('hello ');
      expect(bigram.items, ['everyone', 'there', 'friend']);
    });
  });

  group('TypewriterKeyboardWidget & CompanionApp', () {
    testWidgets('Tapping keys updates text, switches layers, and preserves Space rollover', (tester) async {
      final controller = TextEditingController();
      const prefs = KeyboardPreferences(soundEnabled: false, hapticsLevel: 0);
      final bridge = _TestBridge(controller);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: SizedBox(
                width: 396,
                height: 396 * KeyboardMetrics.aspectRatio,
                child: TypewriterKeyboardWidget(
                  bridge: bridge,
                  initialPreferences: prefs,
                ),
              ),
            ),
          ),
        ),
      );

      // Tap 'H' (r2_5) -> (788, 482) in 1320x1100 scaled to 396
      final scale = 396.0 / 1320.0;
      final kbTopLeft = tester.getTopLeft(find.byType(TypewriterKeyboardWidget));
      await tester.tapAt(kbTopLeft + Offset(788 * scale, 482 * scale));
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.text, 'h');

      // Tap '123' mode key (114, 852)
      await tester.tapAt(kbTopLeft + Offset(114 * scale, 852 * scale));
      await tester.pump(const Duration(milliseconds: 50));

      // Tap '1' (r1_0) -> (84, 308)
      await tester.tapAt(kbTopLeft + Offset(84 * scale, 308 * scale));
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.text, 'h1');

      // Switch back to ABC and verify instant spacebar + two-thumb rollover order
      await tester.tapAt(kbTopLeft + Offset(114 * scale, 852 * scale));
      await tester.pump(const Duration(milliseconds: 20));
      final g1 = await tester.startGesture(kbTopLeft + Offset(660 * scale, 852 * scale)); // Space down
      await tester.pump(const Duration(milliseconds: 10));
      final g2 = await tester.startGesture(kbTopLeft + Offset(596 * scale, 308 * scale)); // T down before Space up
      await tester.pump(const Duration(milliseconds: 10));
      await g1.up();
      await g2.up();
      await tester.pump(const Duration(milliseconds: 400));
      expect(controller.text, 'h1 t');
    });

    testWidgets('Autocorrect on Space, Backspace Undo, Shift-drag & Backspace swipe word delete', (tester) async {
      final controller = TextEditingController();
      const prefs = KeyboardPreferences(
        soundEnabled: false,
        hapticsLevel: 0,
        autoCaps: false,
        autoCorrectOnSpace: true,
        doubleSpacePeriod: false,
      );
      final bridge = _TestBridge(controller);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: SizedBox(
                width: 396,
                height: 396 * KeyboardMetrics.aspectRatio,
                child: TypewriterKeyboardWidget(
                  bridge: bridge,
                  initialPreferences: prefs,
                ),
              ),
            ),
          ),
        ),
      );

      final scale = 396.0 / 1320.0;
      final kbTopLeft = tester.getTopLeft(find.byType(TypewriterKeyboardWidget));
      Offset keyPos(String id) {
        final d = kKeyDefs.firstWhere((k) => k.id == id);
        return kbTopLeft + Offset(d.x * scale, d.y * scale);
      }

      // Type "teh" then Space -> autocorrects to "the "
      await tester.tapAt(keyPos('r1_4')); // t
      await tester.tapAt(keyPos('r1_2')); // e
      await tester.tapAt(keyPos('r2_5')); // h
      await tester.tapAt(keyPos('space'));
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.text, 'the ');

      // Immediate Backspace undoes autocorrect back to raw "teh"
      await tester.tapAt(keyPos('backspace'));
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.text, 'teh');

      // Backspace swipe-left deletes whole word
      final bk = await tester.startGesture(keyPos('backspace'));
      await bk.moveBy(Offset(-46 * scale, 0));
      await bk.up();
      await tester.pump(const Duration(milliseconds: 50));
      expect(controller.text, '');
      expect(bridge.deleteWordCalls, greaterThanOrEqualTo(1));

      // Chorded Shift -> slide to K -> release commits uppercase 'K' and exits Shift
      final sh = await tester.startGesture(keyPos('shift'));
      await sh.moveTo(keyPos('r2_7')); // K
      await sh.up();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tapAt(keyPos('r2_1')); // s (should be lowercase again)
      await tester.pump(const Duration(milliseconds: 300));
      expect(controller.text, 'Ks');
    });

    testWidgets('Quick Studio Menu switches MechanismView, opens Clipboard & Emoji categories', (tester) async {
      final controller = TextEditingController();
      const prefs = KeyboardPreferences(soundEnabled: false, hapticsLevel: 0);
      final bridge = _TestBridge(controller);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 396,
              height: 396 * KeyboardMetrics.aspectRatio,
              child: TypewriterKeyboardWidget(
                bridge: bridge,
                initialPreferences: prefs,
              ),
            ),
          ),
        ),
      );

      final scale = 396.0 / 1320.0;
      final kbTopLeft = tester.getTopLeft(find.byType(TypewriterKeyboardWidget));
      // Tap Grid icon top-left (~68, 76)
      await tester.tapAt(kbTopLeft + Offset(68 * scale, 76 * scale));
      await tester.pumpAndSettle();
      expect(find.text('Mechanism View'), findsOneWidget);

      await tester.tap(find.text('Mechanism View'));
      await tester.pump();
      expect(find.text('Crystal Glass'), findsOneWidget);

      await tester.tap(find.text('Clipboard'));
      await tester.pumpAndSettle();
      expect(find.text('Clipboard History'), findsOneWidget);
      await tester.tap(find.text('482910'));
      await tester.pump();
      expect(controller.text, '482910');

      // Open categorized Emoji drawer
      final emojiDef = kKeyDefs.firstWhere((k) => k.id == 'emoji');
      await tester.tapAt(kbTopLeft + Offset(emojiDef.x * scale, emojiDef.y * scale));
      await tester.pumpAndSettle();
      expect(find.text('Faces'), findsOneWidget);
      expect(find.text('Hearts'), findsOneWidget);
      await tester.tap(find.text('Hearts'));
      await tester.pump();
      expect(find.text('❤️'), findsOneWidget);
    });

    testWidgets('Companion app renders streamlined IME setup, test box, and settings', (tester) async {
      await tester.pumpWidget(const TypewriterCompanionApp());
      await tester.pump();
      expect(find.text('Typewriter'), findsOneWidget);
      expect(find.text('Test System Keyboard'), findsOneWidget);
      expect(find.text('Crystal'), findsOneWidget);
      expect(find.text('Blueprint'), findsOneWidget);
      expect(find.text('Auto-Correct on Space'), findsOneWidget);
      expect(find.text('3D Deck'), findsNothing);
      expect(find.text('Demo'), findsNothing);
    });
  });
}
