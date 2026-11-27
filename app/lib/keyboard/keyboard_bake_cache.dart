import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:material_ui/material_ui.dart';
import 'keyboard_geometry.dart';

/// Pre-baked photorealistic 3D studio sprites for 60/120 FPS rendering.
class BakedKeySprite {
  final ui.Image restImage;             // Multi-layered studio shadow + 3D barrel + satin chrome cup + porcelain face + legend
  final ui.Image topImage;              // Rest bezel + face + legend (for smooth plunge blending)
  final ui.Image pressedTopImage;       // Shadowed gunmetal bezel + darkened keybed-well face + legend
  final ui.Image crystalRestImage;      // 24% frosted crystal glass insert + liquid-chrome rim + sharp legend
  final ui.Image crystalTopImage;       // Top-only crystal rest sprite (for smooth plunge blending)
  final ui.Image crystalPressedTopImage;// Top-only crystal pressed sprite
  final Rect restBounds;
  final Rect topBounds;

  const BakedKeySprite({
    required this.restImage,
    required this.topImage,
    required this.pressedTopImage,
    required this.crystalRestImage,
    required this.crystalTopImage,
    required this.crystalPressedTopImage,
    required this.restBounds,
    required this.topBounds,
  });

  void dispose() {
    restImage.dispose();
    topImage.dispose();
    pressedTopImage.dispose();
    crystalRestImage.dispose();
    crystalTopImage.dispose();
    crystalPressedTopImage.dispose();
  }
}

class KeyboardBakeCache {
  double _bakedScale = 0.0;
  double _bakedDpr = 0.0;
  Size _bakedSize = Size.zero;

  ui.Image? deckImage;
  ui.Image? blueprintDeckImage;
  ui.Image? barImage;
  Rect barBounds = Rect.zero;
  ui.Image? barShortImage;
  Rect barShortBounds = Rect.zero;
  ui.Image? knuckleImage;
  Rect knuckleBounds = Rect.zero;
  ui.Image? bracketLeftImage;
  Rect bracketLeftBounds = Rect.zero;
  ui.Image? bracketRightImage;
  Rect bracketRightBounds = Rect.zero;
  ui.Image? stabilizerArmImage;
  Rect stabilizerArmBounds = Rect.zero;
  ui.Image? stabilizerShortArmImage;
  Rect stabilizerShortArmBounds = Rect.zero;

  // Blueprint chassis hardware sprites (Round 10+)
  ui.Image? gimbalTopBottomImage;
  Rect gimbalTopBottomBounds = Rect.zero;
  ui.Image? gimbalWideWrapImage;
  Rect gimbalWideWrapBounds = Rect.zero;
  ui.Image? plungerAnvilImage;
  Rect plungerAnvilBounds = Rect.zero;
  ui.Image? clevisAxleImage;
  Rect clevisAxleBounds = Rect.zero;
  ui.Image? sliderBlockImage;
  Rect sliderBlockBounds = Rect.zero;
  ui.Image? returnCradleImage;
  Rect returnCradleBounds = Rect.zero;
  ui.Image? spaceEarLeftImage;
  Rect spaceEarLeftBounds = Rect.zero;
  ui.Image? spaceEarRightImage;
  Rect spaceEarRightBounds = Rect.zero;

  ui.Image? roundShadowImage;
  Rect roundShadowBounds = Rect.zero;
  ui.Image? pillShadowImage;
  Rect pillShadowBounds = Rect.zero;
  ui.Image? spaceShadowImage;
  Rect spaceShadowBounds = Rect.zero;
  ui.Image? returnShadowImage;
  Rect returnShadowBounds = Rect.zero;

  final Map<String, BakedKeySprite> _keySprites = {};
  KeyboardLayer? _cachedLayer;
  bool? _cachedShiftActive;
  bool? _cachedCapsLock;
  String? _cachedActionLabel;

  static const double _w = KeyboardMetrics.designWidth;
  static const double _h = KeyboardMetrics.designHeight;

  bool isReadyFor(Size size, double dpr) {
    return deckImage != null &&
        _bakedSize == size &&
        (_bakedDpr - dpr).abs() < 0.01;
  }

  void ensureBaked({
    required Size size,
    required double dpr,
    required KeyboardLayer layer,
    required bool shifted,
    required bool capsLock,
    required String actionLabel,
  }) {
    final effDpr = dpr.clamp(1.0, 3.0);
    final sizeChanged = _bakedSize != size || (_bakedDpr - effDpr).abs() >= 0.01;
    if (sizeChanged || deckImage == null) {
      _disposeAll();
      _bakedSize = size;
      _bakedDpr = effDpr;
      _bakedScale = (size.width / _w) * effDpr;
      _bakeStaticWorld(size, effDpr);
      _bakeShadows();
      _bakeAllKeys(layer, shifted, capsLock, actionLabel);
      _cachedLayer = layer;
      _cachedShiftActive = shifted || capsLock;
      _cachedCapsLock = capsLock;
      _cachedActionLabel = actionLabel;
      return;
    }

    final shiftActive = shifted || capsLock;
    if (_cachedLayer != layer) {
      _bakeAllKeys(layer, shifted, capsLock, actionLabel);
      _cachedLayer = layer;
      _cachedShiftActive = shiftActive;
      _cachedCapsLock = capsLock;
      _cachedActionLabel = actionLabel;
      return;
    }

    if (_cachedShiftActive != shiftActive || _cachedCapsLock != capsLock) {
      final shiftDef = kKeyDefs.firstWhere((k) => k.id == 'shift');
      _keySprites['shift']?.dispose();
      _keySprites['shift'] = _bakeSingleKey(shiftDef, layer, shifted, capsLock, actionLabel);
      _cachedShiftActive = shiftActive;
      _cachedCapsLock = capsLock;
    }

    if (_cachedActionLabel != actionLabel) {
      final retDef = kKeyDefs.firstWhere((k) => k.id == 'return');
      _keySprites['return']?.dispose();
      _keySprites['return'] = _bakeSingleKey(retDef, layer, shifted, capsLock, actionLabel);
      _cachedActionLabel = actionLabel;
    }
  }

  BakedKeySprite? keySprite(String id) => _keySprites[id];

  ui.Image? shadowFor(KeyDef def) {
    if (def.special == KeySpecial.space) return spaceShadowImage;
    if (def.special == KeySpecial.returnKey) return returnShadowImage;
    if (def.pill) return pillShadowImage;
    return roundShadowImage;
  }

  Rect shadowBoundsFor(KeyDef def) {
    if (def.special == KeySpecial.space) return spaceShadowBounds;
    if (def.special == KeySpecial.returnKey) return returnShadowBounds;
    if (def.pill) return pillShadowBounds;
    return roundShadowBounds;
  }

  void _bakeStaticWorld(Size size, double dpr) {
    final pxW = math.max(1, (size.width * dpr).round());
    final pxH = math.max(1, (size.height * dpr).round());
    final sx = pxW / _w;
    final sy = pxH / _h;

    final recorder = ui.PictureRecorder();
    final c = Canvas(recorder, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
    c.scale(sx, sy);

    c.clipRRect(
      RRect.fromRectAndCorners(
        const Rect.fromLTWH(0, 0, _w, _h),
        topLeft: const Radius.circular(60),
        topRight: const Radius.circular(60),
      ),
    );

    // 1. Exact photographic neutral alabaster deck (#DDDDE5 top -> #D0D1DA bottom)
    final deckPaint = Paint()
      ..shader = ui.Gradient.linear(
        const Offset(0, 0),
        const Offset(0, _h),
        const [
          Color(0xFFE0E0E8),
          Color(0xFFDADAE3),
          Color(0xFFD7D8E0),
          Color(0xFFD0D1DA),
        ],
        const [0.0, 0.16, 0.84, 1.0],
      );
    c.drawRect(const Rect.fromLTWH(0, 0, _w, _h), deckPaint);

    // Subtle overhead softbox falloff across the aluminum deck
    final softboxPaint = Paint()
      ..shader = ui.Gradient.radial(
        const Offset(_w * 0.5, _h * 0.40),
        _w * 0.62,
        const [
          Color(0x14FFFFFF),
          Color(0x06FFFFFF),
          Color(0x00FFFFFF),
        ],
        const [0.0, 0.52, 1.0],
      );
    c.drawRect(const Rect.fromLTWH(0, 0, _w, _h), softboxPaint);

    // 2. Dramatic 3D recessed keybed cavity well contained strictly below top slots (y >= 245)
    // so y=0..240 around the 17 CNC slots & prediction bar stays clean studio silver-alabaster
    _drawBlurShadow(
      c,
      RRect.fromRectAndRadius(const Rect.fromLTWH(110, 300, _w - 220, 470), const Radius.circular(96)),
      0,
      0,
      90.0,
      const Color(0x7A161920),
    );
    _drawBlurShadow(
      c,
      RRect.fromRectAndRadius(const Rect.fromLTWH(170, 345, _w - 340, 380), const Radius.circular(80)),
      0,
      0,
      70.0,
      const Color(0x48161920),
    );

    // Deep per-row keybed shadow wells behind Q..P, A..L, Z..M and under Spacebar brackets
    for (final rowY in KeyboardMetrics.rowY) {
      final wellRRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(96, rowY - 40.0, _w - 192, 84.0),
        const Radius.circular(42.0),
      );
      _drawBlurShadow(c, wellRRect, 0, 6.0, 38.0, const Color(0x5A12151B));
    }
    // Deep Spacebar undercarriage shadow well
    _drawBlurShadow(
      c,
      RRect.fromRectAndRadius(const Rect.fromLTWH(340, 770, 640, 96), const Radius.circular(48)),
      0,
      10.0,
      36.0,
      const Color(0x4E12151B),
    );

    // 3. Rich directional down-right studio cast shadows + tight contact occlusion under all 32 keycaps
    for (final def in kKeyDefs) {
      final sx0 = def.x - def.w * 0.46;
      final sy0 = def.y - def.h * 0.42 + 12.0;
      final rrect = RRect.fromRectAndRadius(
        Rect.fromLTWH(sx0, sy0, def.w * 0.92, def.h * 0.92),
        Radius.circular(def.h * 0.46),
      );
      _drawBlurShadow(c, rrect, 6.0, 18.0, 36.0, const Color(0x7212151B));
      _drawBlurShadow(c, rrect, 2.0, 6.5, 11.0, const Color(0x5E0E1015));
    }

    // 4. 17 Recessed CNC-milled typebar slots + subtle top studio bevel rim
    _drawSlotsAndTopBevel(c, slotCastAlpha: 0x40);

    final pic = recorder.endRecording();
    deckImage = pic.toImageSync(pxW, pxH);
    pic.dispose();

    // 4b. Bake clean studio alabaster deck for Blueprint cutaway mode (ONLY top 17 CNC slots, zero keybed shadows)
    final bpRecorder = ui.PictureRecorder();
    final bpc = Canvas(bpRecorder, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
    bpc.scale(sx, sy);
    bpc.clipRRect(
      RRect.fromRectAndCorners(
        const Rect.fromLTWH(0, 0, _w, _h),
        topLeft: const Radius.circular(60),
        topRight: const Radius.circular(60),
      ),
    );
    bpc.drawRect(
      const Rect.fromLTWH(0, 0, _w, _h),
      Paint()
        ..shader = ui.Gradient.linear(
          const Offset(0, 0),
          const Offset(0, _h),
          const [Color(0xFFF4F5F8), Color(0xFFF0F1F5), Color(0xFFEAEBF0)],
          const [0.0, 0.55, 1.0],
        ),
    );
    _drawSlotsAndTopBevel(bpc, slotCastAlpha: 0x26);
    final bpPic = bpRecorder.endRecording();
    blueprintDeckImage = bpPic.toImageSync(pxW, pxH);
    bpPic.dispose();

    // 5. Bake stamped dark-gunmetal steel typebars terminating cleanly behind Row 4
    barBounds = const Rect.fromLTWH(-24, -14, 58, 635);
    barImage = _bakeSteelBar(584.0, barBounds);
    barShortBounds = const Rect.fromLTWH(-24, -14, 58, 605);
    barShortImage = _bakeSteelBar(554.0, barShortBounds);

    // 6. Bake 3D mechanical clevis sleeves, Spacebar asymmetric brackets, and slotted bellcrank stabilizer loops
    knuckleBounds = const Rect.fromLTWH(-12, -10, 48, 52);
    knuckleImage = _bakeKnuckleSprite(knuckleBounds);
    bracketLeftBounds = const Rect.fromLTWH(-22, -16, 130, 112);
    bracketLeftImage = _bakeBracketSprite(86.0, bracketLeftBounds);
    bracketRightBounds = const Rect.fromLTWH(-22, -16, 130, 112);
    bracketRightImage = _bakeBracketSprite(86.0, bracketRightBounds);
    stabilizerArmBounds = const Rect.fromLTWH(-28, -14, 64, 144);
    stabilizerArmImage = _bakeStabilizerArmSprite(76.0, stabilizerArmBounds);
    stabilizerShortArmBounds = const Rect.fromLTWH(-28, -14, 64, 132);
    stabilizerShortArmImage = _bakeStabilizerArmSprite(64.0, stabilizerShortArmBounds);

    // 7. Bake Blueprint undercarriage chassis sub-assemblies (Round 10)
    gimbalTopBottomBounds = Rect.fromCenter(center: Offset.zero, width: 120, height: 120);
    gimbalTopBottomImage = _bakeGimbalRingSprite(gimbalTopBottomBounds, wideWrap: false);
    gimbalWideWrapBounds = Rect.fromCenter(center: Offset.zero, width: 120, height: 120);
    gimbalWideWrapImage = _bakeGimbalRingSprite(gimbalWideWrapBounds, wideWrap: true);
    plungerAnvilBounds = Rect.fromCenter(center: const Offset(0, 14), width: 76, height: 112);
    plungerAnvilImage = _bakePlungerAnvilSprite(plungerAnvilBounds);
    clevisAxleBounds = Rect.fromCenter(center: Offset.zero, width: 64, height: 50);
    clevisAxleImage = _bakeClevisAxleSprite(clevisAxleBounds);
    sliderBlockBounds = Rect.fromCenter(center: Offset.zero, width: 76, height: 88);
    sliderBlockImage = _bakeSliderBlockSprite(sliderBlockBounds);
    returnCradleBounds = Rect.fromCenter(center: Offset.zero, width: 312, height: 164);
    returnCradleImage = _bakeReturnCradleSprite(returnCradleBounds);
    spaceEarLeftBounds = const Rect.fromLTWH(-36, -64, 164, 184);
    spaceEarLeftImage = _bakeSpaceEarSprite(spaceEarLeftBounds, isRight: false);
    spaceEarRightBounds = const Rect.fromLTWH(-128, -64, 164, 184);
    spaceEarRightImage = _bakeSpaceEarSprite(spaceEarRightBounds, isRight: true);
  }

  void _drawSlotsAndTopBevel(Canvas c, {required int slotCastAlpha}) {
    for (int i = 0; i < KeyboardMetrics.slotCount; i++) {
      final cx = KeyboardMetrics.slotStartX + i * KeyboardMetrics.slotPitch;
      const drawnSlotW = 20.5;
      final slotRect = Rect.fromLTWH(
        cx - 10.0,
        KeyboardMetrics.slotY - 1.5,
        drawnSlotW,
        KeyboardMetrics.slotH - 6.0,
      );
      final slotRRect = RRect.fromRectAndRadius(
        slotRect,
        const Radius.circular(9.2),
      );

      // Soft diagonal dark cast shadow falling onto the bright deck to the bottom-left of every slot
      _drawBlurShadow(c, slotRRect, -6.5, 10.5, 13.0, Color.fromARGB(slotCastAlpha, 0x12, 0x15, 0x1B));
      // Machined outer bevel shadow (top-left) and crisp deck catchlight (bottom-right)
      _drawBlurShadow(c, slotRRect, -1.2, -1.6, 3.2, const Color(0x48383C46));
      _drawBlurShadow(c, slotRRect, 1.5, 1.8, 2.6, const Color(0xB8F8F9FC));

      // Deep machined CNC pocket
      final sg = ui.Gradient.linear(
        Offset(slotRect.left, slotRect.top),
        Offset(slotRect.right, slotRect.bottom),
        const [
          Color(0xFF030406),
          Color(0xFF0A0C10),
          Color(0xFF171A21),
          Color(0xFF282C35),
        ],
        const [0.0, 0.54, 0.86, 1.0],
      );
      c.drawRRect(slotRRect, Paint()..shader = sg);

      c.drawRRect(
        slotRRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = const Color(0xCC040507),
      );

      // Crisp right chamfer lip highlight
      c.drawLine(
        Offset(slotRect.right + 0.7, slotRect.top + 8),
        Offset(slotRect.right + 0.7, slotRect.bottom - 7),
        Paint()
          ..color = const Color(0xE6F2F4F8)
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      );
    }

    // Subtle top studio bevel rim highlight (~2.5px) along the rounded top edge above prediction bar
    final topBevelRRect = RRect.fromRectAndCorners(
      const Rect.fromLTWH(0, 1.2, _w, _h),
      topLeft: const Radius.circular(60),
      topRight: const Radius.circular(60),
    );
    c.drawRRect(
      topBevelRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..shader = ui.Gradient.linear(
          const Offset(0, 0),
          const Offset(0, 48),
          const [Color(0xCCFFFFFF), Color(0x44FFFFFF), Color(0x00FFFFFF)],
          const [0.0, 0.45, 1.0],
        ),
    );
  }

  /// Twin-lobe brushed-pewter clevis hinge sleeve (matching macro_left_mech_2x.png)
  ui.Image _bakeKnuckleSprite(Rect bounds) {
    final s = _bakedScale;
    final pxW = math.max(1, (bounds.width * s).ceil());
    final pxH = math.max(1, (bounds.height * s).ceil());
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
    c.scale(s, s);
    c.translate(-bounds.left, -bounds.top);

    const h = 24.0;
    // Outer primary cylindrical barrel + inner clevis fork tang
    final outerLobe = RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 11.2, h), const Radius.circular(5.4));
    final innerLobe = RRect.fromRectAndRadius(const Rect.fromLTWH(12.2, 1.5, 6.8, h - 3.0), const Radius.circular(3.4));
    _drawBlurShadow(c, outerLobe, 3.0, 6.5, 10.5, const Color(0x4E16181D));

    final innerG = ui.Gradient.linear(
      const Offset(12.2, 0),
      const Offset(19.0, 0),
      const [Color(0xFF2B2E34), Color(0xFF8A8E98), Color(0xFF565A62), Color(0xFF23262B)],
      const [0.0, 0.36, 0.72, 1.0],
    );
    c.drawRRect(innerLobe, Paint()..shader = innerG);

    // Dark vertical clevis pin seam between the two lobes
    c.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(10.0, 1.2, 2.8, h - 2.4), const Radius.circular(1.4)),
      Paint()..color = const Color(0xCC181A20),
    );

    final outerG = ui.Gradient.linear(
      const Offset(0, 0),
      const Offset(11.2, 0),
      const [
        Color(0xFF3E4148),
        Color(0xFFAAB0BA),
        Color(0xFFCFD3DC),
        Color(0xFF727680),
        Color(0xFF34373E),
      ],
      const [0.0, 0.25, 0.44, 0.76, 1.0],
    );
    c.drawRRect(outerLobe, Paint()..shader = outerG);

    // Soft top-cap highlight sheen on primary barrel
    c.drawRRect(
      outerLobe,
      Paint()
        ..shader = ui.Gradient.linear(
          const Offset(0, 0),
          const Offset(0, h),
          const [Color(0x44FFFFFF), Color(0x00FFFFFF), Color(0x44121418)],
          const [0.0, 0.36, 1.0],
        ),
    );

    final pic = rec.endRecording();
    final img = pic.toImageSync(pxW, pxH);
    pic.dispose();
    return img;
  }

  /// Soft brushed-pewter pillow bracket with 3 asymmetric hinge knuckles & 2 recessed rivets (matching macro_sp_bracket_3x.png)
  ui.Image _bakeBracketSprite(double bw, Rect bounds) {
    final s = _bakedScale;
    final pxW = math.max(1, (bounds.width * s).ceil());
    final pxH = math.max(1, (bounds.height * s).ceil());
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
    c.scale(s, s);
    c.translate(-bounds.left, -bounds.top);

    const bh = 58.0;
    final rrect = RRect.fromRectAndCorners(
      Rect.fromLTWH(0, 0, bw, bh),
      topLeft: const Radius.circular(5),
      topRight: const Radius.circular(5),
      bottomLeft: const Radius.circular(14),
      bottomRight: const Radius.circular(14),
    );
    _drawBlurShadow(c, rrect, 2.0, 14.0, 22.0, const Color(0x42181A1F));
    _drawBlurShadow(c, rrect, 0.5, 4.5, 7.0, const Color(0x3C14161B));

    // Soft cast pewter plate (smooth 3D stamped hardware, no hard outline)
    final bg = ui.Gradient.linear(
      const Offset(0, 0),
      const Offset(0, bh),
      const [
        Color(0xFF4B4F57),
        Color(0xFF838791),
        Color(0xFF7A7E88),
        Color(0xFF5D616A),
      ],
      const [0.0, 0.34, 0.74, 1.0],
    );
    c.drawRRect(rrect, Paint()..shader = bg);

    // Smooth sculpted central pocket recess behind the 3 knuckles (no boxy stripes)
    final centerPocket = RRect.fromRectAndCorners(
      Rect.fromLTWH(bw * 0.25, 0, bw * 0.50, 49.0),
      bottomLeft: const Radius.circular(6),
      bottomRight: const Radius.circular(6),
    );
    _drawBlurShadow(c, centerPocket, 0, 0, 2.5, const Color(0x5514161A));
    c.drawRRect(
      centerPocket,
      Paint()
        ..shader = ui.Gradient.linear(
          const Offset(0, 0),
          const Offset(0, 49.0),
          const [Color(0x6814161B), Color(0x441C1F25), Color(0x001C1F25)],
          const [0.0, 0.72, 1.0],
        ),
    );

    // 3 Asymmetric articulated knuckles: tall left, shorter recessed center, tall right (macro_sp_bracket_3x.png)
    final fingers = [
      (bw * 0.27, 52.0, false),
      (bw * 0.435, 32.0, true),
      (bw * 0.595, 52.0, false),
    ];
    for (final f in fingers) {
      final rx = f.$1;
      final fh = f.$2;
      final isCenter = f.$3;
      final rr = RRect.fromRectAndRadius(Rect.fromLTWH(rx, 1, 13.0, fh), const Radius.circular(5.5));
      _drawBlurShadow(c, rr, 1.5, 3.0, 4.5, const Color(0x48101216));
      final rodG = ui.Gradient.linear(
        Offset(rx, 0),
        Offset(rx + 13.0, 0),
        isCenter
            ? const [
                Color(0xFF282B31),
                Color(0xFF62666F),
                Color(0xFF9296A0),
                Color(0xFF565A63),
                Color(0xFF2A2D33),
              ]
            : const [
                Color(0xFF2C2F36),
                Color(0xFF727680),
                Color(0xFFB6BAC4),
                Color(0xFF62666F),
                Color(0xFF30333A),
              ],
        const [0.0, 0.24, 0.46, 0.74, 1.0],
      );
      c.drawRRect(rr, Paint()..shader = rodG);
    }

    // 2 Countersunk ring rivets on left & right mounting tabs (clear below Spacebar skirt)
    for (final rx in [12.5, bw - 12.5]) {
      final center = Offset(rx, 24.0);
      c.drawCircle(center, 7.2, Paint()..color = const Color(0x4A14161B));
      c.drawCircle(
        center,
        6.0,
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(rx - 4.5, center.dy - 4.5),
            Offset(rx + 4.5, center.dy + 4.5),
            const [Color(0xFF3A3E46), Color(0xFF7E828C), Color(0xFFA6AAB4)],
            const [0.0, 0.52, 1.0],
          ),
      );
      c.drawCircle(
        center,
        6.0,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..shader = ui.Gradient.linear(
            Offset(rx - 3.5, center.dy - 5.2),
            Offset(rx + 3.5, center.dy + 5.2),
            const [Color(0xF0121419), Color(0xF0D2D6E0)],
            const [0.0, 1.0],
          ),
      );
    }

    // Soft top contact shadow cast from Spacebar bottom edge
    c.save();
    c.clipRRect(rrect);
    c.drawRect(
      Rect.fromLTWH(0, 0, bw, 11.0),
      Paint()
        ..shader = ui.Gradient.linear(
          const Offset(0, 0),
          const Offset(0, 11.0),
          const [Color(0x7814161A), Color(0x0014161A)],
        ),
    );
    c.restore();

    final pic = rec.endRecording();
    final img = pic.toImageSync(pxW, pxH);
    pic.dispose();
    return img;
  }

  ui.Image _renderSprite(Rect bounds, void Function(Canvas c) paintFn) {
    final s = _bakedScale;
    final pxW = math.max(1, (bounds.width * s).ceil());
    final pxH = math.max(1, (bounds.height * s).ceil());
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
    c.scale(s, s);
    c.translate(-bounds.left, -bounds.top);
    paintFn(c);
    final pic = rec.endRecording();
    final img = pic.toImageSync(pxW, pxH);
    pic.dispose();
    return img;
  }

  /// Bead-blasted satin CNC gunmetal steel shader matching cutaway blueprint photo
  static ui.Shader _gunmetalLinearShader(Offset a, Offset b) {
    return ui.Gradient.linear(
      a,
      b,
      const [
        Color(0xFF1A1C21),
        Color(0xFF9EA4B0),
        Color(0xFF606570),
        Color(0xFF474B55),
        Color(0xFF2B2F37),
        Color(0xFF14161B),
      ],
      const [0.0, 0.14, 0.28, 0.62, 0.86, 1.0],
    );
  }

  void _drawPathBlurShadow(
    Canvas c,
    Path path,
    double dx,
    double dy,
    double sigma,
    Color col,
  ) {
    c.save();
    c.translate(dx, dy);
    c.drawPath(
      path,
      Paint()
        ..color = col
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, sigma),
    );
    c.restore();
  }

  /// Chamfered dark-gunmetal Spacebar stabilizer bellcrank eyelet foot (cut_spacebar_torsion.png)
  ui.Image _bakeStabilizerArmSprite(double armH, Rect bounds) {
    return _renderSprite(bounds, (c) {
      final outerPath = Path()
        ..addRRect(RRect.fromRectAndCorners(
          Rect.fromLTWH(-7.4, -4.0, 14.8, armH + 4.0),
          bottomLeft: const Radius.circular(7.4),
          bottomRight: const Radius.circular(7.4),
        ));
      final innerCutout = Path()
        ..addRRect(RRect.fromRectAndCorners(
          Rect.fromLTWH(-2.1, armH - 22.0, 4.2, 15.5),
          topLeft: const Radius.circular(2.1),
          topRight: const Radius.circular(2.1),
          bottomLeft: const Radius.circular(2.1),
          bottomRight: const Radius.circular(2.1),
        ));
      final upperSlot = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromLTWH(-1.6, -4.0, 3.2, math.max(12.0, armH - 28.0)),
          const Radius.circular(1.6),
        ));
      final combinedCutout = Path.combine(PathOperation.union, innerCutout, upperSlot);
      final footPath = Path.combine(PathOperation.difference, outerPath, combinedCutout);

      _drawPathBlurShadow(c, footPath, 3.6, 12.0, 9.5, const Color(0x4C12151B));
      _drawPathBlurShadow(c, footPath, 1.3, 4.5, 3.2, const Color(0x460E1015));

      // Recessed dark steel eyelet interior
      c.drawPath(
        upperSlot,
        Paint()..color = const Color(0x99262A32),
      );

      // Dark gunmetal brushed steel bevel body
      c.drawPath(footPath, Paint()..shader = _gunmetalLinearShader(const Offset(-7.4, 0), const Offset(7.4, 0)));

      // Crisp chamfered inner rim around eyelet & outer edge highlight
      c.save();
      c.clipPath(footPath);
      c.drawPath(
        combinedCutout,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = const Color(0xCC121419),
      );
      c.drawPath(
        outerPath,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = const Color(0x55DCE0EA),
      );
      c.restore();
    });
  }

  /// Satin dark-gunmetal typebar lever (~13.6u) with curved J-elbow entering top-left of CNC slot (cut_top_slots.png)
  ui.Image _bakeSteelBar(double shaftLen, Rect bounds) {
    return _renderSprite(bounds, (c) {
      const barW = 14.0;
      const barLeft = -8.6; // Hugs left wall of slot so dark milled pocket stays visible on right
      final shaftRRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(barLeft, 10.5, barW, shaftLen - 4.5),
        const Radius.circular(3.8),
      );
      _drawBlurShadow(c, shaftRRect, 4.2, 7.5, 9.5, const Color(0x4A12151B));
      _drawBlurShadow(c, shaftRRect, 1.5, 2.6, 3.6, const Color(0x400E1015));

      c.drawRRect(
        shaftRRect,
        Paint()..shader = _gunmetalLinearShader(const Offset(barLeft, 0), const Offset(barLeft + barW, 0)),
      );

      // Chamfered flat CNC bevel edges framing satin center face
      c.drawLine(
        Offset(barLeft + 1.8, 17.0),
        Offset(barLeft + 1.8, shaftLen + 2.0),
        Paint()
          ..color = const Color(0x66C6CCD8)
          ..strokeWidth = 1.25
          ..strokeCap = StrokeCap.round,
      );
      c.drawLine(
        Offset(barLeft + barW - 1.3, 17.0),
        Offset(barLeft + barW - 1.3, shaftLen + 2.0),
        Paint()
          ..color = const Color(0xCC0C0E13)
          ..strokeWidth = 1.3,
      );

      // Curved 3D J-elbow arch bending into upper dark CNC slot depth
      final archPath = Path()
        ..moveTo(barLeft, 10.5)
        ..quadraticBezierTo(barLeft + 1.4, 0.0, barLeft + 7.0, 0.0)
        ..quadraticBezierTo(barLeft + 12.6, 0.0, barLeft + barW, 8.2)
        ..lineTo(barLeft + barW, 24.0)
        ..lineTo(barLeft, 24.0)
        ..close();

      _drawBlurShadow(
        c,
        RRect.fromRectAndRadius(const Rect.fromLTWH(barLeft, 0.5, barW, 22.0), const Radius.circular(5.5)),
        -3.5,
        6.5,
        7.5,
        const Color(0x4612151B),
      );

      c.drawPath(
        archPath,
        Paint()..shader = _gunmetalLinearShader(const Offset(barLeft, 0.0), const Offset(barLeft + barW, 16.0)),
      );

      // Subtle top-to-bottom curvature shading along the bend without any harsh bright specular dot
      c.save();
      c.clipPath(archPath);
      c.drawRect(
        const Rect.fromLTWH(barLeft, 0.0, barW, 24.0),
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, 0.0),
            const Offset(0, 24.0),
            const [Color(0x5522252C), Color(0x38969CA8), Color(0x0014161B), Color(0x2E14161B)],
            const [0.0, 0.28, 0.65, 1.0],
          ),
      );
      c.drawLine(
        const Offset(barLeft + 2.4, 5.5),
        const Offset(barLeft + 2.4, 22.0),
        Paint()
          ..color = const Color(0x55B8BECB)
          ..strokeWidth = 1.2
          ..strokeCap = StrokeCap.round,
      );
      c.restore();
    });
  }

  /// Chamfered uniform satin dark-gunmetal split gimbal C-ring cradle (#2C3038 -> #8E939E -> #343842)
  ui.Image _bakeGimbalRingSprite(Rect bounds, {required bool wideWrap}) {
    return _renderSprite(bounds, (c) {
      const r = 44.0;
      const strokeW = 6.8;
      final rect = Rect.fromCircle(center: Offset.zero, radius: r);
      final arcPath = Path();
      if (wideWrap) {
        // 270 deg deep wrap C-arc open on the RIGHT (-45..+45 deg)
        arcPath.addArc(rect, math.pi * 0.25, math.pi * 1.50);
      } else {
        // Top & bottom symmetric split C-arcs (-142..-38 deg and +38..+142 deg)
        arcPath.addArc(rect, -math.pi * 0.78, math.pi * 0.56);
        arcPath.addArc(rect, math.pi * 0.22, math.pi * 0.56);
      }

      // Soft studio drop shadow onto chassis/deck
      c.save();
      c.translate(2.4, 6.2);
      c.drawPath(
        arcPath,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeW + 1.0
          ..strokeCap = StrokeCap.round
          ..color = const Color(0x4612151B)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4.2),
      );
      c.restore();

      // Horizontal left->right gradient so BOTH upper and lower C-arcs share identical rich satin gunmetal tone
      c.drawPath(
        arcPath,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeW
          ..strokeCap = StrokeCap.round
          ..shader = ui.Gradient.linear(
            const Offset(-r, 0),
            const Offset(r, 0),
            const [
              Color(0xFF2C3038),
              Color(0xFF6B707C),
              Color(0xFF8E939E),
              Color(0xFF525762),
              Color(0xFF343842),
            ],
            const [0.0, 0.24, 0.48, 0.76, 1.0],
          ),
      );

      // Subtle 1.5px chamfered highlight ridge matching across upper & lower arcs
      c.drawPath(
        arcPath,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round
          ..shader = ui.Gradient.linear(
            const Offset(-r, 0),
            const Offset(r, 0),
            const [Color(0x558E94A0), Color(0x88C8CDD8), Color(0x55969CA8), Color(0x44686D78)],
            const [0.0, 0.35, 0.70, 1.0],
          ),
      );
    });
  }

  /// Beveled round steel plunger anvil disc (Ø40u) + vertical dome-top plunger tongue lug (y=-10..+42u)
  ui.Image _bakePlungerAnvilSprite(Rect bounds) {
    return _renderSprite(bounds, (c) {
      const discR = 20.0;
      final discRRect = RRect.fromRectAndRadius(
        Rect.fromCircle(center: Offset.zero, radius: discR),
        const Radius.circular(discR),
      );
      _drawBlurShadow(c, discRRect, 2.8, 7.0, 9.0, const Color(0x4A12151B));
      _drawBlurShadow(c, discRRect, 1.0, 2.5, 3.2, const Color(0x440E1015));

      // Outer chamfer ring + brushed gunmetal disc face
      c.drawCircle(
        Offset.zero,
        discR,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(-discR, -discR),
            const Offset(discR, discR),
            const [Color(0xFF969CA8), Color(0xFF555A65), Color(0xFF262A32), Color(0xFF14161B)],
            const [0.0, 0.35, 0.74, 1.0],
          ),
      );
      c.drawCircle(
        Offset.zero,
        discR - 2.0,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(-discR, -discR),
            const Offset(discR, discR),
            const [Color(0xFF7B808C), Color(0xFF5B606B), Color(0xFF3E424B), Color(0xFF2B2F37)],
            const [0.0, 0.36, 0.72, 1.0],
          ),
      );

      // Vertical dome-top plunger tongue lug (y=-10..+42u, centered x=0)
      final tongueRRect = RRect.fromRectAndRadius(
        const Rect.fromLTWH(-5.2, -10.0, 10.4, 52.0),
        const Radius.circular(5.2),
      );
      _drawBlurShadow(c, tongueRRect, 2.2, 4.5, 5.5, const Color(0x4412151B));
      c.drawRRect(
        tongueRRect,
        Paint()..shader = _gunmetalLinearShader(const Offset(-5.2, 0), const Offset(5.2, 0)),
      );
      c.drawLine(
        const Offset(-2.0, -7.0),
        const Offset(-2.0, 39.0),
        Paint()
          ..color = const Color(0x99ECEFF8)
          ..strokeWidth = 1.4
          ..strokeCap = StrokeCap.round,
      );
    });
  }

  /// Triple-ring horizontal clevis pivot axle bolt (~36x22u centered at (0,0), cut_left_shift.png)
  ui.Image _bakeClevisAxleSprite(Rect bounds) {
    return _renderSprite(bounds, (c) {
      const w = 36.0;
      const h = 21.0;
      final bodyRRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset.zero, width: w, height: h),
        const Radius.circular(5.5),
      );
      _drawBlurShadow(c, bodyRRect, 2.2, 5.5, 7.5, const Color(0x52101217));

      final cylShader = ui.Gradient.linear(
        const Offset(0, -h / 2),
        const Offset(0, h / 2),
        const [
          Color(0xFF1D2027),
          Color(0xFF9EA4B0),
          Color(0xFF747986),
          Color(0xFF474B55),
          Color(0xFF20232A),
          Color(0xFF101217),
        ],
        const [0.0, 0.16, 0.32, 0.60, 0.84, 1.0],
      );
      c.drawRRect(bodyRRect, Paint()..shader = cylShader);

      // Left & right endcap bevel flanges
      for (final ex in [-w / 2 + 2.5, w / 2 - 2.5]) {
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: Offset(ex, 0), width: 4.5, height: h + 1.5),
            const Radius.circular(2.2),
          ),
          Paint()..shader = cylShader,
        );
      }

      // Two crisp recessed dark vertical seam grooves separating the 3 collar rings
      for (final sx in [-7.5, 7.5]) {
        c.drawRect(
          Rect.fromLTWH(sx - 1.3, -h / 2 - 0.5, 2.6, h + 1.0),
          Paint()..color = const Color(0xEE0E1015),
        );
        c.drawLine(
          Offset(sx + 1.6, -h / 2 + 1.5),
          Offset(sx + 1.6, h / 2 - 1.5),
          Paint()
            ..color = const Color(0x66E4E8F2)
            ..strokeWidth = 0.9,
        );
      }
    });
  }

  /// Stamped rectangular U-channel slider block (~44x58u centered at (0,0), top flange + countersunk screw rivet)
  ui.Image _bakeSliderBlockSprite(Rect bounds) {
    return _renderSprite(bounds, (c) {
      final flangeRRect = RRect.fromRectAndRadius(
        const Rect.fromLTWH(-22.0, -29.0, 44.0, 8.5),
        const Radius.circular(3.0),
      );
      final bodyRRect = RRect.fromRectAndCorners(
        const Rect.fromLTWH(-16.5, -22.0, 33.0, 49.0),
        topLeft: const Radius.circular(2.5),
        topRight: const Radius.circular(2.5),
        bottomLeft: const Radius.circular(11.0),
        bottomRight: const Radius.circular(11.0),
      );

      _drawBlurShadow(c, bodyRRect, 3.0, 7.5, 9.5, const Color(0x5212151B));
      _drawBlurShadow(c, flangeRRect, 2.5, 6.0, 7.5, const Color(0x4612151B));

      // Main chamfered U-channel slider block body
      c.drawRRect(
        bodyRRect,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(-16.5, -22.0),
            const Offset(16.5, 27.0),
            const [
              Color(0xFF424650),
              Color(0xFF6B707C),
              Color(0xFF4C505B),
              Color(0xFF2C3038),
              Color(0xFF1A1D23),
            ],
            const [0.0, 0.25, 0.55, 0.84, 1.0],
          ),
      );
      // Left bright bevel edge + dark top lip contact shadow
      c.drawLine(
        const Offset(-15.0, -19.0),
        const Offset(-15.0, 18.0),
        Paint()
          ..color = const Color(0x88C8CDD8)
          ..strokeWidth = 1.6
          ..strokeCap = StrokeCap.round,
      );
      c.drawRect(
        const Rect.fromLTWH(-16.5, -21.0, 33.0, 5.5),
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, -21.0),
            const Offset(0, -15.5),
            const [Color(0xAA0C0E12), Color(0x000C0E12)],
          ),
      );

      // Top horizontal flange lip
      c.drawRRect(
        flangeRRect,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, -29.0),
            const Offset(0, -20.5),
            const [Color(0xFFB4BAC6), Color(0xFF6E7380), Color(0xFF282C34)],
            const [0.0, 0.48, 1.0],
          ),
      );

      // Countersunk hex/slotted front screw rivet at (0, 10)
      const sc = Offset(0, 10.0);
      c.drawCircle(sc, 6.4, Paint()..color = const Color(0xCC121419));
      c.drawCircle(
        sc,
        5.0,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(-4, 6),
            const Offset(4, 14),
            const [Color(0xFF8C919E), Color(0xFF464A54), Color(0xFF20232A)],
            const [0.0, 0.52, 1.0],
          ),
      );
      c.drawLine(
        const Offset(-2.6, 8.8),
        const Offset(2.6, 11.2),
        Paint()
          ..color = const Color(0xEE101217)
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      );
    });
  }

  /// Return continuous stamped oval tubular ring (~272x122u) + central T-anvil bridge block (cut_right_return.png)
  ui.Image _bakeReturnCradleSprite(Rect bounds) {
    return _renderSprite(bounds, (c) {
      const rw = 266.0;
      const rh = 116.0;
      const tube = 10.5;
      final outerOval = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: rw, height: rh),
          const Radius.circular(rh / 2),
        ));
      final innerHole = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: rw - tube * 2, height: rh - tube * 2),
          const Radius.circular((rh - tube * 2) / 2),
        ));
      final ringPath = Path.combine(PathOperation.difference, outerOval, innerHole);

      // Central T-anvil bridge block joining upper cavity and bottom rail
      final tBridge = Path()
        ..addRRect(RRect.fromRectAndCorners(
          const Rect.fromLTWH(-38.0, -34.0, 76.0, 44.0),
          topLeft: const Radius.circular(4.0),
          topRight: const Radius.circular(4.0),
          bottomLeft: const Radius.circular(6.0),
          bottomRight: const Radius.circular(6.0),
        ))
        ..addRRect(RRect.fromRectAndRadius(
          const Rect.fromLTWH(-12.5, 6.0, 25.0, 50.0),
          const Radius.circular(3.0),
        ));
      final fullCradle = Path.combine(PathOperation.union, ringPath, tBridge);

      _drawPathBlurShadow(c, fullCradle, 3.2, 8.5, 11.0, const Color(0x4E12151B));
      _drawPathBlurShadow(c, fullCradle, 1.2, 3.0, 4.0, const Color(0x440E1015));

      final metalShader = ui.Gradient.linear(
        const Offset(-rw / 2, -rh / 2),
        const Offset(rw / 2, rh / 2),
        const [
          Color(0xFF3E424B),
          Color(0xFF7C828E),
          Color(0xFF535863),
          Color(0xFF2E323A),
          Color(0xFF5E636F),
          Color(0xFF1E2128),
        ],
        const [0.0, 0.22, 0.46, 0.68, 0.86, 1.0],
      );
      c.drawPath(fullCradle, Paint()..shader = metalShader);

      // Machined collar shoulder recess seams flanking central T-anvil clamp (cut_right_return.png)
      for (final sy in [-32.0, 10.0]) {
        c.drawLine(
          Offset(-36.0, sy),
          Offset(36.0, sy),
          Paint()
            ..color = const Color(0xCC121419)
            ..strokeWidth = 2.0,
        );
      }

      // Crisp chamfered inner & outer specular rim on the tubular oval
      c.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: rw - tube, height: rh - tube),
          const Radius.circular((rh - tube) / 2),
        ),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..shader = ui.Gradient.linear(
            const Offset(0, -rh / 2),
            const Offset(0, rh / 2),
            const [Color(0x99CBD0DC), Color(0x287A7F8C), Color(0x66A8AEB9)],
            const [0.0, 0.50, 1.0],
          ),
      );
    });
  }

  /// Sculpted continuous 90-degree cast-steel L-flange ear with Ø34u/Ø15u clean transparent bore hole (cut_spacebar_torsion.png)
  /// Anchor (0,0) = bore-hole center; curved crank elbow terminates at (±90, +85) into torsion hinge anvil block.
  ui.Image _bakeSpaceEarSprite(Rect bounds, {required bool isRight}) {
    return _renderSprite(bounds, (c) {
      final dir = isRight ? -1.0 : 1.0;

      // Smooth continuous cast-steel ribbon from upper mount (dir*20, -40) down to y=68 then smooth R=16u 90° bend to (dir*90, 82)
      final ribbonCenterline = Path()
        ..moveTo(dir * 21.0, -40.0)
        ..lineTo(dir * 21.0, 64.0)
        ..quadraticBezierTo(dir * 21.0, 82.0, dir * 39.0, 82.0)
        ..lineTo(dir * 90.0, 82.0);

      // Thick rounded stroke converted or layered cleanly with the Ø34u protruding bore lug
      final lugCircle = Path()..addOval(Rect.fromCircle(center: Offset.zero, radius: 17.5));
      final earNeck = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromLTRB(isRight ? -24.0 : 0.0, -13.0, isRight ? 0.0 : 24.0, 13.0),
          const Radius.circular(6.0),
        ));
      final spineUpper = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromLTRB(isRight ? -29.0 : 13.0, -44.0, isRight ? -13.0 : 29.0, 66.0),
          const Radius.circular(7.5),
        ));
      // Smooth rounded elbow corner block (outer fillet R=18u)
      final elbowArm = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromLTRB(isRight ? -92.0 : 13.0, 52.0, isRight ? -13.0 : 92.0, 90.0),
          const Radius.circular(18.0),
        ));
      // Carve inner corner fillet so the L-bend has uniform 16u cast-steel wall thickness!
      final innerCornerCut = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromLTRB(isRight ? -96.0 : 29.0, 34.0, isRight ? -29.0 : 96.0, 74.0),
          const Radius.circular(14.0),
        ));
      final cleanElbow = Path.combine(PathOperation.difference, elbowArm, innerCornerCut);

      final unionSolid = Path.combine(
        PathOperation.union,
        Path.combine(PathOperation.union, lugCircle, earNeck),
        Path.combine(PathOperation.union, spineUpper, cleanElbow),
      );
      // Clean Ø15u transparent bore hole through the protruding ear
      final boreHole = Path()..addOval(Rect.fromCircle(center: Offset.zero, radius: 7.5));
      final bracketPath = Path.combine(PathOperation.difference, unionSolid, boreHole);

      _drawPathBlurShadow(c, bracketPath, 2.8, 6.2, 6.0, const Color(0x4A12151B));
      _drawPathBlurShadow(c, bracketPath, 0.9, 2.4, 2.6, const Color(0x400E1015));

      c.drawPath(
        bracketPath,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(-32, -44),
            const Offset(54, 90),
            const [
              Color(0xFF424650),
              Color(0xFF8A909D),
              Color(0xFF565B66),
              Color(0xFF282B33),
              Color(0xFF585D68),
              Color(0xFF1C1F25),
            ],
            const [0.0, 0.24, 0.46, 0.72, 0.88, 1.0],
          ),
      );

      // Subtle continuous bevel highlight tracing the sculpted 90° cast bend
      c.save();
      c.clipPath(bracketPath);
      c.drawPath(
        ribbonCenterline,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.2
          ..strokeCap = StrokeCap.round
          ..color = const Color(0x55D4D8E4),
      );
      c.drawCircle(
        Offset.zero,
        8.3,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0
          ..shader = ui.Gradient.linear(
            const Offset(-8, -8),
            const Offset(8, 8),
            const [Color(0xDD101217), Color(0xCCCFD4E0)],
          ),
      );
      c.restore();

      // Torsion hinge anvil block clamping the inner crank end at (dir * 84, 82)
      final anvilRRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(dir * 84.0, 82.0), width: 22.0, height: 20.0),
        const Radius.circular(4.5),
      );
      _drawBlurShadow(c, anvilRRect, 2.0, 4.5, 6.0, const Color(0x48101217));
      c.drawRRect(
        anvilRRect,
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(dir * 84.0 - 11.0, 72.0),
            Offset(dir * 84.0 + 11.0, 92.0),
            const [Color(0xFF565B66), Color(0xFF2A2E36), Color(0xFF14161B)],
            const [0.0, 0.52, 1.0],
          ),
      );
    });
  }

  void _bakeShadows() {
    (ui.Image, Rect) bakeShape(double w, double h) {
      final r = h / 2;
      final bounds = Rect.fromCenter(center: Offset.zero, width: w + 88, height: h + 96);
      final s = _bakedScale;
      final pxW = math.max(1, (bounds.width * s).ceil());
      final pxH = math.max(1, (bounds.height * s).ceil());
      final rec = ui.PictureRecorder();
      final c = Canvas(rec, Rect.fromLTWH(0, 0, pxW.toDouble(), pxH.toDouble()));
      c.scale(s, s);
      c.translate(-bounds.left, -bounds.top);

      _drawBlurShadow(
        c,
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w - 4, height: h - 2), Radius.circular(r)),
        2.0,
        16.0,
        28.0,
        const Color(0x4D181A1F),
      );
      _drawBlurShadow(
        c,
        RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w - 2, height: h - 1), Radius.circular(r)),
        0.5,
        5.0,
        9.0,
        const Color(0x4D101216),
      );

      final pic = rec.endRecording();
      final img = pic.toImageSync(pxW, pxH);
      pic.dispose();
      return (img, bounds);
    }

    final r1 = bakeShape(116, 116);
    roundShadowImage = r1.$1;
    roundShadowBounds = r1.$2;
    final r2 = bakeShape(176, 116);
    pillShadowImage = r2.$1;
    pillShadowBounds = r2.$2;
    final r3 = bakeShape(616, 114);
    spaceShadowImage = r3.$1;
    spaceShadowBounds = r3.$2;
    final r4 = bakeShape(298, 114);
    returnShadowImage = r4.$1;
    returnShadowBounds = r4.$2;
  }

  void _bakeAllKeys(
    KeyboardLayer layer,
    bool shifted,
    bool capsLock,
    String actionLabel,
  ) {
    for (final sprite in _keySprites.values) {
      sprite.dispose();
    }
    _keySprites.clear();

    for (final def in kKeyDefs) {
      _keySprites[def.id] = _bakeSingleKey(def, layer, shifted, capsLock, actionLabel);
    }
  }

  BakedKeySprite _bakeSingleKey(
    KeyDef def,
    KeyboardLayer layer,
    bool shifted,
    bool capsLock,
    String actionLabel,
  ) {
    final restBounds = Rect.fromCenter(
      center: const Offset(0, 12),
      width: def.w + 96,
      height: def.h + 104,
    );
    final topBounds = Rect.fromCenter(
      center: Offset.zero,
      width: def.w + 8,
      height: def.h + 8,
    );

    ui.Image bakeKey(Rect bounds, {required bool includeShadowAndSkirt, required bool pressed, required bool crystal}) {
      return _renderSprite(bounds, (c) {
        _paintKeycapToLocalOrigin(
          c,
          def,
          layer,
          shifted,
          capsLock,
          actionLabel,
          includeShadowAndSkirt: includeShadowAndSkirt,
          pressed: pressed,
          crystal: crystal,
        );
      });
    }

    return BakedKeySprite(
      restImage: bakeKey(restBounds, includeShadowAndSkirt: true, pressed: false, crystal: false),
      topImage: bakeKey(topBounds, includeShadowAndSkirt: false, pressed: false, crystal: false),
      pressedTopImage: bakeKey(topBounds, includeShadowAndSkirt: false, pressed: true, crystal: false),
      crystalRestImage: bakeKey(restBounds, includeShadowAndSkirt: true, pressed: false, crystal: true),
      crystalTopImage: bakeKey(topBounds, includeShadowAndSkirt: false, pressed: false, crystal: true),
      crystalPressedTopImage: bakeKey(topBounds, includeShadowAndSkirt: false, pressed: true, crystal: true),
      restBounds: restBounds,
      topBounds: topBounds,
    );
  }

  void _paintKeycapToLocalOrigin(
    Canvas c,
    KeyDef def,
    KeyboardLayer layer,
    bool shifted,
    bool capsLock,
    String actionLabel, {
    required bool includeShadowAndSkirt,
    required bool pressed,
    bool crystal = false,
  }) {
    final w = def.w;
    final h = def.h;
    final r = h / 2.0;
    final x = -w / 2.0;
    // Matched 3D overhead perspective: subtle 4.2u barrel drop so keycaps stay sleek and sculpted
    final yTop = -h / 2.0 - (includeShadowAndSkirt ? 1.0 : 0.0);
    const skirtDrop = 4.2;

    const inset = 11.2;
    final fx = x + inset;
    final fy = yTop + inset * 0.92;
    final fw = w - inset * 2.0;
    final fh = h - inset * 2.0;
    final fr = fh / 2.0;
    final faceRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(fx, fy, fw, fh),
      Radius.circular(fr),
    );
    final bezelRect = Rect.fromLTWH(x, yTop, w, h);
    final bezelRRect = RRect.fromRectAndRadius(bezelRect, Radius.circular(r));
    final faceCutoutPath = Path()..addRRect(faceRRect);

    if (includeShadowAndSkirt) {
      if (crystal) {
        // Crystal mode: NEVER fill opaque dark skirt/shadow behind the transparent crystal window!
        c.save();
        c.clipPath(
          Path.combine(
            PathOperation.difference,
            Path()..addRect(Rect.fromLTWH(x - 60, yTop - 60, w + 120, h + 130)),
            faceCutoutPath,
          ),
        );
      }
      // Deep multi-pass photographic floor shadow (broad diffuse studio bloom + tight contact rim)
      _drawBlurShadow(
        c,
        RRect.fromRectAndRadius(Rect.fromLTWH(x + 2, yTop + skirtDrop + 5, w - 4, h - 2), Radius.circular(r)),
        3.5,
        16.0,
        30.0,
        Color.fromARGB(crystal ? 0x3A : 0x6E, 0x12, 0x15, 0x1B),
      );
      _drawBlurShadow(
        c,
        RRect.fromRectAndRadius(Rect.fromLTWH(x + 1, yTop + skirtDrop + 1.5, w - 2, h - 1), Radius.circular(r)),
        1.0,
        5.5,
        9.5,
        Color.fromARGB(crystal ? 0x36 : 0x66, 0x0E, 0x10, 0x15),
      );

      // High-contrast cylindrical chrome side skirt blending naturally into floor shadow
      final skirtRRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x + 0.4, yTop + skirtDrop, w - 0.8, h),
        Radius.circular(r),
      );
      final skirtShader = ui.Gradient.linear(
        Offset(x, 0),
        Offset(x + w, 0),
        const [
          Color(0xFF2C3038),
          Color(0xFF8C909C),
          Color(0xFF454952),
          Color(0xFF232730),
          Color(0xFF484C56),
          Color(0xFF848894),
          Color(0xFF282C34),
        ],
        const [0.0, 0.14, 0.32, 0.50, 0.68, 0.86, 1.0],
      );
      c.drawRRect(skirtRRect, Paint()..shader = skirtShader);
      if (crystal) {
        c.restore();
      }
    }

    // 1. High-Contrast Liquid-Metal Chrome Bezel Ring (punched hollow in crystal mode!)
    final isModeActive = def.special == KeySpecial.mode && layer != KeyboardLayer.abc;
    if (crystal) {
      c.save();
      c.clipPath(
        Path.combine(
          PathOperation.difference,
          Path()..addRRect(bezelRRect),
          faceCutoutPath,
        ),
      );
    }
    if (pressed || isModeActive) {
      final pg = ui.Gradient.linear(
        Offset(0, yTop),
        Offset(0, yTop + h),
        isModeActive && !pressed
            ? const [
                Color(0xFF565A64),
                Color(0xFF484C56),
                Color(0xFF3C4049),
                Color(0xFF464A54),
                Color(0xFF525660),
                Color(0xFF383B43),
              ]
            : const [
                Color(0xFF5D616B),
                Color(0xFF4C5059),
                Color(0xFF3E414A),
                Color(0xFF4A4E57),
                Color(0xFF585C65),
                Color(0xFF393C44),
              ],
        const [0.0, 0.18, 0.48, 0.74, 0.90, 1.0],
      );
      c.drawRRect(bezelRRect, Paint()..shader = pg);
    } else if (!def.pill) {
      // High-contrast liquid chrome: razor-bright #FFFFFF/#F4F7FF gleam peaks next to deep gunmetal #232730/#353944 valleys
      final sweep = ui.Gradient.sweep(
        Offset(0, yTop + h / 2.0),
        const [
          Color(0xFFEAECEF),
          Color(0xFFFFFFFF),
          Color(0xFFD6DAE4),
          Color(0xFF262A34),
          Color(0xFF4E525E),
          Color(0xFFF4F7FF),
          Color(0xFFC4C8D4),
          Color(0xFF232730),
          Color(0xFF7A7E8A),
          Color(0xFFEAECEF),
        ],
        const [0.0, 0.11, 0.22, 0.35, 0.47, 0.59, 0.71, 0.83, 0.93, 1.0],
        TileMode.clamp,
        0.0,
        math.pi * 2.0,
        Matrix4.rotationZ(-math.pi * 0.68).storage,
      );
      c.drawRRect(bezelRRect, Paint()..shader = sweep);
    } else {
      // High-contrast diagonal liquid chrome sweep for pill keys (Space, Return, Shift, 123, Backspace)
      final lg = ui.Gradient.linear(
        Offset(x, yTop),
        Offset(x + w, yTop + h),
        const [
          Color(0xFFFFFFFF),
          Color(0xFFD2D6E2),
          Color(0xFF4C505B),
          Color(0xFF282C35),
          Color(0xFF8A8E9A),
          Color(0xFFF4F7FF),
          Color(0xFF383C45),
        ],
        const [0.0, 0.16, 0.34, 0.50, 0.70, 0.86, 1.0],
      );
      c.drawRRect(bezelRRect, Paint()..shader = lg);
    }

    // Lathe-turned bevel curvature & machined inner step groove around r-6.0
    c.save();
    c.clipRRect(bezelRRect);
    c.drawRRect(
      bezelRRect,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, yTop),
          Offset(0, yTop + h),
          (pressed || isModeActive)
              ? const [
                  Color(0x22FFFFFF),
                  Color(0x00FFFFFF),
                  Color(0x1E101216),
                  Color(0x380C0E12),
                ]
              : def.pill
                  ? const [
                      Color(0x28FFFFFF),
                      Color(0x00FFFFFF),
                      Color(0x1414161C),
                      Color(0x28121418),
                    ]
                  : const [
                      Color(0x52FFFFFF),
                      Color(0x00FFFFFF),
                      Color(0x1614161C),
                      Color(0x2E121418),
                    ],
          const [0.0, 0.22, 0.76, 1.0],
        ),
    );

    // Specular crest along outer chrome shoulder (~3.3u in)
    final crestRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(x + 3.3, yTop + 3.3, w - 6.6, h - 6.6),
      Radius.circular(r - 3.3),
    );
    c.drawRRect(
      crestRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.9)
        ..shader = ui.Gradient.linear(
          Offset(0, yTop + 3.3),
          Offset(0, yTop + h - 3.3),
          (pressed || isModeActive)
              ? const [Color(0x428A8E98), Color(0x14464952), Color(0x24686C76)]
              : def.pill
                  ? const [Color(0x78E4E7EF), Color(0x24828690), Color(0x62DFE2EC)]
                  : const [Color(0xD8FFFFFF), Color(0x66C4C8D2), Color(0x7AE4E7EF)],
          const [0.0, 0.50, 1.0],
        ),
    );

    // Crisp concentric lathe-turned inner step groove around inset 6.0
    final stepGrooveRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(x + 6.0, yTop + 6.0, w - 12.0, h - 12.0),
      Radius.circular(r - 6.0),
    );
    c.drawRRect(
      stepGrooveRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.25
        ..shader = ui.Gradient.linear(
          Offset(0, yTop + 6.0),
          Offset(0, yTop + h - 6.0),
          pressed
              ? const [Color(0x481C1F24), Color(0x701C1F24), Color(0x581C1F24)]
              : const [Color(0x4C2C2F36), Color(0x78282B32), Color(0x6824272E)],
          const [0.0, 0.50, 1.0],
        ),
    );
    c.restore();

    // Crisp dark outer contact rim (#1A1D24) so every keycap snaps cleanly off the keybed
    c.drawRRect(
      bezelRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..shader = ui.Gradient.linear(
          Offset(0, yTop),
          Offset(0, yTop + h),
          pressed
              ? const [Color(0x881A1D24), Color(0xBB1A1D24), Color(0xEE1A1D24)]
              : const [Color(0x661A1D24), Color(0x991A1D24), Color(0xCC1A1D24)],
          const [0.0, 0.55, 1.0],
        ),
    );

    // 2. Sculpted Inner Cup Wall + Face (opaque porcelain/ruby OR bright icy frosted crystal glass)
    if (crystal) {
      c.restore(); // End hollow bezel ring clip
      c.save();
      c.clipRRect(faceRRect);
      // Optical sapphire glass (#F4F7FF 22% top -> #DCE4F2 10% center -> #FFFFFF 36% bottom caustic crescent)
      c.drawRRect(
        faceRRect,
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(0, fy),
            Offset(0, fy + fh),
            def.isRed
                ? (pressed
                    ? const [Color(0x88921226), Color(0x74C0203A), Color(0x90E23854)]
                    : const [Color(0x74B81B33), Color(0x58DE2846), Color(0x86F44864)])
                : (pressed
                    ? const [Color(0x48F4F7FF), Color(0x28DCE4F2), Color(0x64FFFFFF)]
                    : const [Color(0x38F4F7FF), Color(0x1ADCE4F2), Color(0x5CFFFFFF)]),
            const [0.0, 0.52, 1.0],
          ),
      );
      // Diagonal crystal glass specular highlight band
      c.drawRect(
        Rect.fromLTWH(fx - fw * 0.1, fy - fh * 0.15, fw * 1.2, fh * 0.56),
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(fx, fy),
            Offset(fx + fw * 0.55, fy + fh * 0.55),
            const [Color(0x58FFFFFF), Color(0x1EFFFFFF), Color(0x00FFFFFF)],
            const [0.0, 0.45, 1.0],
          ),
      );
      // Crisp white inner specular rim + dark outer cup contact edge
      c.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(fx + 1.1, fy + 1.1, fw - 2.2, fh - 2.2),
          Radius.circular(fr - 1.1),
        ),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0
          ..shader = ui.Gradient.linear(
            Offset(0, fy),
            Offset(0, fy + fh),
            const [Color(0xCCFFFFFF), Color(0x55FFFFFF), Color(0xAAFFFFFF)],
            const [0.0, 0.5, 1.0],
          ),
      );
      c.restore();
      c.drawRRect(
        faceRRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = const Color(0xCC22252C),
      );
    } else {
      // Crisp 360-degree dark recessed inner step groove (~1.8u #2E323B) separating chrome ring from 92u porcelain cup
      final cupWallRRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(fx - 2.2, fy - 2.2, fw + 4.4, fh + 4.4),
        Radius.circular(fr + 2.2),
      );
      final cupWallShader = ui.Gradient.linear(
        Offset(0, fy - 2.2),
        Offset(0, fy + fh + 2.2),
        (pressed || isModeActive)
            ? const [Color(0xE8181A20), Color(0xB82E323B), Color(0xD8525660)]
            : const [Color(0xF022252C), Color(0xC8383C45), Color(0xE060646E)],
        const [0.0, 0.48, 1.0],
      );
      c.drawRRect(cupWallRRect, Paint()..shader = cupWallShader);

      // 3. Soft Studio Porcelain / Deep Ruby Key Face
      if (def.isRed) {
        final rg = ui.Gradient.linear(
          Offset(0, fy),
          Offset(0, fy + fh),
          pressed
              ? const [Color(0xFF680916), Color(0xFF8A0E20), Color(0xFF800C1C), Color(0xFF941427)]
              : const [Color(0xFF8C0D1E), Color(0xFFBC152D), Color(0xFFCA1933), Color(0xFFD61E38)],
          const [0.0, 0.16, 0.72, 1.0],
        );
        c.drawRRect(faceRRect, Paint()..shader = rg);
      } else {
        final fg = ui.Gradient.linear(
          Offset(0, fy),
          Offset(0, fy + fh),
          (pressed || isModeActive)
              ? const [
                  Color(0xFF9EA2AC),
                  Color(0xFFB2B6C0),
                  Color(0xFFB8BCC6),
                  Color(0xFFBEC2CB),
                  Color(0xFFB3B7C0),
                ]
              : const [
                  Color(0xFFDCDEE7),
                  Color(0xFFE7E8EF),
                  Color(0xFFEAECEF),
                  Color(0xFFE5E7EE),
                  Color(0xFFDCE0E9),
                ],
          const [0.0, 0.18, 0.56, 0.86, 1.0],
        );
        c.drawRRect(faceRRect, Paint()..shader = fg);
      }

      // Soft top inner-cup concave ambient shadow (darker burgundy vignette on Backspace + bright bottom inner catchlight)
      c.save();
      c.clipRRect(faceRRect);
      c.drawRRect(
        faceRRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = def.isRed ? 6.0 : 5.2
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.0)
          ..shader = ui.Gradient.linear(
            Offset(0, fy),
            Offset(0, fy + fh),
            [
              (def.isRed ? const Color(0xFF42040C) : const Color(0xFF343740))
                  .withValues(alpha: pressed ? 0.38 : (def.isRed ? 0.34 : 0.24)),
              Colors.transparent,
              Colors.white.withValues(alpha: pressed ? 0.08 : (def.isRed ? 0.34 : 0.26)),
            ],
            const [0.0, 0.45, 1.0],
          ),
      );
      if (def.isRed && !pressed) {
        // Crisp bright bottom-inner specular rim catchlight inside the Backspace carmine face
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(fx + 1.0, fy + 1.0, fw - 2.0, fh - 2.0),
            Radius.circular(fr - 1.0),
          ),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.0
            ..shader = ui.Gradient.linear(
              Offset(0, fy),
              Offset(0, fy + fh),
              const [Colors.transparent, Colors.transparent, Color(0x55FF90A0), Color(0x99FFD8DF)],
              const [0.0, 0.65, 0.88, 1.0],
            ),
        );
      }
      c.restore();
    }

    _drawLegendAtOrigin(
      c,
      def,
      layer,
      shifted,
      capsLock,
      actionLabel,
      yOffset: yTop + h / 2.0,
      pressed: pressed,
      crystal: crystal,
    );
  }

  void _drawLegendAtOrigin(
    Canvas c,
    KeyDef def,
    KeyboardLayer layer,
    bool shifted,
    bool capsLock,
    String actionLabel, {
    double yOffset = 0.0,
    bool pressed = false,
    bool crystal = false,
  }) {
    final cfg = kKeyboardLayers[layer]!;
    final inkColor = crystal
        ? (def.isRed
            ? const Color(0xFFFCE8EC)
            : (pressed ? const Color(0xFF0A0C10) : const Color(0xFF101319)))
        : (def.isRed
            ? (pressed ? const Color(0xFF1D0408) : const Color(0xFF2A050A))
            : (pressed ? const Color(0xFF191C22) : const Color(0xFF1F2228)));

    c.save();
    c.translate(0, yOffset);

    if (def.special == KeySpecial.shift && cfg.shiftText == null) {
      final path = Path()
        ..moveTo(0, -23)
        ..lineTo(-22, 0)
        ..lineTo(-10, 0)
        ..lineTo(-10, 22)
        ..lineTo(10, 22)
        ..lineTo(10, 0)
        ..lineTo(22, 0)
        ..close();
      if (shifted || capsLock) {
        c.drawPath(path, Paint()..color = inkColor);
      }
      c.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = inkColor,
      );
      if (capsLock) {
        c.drawLine(
          const Offset(-11, 28),
          const Offset(11, 28),
          Paint()
            ..strokeWidth = 3.4
            ..strokeCap = StrokeCap.round
            ..color = inkColor,
        );
      }
      c.restore();
      return;
    }

    if (def.special == KeySpecial.backspace) {
      // Rich dark-maroon recessed icon with subtle burgundy bevel edge (macro_bksp_3x.png)
      final outline = Path()
        ..moveTo(-15, -19.5)
        ..lineTo(22, -19.5)
        ..arcToPoint(const Offset(28, -13.5), radius: const Radius.circular(6))
        ..lineTo(28, 13.5)
        ..arcToPoint(const Offset(22, 19.5), radius: const Radius.circular(6))
        ..lineTo(-15, 19.5)
        ..lineTo(-32, 0)
        ..close();
      final bevelPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = pressed ? const Color(0xFF4E0812) : const Color(0xFF680E1B);
      final corePaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = pressed ? const Color(0xFF280409) : const Color(0xFF38060D);

      c.drawPath(outline, bevelPaint);
      c.drawLine(const Offset(-3.5, -8.0), const Offset(12.5, 8.0), bevelPaint);
      c.drawLine(const Offset(12.5, -8.0), const Offset(-3.5, 8.0), bevelPaint);

      c.drawPath(outline, corePaint);
      c.drawLine(const Offset(-3.5, -8.0), const Offset(12.5, 8.0), corePaint);
      c.drawLine(const Offset(12.5, -8.0), const Offset(-3.5, 8.0), corePaint);
      c.restore();
      return;
    }

    if (def.special == KeySpecial.emoji) {
      final strokePaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = inkColor;
      c.drawCircle(Offset.zero, 25.0, strokePaint);
      final eyePaint = Paint()..color = inkColor;
      c.drawOval(Rect.fromCenter(center: const Offset(-8.2, -6.2), width: 3.4, height: 4.8), eyePaint);
      c.drawOval(Rect.fromCenter(center: const Offset(8.2, -6.2), width: 3.4, height: 4.8), eyePaint);
      final smile = Path()
        ..moveTo(-12.5, 3.8)
        ..lineTo(12.5, 3.8)
        ..quadraticBezierTo(0, 19.5, -12.5, 3.8)
        ..close();
      c.drawPath(smile, strokePaint);
      c.restore();
      return;
    }

    if (def.special == KeySpecial.returnKey) {
      void drawReturnAction(Paint p) {
        switch (actionLabel) {
          case 'search':
            c.drawCircle(const Offset(-4, -4), 15, p);
            c.drawLine(const Offset(7.5, 7.5), const Offset(21, 21), p);
          case 'send':
            final plane = Path()
              ..moveTo(-22, -4)
              ..lineTo(24, -18)
              ..lineTo(6, 20)
              ..lineTo(-4, 4)
              ..close();
            c.drawPath(plane, p);
            c.drawLine(const Offset(-4, 4), const Offset(24, -18), p);
          case 'go':
            c.drawLine(const Offset(-24, 0), const Offset(24, 0), p);
            final goHead = Path()
              ..moveTo(9, -14)
              ..lineTo(25, 0)
              ..lineTo(9, 14);
            c.drawPath(goHead, p);
          case 'next':
            c.drawLine(const Offset(-26, 0), const Offset(15, 0), p);
            final nextHead = Path()
              ..moveTo(1, -13)
              ..lineTo(16, 0)
              ..lineTo(1, 13);
            c.drawPath(nextHead, p);
            c.drawLine(const Offset(24, -15), const Offset(24, 15), p);
          case 'done':
            final check = Path()
              ..moveTo(-20, 2)
              ..lineTo(-5, 16)
              ..lineTo(22, -14);
            c.drawPath(check, p);
          default:
            final arrowShaft = Path()
              ..moveTo(15, -17)
              ..lineTo(26, -17)
              ..arcToPoint(const Offset(30, -13), radius: const Radius.circular(4))
              ..lineTo(30, 1)
              ..arcToPoint(const Offset(26, 5), radius: const Radius.circular(4))
              ..lineTo(-27, 5);
            c.drawPath(arrowShaft, p);
            final head = Path()
              ..moveTo(-13, -7.5)
              ..lineTo(-28, 5)
              ..lineTo(-13, 17.5);
            c.drawPath(head, p);
        }
      }

      if (crystal) {
        drawReturnAction(
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 6.2
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..color = const Color(0xDDFFFFFF),
        );
      }
      drawReturnAction(
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.3
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = inkColor,
      );
      c.restore();
      return;
    }

    String text = '';
    bool isSans = false;
    bool isSansPunct = false;
    bool isNum123 = false;

    if (def.id.startsWith('r1_')) {
      text = cfg.r1[def.col];
    } else if (def.id.startsWith('r2_')) {
      text = cfg.r2[def.col];
      isSansPunct = layer != KeyboardLayer.abc;
    } else if (def.id.startsWith('r3_')) {
      text = cfg.r3[def.col];
      isSansPunct = layer != KeyboardLayer.abc;
    } else if (def.special == KeySpecial.shift) {
      text = cfg.shiftText ?? '';
      isSans = true;
    } else if (def.special == KeySpecial.mode) {
      text = cfg.modeLabel;
      isNum123 = cfg.modeNumStyle;
      isSans = !isNum123;
    }
    if (text.isEmpty) {
      c.restore();
      return;
    }

    final useSans = isSans || isSansPunct;
    final fontSize = isSans ? 39.0 : (isSansPunct ? 52.0 : (isNum123 ? 47.0 : 64.0));
    final fontFamily = useSans ? 'sans-serif' : 'Arvo';
    final ty = useSans ? 0.5 : 1.0;

    final fillTp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontFamily: fontFamily,
          fontSize: fontSize,
          fontWeight: FontWeight.w400,
          color: inkColor,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    final pos = Offset(-fillTp.width / 2, ty - fillTp.height / 2);
    if (crystal && !def.isRed) {
      // Crisp frosty white backing halo so dark text stays razor-legible over moving steel chassis
      final haloTp = TextPainter(
        text: TextSpan(
          text: text,
          style: TextStyle(
            fontFamily: fontFamily,
            fontSize: fontSize,
            fontWeight: FontWeight.w400,
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 4.2
              ..strokeJoin = StrokeJoin.round
              ..color = const Color(0xE8FFFFFF),
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      haloTp.paint(c, pos);
      haloTp.dispose();
    }
    if (!useSans) {
      // Micro-optical weight boost matching REF Arvo letterform fullness without chunky Bold
      fillTp.paint(c, pos + const Offset(0.32, 0.0));
      fillTp.paint(c, pos + const Offset(0.0, 0.32));
    }
    fillTp.paint(c, pos);
    fillTp.dispose();
    c.restore();
  }

  void _drawBlurShadow(
    Canvas c,
    RRect rrect,
    double dx,
    double dy,
    double blur,
    Color color,
  ) {
    final sigma = (blur * 0.45).clamp(0.4, 30.0);
    final paint = Paint()
      ..color = color
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, sigma);
    c.save();
    c.translate(dx, dy);
    c.drawRRect(rrect, paint);
    c.restore();
  }

  void _disposeAll() {
    deckImage?.dispose();
    deckImage = null;
    blueprintDeckImage?.dispose();
    blueprintDeckImage = null;
    barImage?.dispose();
    barImage = null;
    barShortImage?.dispose();
    barShortImage = null;
    knuckleImage?.dispose();
    knuckleImage = null;
    bracketLeftImage?.dispose();
    bracketLeftImage = null;
    bracketRightImage?.dispose();
    bracketRightImage = null;
    stabilizerArmImage?.dispose();
    stabilizerArmImage = null;
    stabilizerShortArmImage?.dispose();
    stabilizerShortArmImage = null;
    gimbalTopBottomImage?.dispose();
    gimbalTopBottomImage = null;
    gimbalWideWrapImage?.dispose();
    gimbalWideWrapImage = null;
    plungerAnvilImage?.dispose();
    plungerAnvilImage = null;
    clevisAxleImage?.dispose();
    clevisAxleImage = null;
    sliderBlockImage?.dispose();
    sliderBlockImage = null;
    returnCradleImage?.dispose();
    returnCradleImage = null;
    spaceEarLeftImage?.dispose();
    spaceEarLeftImage = null;
    spaceEarRightImage?.dispose();
    spaceEarRightImage = null;
    roundShadowImage?.dispose();
    roundShadowImage = null;
    pillShadowImage?.dispose();
    pillShadowImage = null;
    spaceShadowImage?.dispose();
    spaceShadowImage = null;
    returnShadowImage?.dispose();
    returnShadowImage = null;
    for (final s in _keySprites.values) {
      s.dispose();
    }
    _keySprites.clear();
  }

  void dispose() => _disposeAll();
}
