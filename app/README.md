# Typewriter Android App (`app/`)

The Flutter + Kotlin Android Input Method Service (`TypewriterInputMethodService`) and Companion Settings application for **Typewriter**.

## Architecture

- `lib/main.dart` — Dual Dart entrypoints (`main()` for the Companion App and `@pragma('vm:entry-point') imeMain()` for the Android IME engine).
- `lib/app/companion_app.dart` — Setup checklist, live "Test System Keyboard" scratchpad, and real-time preferences UI.
- `lib/keyboard/keyboard_geometry.dart` — `1320 × 1040` coordinate layout for all 32 keys, 17 top slots, and `ABC` / `123` / `#+=` layers.
- `lib/keyboard/keyboard_physics.dart` — Committed plunge/dwell/spring-return kinematics, adjacent bar tremor, Spacebar coil stretch, and Voronoi gap hit-testing.
- `lib/keyboard/typewriter_painter.dart` & `keyboard_bake_cache.dart` — High-FPS CustomPainter rendering Classic, Crystal, and Blueprint modes with offscreen layer baking.
- `lib/keyboard/prediction_engine.dart` — Offline 4,770-word prefix matcher, bigrams, typo autocorrect, and local word learning.
- `android/app/src/main/kotlin/com/typewriter/keyboard/typewriter_keyboard/` — Native `TypewriterInputMethodService`, `SoundAndHapticsEngine` (`SoundPool` + `Vibrator`), `PrefsStore`, and `VoiceRecognitionActivity`.

## Commands

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```
