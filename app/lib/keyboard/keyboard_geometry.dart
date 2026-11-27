import 'dart:ui';

/// Authentic 1320 x 1040 precision-machined studio typewriter coordinate system:
/// - Matches original video proportions (17 milled top slots, 120u sculpted keycaps)
/// - Crisp 8u horizontal clearance and balanced 22u/26u/46u row breathing room
/// - Clean mechanical undercarriage terminating behind Row 4 with only Spacebar brackets & 4 loops below
class KeyboardMetrics {
  static const double designWidth = 1320.0;
  static const double designHeight = 1040.0;
  static const double aspectRatio = designHeight / designWidth;

  static const int slotCount = 17;
  static const double slotPitch = 47.9;
  static const double slotStartX = 272.0; // exact match to reference 17 milled slots (272 .. 1038)
  static const double slotY = 179.0;
  static const double slotH = 74.0;
  static const double slotW = 21.0;

  static const List<double> rowY = [365.0, 500.0, 645.0, 804.0];
  static const double keyDiameter = 116.0;
}

class KnuckleDef {
  final double x;
  final double y;
  final double w;

  const KnuckleDef({required this.x, required this.y, required this.w});
}

class StemDef {
  final double x;
  final double len;
  final KnuckleDef? knuckle;

  const StemDef({required this.x, required this.len, this.knuckle});
}

enum KeySpecial {
  none,
  shift,
  backspace,
  mode,
  emoji,
  space,
  returnKey,
}

class KeyDef {
  final String id;
  final int row;
  final int col;
  final double x;
  final double y;
  final double w;
  final double h;
  final List<Object> bars; // int (0..16) or String ('L0','L1','R0','R1','SPACE')
  final KeySpecial special;
  final bool pill;
  final bool isRed;
  final bool heavy;
  final StemDef? stem;

  const KeyDef({
    required this.id,
    required this.row,
    required this.col,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    required this.bars,
    this.special = KeySpecial.none,
    this.pill = false,
    this.isRed = false,
    this.heavy = false,
    this.stem,
  });

  Rect get hitRect => Rect.fromCenter(
        center: Offset(x, y),
        width: w + 10.0,
        height: h + 26.0,
      );
}

enum KeyboardLayer { abc, num, sym }

enum MechanismView { classic, crystal, blueprint }

class LayerConfig {
  final List<String> r1;
  final List<String> r2;
  final List<String> r3;
  final String? shiftText;
  final String modeLabel;
  final bool modeNumStyle;

  const LayerConfig({
    required this.r1,
    required this.r2,
    required this.r3,
    required this.shiftText,
    required this.modeLabel,
    required this.modeNumStyle,
  });
}

const Map<KeyboardLayer, LayerConfig> kKeyboardLayers = {
  KeyboardLayer.abc: LayerConfig(
    r1: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    r2: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    r3: ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    shiftText: null,
    modeLabel: '123',
    modeNumStyle: true,
  ),
  KeyboardLayer.num: LayerConfig(
    r1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    r2: ['-', '/', ':', ';', '(', ')', r'$', '@', '”'],
    r3: ['.', ',', '&', '?', '!', '‘', '’'],
    shiftText: '#+=',
    modeLabel: 'ABC',
    modeNumStyle: false,
  ),
  KeyboardLayer.sym: LayerConfig(
    r1: ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
    r2: ['_', '\\', '|', '~', '<', '>', '€', '£', '¥'],
    r3: ['.', ',', '&', '?', '!', '‘', '’'],
    shiftText: '123',
    modeLabel: 'ABC',
    modeNumStyle: false,
  ),
};

const Map<String, List<String>> kAccentAlternates = {
  'Q': ['1'],
  'W': ['2'],
  'E': ['3', 'è', 'é', 'ê', 'ë', 'ē', 'ė', 'ę'],
  'R': ['4'],
  'T': ['5'],
  'Y': ['6', 'ÿ'],
  'U': ['7', 'ù', 'ú', 'û', 'ü', 'ū'],
  'I': ['8', 'ì', 'í', 'î', 'ï', 'ī', 'į'],
  'O': ['9', 'ò', 'ó', 'ô', 'ö', 'œ', 'ø', 'õ', 'ō'],
  'P': ['0'],
  'A': ['à', 'á', 'â', 'ä', 'æ', 'ã', 'å', 'ā'],
  'C': ['ç', 'ć', 'č'],
  'N': ['ñ', 'ń'],
  'S': ['ß', 'ś', 'š'],
  'Z': ['ž', 'ź', 'ż'],
  '-': ['–', '—', '_', '•'],
  r'$': ['€', '£', '¥', '¢', '₹'],
  '?': ['¿'],
  '!': ['¡'],
  '.': ['…', ',', '@', '/', '.com'],
  '+': ['±', '×', '÷'],
  '=': ['≠', '≈'],
  '”': ['"', '«', '»'],
  '‘': ["'", '‚'],
  '’': ["'", '′'],
  '/': ['\\', ':'],
};

const List<KeyDef> kKeyDefs = [
  // Row 1 (exact measured face centers: y = 365, pitch = 127.2, bezel OD = 116)
  KeyDef(
    id: 'r1_0', row: 0, col: 0, x: 88, y: 365, w: 116, h: 116,
    bars: ['L0'],
    stem: StemDef(x: 88, len: 112, knuckle: KnuckleDef(x: 74, y: 474, w: 21)),
  ),
  KeyDef(
    id: 'r1_1', row: 0, col: 1, x: 215, y: 365, w: 116, h: 116,
    bars: ['L1', 0],
    stem: StemDef(x: 225, len: 142, knuckle: KnuckleDef(x: 214, y: 542, w: 22)),
  ),
  KeyDef(
    id: 'r1_2', row: 0, col: 2, x: 342, y: 365, w: 116, h: 116,
    bars: [1, 2],
    stem: StemDef(x: 342, len: 250),
  ),
  KeyDef(
    id: 'r1_3', row: 0, col: 3, x: 469, y: 365, w: 116, h: 116,
    bars: [4],
    stem: StemDef(x: 469, len: 355),
  ),
  KeyDef(
    id: 'r1_4', row: 0, col: 4, x: 596, y: 365, w: 116, h: 116,
    bars: [7],
    stem: StemDef(x: 596, len: 355),
  ),
  KeyDef(
    id: 'r1_5', row: 0, col: 5, x: 724, y: 365, w: 116, h: 116,
    bars: [9, 10],
    stem: StemDef(x: 724, len: 355),
  ),
  KeyDef(
    id: 'r1_6', row: 0, col: 6, x: 851, y: 365, w: 116, h: 116,
    bars: [12],
    stem: StemDef(x: 851, len: 355),
  ),
  KeyDef(
    id: 'r1_7', row: 0, col: 7, x: 978, y: 365, w: 116, h: 116,
    bars: [14, 15],
    stem: StemDef(x: 978, len: 250),
  ),
  KeyDef(
    id: 'r1_8', row: 0, col: 8, x: 1106, y: 365, w: 116, h: 116,
    bars: [16, 'R1'],
    stem: StemDef(x: 1095, len: 142, knuckle: KnuckleDef(x: 1084, y: 542, w: 22)),
  ),
  KeyDef(
    id: 'r1_9', row: 0, col: 9, x: 1233, y: 365, w: 116, h: 116,
    bars: ['R0'],
    stem: StemDef(x: 1233, len: 112, knuckle: KnuckleDef(x: 1222, y: 474, w: 21)),
  ),

  // Row 2 (y = 500)
  KeyDef(id: 'r2_0', row: 1, col: 0, x: 152, y: 500, w: 116, h: 116, bars: ['L0', 'L1'], stem: StemDef(x: 152, len: 88)),
  KeyDef(id: 'r2_1', row: 1, col: 1, x: 279, y: 500, w: 116, h: 116, bars: [0], stem: StemDef(x: 279, len: 94)),
  KeyDef(id: 'r2_2', row: 1, col: 2, x: 406, y: 500, w: 116, h: 116, bars: [3], stem: StemDef(x: 406, len: 94)),
  KeyDef(id: 'r2_3', row: 1, col: 3, x: 534, y: 500, w: 116, h: 116, bars: [5], stem: StemDef(x: 534, len: 94)),
  KeyDef(id: 'r2_4', row: 1, col: 4, x: 661, y: 500, w: 116, h: 116, bars: [8], stem: StemDef(x: 661, len: 94)),
  KeyDef(id: 'r2_5', row: 1, col: 5, x: 788, y: 500, w: 116, h: 116, bars: [11], stem: StemDef(x: 788, len: 94)),
  KeyDef(id: 'r2_6', row: 1, col: 6, x: 916, y: 500, w: 116, h: 116, bars: [13], stem: StemDef(x: 916, len: 94)),
  KeyDef(id: 'r2_7', row: 1, col: 7, x: 1042, y: 500, w: 116, h: 116, bars: [16], stem: StemDef(x: 1042, len: 94)),
  KeyDef(id: 'r2_8', row: 1, col: 8, x: 1168, y: 500, w: 116, h: 116, bars: ['R1', 'R0'], stem: StemDef(x: 1168, len: 88)),

  // Row 3 (y = 645)
  KeyDef(id: 'shift', row: 2, col: -1, x: 102, y: 645, w: 176, h: 116, bars: ['L0'], special: KeySpecial.shift, pill: true, stem: StemDef(x: 146, len: 84)),
  KeyDef(id: 'r3_0', row: 2, col: 0, x: 278, y: 645, w: 116, h: 116, bars: [0, 1], stem: StemDef(x: 278, len: 84)),
  KeyDef(id: 'r3_1', row: 2, col: 1, x: 405, y: 645, w: 116, h: 116, bars: [2, 3], stem: StemDef(x: 405, len: 84)),
  KeyDef(id: 'r3_2', row: 2, col: 2, x: 533, y: 645, w: 116, h: 116, bars: [5, 6], stem: StemDef(x: 533, len: 84)),
  KeyDef(id: 'r3_3', row: 2, col: 3, x: 660, y: 645, w: 116, h: 116, bars: [8], stem: StemDef(x: 660, len: 84)),
  KeyDef(id: 'r3_4', row: 2, col: 4, x: 787, y: 645, w: 116, h: 116, bars: [10, 11], stem: StemDef(x: 787, len: 84)),
  KeyDef(id: 'r3_5', row: 2, col: 5, x: 913, y: 645, w: 116, h: 116, bars: [13, 14], stem: StemDef(x: 913, len: 84)),
  KeyDef(id: 'r3_6', row: 2, col: 6, x: 1040, y: 645, w: 116, h: 116, bars: [15, 16], stem: StemDef(x: 1040, len: 84)),
  KeyDef(id: 'backspace', row: 2, col: 7, x: 1212, y: 645, w: 176, h: 116, bars: ['R0'], special: KeySpecial.backspace, isRed: true, pill: true, stem: StemDef(x: 1170, len: 84)),

  // Row 4 (y = 804)
  KeyDef(id: 'mode', row: 3, col: 0, x: 102, y: 804, w: 178, h: 114, bars: ['L0'], special: KeySpecial.mode, pill: true),
  KeyDef(id: 'emoji', row: 3, col: 1, x: 277, y: 804, w: 116, h: 114, bars: ['L1'], special: KeySpecial.emoji),
  KeyDef(id: 'space', row: 3, col: 2, x: 656, y: 804, w: 616, h: 114, bars: ['SPACE'], special: KeySpecial.space, pill: true, heavy: true),
  KeyDef(id: 'return', row: 3, col: 3, x: 1136, y: 804, w: 298, h: 114, bars: ['R1', 'R0'], special: KeySpecial.returnKey, pill: true, heavy: true),
];
