import 'package:material_ui/material_ui.dart';

class GridMenuIconPainter extends CustomPainter {
  final Color color;
  const GridMenuIconPainter({this.color = const Color(0xFF7C7E88)});

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 24.0;
    final sy = size.height / 24.0;
    canvas.save();
    canvas.scale(sx, sy);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.55
      ..strokeJoin = StrokeJoin.round
      ..color = color;

    const r = Radius.circular(1.5);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(3.2, 3.2, 7.1, 7.1), r), paint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(13.7, 3.2, 7.1, 7.1), r), paint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(3.2, 13.7, 7.1, 7.1), r), paint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(13.7, 13.7, 7.1, 7.1), r), paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant GridMenuIconPainter oldDelegate) => oldDelegate.color != color;
}

class GlobeIconPainter extends CustomPainter {
  final Color color;
  const GlobeIconPainter({this.color = const Color(0xFF15171C)});

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 36.0;
    final sy = size.height / 36.0;
    canvas.save();
    canvas.scale(sx, sy);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.95
      ..strokeCap = StrokeCap.round
      ..color = color;

    canvas.drawCircle(const Offset(18, 18), 13.2, paint);
    canvas.drawOval(Rect.fromCenter(center: const Offset(18, 18), width: 13.2, height: 26.4), paint);
    canvas.drawLine(const Offset(4.8, 18), const Offset(31.2, 18), paint);

    final topArc = Path()
      ..moveTo(7.2, 11.3)
      ..cubicTo(11.3, 13.1, 14.5, 13.4, 18.0, 13.4)
      ..cubicTo(21.5, 13.4, 24.7, 13.1, 28.8, 11.3);
    canvas.drawPath(topArc, paint);

    final botArc = Path()
      ..moveTo(7.2, 24.7)
      ..cubicTo(11.3, 22.9, 14.5, 22.6, 18.0, 22.6)
      ..cubicTo(21.5, 22.6, 24.7, 22.9, 28.8, 24.7);
    canvas.drawPath(botArc, paint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant GlobeIconPainter oldDelegate) => oldDelegate.color != color;
}

class MicIconPainter extends CustomPainter {
  final Color color;
  const MicIconPainter({this.color = const Color(0xFF15171C)});

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 36.0;
    final sy = size.height / 36.0;
    canvas.save();
    canvas.scale(sx, sy);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.1
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;

    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(13.2, 5.5, 9.6, 16.2), const Radius.circular(4.8)),
      paint,
    );

    final cradle = Path()
      ..moveTo(8.8, 17.5)
      ..arcToPoint(const Offset(27.2, 17.5), radius: const Radius.circular(9.2), clockwise: false);
    canvas.drawPath(cradle, paint);

    canvas.drawLine(const Offset(18, 26.7), const Offset(18, 31), paint);
    canvas.drawLine(const Offset(13, 31), const Offset(23, 31), paint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant MicIconPainter oldDelegate) => oldDelegate.color != color;
}
