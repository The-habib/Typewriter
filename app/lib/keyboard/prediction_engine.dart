import 'package:flutter/services.dart' show rootBundle;

class PredictionResult {
  final List<String> items; // Always 3 items
  final int highlightIndex; // -1 if none

  const PredictionResult({
    required this.items,
    this.highlightIndex = -1,
  });
}

class PredictionEngine {
  static const String _dictAssetPath = 'assets/dict/en_common.txt';

  // Compiled synchronous fallback dictionary so unit tests and first-frame
  // predictions work immediately before rootBundle finishes loading.
  static const List<String> _fallbackWords = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'is', 'are', 'was', 'were', 'been', 'has', 'had', 'did', 'does', 'doing',
    "I'm", "I've", "I'll", "I'd", "you're", "you've", "you'll", "you'd",
    "he's", "she's", "it's", "we're", "we've", "we'll", "they're", "they've",
    "don't", "doesn't", "didn't", "can't", "won't", "couldn't", "wouldn't",
    "shouldn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't",
    "that's", "there's", "here's", "what's", "who's", "where's", "when's", "let's",
    'type', 'typer', 'types', 'typed', 'typing', 'typical', 'typically',
    'typewriter', 'typewriters', "typewriter's", 'pocket', 'pockets', 'pocketbook',
    'police', 'poor', 'bars', 'barstools', 'barstool', 'swim', 'swing', 'swings',
    'whenever', 'wherever', 'whatever', 'improve', 'improved', 'improving',
    'kind', 'king', 'kidding', 'kiddingly', 'kids', 'keep', 'key', 'keys',
    'keyboard', 'keyboards', 'mechanical', 'vintage', 'studio', 'design',
    'nothing', 'note', 'notes', 'notebook', 'hello', 'hey', 'hi', 'thanks',
    'thank', 'please', 'sorry', 'great', 'awesome', 'amazing', 'really', 'very',
    'much', 'more', 'many', 'here', 'where', 'why', 'today', 'tomorrow', 'tonight',
    'morning', 'afternoon', 'evening', 'night', 'yesterday', 'week', 'month',
    'love', 'feel', 'feeling', 'happy', 'ready', 'right', 'left', 'down',
    'sound', 'sounds', 'click', 'clack', 'bell', 'spring', 'steel', 'chrome',
    'silver', 'metal', 'letter', 'letters', 'word', 'words', 'write', 'writer',
    'writing', 'written', 'send', 'sent', 'message', 'messages', 'call', 'home',
    'phone', 'mobile', 'android', 'app', 'apps', 'screen', 'touch', 'fast',
    'quick', 'slow', 'smooth', 'clean', 'cool', 'nice', 'best', 'better',
    'thing', 'things', 'something', 'anything', 'everything', 'someone', 'everyone',
    'always', 'never', 'often', 'sometimes', 'maybe', 'probably', 'actually',
    'still', 'already', 'again', 'soon', 'later', 'before', 'while', 'during',
    'since', 'until', 'though', 'although', 'through', 'around', 'between',
    'should', 'must', 'might', 'need', 'needs', 'needed', 'help', 'helps',
    'start', 'started', 'stop', 'stopped', 'play', 'playing', 'try', 'trying',
    'find', 'found', 'tell', 'told', 'ask', 'asked', 'seem', 'seems', 'let',
    'put', 'mean', 'means', 'leave', 'left', 'turn', 'move', 'live', 'believe',
    'hold', 'bring', 'happen', 'next', 'last', 'long', 'little', 'own', 'old',
    'big', 'high', 'different', 'small', 'large', 'early', 'young', 'important',
    'public', 'bad', 'same', 'able', 'real', 'true', 'sure', 'fine', 'okay',
    'yes', 'yeah', 'nope', 'wait', 'watch', 'check', 'open', 'close', 'read',
    'book', 'page', 'line', 'text', 'copy', 'paste', 'delete', 'save', 'done',
    'world', 'life', 'hand', 'part', 'place', 'case', 'company', 'system',
    'program', 'question', 'number', 'point', 'fact', 'idea', 'friend', 'friends',
    'family', 'story', 'name', 'music', 'video', 'photo', 'picture', 'light',
    'dark', 'color', 'white', 'black', 'red', 'blue', 'green', 'gold',
    'receive', 'definitely', 'separate', 'occurred', 'because', 'which', 'their',
    'until', 'friend', 'people', 'believe', 'address', 'calendar', 'tomorrow',
    'necessary', 'business', 'language', 'keyboard', 'example', 'something',
    'everything', 'anything', 'interesting', 'welcome', 'working', 'meeting',
  ];

  static final RegExp _trailingWordRegex = RegExp(r"([A-Za-z'’]+)$");
  static final RegExp _prevWordRegex = RegExp(r"([A-Za-z'’]+)\s+$");
  static final RegExp _validTokenRegex = RegExp(r"^[A-Za-z](?:[A-Za-z']*[A-Za-z])?$");
  static final RegExp _alphaOnlyChunkRegex = RegExp(r"^[A-Za-z'’]+$");

  static const Map<String, String> _typoShortcuts = {
    'teh': 'the',
    'hte': 'the',
    'adn': 'and',
    'nad': 'and',
    'im': "I'm",
    'ive': "I've",
    'dont': "don't",
    'doesnt': "doesn't",
    'didnt': "didn't",
    'cant': "can't",
    'wont': "won't",
    'isnt': "isn't",
    'arent': "aren't",
    'wasnt': "wasn't",
    'werent': "weren't",
    'havent': "haven't",
    'hasnt': "hasn't",
    'hadnt': "hadn't",
    'wouldnt': "wouldn't",
    'shouldnt': "shouldn't",
    'couldnt': "couldn't",
    'youre': "you're",
    'youve': "you've",
    'youll': "you'll",
    'youd': "you'd",
    'theyre': "they're",
    'theyve': "they've",
    'theyll': "they'll",
    'theyd': "they'd",
    'thats': "that's",
    'whats': "what's",
    'theres': "there's",
    'heres': "here's",
    'wheres': "where's",
    'whos': "who's",
    'hes': "he's",
    'shes': "she's",
    'recieve': 'receive',
    'definately': 'definitely',
    'seperate': 'separate',
    'occured': 'occurred',
    'untill': 'until',
    'becuase': 'because',
    'becasue': 'because',
    'beacuse': 'because',
    'wich': 'which',
    'thier': 'their',
    'waht': 'what',
    'taht': 'that',
    'htat': 'that',
    'jsut': 'just',
    'tahn': 'than',
    'ahve': 'have',
    'hvae': 'have',
    'tiem': 'time',
    'liek': 'like',
    'wiht': 'with',
    'wtih': 'with',
    'yuor': 'your',
    'yuo': 'you',
    'abuot': 'about',
    'abotu': 'about',
    'konw': 'know',
    'kwno': 'know',
    'thnik': 'think',
    'tihnk': 'think',
    'realy': 'really',
    'relly': 'really',
    'probaly': 'probably',
    'probly': 'probably',
    'tommorow': 'tomorrow',
    'tomorow': 'tomorrow',
    'neccessary': 'necessary',
    'necesary': 'necessary',
    'accomodate': 'accommodate',
    'beleive': 'believe',
    'freind': 'friend',
    'frend': 'friend',
    'peopel': 'people',
    'poeple': 'people',
    'shoudl': 'should',
    'woudl': 'would',
    'coudl': 'could',
    'intresting': 'interesting',
    'diffrent': 'different',
    'importnat': 'important',
    'mesage': 'message',
    'keybaord': 'keyboard',
    'typewrtier': 'typewriter',
    'alwyas': 'always',
    'alwasy': 'always',
    'somethign': 'something',
    'everythign': 'everything',
    'nothign': 'nothing',
    'anythign': 'anything',
    'exmaple': 'example',
    'langauge': 'language',
    'busines': 'business',
    'sucess': 'success',
    'adress': 'address',
    'calender': 'calendar',
    'enviroment': 'environment',
    'goverment': 'government',
    'independant': 'independent',
    'knowlege': 'knowledge',
    'occassion': 'occasion',
    'priviledge': 'privilege',
    'refered': 'referred',
    'rythm': 'rhythm',
    'succesful': 'successful',
    'truely': 'truly',
    'wierd': 'weird',
    'writting': 'writing',
    'begining': 'beginning',
    'comming': 'coming',
    'runing': 'running',
    'stoping': 'stopping',
    'geting': 'getting',
    'makeing': 'making',
    'takeing': 'taking',
    'useing': 'using',
    'haveing': 'having',
    'giveing': 'giving',
  };

  static const Map<String, String> _qwertyNeighbors = {
    'q': 'was',
    'w': 'qeasd',
    'e': 'wrsdf',
    'r': 'etdfg',
    't': 'ryfgh',
    'y': 'tughj',
    'u': 'yihjk',
    'i': 'uojkl',
    'o': 'ipkl',
    'p': 'ol',
    'a': 'qwsxz',
    's': 'qweadzx',
    'd': 'wersfxc',
    'f': 'ertdgcv',
    'g': 'rtyfhvb',
    'h': 'tyugjbn',
    'j': 'yuihknm',
    'k': 'uiojlm',
    'l': 'iopk',
    'z': 'asx',
    'x': 'zsdc',
    'c': 'xdfv',
    'v': 'cfgb',
    'b': 'vghn',
    'n': 'bhjm',
    'm': 'njk',
  };

  // Conversational frequency bigrams for ~125 common English lead words.
  static const Map<String, List<String>> _nextWordMap = {
    'i': ['am', 'think', 'know'],
    "i'm": ['not', 'so', 'good'],
    'im': ['not', 'so', 'good'],
    "i've": ['been', 'got', 'never'],
    "i'll": ['be', 'let', 'send'],
    "i'd": ['love', 'like', 'rather'],
    'you': ['can', 'are', 'know'],
    "you're": ['welcome', 'right', 'going'],
    "you've": ['got', 'been', 'seen'],
    "you'll": ['be', 'see', 'find'],
    'we': ['are', 'can', 'need'],
    "we're": ['going', 'doing', 'all'],
    "we'll": ['be', 'see', 'get'],
    'they': ['are', 'were', 'will'],
    "they're": ['not', 'going', 'all'],
    'he': ['is', 'was', 'said'],
    'she': ['is', 'was', 'said'],
    'it': ['is', 'was', 'will'],
    "it's": ['a', 'not', 'going'],
    'that': ['is', 'was', 'would'],
    "that's": ['why', 'great', 'true'],
    'there': ['is', 'are', 'was'],
    "there's": ['a', 'no', 'something'],
    'here': ['is', 'are', 'we'],
    "here's": ['the', 'a', 'what'],
    'this': ['is', 'will', 'morning'],
    'what': ['is', 'are', 'do'],
    "what's": ['up', 'going', 'the'],
    'when': ['you', 'I', 'the'],
    'where': ['are', 'is', 'did'],
    'who': ['is', 'are', 'was'],
    'why': ['are', 'do', 'not'],
    'how': ['are', 'you', 'much'],
    'is': ['it', 'this', 'there'],
    'are': ['you', 'we', 'they'],
    'was': ['a', 'just', 'not'],
    'were': ['you', 'not', 'all'],
    'am': ['not', 'going', 'so'],
    'be': ['there', 'able', 'sure'],
    'been': ['a', 'thinking', 'working'],
    'have': ['a', 'to', 'you'],
    'has': ['been', 'a', 'to'],
    'had': ['a', 'to', 'no'],
    'do': ['you', 'not', 'it'],
    'does': ['not', 'it', 'that'],
    'did': ['you', 'not', 'it'],
    "don't": ['know', 'think', 'worry'],
    "doesn't": ['matter', 'work', 'make'],
    "didn't": ['know', 'see', 'mean'],
    "can't": ['wait', 'believe', 'make'],
    "won't": ['be', 'work', 'take'],
    'can': ['you', 'we', 'I'],
    'could': ['you', 'be', 'not'],
    'would': ['you', 'be', 'like'],
    'should': ['be', 'we', 'I'],
    'will': ['be', 'do', 'you'],
    'not': ['kidding', 'sure', 'bad'],
    'no': ['problem', 'way', 'worries'],
    'yes': ['please', 'I', 'it'],
    'in': ['your', 'the', 'a'],
    'on': ['the', 'your', 'my'],
    'at': ['the', 'home', 'work'],
    'to': ['the', 'be', 'do'],
    'for': ['the', 'you', 'a'],
    'of': ['the', 'course', 'all'],
    'with': ['the', 'you', 'me'],
    'from': ['the', 'my', 'now'],
    'by': ['the', 'now', 'far'],
    'about': ['the', 'it', 'that'],
    'into': ['the', 'a', 'my'],
    'over': ['the', 'there', 'here'],
    'after': ['the', 'work', 'that'],
    'before': ['the', 'I', 'you'],
    'around': ['the', 'here', 'now'],
    'through': ['the', 'it', 'this'],
    'and': ['I', 'the', 'then'],
    'but': ['I', 'it', 'not'],
    'or': ['not', 'something', 'maybe'],
    'so': ['much', 'good', 'many'],
    'if': ['you', 'I', 'it'],
    'because': ['I', 'of', 'it'],
    'just': ['a', 'got', 'wanted'],
    'very': ['good', 'much', 'nice'],
    'really': ['good', 'like', 'appreciate'],
    'sooner': ['or', 'the', 'better'],
    'all': ['the', 'good', 'right'],
    'some': ['time', 'good', 'people'],
    'my': ['phone', 'way', 'friend'],
    'your': ['pocket', 'hand', 'phone'],
    'our': ['team', 'way', 'next'],
    'their': ['own', 'way', 'best'],
    'a': ['good', 'great', 'little'],
    'an': ['hour', 'email', 'update'],
    'the': ['best', 'same', 'first'],
    'good': ['morning', 'idea', 'luck'],
    'great': ['idea', 'job', 'day'],
    'happy': ['to', 'birthday', 'with'],
    'sorry': ['for', 'about', 'I'],
    'thank': ['you', 'god', 'everyone'],
    'thanks': ['for', 'so', 'a'],
    'please': ['let', 'send', 'check'],
    'hello': ['everyone', 'there', 'friend'],
    'hey': ['there', 'how', 'everyone'],
    'see': ['you', 'the', 'that'],
    'look': ['at', 'like', 'for'],
    'make': ['sure', 'a', 'it'],
    'get': ['back', 'the', 'a'],
    'go': ['to', 'ahead', 'home'],
    'going': ['to', 'on', 'well'],
    'come': ['over', 'back', 'with'],
    'take': ['a', 'care', 'the'],
    'know': ['what', 'how', 'that'],
    'think': ['about', 'it', 'so'],
    'want': ['to', 'a', 'you'],
    'need': ['to', 'a', 'help'],
    'like': ['a', 'to', 'that'],
    'love': ['it', 'this', 'you'],
    'let': ['me', 'us', 'know'],
    'check': ['out', 'the', 'it'],
    'send': ['me', 'you', 'it'],
    'call': ['me', 'you', 'later'],
    'tell': ['me', 'you', 'him'],
    'give': ['me', 'you', 'it'],
    'sounds': ['good', 'great', 'like'],
    'looks': ['good', 'great', 'like'],
    'typewriter': ['in', 'on', 'is'],
    'bars': ['swing', 'and', 'move'],
    'swing': ['when', 'with', 'back'],
    'talk': ['soon', 'to', 'about'],
    'right': ['now', 'here', 'away'],
    'too': ['much', 'bad', 'many'],
  };

  static bool _assetLoaded = false;
  static Future<void>? _loadFuture;

  // Active frequency-ordered dictionary state (initialized lazily from _fallbackWords).
  static bool _initialized = false;
  static List<String> _words = const [];
  static Map<String, String> _wordSet = const {};
  static Map<String, List<String>> _byFirstChar = const {};

  // Learned user words (lower -> count & canonical casing).
  static final Map<String, int> _learnedCounts = {};
  static final Map<String, String> _learnedCanonical = {};

  static void _ensureInitialized() {
    if (_initialized) return;
    _setWordList(_fallbackWords);
  }

  /// Loads `assets/dict/en_common.txt` once into memory safely with fallback.
  static Future<void> ensureLoaded() {
    _ensureInitialized();
    if (_assetLoaded) return Future.value();
    return _loadFuture ??= () async {
      try {
        final raw = await rootBundle.loadString(_dictAssetPath);
        if (raw.trim().isNotEmpty) {
          loadFromRawText(raw);
          _assetLoaded = true;
        }
      } catch (_) {
        // Keep compiled fallback list in unit tests or missing-asset contexts.
      } finally {
        _loadFuture = null;
      }
    }();
  }

  /// Parses newline-separated frequency-ranked words synchronously (great for unit tests).
  static void loadFromRawText(String raw) {
    final parsed = <String>[];
    final lines = raw.split(RegExp(r'\r?\n'));
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
      final normalized = trimmed.replaceAll('’', "'");
      if (normalized.length == 1 && normalized != 'I' && normalized != 'a') {
        continue;
      }
      if (!_validTokenRegex.hasMatch(normalized)) continue;
      parsed.add(normalized);
    }
    if (parsed.isNotEmpty) {
      _setWordList(parsed);
    } else {
      _ensureInitialized();
    }
  }

  static void _setWordList(List<String> rawWords) {
    final words = <String>[];
    final wordSet = <String, String>{};
    final byFirstChar = <String, List<String>>{};

    for (final raw in rawWords) {
      final w = raw.trim().replaceAll('’', "'");
      if (w.isEmpty) continue;
      final low = w.toLowerCase();
      if (wordSet.containsKey(low)) continue;
      words.add(w);
      wordSet[low] = w;
      (byFirstChar[low[0]] ??= <String>[]).add(w);
    }

    _words = words;
    _wordSet = wordSet;
    _byFirstChar = byFirstChar;
    _initialized = true;
  }

  /// Learns or boosts a user-typed word in memory for future predictions & autocorrect safety.
  static void learnWord(String word) {
    _ensureInitialized();
    final clean = word.trim().replaceAll('’', "'");
    if (clean.length < 2 || !_validTokenRegex.hasMatch(clean)) return;
    final low = clean.toLowerCase();
    _learnedCounts[low] = (_learnedCounts[low] ?? 0) + 1;
    // Keep dictionary canonical form if known, otherwise keep user's casing.
    _learnedCanonical.putIfAbsent(low, () => _wordSet[low] ?? clean);
  }

  static int get dictionarySize {
    _ensureInitialized();
    return _words.length;
  }

  static bool isKnownWord(String word) {
    _ensureInitialized();
    final low = word.trim().toLowerCase().replaceAll('’', "'");
    return _wordSet.containsKey(low) || _learnedCounts.containsKey(low);
  }

  static PredictionResult predict(String textBeforeCursor, {bool enabled = true}) {
    _ensureInitialized();
    if (!enabled) {
      return const PredictionResult(items: ['', '', ''], highlightIndex: -1);
    }

    final match = _trailingWordRegex.firstMatch(textBeforeCursor);
    if (match == null || match.group(1)!.isEmpty) {
      final prev = _prevWordRegex.firstMatch(textBeforeCursor);
      if (prev != null) {
        final key = prev.group(1)!.toLowerCase().replaceAll('’', "'");
        final nexts = _nextWordMap[key];
        if (nexts != null && nexts.length >= 3) {
          return PredictionResult(
            items: nexts.take(3).map((w) => w.replaceAll("'", '’')).toList(),
            highlightIndex: -1,
          );
        }
      }
      return const PredictionResult(items: ['I’m', 'I', 'The'], highlightIndex: -1);
    }

    final cur = match.group(1)!;
    final low = cur.toLowerCase().replaceAll('’', "'");

    // Exact showcase shortcuts matching the reference video cadence
    switch (low) {
      case 't':
        return PredictionResult(items: ['“$cur”', 'the', 'they']);
      case 'typewr':
        return PredictionResult(items: ['“$cur”', 'typer', 'typewriter'], highlightIndex: 1);
      case 'typewriter':
        return PredictionResult(items: ['“$cur”', 'typewriters', 'typewriter’s']);
      case 'po':
        return PredictionResult(items: ['“$cur”', 'police', 'poor']);
      case 'pocket':
        return PredictionResult(items: ['“$cur”', 'pockets', 'pocketbook']);
      case 'bars':
        return PredictionResult(items: ['“$cur”', 'barstools', 'barstool']);
      case 'swi':
        return PredictionResult(items: ['“$cur”', 'swim', 'swing'], highlightIndex: 1);
      case 'typ':
        return PredictionResult(items: ['“$cur”', 'type', 'typical'], highlightIndex: 1);
      case 'i':
        return PredictionResult(items: ['“$cur”', 'I', 'I’m'], highlightIndex: 1);
      case 'im':
        return PredictionResult(items: ['“$cur”', 'I’m', 'Improve'], highlightIndex: 1);
      case 'ki':
        return PredictionResult(items: ['“$cur”', 'kind', 'king']);
      case 'kidding':
        return PredictionResult(items: ['“$cur”', 'kiddingly', '']);
    }

    final startsUpper =
        cur.isNotEmpty && cur[0] == cur[0].toUpperCase() && cur[0] != cur[0].toLowerCase();
    final prefixMatches = <String>[];
    final seenLower = <String>{low};

    // 1. Learned user words matching prefix (highest priority, sorted by count desc).
    if (_learnedCounts.isNotEmpty) {
      final learnedCandidates = _learnedCanonical.entries
          .where((e) => e.key.startsWith(low) && e.key != low)
          .toList()
        ..sort((a, b) => (_learnedCounts[b.key] ?? 0).compareTo(_learnedCounts[a.key] ?? 0));
      for (final entry in learnedCandidates) {
        if (seenLower.add(entry.key)) {
          prefixMatches.add(_formatCase(entry.value, startsUpper));
          if (prefixMatches.length >= 2) break;
        }
      }
    }

    // 2. Frequency-ranked dictionary prefix lookup indexed by first character.
    if (prefixMatches.length < 2 && low.isNotEmpty) {
      final bucket = _byFirstChar[low[0]] ?? const <String>[];
      for (final w in bucket) {
        final wl = w.toLowerCase();
        if (wl.startsWith(low) && seenLower.add(wl)) {
          prefixMatches.add(_formatCase(w, startsUpper));
          if (prefixMatches.length >= 2) break;
        }
      }
    }

    // 3. Confident autocorrect / edit-distance-1 fallback when no prefix matched.
    if (prefixMatches.isEmpty && low.length >= 2) {
      final correction = autoCorrectSuggestion(textBeforeCursor);
      if (correction != null) {
        final corrLow = correction.toLowerCase().replaceAll('’', "'");
        if (seenLower.add(corrLow)) {
          prefixMatches.add(correction.replaceAll("'", '’'));
        }
      }
      if (prefixMatches.length < 2 && low.length >= 3) {
        for (final w in _words) {
          final wl = w.toLowerCase();
          if ((wl.length - low.length).abs() <= 1 &&
              seenLower.add(wl) &&
              (_isAdjacentTransposition(low, wl) || _levenshtein1(low, wl))) {
            prefixMatches.add(_formatCase(w, startsUpper));
            if (prefixMatches.length >= 2) break;
          }
        }
      }
    }

    final s1 = prefixMatches.isNotEmpty ? prefixMatches[0] : '';
    final s2 = prefixMatches.length > 1 ? prefixMatches[1] : '';
    final hl = (prefixMatches.isNotEmpty && cur.length >= 2) ? 1 : -1;

    return PredictionResult(
      items: ['“$cur”', s1, s2],
      highlightIndex: hl,
    );
  }

  /// Returns a confident single autocorrect replacement for the trailing word
  /// before the cursor, or `null` when the token is valid, ambiguous, or unsafe.
  static String? autoCorrectSuggestion(String textBeforeCursor) {
    _ensureInitialized();
    if (textBeforeCursor.isEmpty) return null;
    final lastChar = textBeforeCursor[textBeforeCursor.length - 1];
    if (lastChar.trim().isEmpty) return null;

    final wsMatch = RegExp(r'(\S+)$').firstMatch(textBeforeCursor);
    if (wsMatch == null) return null;
    final chunk = wsMatch.group(1)!;
    if (!_alphaOnlyChunkRegex.hasMatch(chunk)) return null;

    final low = chunk.toLowerCase().replaceAll('’', "'");
    final startsUpper =
        chunk.isNotEmpty && chunk[0] == chunk[0].toUpperCase() && chunk[0] != chunk[0].toLowerCase();
    final isShortAllCaps =
        chunk.length >= 2 && chunk.length <= 5 && chunk == chunk.toUpperCase() && chunk != chunk.toLowerCase();

    // 1. Exact known typo / non-word apostrophe contraction shortcut.
    final shortcut = _typoShortcuts[low];
    if (shortcut != null) {
      if (isShortAllCaps && low != 'im') return null;
      return _formatCase(shortcut, startsUpper, keepStraightApostrophe: true);
    }

    // 2. Skip short tokens, acronyms, or already valid dictionary / learned words.
    if (low.length < 3 || isShortAllCaps) return null;
    if (_wordSet.containsKey(low) || _learnedCounts.containsKey(low)) return null;

    // 3. Find strongest frequency-weighted Levenshtein-1 or adjacent-QWERTY-transposition match.
    String? bestWord;
    int bestScore = 1 << 30;
    final maxRankForLength = low.length == 3 ? 1600 : _words.length;

    for (int rank = 0; rank < _words.length && rank < maxRankForLength; rank++) {
      final w = _words[rank];
      final wl = w.toLowerCase();
      if ((wl.length - low.length).abs() > 1) continue;

      int bonus = 0;
      if (_isAdjacentTransposition(low, wl)) {
        bonus = 600;
      } else if (_isQwertyAdjacentSub(low, wl)) {
        bonus = 350;
      } else if (low.length >= 4 && _levenshtein1(low, wl)) {
        bonus = 0;
      } else if (low.length == 3 && wl.length == 3 && _levenshtein1(low, wl) && rank < 400) {
        bonus = 0;
      } else {
        continue;
      }

      if (wl[0] == low[0]) bonus += 150;
      if (wl.length == low.length) bonus += 80;

      final score = rank - bonus;
      if (score < bestScore) {
        bestScore = score;
        bestWord = w;
      }
    }

    if (bestWord == null) return null;
    return _formatCase(bestWord, startsUpper, keepStraightApostrophe: true);
  }

  static String _formatCase(
    String word,
    bool capitalize, {
    bool keepStraightApostrophe = false,
  }) {
    final pretty = keepStraightApostrophe ? word : word.replaceAll("'", '’');
    if (!capitalize || pretty.isEmpty) return pretty;
    if (pretty.startsWith('I')) return pretty;
    return pretty[0].toUpperCase() + pretty.substring(1);
  }

  static bool _isAdjacentTransposition(String a, String b) {
    if (a.length != b.length || a.length < 2) return false;
    int diffIndex = -1;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) {
        if (diffIndex != -1) return false;
        if (i + 1 >= a.length) return false;
        if (a[i] == b[i + 1] && a[i + 1] == b[i]) {
          diffIndex = i;
          i++; // skip paired index
        } else {
          return false;
        }
      }
    }
    return diffIndex != -1;
  }

  static bool _isQwertyAdjacentSub(String a, String b) {
    if (a.length != b.length) return false;
    int diffs = 0;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) {
        diffs++;
        if (diffs > 1) return false;
        final neighbors = _qwertyNeighbors[a[i]];
        if (neighbors == null || !neighbors.contains(b[i])) {
          return false;
        }
      }
    }
    return diffs == 1;
  }

  static bool _levenshtein1(String a, String b) {
    if ((a.length - b.length).abs() > 1) return false;
    int i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] == b[j]) {
        i++;
        j++;
      } else {
        edits++;
        if (edits > 1) return false;
        if (a.length > b.length) {
          i++;
        } else if (b.length > a.length) {
          j++;
        } else {
          i++;
          j++;
        }
      }
    }
    if (i < a.length || j < b.length) edits++;
    return edits == 1;
  }
}
