import 'dart:math' as math;
import 'dart:ui' show Offset;
import 'package:flutter/foundation.dart';
import 'keyboard_geometry.dart';

enum KeyPhase { idle, down, hold, up }

class KeyPhysState {
  final KeyDef def;
  double p = 0.0;
  KeyPhase phase = KeyPhase.idle;
  double t = 0.0;
  bool held = false;
  double startP = 0.0;

  KeyPhysState(this.def);
}

class BarPhysState {
  double p = 0.0;
  double v = 0.0;
  double cam = 0.0;
  double camV = 0.0;
  double tremor = 0.0;
  double tremorV = 0.0;
}

/// Precision mechanical kinematics engine with committed full-stroke motion,
/// critically-damped steel bar follow-through, and sympathetic adjacent bar tremor.
class KeyboardPhysicsController extends ChangeNotifier {
  final Map<String, KeyPhysState> keys = {
    for (final def in kKeyDefs) def.id: KeyPhysState(def),
  };

  final Map<Object, BarPhysState> bars = {
    for (int i = 0; i < KeyboardMetrics.slotCount; i++) i: BarPhysState(),
    'L0': BarPhysState(),
    'L1': BarPhysState(),
    'R0': BarPhysState(),
    'R1': BarPhysState(),
    'SPACE': BarPhysState(),
  };

  bool slowMo = false;
  bool _active = false;
  bool get isActive => _active;

  // Coupled Spacebar coil spring overshoot, torsion crossbar twist, and per-row cross-shaft inertial tremor
  double spaceSpringStretch = 0.0;
  double _spaceSpringV = 0.0;
  double spaceTorsionTwist = 0.0;
  double _spaceTorsionV = 0.0;
  final List<double> rowTremor = [0.0, 0.0, 0.0, 0.0];
  final List<double> _rowTremorV = [0.0, 0.0, 0.0, 0.0];

  static double _easeStrikeDown(double u) {
    if (u < 0.5) {
      return 2.4 * u * u * u + 0.4 * u * u;
    }
    return 1.0 - math.pow(1.0 - u, 2.6).toDouble();
  }

  static double _easeSpringUp(double u) {
    return 1.0 - math.pow(1.0 - u, 2.45).toDouble();
  }

  void pressKey(String id) {
    final kp = keys[id];
    if (kp == null) return;
    kp.held = true;
    kp.startP = kp.p;
    kp.phase = KeyPhase.down;
    kp.t = 0.0;

    for (final b in kp.def.bars) {
      bars[b]?.v += (b == 'SPACE' ? 3.2 : 4.2);
      bars[b]?.camV += (b == 'SPACE' ? 7.0 : 12.5);
      if (b is int) {
        bars[b - 1]?.tremorV += 18.0;
        bars[b + 1]?.tremorV += 18.0;
        bars[b - 2]?.tremorV += 7.5;
        bars[b + 2]?.tremorV += 7.5;
      }
    }
    final r = kp.def.row.clamp(0, 3);
    _rowTremorV[r] += kp.def.heavy ? 22.0 : 13.5;
    if (id == 'space') {
      _spaceSpringV += 6.5;
      _spaceTorsionV += 7.5;
    }
    _active = true;
    notifyListeners();
  }

  void releaseKey(String id) {
    final kp = keys[id];
    if (kp == null) return;
    kp.held = false;
    _active = true;
    notifyListeners();
  }

  void releaseAll() {
    for (final kp in keys.values) {
      kp.held = false;
    }
    _active = true;
    notifyListeners();
  }

  /// Advances physics by [dtSeconds]. Returns true if animation is still active.
  bool step(double dtSeconds) {
    var dt = dtSeconds.clamp(0.0, 0.032);
    if (slowMo) dt *= 0.25;
    if (dt <= 0.0) return _active;

    var anyActive = false;
    final barTargets = <Object, double>{
      for (final bk in bars.keys) bk: 0.0,
    };

    for (final kp in keys.values) {
      // Crisp 44ms mechanical strike down + 46ms dwell + visible 118ms spring return (145ms heavy keys)
      final downDur = kp.def.heavy ? 0.056 : 0.044;
      final holdMin = kp.def.heavy ? 0.054 : 0.046;
      final upDur = kp.def.heavy ? 0.145 : 0.118;

      switch (kp.phase) {
        case KeyPhase.down:
          kp.t += dt;
          final u = (kp.t / downDur).clamp(0.0, 1.0);
          kp.p = kp.startP + (1.0 - kp.startP) * _easeStrikeDown(u);
          if (u >= 1.0) {
            kp.p = 1.0;
            kp.phase = KeyPhase.hold;
            kp.t = 0.0;
          }
          anyActive = true;
          break;

        case KeyPhase.hold:
          kp.p = 1.0;
          kp.t += dt;
          if (!kp.held && kp.t >= holdMin) {
            kp.phase = KeyPhase.up;
            kp.t = 0.0;
            kp.startP = 1.0;
          }
          anyActive = true;
          break;

        case KeyPhase.up:
          kp.t += dt;
          final u = (kp.t / upDur).clamp(0.0, 1.0);
          kp.p = kp.startP * (1.0 - _easeSpringUp(u));
          if (u >= 1.0) {
            kp.p = 0.0;
            kp.phase = KeyPhase.idle;
            kp.t = 0.0;
          } else {
            anyActive = true;
          }
          break;

        case KeyPhase.idle:
          break;
      }

      if (kp.p > 0.001) {
        for (final b in kp.def.bars) {
          final prev = barTargets[b] ?? 0.0;
          if (kp.p > prev) barTargets[b] = kp.p;
        }
      }
    }

    for (final entry in bars.entries) {
      final bk = entry.key;
      final bp = entry.value;
      final tgt = barTargets[bk] ?? 0.0;
      final diff = tgt - bp.p;

      if (diff.abs() > 0.001 || bp.v.abs() > 0.003) {
        final k = bk == 'SPACE' ? 420.0 : 520.0;
        final c = bk == 'SPACE' ? 32.0 : 36.0;
        final a = k * diff - c * bp.v;
        bp.v += a * dt;
        bp.p += bp.v * dt;
        if (bp.p < 0.0) {
          bp.p = 0.0;
          bp.v = 0.0;
        }
        anyActive = true;
      } else {
        bp.p = tgt;
        bp.v = 0.0;
      }

      // Striker rocker cam follow-through (whips forward cleanly at bottom-out and springs back)
      final camDiff = tgt - bp.cam;
      if (camDiff.abs() > 0.001 || bp.camV.abs() > 0.003) {
        final kCam = bk == 'SPACE' ? 320.0 : 410.0;
        final cCam = bk == 'SPACE' ? 22.0 : 25.0;
        final aCam = kCam * camDiff - cCam * bp.camV;
        bp.camV += aCam * dt;
        bp.cam += bp.camV * dt;
        if (bp.cam < 0.0) {
          bp.cam = 0.0;
          bp.camV = 0.0;
        }
        anyActive = true;
      } else {
        bp.cam = tgt;
        bp.camV = 0.0;
      }

      if (bp.tremor.abs() > 0.002 || bp.tremorV.abs() > 0.005) {
        final ta = -780.0 * bp.tremor - 24.0 * bp.tremorV;
        bp.tremorV += ta * dt;
        bp.tremor += bp.tremorV * dt;
        anyActive = true;
      } else {
        bp.tremor = 0.0;
        bp.tremorV = 0.0;
      }
    }

    // Coupled Spacebar spring harmonic overshoot & torsion crossbar twist
    final spP = bars['SPACE']?.p ?? 0.0;
    if ((spP - spaceSpringStretch).abs() > 0.001 || _spaceSpringV.abs() > 0.003) {
      final a = 360.0 * (spP - spaceSpringStretch) - 21.0 * _spaceSpringV;
      _spaceSpringV += a * dt;
      spaceSpringStretch += _spaceSpringV * dt;
      anyActive = true;
    } else {
      spaceSpringStretch = spP;
      _spaceSpringV = 0.0;
    }

    if ((spP - spaceTorsionTwist).abs() > 0.001 || _spaceTorsionV.abs() > 0.003) {
      final a = 330.0 * (spP - spaceTorsionTwist) - 20.0 * _spaceTorsionV;
      _spaceTorsionV += a * dt;
      spaceTorsionTwist += _spaceTorsionV * dt;
      anyActive = true;
    } else {
      spaceTorsionTwist = spP;
      _spaceTorsionV = 0.0;
    }

    for (int r = 0; r < 4; r++) {
      if (rowTremor[r].abs() > 0.002 || _rowTremorV[r].abs() > 0.005) {
        final ta = -880.0 * rowTremor[r] - 26.0 * _rowTremorV[r];
        _rowTremorV[r] += ta * dt;
        rowTremor[r] += _rowTremorV[r] * dt;
        anyActive = true;
      } else {
        rowTremor[r] = 0.0;
        _rowTremorV[r] = 0.0;
      }
    }

    _active = anyActive;
    notifyListeners();
    return anyActive;
  }

  /// Hit tests a point in 1320 x 1100 logical design coordinates,
  /// with nearest-key Voronoi fallback in inter-key gaps for effortless typing.
  String? hitTest(Offset designPos) {
    String? bestId;
    double bestDistSq = double.infinity;

    for (final def in kKeyDefs) {
      if (def.hitRect.contains(designPos)) {
        final dx = designPos.dx - def.x;
        final dy = designPos.dy - def.y;
        final d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestId = def.id;
        }
      }
    }
    if (bestId != null) return bestId;

    // Voronoi fallback inside the active keybed area so gap taps never drop
    if (designPos.dy >= 230.0 && designPos.dy <= 955.0) {
      for (final def in kKeyDefs) {
        final clampedX = designPos.dx.clamp(def.x - def.w * 0.35, def.x + def.w * 0.35);
        final dx = designPos.dx - clampedX;
        final dy = designPos.dy - def.y;
        final d2 = dx * dx + dy * dy;
        if (d2 < 105.0 * 105.0 && d2 < bestDistSq) {
          bestDistSq = d2;
          bestId = def.id;
        }
      }
    }
    return bestId;
  }
}
