import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:material_ui/material_ui.dart';
import 'keyboard_bake_cache.dart';
import 'keyboard_geometry.dart';
import 'keyboard_physics.dart';

/// Photorealistic 60/120 FPS Studio 3D Typewriter CustomPainter.
/// Supports three live visual layers ([MechanismView.classic], [MechanismView.crystal],
/// and [MechanismView.blueprint]) over the full steel undercarriage chassis.
class TypewriterKeyboardPainter extends CustomPainter {
  final KeyboardPhysicsController physics;
  final KeyboardBakeCache cache;
  final double devicePixelRatio;
  final KeyboardLayer layer;
  final bool shifted;
  final bool capsLock;
  final String actionLabel;
  final MechanismView mechanismView;

  TypewriterKeyboardPainter({
    required this.physics,
    required this.cache,
    required this.devicePixelRatio,
    required this.layer,
    required this.shifted,
    required this.capsLock,
    this.actionLabel = 'newline',
    this.mechanismView = MechanismView.classic,
  }) : super(repaint: physics);

  static const double _w = KeyboardMetrics.designWidth;
  static const double _h = KeyboardMetrics.designHeight;

  static final Paint _imgPaint = Paint()..filterQuality = FilterQuality.low;

  // Front highlight plane: satin machined gunmetal steel bevels (matching blueprint cut_top_slots.png)
  static final ui.Shader _rodShader = ui.Gradient.linear(
    const Offset(-7.0, 0),
    const Offset(7.0, 0),
    const [
      Color(0xFF1A1C22),
      Color(0xFF3E424B),
      Color(0xFF949AA8),
      Color(0xFF747986),
      Color(0xFF454953),
      Color(0xFF23262E),
      Color(0xFF383C46),
      Color(0xFF15171C),
    ],
    const [0.0, 0.14, 0.28, 0.42, 0.58, 0.76, 0.90, 1.0],
  );

  // Rear shadow plane: recessed secondary rods sitting deep in the keybed well
  static final ui.Shader _stemShader = ui.Gradient.linear(
    const Offset(-7.0, 0),
    const Offset(7.0, 0),
    const [
      Color(0xFF121419),
      Color(0xFF2E323A),
      Color(0xFF666B78),
      Color(0xFF3D414A),
      Color(0xFF1A1D23),
      Color(0xFF0E1014),
    ],
    const [0.0, 0.18, 0.33, 0.54, 0.80, 1.0],
  );

  static final Paint _fastSoftShadow1 = Paint()..color = const Color(0x180C0E14);
  static final Paint _fastSoftShadow2 = Paint()..color = const Color(0x260C0E14);
  static final Paint _fastSoftShadow3 = Paint()..color = const Color(0x36080A0F);

  // Per-slot mechanical termination Y matching blueprint cut_top_slots.png & cut_center_rings.png:
  // Paired yokes (1-2, 4, 7-8, 9, 10-11, 14-15) terminate at Row 1/2 clevis pivot axles (y~486);
  // long structural guide bars run down to Row 3/4.
  static const List<double> _slotEndY = [
    760.0, // 0: long left center bar down past Z/S
    488.0, // 1: E left paired yoke -> E clevis axle
    488.0, // 2: E right paired yoke -> E clevis axle
    866.0, // 3: long D/X guide bar down behind spaceEarLeft horizontal crank elbow
    716.0, // 4: R -> Spacebar left coil spring top anchor
    488.0, // 5: R right paired yoke -> R clevis axle
    756.0, // 6: F/C long center bar -> Spacebar bridge
    488.0, // 7: T left paired yoke -> T clevis axle
    756.0, // 8: G/V long center bar -> Spacebar bridge
    488.0, // 9: Y left paired yoke -> Y clevis axle
    488.0, // 10: U left paired yoke -> U clevis axle
    756.0, // 11: H/B long center bar -> Spacebar bridge
    716.0, // 12: U/N -> Spacebar right coil spring top anchor
    866.0, // 13: J/N long guide bar down behind spaceEarRight horizontal crank elbow
    488.0, // 14: I left paired yoke -> I clevis axle
    488.0, // 15: I right paired yoke -> I clevis axle
    760.0, // 16: long right center bar down to Return cradle
  ];

  // Blueprint Row 3 gimbal style: true = wide 270 wrap, false = top/bottom split C-arc.
  // Negative scaleX mirrors the open-right wide wrap into open-left for B/N/M.
  static const Map<String, double> _wideGimbalScaleX = {
    'r3_0': 1.0,  // Z: open right
    'r3_1': 1.0,  // X: open right
    'r3_4': -1.0, // B: open left
    'r3_5': -1.0, // N: open left
    'r3_6': -1.0, // M: open left
  };

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    cache.ensureBaked(
      size: size,
      dpr: devicePixelRatio,
      layer: layer,
      shifted: shifted,
      capsLock: capsLock,
      actionLabel: actionLabel,
    );

    final scaleX = size.width / _w;
    final scaleY = size.height / _h;
    canvas.save();

    final topR = Radius.circular(60.0 * scaleX);
    canvas.clipRRect(
      RRect.fromRectAndCorners(
        Offset.zero & size,
        topLeft: topR,
        topRight: topR,
      ),
    );

    // 1. Studio deck + top 17 CNC slots
    _drawDeck(canvas, size);
    canvas.scale(scaleX, scaleY);

    // 2. Keybed shadow wells (classic & crystal modes only; blueprint uses clean bright studio ground)
    if (mechanismView != MechanismView.blueprint) {
      _drawKeybedWells(canvas);
    }

    // 3. 17 Chamfered steel typebars + active slot hollow chrome rocker carriage
    _drawTopTypebars(canvas);

    // 4. Outer Shift & Return columns + bolted slider blocks + Return oval cradle
    _drawLeftShiftColumn(canvas);
    _drawRightReturnColumn(canvas);

    // 5. Center matrix stems, triple-ring clevis axles, and 32 gimbal C-rings + plunger anvils
    _drawCenterMatrixAndGimbals(canvas);

    // 6. Spacebar torsion crossbar, 12-turn twin coil springs, L-flange ears, 5-wrap hubs & 4 feet
    _drawSpacebarMechanics(canvas);

    // 7. Keycaps (or crisp blueprint etched legend tags)
    _drawKeycapsOrBlueprintLegends(canvas);

    // 8. Concentric top studio specular rim highlight fading softly down the sides
    final rimPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..shader = ui.Gradient.linear(
        const Offset(0, 0),
        const Offset(0, 120),
        [
          Colors.white.withValues(alpha: 0.78),
          Colors.white.withValues(alpha: 0.40),
          Colors.white.withValues(alpha: 0.0),
        ],
        const [0.0, 0.45, 1.0],
      );
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        const Rect.fromLTWH(1.2, 1.2, _w - 2.4, _h),
        topLeft: const Radius.circular(58.8),
        topRight: const Radius.circular(58.8),
      ),
      rimPaint,
    );

    canvas.restore();
  }

  void _drawDeck(Canvas canvas, Size size) {
    final deckImg = mechanismView == MechanismView.blueprint
        ? (cache.blueprintDeckImage ?? cache.deckImage)
        : cache.deckImage;
    if (deckImg != null) {
      canvas.drawImageRect(
        deckImg,
        Rect.fromLTWH(0, 0, deckImg.width.toDouble(), deckImg.height.toDouble()),
        Offset.zero & size,
        _imgPaint,
      );
    }
  }

  void _drawKeybedWells(Canvas c) {
    c.drawOval(
      Rect.fromCenter(center: const Offset(660, 525), width: 1020, height: 480),
      Paint()
        ..shader = ui.Gradient.radial(
          Offset.zero,
          1.0,
          [
            const Color(0xFF12151C).withValues(alpha: 0.30),
            const Color(0xFF151820).withValues(alpha: 0.16),
            const Color(0xFF181B22).withValues(alpha: 0.0),
          ],
          const [0.0, 0.58, 1.0],
          TileMode.clamp,
          (Matrix4.identity()
                ..translateByDouble(660.0, 525.0, 0.0, 1.0)
                ..scaleByDouble(510.0, 240.0, 1.0, 1.0))
              .storage,
        ),
    );
    c.drawOval(
      Rect.fromCenter(center: const Offset(660, 815), width: 760, height: 155),
      Paint()
        ..shader = ui.Gradient.radial(
          Offset.zero,
          1.0,
          [
            const Color(0xFF101319).withValues(alpha: 0.26),
            const Color(0xFF12151B).withValues(alpha: 0.0),
          ],
          const [0.0, 1.0],
          TileMode.clamp,
          (Matrix4.identity()
                ..translateByDouble(660.0, 815.0, 0.0, 1.0)
                ..scaleByDouble(380.0, 77.5, 1.0, 1.0))
              .storage,
        ),
    );
  }

  void _drawTopTypebars(Canvas c) {
    final fullBar = cache.barImage;
    final shortBar = cache.barShortImage;

    for (int i = 0; i < KeyboardMetrics.slotCount; i++) {
      final cx = KeyboardMetrics.slotStartX + i * KeyboardMetrics.slotPitch;
      final bp = physics.bars[i]!;
      final p = math.max(0.0, bp.p);
      final cam = math.max(0.0, bp.cam);
      final kick = (p * 0.80 + cam * 0.28).clamp(0.0, 1.30);
      final dy = p * 23.0 + cam * 4.5 + bp.tremor * 1.15;
      final dx = -p * 1.3 - cam * 0.4;
      final barTop = KeyboardMetrics.slotY + 2.5 + dy;
      final endY = _slotEndY[i] + p * 10.0 + cam * 3.0;

      final isShort = _slotEndY[i] < 550.0;
      final img = isShort ? shortBar : fullBar;
      final bounds = isShort ? cache.barShortBounds : cache.barBounds;

      if (img != null) {
        final dst = bounds.shift(Offset(cx + dx, barTop));
        c.save();
        c.clipRect(Rect.fromLTRB(
          cx - 28.0,
          KeyboardMetrics.slotY + 1.0,
          cx + 30.0,
          endY,
        ));
        c.drawImageRect(
          img,
          Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
          dst,
          _imgPaint,
        );
        c.restore();

        if (kick > 0.025) {
          final slotBotLimit = KeyboardMetrics.slotY + KeyboardMetrics.slotH - 4.0;
          final pitBottom = math.min(barTop + 5.0, slotBotLimit);
          if (pitBottom > KeyboardMetrics.slotY + 2.0) {
            final pitAlpha = (kick * 0.98).clamp(0.0, 0.98);
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTRB(cx - 10.2, KeyboardMetrics.slotY + 1.5, cx + 10.2, pitBottom),
                const Radius.circular(5.0),
              ),
              Paint()..color = const Color(0xFF020306).withValues(alpha: pitAlpha),
            );

            // Fixed upper cross-pivot pin anchored in the CNC slot cheeks
            final forkAlpha = (kick * 2.5).clamp(0.0, 1.0);
            final pinY = KeyboardMetrics.slotY + 7.2;
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromCenter(center: Offset(cx, pinY), width: 17.0, height: 4.2),
                const Radius.circular(2.1),
              ),
              Paint()
                ..shader = ui.Gradient.linear(
                  Offset(0, pinY - 2.1),
                  Offset(0, pinY + 2.1),
                  [
                    const Color(0xFF282B33).withValues(alpha: forkAlpha),
                    const Color(0xFFECEFF8).withValues(alpha: forkAlpha),
                    const Color(0xFF24272F).withValues(alpha: forkAlpha),
                  ],
                  const [0.0, 0.42, 1.0],
                ),
            );

            // Articulated 3D Curved Typebar Striker Hood + Twin Fork Rails swinging forward out of slot
            final yokeTop = KeyboardMetrics.slotY + 5.2;
            final railBottom = (pitBottom + 3.0).clamp(yokeTop + 6.0, slotBotLimit + 1.0);
            final hoodH = math.min(7.5, (railBottom - yokeTop) * 0.42);
            final specPos = (0.28 + kick * 0.34).clamp(0.18, 0.78);
            final railShader = ui.Gradient.linear(
              Offset(cx - 8.2, 0),
              Offset(cx + 8.2, 0),
              [
                const Color(0xFF20232B).withValues(alpha: forkAlpha * 0.96),
                const Color(0xFFE6EAF4).withValues(alpha: forkAlpha),
                const Color(0xFF8B919F).withValues(alpha: forkAlpha * 0.96),
                const Color(0xFF1F2229).withValues(alpha: forkAlpha * 0.96),
              ],
              const [0.0, 0.34, 0.68, 1.0],
            );

            // Left & right gleaming striker fork rails
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTRB(cx - 7.8, yokeTop, cx - 3.6, railBottom),
                const Radius.circular(2.0),
              ),
              Paint()..shader = railShader,
            );
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTRB(cx + 3.6, yokeTop, cx + 7.8, railBottom),
                const Radius.circular(2.0),
              ),
              Paint()..shader = railShader,
            );
            // Swept arched striker shoulder with live specular sweep
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTRB(cx - 7.8, yokeTop, cx + 7.8, yokeTop + hoodH),
                const Radius.circular(3.2),
              ),
              Paint()
                ..shader = ui.Gradient.linear(
                  Offset(0, yokeTop),
                  Offset(0, yokeTop + hoodH),
                  [
                    const Color(0xFF3E424C).withValues(alpha: forkAlpha),
                    const Color(0xFFFFFFFF).withValues(alpha: forkAlpha),
                    const Color(0xFF5A5F6B).withValues(alpha: forkAlpha),
                  ],
                  [0.0, specPos, 1.0],
                ),
            );
            // Pitch-black hollow cam throat between rails
            c.drawRRect(
              RRect.fromRectAndRadius(
                Rect.fromLTRB(cx - 3.3, yokeTop + hoodH - 0.5, cx + 3.3, railBottom - 1.0),
                const Radius.circular(1.4),
              ),
              Paint()..color = const Color(0xFF040508).withValues(alpha: forkAlpha * 0.96),
            );
          }

          // Dynamic darkening + downward cast shadow on the recessed elbow
          c.drawRRect(
            RRect.fromRectAndRadius(
              Rect.fromLTWH(cx + dx - 11.2, barTop - 1.0, 15.2, 26.0),
              const Radius.circular(6.0),
            ),
            Paint()..color = const Color(0xFF080A0E).withValues(alpha: (p * 0.44).clamp(0.0, 0.48)),
          );
        }
      }
    }
  }

  /// Renders a chamfered steel rod/beam with 3-layer directional deck cast shadow (zero MaskFilter.blur).
  void _drawCastRod(
    Canvas c,
    Offset a,
    Offset b,
    double width, {
    double dim = 0.0,
    bool stemTone = false,
    double topAoAlpha = 0.0,
    double radiusFactor = 0.38,
  }) {
    final delta = b - a;
    final len = delta.distance;
    if (len < 1.0) return;

    final angle = math.atan2(delta.dy, delta.dx) - math.pi * 0.5;
    final rx = width * radiusFactor;

    c.save();
    c.translate(a.dx, a.dy);
    c.rotate(angle);

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(-width * 0.5, 0, width, len),
      Radius.circular(rx),
    );
    c.drawRRect(rrect.shift(const Offset(5.5, 9.5)), _fastSoftShadow1);
    c.drawRRect(rrect.shift(const Offset(3.2, 5.5)), _fastSoftShadow2);
    c.drawRRect(rrect.shift(const Offset(1.3, 2.2)), _fastSoftShadow3);

    c.scale(width / 14.0, 1.0);
    final unitRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(-7.0, 0, 14.0, len),
      Radius.circular(rx),
    );
    c.drawRRect(unitRRect, Paint()..shader = stemTone ? _stemShader : _rodShader);

    if (!stemTone && len > 6.0) {
      c.drawLine(
        const Offset(-3.2, 2.0),
        Offset(-3.2, math.max(2.0, len - 2.0)),
        Paint()
          ..color = const Color(0x38D8DCE6)
          ..strokeWidth = 0.95
          ..strokeCap = StrokeCap.round,
      );
    }

    if (topAoAlpha > 0.01) {
      c.drawRRect(
        unitRRect,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, 0),
            Offset(0, math.min(len, 42.0)),
            [
              const Color(0xFF0E1015).withValues(alpha: topAoAlpha),
              const Color(0xFF0E1015).withValues(alpha: 0.0),
            ],
          ),
      );
    }
    if (dim > 0.005) {
      c.drawRRect(
        unitRRect,
        Paint()..color = const Color(0xFF101217).withValues(alpha: (dim * 0.36).clamp(0.0, 0.8)),
      );
    }
    c.restore();
  }

  void _drawSpriteCentered(
    Canvas c,
    ui.Image? img,
    Rect bounds,
    double cx,
    double cy, {
    double scaleX = 1.0,
    double scaleY = 1.0,
  }) {
    if (img == null) return;
    final src = Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble());
    if (scaleX == 1.0 && scaleY == 1.0) {
      c.drawImageRect(img, src, bounds.shift(Offset(cx, cy)), _imgPaint);
      return;
    }
    c.save();
    c.translate(cx, cy);
    c.scale(scaleX, scaleY);
    c.drawImageRect(img, src, bounds, _imgPaint);
    c.restore();
  }

  /// Triple-ring horizontal clevis pivot axle with live rotary highlight rotation on actuation.
  void _drawClevisAxle(Canvas c, double cx, double cy, {double scaleX = 1.0, double rotPhase = 0.0}) {
    final img = cache.clevisAxleImage;
    if (img != null) {
      _drawSpriteCentered(c, img, cache.clevisAxleBounds, cx, cy, scaleX: scaleX);
      if (rotPhase > 0.02) {
        final hy = cy - 4.0 + (rotPhase.clamp(0.0, 1.2) * 5.2);
        c.drawLine(
          Offset(cx - 14.0 * scaleX, hy),
          Offset(cx + 14.0 * scaleX, hy),
          Paint()
            ..color = const Color(0xFFEFF3FC).withValues(alpha: (rotPhase * 0.72).clamp(0.0, 0.78))
            ..strokeWidth = 1.6
            ..strokeCap = StrokeCap.round,
        );
      }
      return;
    }
    _drawDualEarClevisBarrel(c, cx - 12.0 * scaleX, cy - 12.0, 24.0 * scaleX, 24.0);
  }

  void _drawDualEarClevisBarrel(Canvas c, double x, double y, double w, double h) {
    c.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(x + 4.0, y + 6.5, w, h), const Radius.circular(5.5)),
      _fastSoftShadow1,
    );
    c.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(x + 1.4, y + 2.2, w, h), const Radius.circular(5.5)),
      _fastSoftShadow3,
    );
    final earW = (w - 3.5) * 0.5;
    for (final ex in [x, x + earW + 3.5]) {
      c.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(ex, y, earW, h), const Radius.circular(4.0)),
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(ex, 0),
            Offset(ex + earW, 0),
            const [
              Color(0xFF1A1D24),
              Color(0xFFB8BDC8),
              Color(0xFFF6F8FD),
              Color(0xFF5A5E68),
              Color(0xFF181B22),
            ],
            const [0.0, 0.22, 0.42, 0.76, 1.0],
          ),
      );
    }
    c.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(x + earW - 0.5, y + 4.0, 4.5, h - 8.0), const Radius.circular(2.0)),
      Paint()..color = const Color(0xFF1A1C22),
    );
  }

  /// Left Shift column (cut_left_shift.png): Q rail, A -> Shift bolted U-blocks & T-foot,
  /// W->S->Emoji 3-link multi-axle chain, and Z vertical dumbbell H-strut.
  void _drawLeftShiftColumn(Canvas c) {
    final pQ = math.max(0.0, physics.keys['r1_0']?.p ?? 0.0);
    final pW = math.max(0.0, physics.keys['r1_1']?.p ?? 0.0);
    final pA = math.max(0.0, physics.keys['r2_0']?.p ?? 0.0);
    final pShift = math.max(0.0, physics.keys['shift']?.p ?? 0.0);
    final pZ = math.max(0.0, physics.keys['r3_0']?.p ?? 0.0);
    final l0p = math.max(0.0, physics.bars['L0']?.p ?? 0.0);
    final l1p = math.max(0.0, physics.bars['L1']?.p ?? 0.0);

    // Q stem -> triple-ring clevis axle -> outer left vertical rail (x=73)
    final qAxleY = 482.0 + pQ * 17.5;
    _drawCastRod(c, Offset(88.0, 392.0 + pQ * 15.0), Offset(88.0, qAxleY), 10.5, dim: pQ * 0.25);
    _drawCastRod(c, Offset(73.0 - l0p * 1.4, qAxleY), Offset(73.0, 772.0 + l0p * 15.0), 11.5, dim: l0p * 0.35);
    _drawClevisAxle(c, 82.0, qAxleY, rotPhase: math.max(pQ, l0p));

    // A -> Shift upper bolted U-block -> stabilizer flange shelf -> lower bolted block -> T-foot
    final aDrop = pA * 17.5;
    final shDrop = pShift * 18.5;
    _drawCastRod(
      c,
      Offset(152.0, 526.0 + aDrop * 0.8),
      Offset(168.0 - pA * 2.2, 616.0 + aDrop),
      10.5,
      dim: pA * 0.30,
    );
    _drawClevisAxle(c, 168.0 - pA * 2.2, 616.0 + aDrop, scaleX: 0.75, rotPhase: math.max(pA, pShift));

    // Shift vertical plunger column + upper/lower stamped bolted U-channel slider blocks
    _drawCastRod(c, Offset(146.0, 626.0 + shDrop), Offset(146.0, 756.0 + shDrop * 0.92), 11.0, dim: pShift * 0.30);
    _drawSpriteCentered(c, cache.sliderBlockImage, cache.sliderBlockBounds, 146.0, 598.0 + shDrop);
    // Horizontal stabilizer flange shelf between upper & lower slider blocks
    _drawCastRod(c, Offset(122.0, 650.0 + shDrop), Offset(170.0, 650.0 + shDrop), 7.5, dim: pShift * 0.20);
    _drawSpriteCentered(c, cache.sliderBlockImage, cache.sliderBlockBounds, 146.0, 706.0 + shDrop);
    // Bottom T-foot anvil
    _drawCastRod(c, Offset(122.0, 758.0 + shDrop * 0.92), Offset(170.0, 758.0 + shDrop * 0.92), 8.5, dim: pShift * 0.20);

    // W -> S -> Emoji 3-link articulated multi-axle chain (x=215)
    final wAxleY = 514.0 + pW * 17.5;
    final sAxleY = 598.0 + l1p * 16.5;
    final botAxleY = 752.0 + l1p * 13.0;
    _drawCastRod(c, Offset(215.0, 392.0 + pW * 14.0), Offset(215.0 + pW * 1.6, wAxleY), 10.5, dim: pW * 0.28);
    _drawCastRod(c, Offset(215.0 + pW * 1.6, wAxleY), Offset(215.0, sAxleY), 11.0, dim: l1p * 0.28, stemTone: true);
    _drawCastRod(c, Offset(215.0, sAxleY), Offset(215.0, botAxleY), 10.5, dim: l1p * 0.30);
    _drawClevisAxle(c, 215.0 + pW * 1.6, wAxleY, scaleX: 0.85, rotPhase: math.max(pW, l1p));
    _drawClevisAxle(c, 215.0, sAxleY, scaleX: 0.85, rotPhase: l1p);
    _drawClevisAxle(c, 215.0, botAxleY, scaleX: 0.80, rotPhase: l1p);

    // Z sculpted hourglass T-flange strut + spherical steel ball-joint (cut_left_shift.png)
    final zDrop = pZ * 15.0;
    final zTopY = 702.0 + zDrop;
    final zBotY = 760.0 + zDrop * 0.85;
    final zMidY = (zTopY + zBotY) * 0.5;
    _drawCastRod(c, Offset(278.0, 670.0 + zDrop), Offset(278.0, zTopY), 9.0, dim: pZ * 0.22);
    _drawHourglassStrut(c, 278.0, zTopY, zBotY);
    _drawCastRod(c, Offset(254.0, zTopY), Offset(302.0, zTopY), 7.5, dim: pZ * 0.20);
    // Spherical steel ball-joint boss (Ø17u specular bead)
    c.drawCircle(Offset(278.0 + 2.5, zMidY + 4.0), 9.2, _fastSoftShadow2);
    c.drawCircle(
      Offset(278.0, zMidY),
      8.6,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset(275.2, zMidY - 2.8),
          11.0,
          const [Color(0xFFE4E8F2), Color(0xFF686E7B), Color(0xFF1D2027)],
          const [0.0, 0.52, 1.0],
        ),
    );
    _drawCastRod(c, Offset(254.0, zBotY), Offset(302.0, zBotY), 8.0, dim: pZ * 0.20);
  }

  void _drawHourglassStrut(Canvas c, double cx, double topY, double botY) {
    final p = Path()
      ..moveTo(cx - 8.5, topY)
      ..cubicTo(cx - 8.5, topY + 12.0, cx - 4.2, (topY + botY) * 0.5 - 8.0, cx - 4.2, (topY + botY) * 0.5)
      ..cubicTo(cx - 4.2, (topY + botY) * 0.5 + 8.0, cx - 8.5, botY - 12.0, cx - 8.5, botY)
      ..lineTo(cx + 8.5, botY)
      ..cubicTo(cx + 8.5, botY - 12.0, cx + 4.2, (topY + botY) * 0.5 + 8.0, cx + 4.2, (topY + botY) * 0.5)
      ..cubicTo(cx + 4.2, (topY + botY) * 0.5 - 8.0, cx + 8.5, topY + 12.0, cx + 8.5, topY)
      ..close();
    c.drawPath(p.shift(const Offset(3.5, 6.0)), _fastSoftShadow1);
    c.drawPath(p.shift(const Offset(1.4, 2.5)), _fastSoftShadow3);
    c.drawPath(
      p,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(cx - 8.5, 0),
          Offset(cx + 8.5, 0),
          const [
            Color(0xFF1A1C22),
            Color(0xFF949AA8),
            Color(0xFF565B66),
            Color(0xFF20232A),
          ],
          const [0.0, 0.30, 0.65, 1.0],
        ),
    );
  }

  /// Right Return column (cut_right_return.png): P roller stem, L -> Backspace slider block,
  /// O multi-axle chain, and Return continuous oval tubular cradle + central T-anvil.
  void _drawRightReturnColumn(Canvas c) {
    final pP = math.max(0.0, physics.keys['r1_9']?.p ?? 0.0);
    final pO = math.max(0.0, physics.keys['r1_8']?.p ?? 0.0);
    final pL = math.max(0.0, physics.keys['r2_8']?.p ?? 0.0);
    final pBksp = math.max(0.0, physics.keys['backspace']?.p ?? 0.0);
    final pRet = math.max(0.0, physics.keys['return']?.p ?? 0.0);
    final r1p = math.max(0.0, physics.bars['R1']?.p ?? 0.0);

    // P independent clevis roller stem
    final pAxleY = 482.0 + pP * 17.5;
    _drawCastRod(c, Offset(1233.0, 392.0 + pP * 15.0), Offset(1233.0, pAxleY), 10.5, dim: pP * 0.28);
    _drawClevisAxle(c, 1233.0, pAxleY, scaleX: 0.85, rotPhase: pP);

    // O 3-link multi-axle chain straight into Return cradle left T-anvil shoulder
    final oAxle1 = 514.0 + pO * 17.5;
    final oAxle2 = 598.0 + r1p * 16.5;
    final retDrop = pRet * 15.5;
    _drawCastRod(c, Offset(1106.0, 392.0 + pO * 14.0), Offset(1106.0 - pO * 1.6, oAxle1), 10.5, dim: pO * 0.28);
    _drawCastRod(c, Offset(1106.0 - pO * 1.6, oAxle1), Offset(1106.0, oAxle2), 11.0, dim: r1p * 0.28, stemTone: true);
    _drawCastRod(c, Offset(1106.0, oAxle2), Offset(1108.0, 796.0 + retDrop), 10.5, dim: r1p * 0.28);
    _drawClevisAxle(c, 1106.0 - pO * 1.6, oAxle1, scaleX: 0.85, rotPhase: math.max(pO, r1p));
    _drawClevisAxle(c, 1106.0, oAxle2, scaleX: 0.85, rotPhase: r1p);

    // L -> Backspace bolted U-channel slider block -> stabilizer shelf -> Return cradle right bridge
    final lDrop = pL * 17.5;
    final bkDrop = pBksp * 18.5;
    _drawCastRod(c, Offset(1168.0, 526.0 + lDrop * 0.8), Offset(1152.0 + pL * 2.2, 616.0 + lDrop), 10.5, dim: pL * 0.30);
    _drawClevisAxle(c, 1152.0 + pL * 2.2, 616.0 + lDrop, scaleX: 0.75, rotPhase: math.max(pL, pBksp));
    _drawCastRod(c, Offset(1174.0, 626.0 + bkDrop), Offset(1174.0, 788.0 + retDrop), 10.5, dim: pBksp * 0.28);
    _drawSpriteCentered(c, cache.sliderBlockImage, cache.sliderBlockBounds, 1174.0, 600.0 + bkDrop);
    _drawCastRod(c, Offset(1152.0, 652.0 + bkDrop), Offset(1196.0, 652.0 + bkDrop), 7.5, dim: pBksp * 0.20);

    // Return continuous oval tubular cradle + central T-anvil
    if (cache.returnCradleImage != null) {
      _drawSpriteCentered(
        c,
        cache.returnCradleImage,
        cache.returnCradleBounds,
        1136.0,
        804.0 + retDrop,
        scaleY: 1.0 - pRet * 0.04,
      );
    } else {
      final rRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(1136.0, 804.0 + retDrop), width: 266.0, height: 112.0),
        const Radius.circular(56.0),
      );
      c.drawRRect(rRect.shift(const Offset(4.0, 7.0)), _fastSoftShadow2);
      c.drawRRect(
        rRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 10.0
          ..color = const Color(0xFF4C515C),
      );
    }
  }

  /// Renders center vertical key stems, paired yoke clevis axles, and all round-key gimbal C-rings & plunger discs.
  void _drawCenterMatrixAndGimbals(Canvas c) {
    // 1. Center Row 1 & Row 2 stems + paired yoke clevis axles (cut_center_rings.png)
    for (final def in kKeyDefs) {
      if (def.pill || def.special == KeySpecial.emoji) continue;
      // Outer columns handled specifically by _drawLeftShiftColumn & _drawRightReturnColumn
      if (def.id == 'r1_0' ||
          def.id == 'r1_1' ||
          def.id == 'r1_8' ||
          def.id == 'r1_9' ||
          def.id == 'r2_0' ||
          def.id == 'r2_8' ||
          def.id == 'r3_0') {
        continue;
      }
      final stem = def.stem;
      if (stem == null) continue;
      final p = math.max(0.0, physics.keys[def.id]?.p ?? 0.0);
      final tremorY = physics.rowTremor[def.row.clamp(0, 3)] * 0.8;
      final startY = def.y + 24.0 + p * 12.0 + tremorY;
      // Extend Row 1 center stems neatly to their axle (y=488) or behind Spacebar bridge (y=756)
      final targetLen = def.row == 0
          ? (def.col == 2 || def.col == 4 || def.col == 6 || def.col == 7 ? 98.0 : 100.0)
          : (def.row == 1 ? 94.0 : 88.0);
      final endY = startY + targetLen - p * 4.0;

      _drawCastRod(
        c,
        Offset(stem.x, startY),
        Offset(stem.x, endY),
        9.8,
        dim: 0.14 + p * 0.35,
        stemTone: def.row == 1,
        topAoAlpha: 0.36,
      );
    }

    // Horizontal triple-ring clevis pivot axles on Row 1 paired yokes (E, R, T, Y, U, I)
    const row1Axles = [
      ('r1_2', 342.0, 1.0),
      ('r1_3', 469.0, 0.85),
      ('r1_4', 602.0, 1.0),
      ('r1_5', 724.0, 0.85),
      ('r1_6', 849.0, 1.0),
      ('r1_7', 972.0, 1.0),
    ];
    for (final ax in row1Axles) {
      final p = math.max(0.0, physics.keys[ax.$1]?.p ?? 0.0);
      _drawClevisAxle(
        c,
        ax.$2,
        488.0 + p * 17.5 + physics.rowTremor[0] * 0.7,
        scaleX: ax.$3,
        rotPhase: p,
      );
    }

    // 2. All 27 round-key Gimbal Split C-Ring Cradles + Beveled Plunger Anvil Discs + Forked Stem Tongues
    for (final def in kKeyDefs) {
      if (def.pill) continue;
      // In stripped blueprint mode, media_1795782892670_4a14921d.jpg omits Emoji ring (Z H-strut sits above)
      if (mechanismView == MechanismView.blueprint && def.special == KeySpecial.emoji) {
        continue;
      }
      final p = math.max(0.0, physics.keys[def.id]?.p ?? 0.0);
      final tremor = physics.rowTremor[def.row.clamp(0, 3)];
      final cx = def.x;
      final ringY = def.y + p * 6.5 + tremor * 0.7;
      final anvilY = def.y + p * 16.5 + tremor * 1.1;
      final ringScaleX = 1.0 + p * 0.055;
      final ringScaleY = 1.0 - p * 0.10;

      final wideScaleX = _wideGimbalScaleX[def.id];
      if (wideScaleX != null && cache.gimbalWideWrapImage != null) {
        _drawSpriteCentered(
          c,
          cache.gimbalWideWrapImage,
          cache.gimbalWideWrapBounds,
          cx,
          ringY,
          scaleX: wideScaleX * ringScaleX,
          scaleY: ringScaleY,
        );
      } else if (cache.gimbalTopBottomImage != null) {
        _drawSpriteCentered(
          c,
          cache.gimbalTopBottomImage,
          cache.gimbalTopBottomBounds,
          cx,
          ringY,
          scaleX: ringScaleX,
          scaleY: ringScaleY,
        );
      } else {
        // Fallback crisp chamfered arcs
        final arcPaint = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 5.5
          ..strokeCap = StrokeCap.round
          ..color = const Color(0xFF4F5460);
        final rect = Rect.fromCenter(center: Offset(cx, ringY), width: 88.0 * ringScaleX, height: 88.0 * ringScaleY);
        c.drawArc(rect, -math.pi * 0.80, math.pi * 0.60, false, arcPaint);
        c.drawArc(rect, math.pi * 0.20, math.pi * 0.60, false, arcPaint);
      }

      if (cache.plungerAnvilImage != null) {
        _drawSpriteCentered(
          c,
          cache.plungerAnvilImage,
          cache.plungerAnvilBounds,
          cx,
          anvilY,
          scaleX: 1.0 - p * 0.025,
          scaleY: 1.0 - p * 0.025,
        );
      } else {
        c.drawCircle(
          Offset(cx + 2.0, anvilY + 4.0),
          20.0,
          _fastSoftShadow2,
        );
        c.drawCircle(
          Offset(cx, anvilY),
          20.0,
          Paint()..color = const Color(0xFF4C515C),
        );
      }
    }
  }

  /// Spacebar Torsion & Twin-Spring Crown Jewel (cut_spacebar_torsion.png):
  /// Horizontal upper bridge beam, twin 12-turn cylindrical helical coil springs with wire hook tails,
  /// bolted protruding L-flange ears, continuous horizontal beveled stabilizer crossbar,
  /// twin 5-wrap torsion coil hubs, and 4 slotted bellcrank bottom feet.
  void _drawSpacebarMechanics(Canvas c) {
    final p = math.max(0.0, physics.bars['SPACE']?.p ?? 0.0);
    final springP = physics.spaceSpringStretch.clamp(-0.25, 1.40);
    final torsionP = physics.spaceTorsionTwist.clamp(-0.25, 1.40);
    final crossbarY = 868.0 + p * 14.5;

    if (mechanismView == MechanismView.classic) {
      // Classic Mode: cast 3-knuckle riveted Spacebar brackets + chunky 5-turn silver coils on press +
      // 4 slotted feet behind crossbar + horizontal stabilizer crossbar + twin 5-wrap torsion hubs.
      if (p > 0.015) {
        final alpha = math.min(1.0, (p - 0.015) / 0.14);
        final spaceTopY = 747.0 + p * 21.0;
        _drawClassicSpacebarSprings(c, spaceTopY, springP, alpha);
      }

      final bracketDrop = p * 8.5;
      final leftImg = cache.bracketLeftImage;
      if (leftImg != null) {
        c.drawImageRect(
          leftImg,
          Rect.fromLTWH(0, 0, leftImg.width.toDouble(), leftImg.height.toDouble()),
          cache.bracketLeftBounds.shift(Offset(418.0, 855.0 + bracketDrop)),
          _imgPaint,
        );
      }
      final rightImg = cache.bracketRightImage;
      if (rightImg != null) {
        c.drawImageRect(
          rightImg,
          Rect.fromLTWH(0, 0, rightImg.width.toDouble(), rightImg.height.toDouble()),
          cache.bracketRightBounds.shift(Offset(808.0, 855.0 + bracketDrop)),
          _imgPaint,
        );
      }

      // Draw 4 bottom bellcrank feet strictly BEHIND horizontal crossbar & torsion hubs
      _drawSpacebarBottomFeet(c, crossbarY + 2.5, clipTopY: crossbarY - 1.0);
      _drawHorizontalStabilizerCrossbar(c, 444.0, 868.0, crossbarY, torsionP);
      _drawTorsionCoilHub(c, 454.0, crossbarY, torsionP);
      _drawTorsionCoilHub(c, 858.0, crossbarY, torsionP);
      return;
    }

    // Crystal & Blueprint Modes: full exposed twin 12-turn torsion assembly
    // 1. Horizontal upper anvil bridge beam (x=488..824) — plunges 17.5*p with Spacebar
    final bridgeY = 772.0 + p * 17.5;
    _drawCastRod(c, Offset(488.0, bridgeY), Offset(824.0, bridgeY), 10.5, dim: p * 0.25);

    // 2. Twin fine-pitch 12-turn helical coil springs (x=454, 858) stretching cleanly downward (+20*p)
    const springTopY = 708.0;
    final springBotY = 804.0 + springP * 20.0;
    for (final sx in const [454.0, 858.0]) {
      _drawTwelveTurnCoilSpring(c, sx, springTopY, springBotY, crossbarY, springP);
    }

    // 3. Left & right protruding bolted L-flange ears rocking down (+13.5*p)
    final earY = 785.0 + p * 13.5;
    if (cache.spaceEarLeftImage != null) {
      _drawSpriteCentered(c, cache.spaceEarLeftImage, cache.spaceEarLeftBounds, 364.0, earY);
    } else {
      _drawFallbackSpaceEar(c, 364.0, earY, isLeft: true);
    }
    if (cache.spaceEarRightImage != null) {
      _drawSpriteCentered(c, cache.spaceEarRightImage, cache.spaceEarRightBounds, 956.0, earY);
    } else {
      _drawFallbackSpaceEar(c, 956.0, earY, isLeft: false);
    }

    // 4. 4 Slotted bellcrank bottom feet drawn strictly BEHIND crossbar & torsion hubs (+14.5*p)
    _drawSpacebarBottomFeet(c, crossbarY + 2.5, clipTopY: crossbarY - 1.0);

    // 5. Continuous horizontal beveled stabilizer crossbar rocking down (+14.5*p)
    _drawHorizontalStabilizerCrossbar(c, 444.0, 868.0, crossbarY, torsionP);

    // 6. Twin 5-wrap angled torsion coil hubs twisting dynamically with torsionP
    _drawTorsionCoilHub(c, 454.0, crossbarY, torsionP);
    _drawTorsionCoilHub(c, 858.0, crossbarY, torsionP);
  }

  void _drawSpacebarBottomFeet(Canvas c, double loopY, {required double clipTopY}) {
    final armImg = cache.stabilizerArmImage;
    final shortArmImg = cache.stabilizerShortArmImage ?? armImg;
    if (armImg == null) return;
    final srcLong = Rect.fromLTWH(0, 0, armImg.width.toDouble(), armImg.height.toDouble());
    c.save();
    c.clipRect(Rect.fromLTRB(360.0, clipTopY, 960.0, 1040.0));
    c.drawImageRect(armImg, srcLong, cache.stabilizerArmBounds.shift(Offset(402.0, loopY)), _imgPaint);
    if (shortArmImg != null) {
      final srcShort = Rect.fromLTWH(0, 0, shortArmImg.width.toDouble(), shortArmImg.height.toDouble());
      final shortBounds = cache.stabilizerShortArmImage != null
          ? cache.stabilizerShortArmBounds
          : Rect.fromLTWH(
              cache.stabilizerArmBounds.left,
              cache.stabilizerArmBounds.top,
              cache.stabilizerArmBounds.width,
              cache.stabilizerArmBounds.height * 0.86,
            );
      c.drawImageRect(shortArmImg, srcShort, shortBounds.shift(Offset(526.0, loopY)), _imgPaint);
    }
    c.drawImageRect(armImg, srcLong, cache.stabilizerArmBounds.shift(Offset(786.0, loopY)), _imgPaint);
    c.drawImageRect(armImg, srcLong, cache.stabilizerArmBounds.shift(Offset(902.0, loopY)), _imgPaint);
    c.restore();
  }

  void _drawClassicSpacebarSprings(Canvas c, double spaceTopY, double p, double alpha) {
    final baseY = 725.0 + p * 4.0;
    final coilPitch = 6.8 - p * 1.1;
    const coilRadius = 11.8;
    const turns = 5;

    final backPaint = Paint()
      ..color = const Color(0xFF282B33).withValues(alpha: alpha * 0.92)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    final shadowPaint = Paint()
      ..color = const Color(0xFF0E1015).withValues(alpha: alpha * 0.34)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.4
      ..strokeCap = StrokeCap.round;
    final bodyDarkPaint = Paint()
      ..color = const Color(0xFF3E424B).withValues(alpha: alpha)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.6
      ..strokeCap = StrokeCap.round;
    final bodyMidPaint = Paint()
      ..color = const Color(0xFF9398A6).withValues(alpha: alpha)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    for (final sx in const [463.6, 846.8]) {
      c.save();
      c.clipRect(Rect.fromLTRB(sx - 20.0, 718.0, sx + 20.0, spaceTopY + 3.0));
      c.drawRect(
        Rect.fromLTWH(sx - 14.0, 720.0, 28.0, 46.0),
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, 720.0),
            const Offset(0, 766.0),
            [
              const Color(0xFF0E1016).withValues(alpha: 0.62 * alpha),
              const Color(0xFF14161C).withValues(alpha: 0.18 * alpha),
            ],
          ),
      );
      final backPath = Path();
      for (int k = 0; k < turns; k++) {
        final y0 = baseY + k * coilPitch;
        final yMid = y0 + coilPitch * 0.50;
        backPath.moveTo(sx + coilRadius, yMid);
        backPath.cubicTo(
          sx + coilRadius * 0.4, yMid - coilPitch * 0.25,
          sx - coilRadius * 0.4, y0 - coilPitch * 0.05,
          sx - coilRadius, y0,
        );
      }
      c.drawPath(backPath, backPaint);
      c.drawRect(
        Rect.fromLTWH(sx - 2.6, 720.0, 5.2, 48.0),
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(sx - 2.6, 0),
            Offset(sx + 2.6, 0),
            [
              const Color(0xFF20232A).withValues(alpha: alpha),
              const Color(0xFF9EA3B0).withValues(alpha: alpha),
              const Color(0xFF24272E).withValues(alpha: alpha),
            ],
            const [0.0, 0.38, 1.0],
          ),
      );
      final frontPath = Path();
      for (int k = 0; k < turns; k++) {
        final y0 = baseY + k * coilPitch;
        final yMid = y0 + coilPitch * 0.50;
        final yNext = y0 + coilPitch;
        frontPath.moveTo(sx - coilRadius, yMid * 0.35 + y0 * 0.65);
        frontPath.cubicTo(
          sx - coilRadius * 0.35, yMid + coilPitch * 0.22,
          sx + coilRadius * 0.35, yNext - coilPitch * 0.04,
          sx + coilRadius, yMid,
        );
      }
      final crestPaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round
        ..shader = ui.Gradient.linear(
          Offset(sx - coilRadius, 0),
          Offset(sx + coilRadius, 0),
          [
            const Color(0xFF9EA4B2).withValues(alpha: alpha * 0.85),
            const Color(0xFFFFFFFF).withValues(alpha: alpha),
            const Color(0xFFC8CEDB).withValues(alpha: alpha * 0.92),
            const Color(0xFF565B66).withValues(alpha: alpha * 0.82),
          ],
          const [0.0, 0.34, 0.66, 1.0],
        );
      c.drawPath(frontPath.shift(const Offset(2.2, 2.6)), shadowPaint);
      c.drawPath(frontPath, bodyDarkPaint);
      c.drawPath(frontPath.shift(const Offset(0.0, -0.25)), bodyMidPaint);
      c.drawPath(frontPath.shift(const Offset(-0.2, -0.60)), crestPaint);
      c.restore();
    }
  }

  void _drawTwelveTurnCoilSpring(
    Canvas c,
    double sx,
    double topY,
    double botY,
    double hubY,
    double springP, {
    int turns = 12,
  }) {
    const coilRadius = 8.4; // Fine tempered steel wire pitch matching cut_spacebar_torsion.png (~16.8u OD)
    final span = math.max(24.0, botY - topY);
    final pitch = span / turns;

    // Straight lower wire hook tail extending down cleanly into torsion hub
    final wirePaint = Paint()
      ..color = const Color(0xFF3E424C)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..strokeCap = StrokeCap.round;
    final wireHighlight = Paint()
      ..color = const Color(0xFFCFD4E0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..strokeCap = StrokeCap.round;
    c.drawLine(Offset(sx + 1.5, botY + 2.0), Offset(sx + 1.5, hubY + 2.0), _fastSoftShadow2);
    c.drawLine(Offset(sx, botY - 1.0), Offset(sx, hubY), wirePaint);
    c.drawLine(Offset(sx - 0.5, botY - 1.0), Offset(sx - 0.5, hubY), wireHighlight);

    // Back half-turns
    final backPath = Path();
    for (int k = 0; k < turns; k++) {
      final y0 = topY + k * pitch;
      final yMid = y0 + pitch * 0.50;
      backPath.moveTo(sx + coilRadius, yMid);
      backPath.cubicTo(
        sx + coilRadius * 0.4,
        yMid - pitch * 0.25,
        sx - coilRadius * 0.4,
        y0 - pitch * 0.05,
        sx - coilRadius,
        y0,
      );
    }
    c.drawPath(
      backPath,
      Paint()
        ..color = const Color(0xFF1F2229)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.3
        ..strokeCap = StrokeCap.round,
    );

    // Front half-turns with cast shadow & fine tempered steel crest
    final frontPath = Path();
    for (int k = 0; k < turns; k++) {
      final y0 = topY + k * pitch;
      final yMid = y0 + pitch * 0.50;
      final yNext = y0 + pitch;
      frontPath.moveTo(sx - coilRadius, yMid * 0.35 + y0 * 0.65);
      frontPath.cubicTo(
        sx - coilRadius * 0.35,
        yMid + pitch * 0.22,
        sx + coilRadius * 0.35,
        yNext - pitch * 0.04,
        sx + coilRadius,
        yMid,
      );
    }
    c.drawPath(
      frontPath.shift(const Offset(1.8, 2.5)),
      Paint()
        ..color = const Color(0x280A0C10)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.2
        ..strokeCap = StrokeCap.round,
    );
    c.drawPath(
      frontPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..shader = ui.Gradient.linear(
          Offset(sx - coilRadius, 0),
          Offset(sx + coilRadius, 0),
          const [
            Color(0xFF343842),
            Color(0xFF9EA4B2),
            Color(0xFFC8CEDB),
            Color(0xFF6B707D),
            Color(0xFF22252C),
          ],
          const [0.0, 0.28, 0.45, 0.72, 1.0],
        ),
    );
  }

  void _drawHorizontalStabilizerCrossbar(
    Canvas c,
    double x1,
    double x2,
    double cy,
    double torsionP,
  ) {
    const halfH = 6.2;
    final barRRect = RRect.fromRectAndRadius(
      Rect.fromLTRB(x1, cy - halfH, x2, cy + halfH),
      const Radius.circular(halfH),
    );
    c.drawRRect(barRRect.shift(const Offset(3.0, 6.5)), _fastSoftShadow1);
    c.drawRRect(barRRect.shift(const Offset(1.5, 3.0)), _fastSoftShadow2);

    // Bead-blasted satin CNC crossbar whose specular chamfer rolls with torsion twist
    final crestStop = (0.28 + torsionP * 0.22).clamp(0.16, 0.60);
    c.drawRRect(
      barRRect,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, cy - halfH),
          Offset(0, cy + halfH),
          const [
            Color(0xFF1A1D24),
            Color(0xFFA2A8B5),
            Color(0xFF5D626E),
            Color(0xFF2B2F37),
            Color(0xFF121419),
          ],
          [0.0, crestStop, crestStop + 0.24, 0.78, 1.0],
        ),
    );
  }

  void _drawTorsionCoilHub(Canvas c, double cx, double cy, double torsionP) {
    // Stepped dark recessed cast anvil pocket cradling angled helical torsion wraps (cut_spacebar_torsion.png)
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, cy + 2.0), width: 42.0, height: 22.0),
        const Radius.circular(6.0),
      ),
      Paint()..color = const Color(0xFF14161C),
    );
    const wrapCount = 5;
    const spacing = 5.4;
    final startX = cx - (wrapCount - 1) * spacing * 0.5;
    final specShift = torsionP * 3.0;

    c.save();
    c.translate(cx, cy);
    c.rotate(-0.14 - torsionP * 0.08);
    for (int i = 0; i < wrapCount; i++) {
      final wx = (startX + i * spacing) - cx;
      final wrapRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(wx, 0), width: 4.4, height: 23.0),
        const Radius.circular(2.2),
      );
      c.drawRRect(
        wrapRect,
        Paint()
          ..shader = ui.Gradient.linear(
            const Offset(0, -11.5),
            const Offset(0, 11.5),
            const [
              Color(0xFF181A20),
              Color(0xFFDCE0EA),
              Color(0xFF6B707D),
              Color(0xFF1A1D24),
            ],
            [
              0.0,
              (0.28 + specShift * 0.08).clamp(0.14, 0.58),
              (0.62 + specShift * 0.08).clamp(0.42, 0.86),
              1.0,
            ],
          ),
      );
    }
    c.restore();
  }

  void _drawFallbackSpaceEar(Canvas c, double bx, double by, {required bool isLeft}) {
    final dir = isLeft ? 1.0 : -1.0;
    final p = Paint()..color = const Color(0xFF4C515C);
    c.drawCircle(Offset(bx, by), 16.0, p);
    c.drawCircle(Offset(bx, by), 7.5, Paint()..color = const Color(0xFFE6E8EE));
    _drawCastRod(c, Offset(bx + dir * 24.0, by - 12.0), Offset(bx + dir * 24.0, by + 98.0), 12.0);
  }

  void _drawKeycapsOrBlueprintLegends(Canvas c) {
    if (mechanismView == MechanismView.blueprint) {
      _drawBlueprintLegends(c);
      return;
    }

    final activeKeys = <KeyDef>[];
    final restingKeys = <KeyDef>[];
    for (final def in kKeyDefs) {
      final p = physics.keys[def.id]?.p ?? 0.0;
      if (p > 0.002) {
        activeKeys.add(def);
      } else {
        restingKeys.add(def);
      }
    }
    if (activeKeys.length > 1) {
      activeKeys.sort(
        (a, b) => (physics.keys[b.id]?.p ?? 0.0).compareTo(physics.keys[a.id]?.p ?? 0.0),
      );
    }

    for (final def in activeKeys) {
      _drawActiveKeycap(canvas: c, def: def, pRaw: physics.keys[def.id]!.p);
    }
    for (final def in restingKeys) {
      _drawRestingKeycap(c, def);
    }
  }

  /// Subtle crisp ASCII etched legend tags centered inside dark plunger anvil discs
  /// or tucked cleanly on pill key anvils so C-rings never slice text in Blueprint mode.
  void _drawBlueprintLegends(Canvas c) {
    final cfg = kKeyboardLayers[layer]!;
    for (final def in kKeyDefs) {
      String label = '';
      if (def.id.startsWith('r1_')) {
        label = cfg.r1[def.col];
      } else if (def.id.startsWith('r2_')) {
        label = cfg.r2[def.col];
      } else if (def.id.startsWith('r3_')) {
        label = cfg.r3[def.col];
      } else if (def.special == KeySpecial.shift) {
        label = cfg.shiftText ?? 'SHIFT';
      } else if (def.special == KeySpecial.backspace) {
        label = 'DEL';
      } else if (def.special == KeySpecial.mode) {
        label = cfg.modeLabel;
      } else if (def.special == KeySpecial.emoji) {
        label = 'EMOJI';
      } else if (def.special == KeySpecial.returnKey) {
        label = switch (actionLabel) {
          'send' => 'SEND',
          'go' => 'GO',
          'next' => 'NEXT',
          'done' => 'DONE',
          'search' => 'SEARCH',
          _ => 'RET',
        };
      }
      if (label.isEmpty) continue;

      final p = math.max(0.0, physics.keys[def.id]?.p ?? 0.0);
      final tremor = physics.rowTremor[def.row.clamp(0, 3)];
      final isAnvilEtched = (!def.pill && def.special != KeySpecial.emoji) ||
          def.special == KeySpecial.shift ||
          def.special == KeySpecial.backspace ||
          def.special == KeySpecial.returnKey;
      final isSpecial = def.special != KeySpecial.none;
      final dy = (!def.pill && def.special != KeySpecial.emoji) ? (p * 13.0 + tremor * 0.9) : (p * 14.0);

      final color = isAnvilEtched
          ? Color.lerp(const Color(0xFFD8DCE6), Colors.white, p * 0.65)!
              .withValues(alpha: 0.86 + p * 0.14)
          : const Color(0xFF343844).withValues(alpha: 0.72 + p * 0.28);

      final tp = TextPainter(
        text: TextSpan(
          text: label,
          style: TextStyle(
            fontFamily: isSpecial ? 'sans-serif' : 'Arvo',
            fontSize: (!def.pill && def.special != KeySpecial.emoji) ? 15.0 : 12.0,
            fontWeight: FontWeight.w700,
            letterSpacing: isSpecial ? 0.5 : 0.0,
            color: color,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      late final Offset tagOffset;
      if (!def.pill && def.special != KeySpecial.emoji) {
        // Etched cleanly inside the upper-center of the Ø40u dark plunger anvil disc
        tagOffset = Offset(def.x - tp.width * 0.5, def.y - 6.0 + dy - tp.height * 0.5);
      } else if (def.special == KeySpecial.shift) {
        tagOffset = Offset(146.0 - tp.width * 0.5, 594.0 + p * 15.0 - tp.height * 0.5);
      } else if (def.special == KeySpecial.backspace) {
        tagOffset = Offset(1174.0 - tp.width * 0.5, 596.0 + p * 15.0 - tp.height * 0.5);
      } else if (def.special == KeySpecial.returnKey) {
        tagOffset = Offset(1136.0 - tp.width * 0.5, 810.0 + p * 13.0 - tp.height * 0.5);
      } else {
        // Mode (123/ABC) and EMOJI sit cleanly in open lower corners
        tagOffset = Offset(def.x - tp.width * 0.5, def.y + dy - tp.height * 0.5);
      }
      tp.paint(c, tagOffset);
      tp.dispose();
    }
  }

  void _drawRestingKeycap(Canvas c, KeyDef def) {
    final sprite = cache.keySprite(def.id);
    if (sprite == null) return;
    final img = mechanismView == MechanismView.crystal
        ? sprite.crystalRestImage
        : sprite.restImage;
    final dst = sprite.restBounds.shift(Offset(def.x, def.y));
    c.drawImageRect(
      img,
      Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
      dst,
      _imgPaint,
    );
  }

  void _drawActiveKeycap({
    required Canvas canvas,
    required KeyDef def,
    required double pRaw,
  }) {
    final sprite = cache.keySprite(def.id);
    if (sprite == null) return;

    final isCrystal = mechanismView == MechanismView.crystal;
    final p = pRaw.clamp(0.0, 1.0);
    final scale = 1.0 - p * 0.032;
    final dy = p * 17.5;
    final w = def.w * scale;
    final h = def.h * scale;
    final r = h / 2.0;
    final cx = def.x;
    final cy = def.y + dy;
    final skirtH = math.max(1.5, 7.5 * (1.0 - p * 0.80));
    final lift = 1.0 - p;

    final shImg = cache.shadowFor(def);
    if (shImg != null) {
      final shBounds = cache.shadowBoundsFor(def);
      final dst = Rect.fromCenter(
        center: Offset(cx + 0.5, cy + skirtH * 0.55 + 2.0 * lift),
        width: shBounds.width * scale,
        height: shBounds.height * scale,
      );
      canvas.drawImageRect(
        shImg,
        Rect.fromLTWH(0, 0, shImg.width.toDouble(), shImg.height.toDouble()),
        dst,
        _imgPaint,
      );
    }

    if (!isCrystal) {
      final skirtRect = Rect.fromCenter(center: Offset(cx, cy + skirtH), width: w, height: h);
      final skirtRRect = RRect.fromRectAndRadius(skirtRect, Radius.circular(r));
      final skirtShader = ui.Gradient.linear(
        Offset(skirtRect.left, 0),
        Offset(skirtRect.right, 0),
        const [
          Color(0xFF2E3138),
          Color(0xFF565A64),
          Color(0xFF434750),
          Color(0xFF282B31),
          Color(0xFF3E424A),
          Color(0xFF525660),
          Color(0xFF2A2D34),
        ],
        const [0.0, 0.16, 0.34, 0.52, 0.70, 0.86, 1.0],
      );
      canvas.drawRRect(skirtRRect, Paint()..shader = skirtShader);
    }

    final topImg = isCrystal ? sprite.crystalTopImage : sprite.topImage;
    final pressedImg = isCrystal ? sprite.crystalPressedTopImage : sprite.pressedTopImage;
    final topDst = Rect.fromCenter(
      center: Offset(cx, cy),
      width: sprite.topBounds.width * scale,
      height: sprite.topBounds.height * scale,
    );
    final srcRect = Rect.fromLTWH(0, 0, topImg.width.toDouble(), topImg.height.toDouble());

    if (p < 0.995) {
      canvas.drawImageRect(topImg, srcRect, topDst, _imgPaint);
    }
    if (p > 0.005) {
      final blendPaint = Paint()
        ..filterQuality = FilterQuality.low
        ..color = Color.fromARGB((p * 255).round().clamp(0, 255), 255, 255, 255);
      canvas.drawImageRect(pressedImg, srcRect, topDst, blendPaint);
    }
  }

  @override
  bool shouldRepaint(covariant TypewriterKeyboardPainter oldDelegate) {
    return oldDelegate.devicePixelRatio != devicePixelRatio ||
        oldDelegate.layer != layer ||
        oldDelegate.shifted != shifted ||
        oldDelegate.capsLock != capsLock ||
        oldDelegate.actionLabel != actionLabel ||
        oldDelegate.mechanismView != mechanismView ||
        oldDelegate.physics != physics;
  }
}
