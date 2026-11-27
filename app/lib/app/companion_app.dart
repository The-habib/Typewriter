import 'package:material_ui/material_ui.dart';
import '../keyboard/keyboard_bridge.dart';

class TypewriterCompanionApp extends StatelessWidget {
  const TypewriterCompanionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Typewriter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF20222A),
        scaffoldBackgroundColor: const Color(0xFFF6F7FA),
      ),
      home: const CompanionHomeScreen(),
    );
  }
}

class CompanionHomeScreen extends StatefulWidget {
  const CompanionHomeScreen({super.key});

  @override
  State<CompanionHomeScreen> createState() => _CompanionHomeScreenState();
}

class _CompanionHomeScreenState extends State<CompanionHomeScreen>
    with WidgetsBindingObserver {
  final TextEditingController _testController = TextEditingController();
  bool _isEnabled = false;
  bool _isSelected = false;
  KeyboardPreferences _prefs = const KeyboardPreferences();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshStatusAndPrefs();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshStatusAndPrefs();
    }
  }

  Future<void> _refreshStatusAndPrefs() async {
    final status = await CompanionAppBridge.getImeStatus();
    final prefs = await CompanionAppBridge.getPreferences();
    if (!mounted) return;
    setState(() {
      _isEnabled = status.isEnabled;
      _isSelected = status.isSelected;
      _prefs = prefs;
    });
  }

  Future<void> _setPref(String key, Object value, KeyboardPreferences next) async {
    setState(() {
      _prefs = next;
    });
    await CompanionAppBridge.setPreference(key, value);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _testController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7FA),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            _buildHeader(),
            const SizedBox(height: 14),
            _buildSetupCard(),
            const SizedBox(height: 14),
            _buildTestKeyboardCard(),
            const SizedBox(height: 14),
            _buildSettingsCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: const Color(0x22000000), width: 1.0),
            boxShadow: const [
              BoxShadow(
                color: Color(0x18101218),
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset(
              'assets/images/typewriter_logo.png',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                color: const Color(0xFFDCE0E8),
                alignment: Alignment.center,
                child: const Text(
                  'T',
                  style: TextStyle(
                    fontFamily: 'Arvo',
                    fontSize: 20,
                    color: Color(0xFF22242C),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Typewriter',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1F2229),
                ),
              ),
              Text(
                'System Android IME & Settings',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF757987)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSetupCard() {
    final allReady = _isEnabled && _isSelected;
    return Card(
      elevation: 0,
      color: allReady ? const Color(0xFFECFDF3) : const Color(0xFF20222A),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              allReady ? 'Typewriter is Active' : 'Keyboard Setup',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: allReady ? const Color(0xFF14532D) : Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  _isEnabled ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                  color: _isEnabled ? const Color(0xFF22C55E) : const Color(0xFFE5A00D),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '1. Enable in Android Languages & Input',
                    style: TextStyle(
                      color: allReady ? const Color(0xFF166534) : Colors.white,
                      fontSize: 13.5,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    await CompanionAppBridge.openInputMethodSettings();
                    Future.delayed(const Duration(milliseconds: 500), _refreshStatusAndPrefs);
                  },
                  child: Text(
                    _isEnabled ? 'Settings' : 'Enable',
                    style: TextStyle(
                      color: allReady ? const Color(0xFF15803D) : const Color(0xFFE5A00D),
                    ),
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Icon(
                  _isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                  color: _isSelected ? const Color(0xFF22C55E) : const Color(0xFFE5A00D),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '2. Select as Active Keyboard',
                    style: TextStyle(
                      color: allReady ? const Color(0xFF166534) : Colors.white,
                      fontSize: 13.5,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    await CompanionAppBridge.showInputMethodPicker();
                    Future.delayed(const Duration(milliseconds: 500), _refreshStatusAndPrefs);
                  },
                  child: Text(
                    _isSelected ? 'Switch' : 'Select',
                    style: TextStyle(
                      color: allReady ? const Color(0xFF15803D) : const Color(0xFFE5A00D),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTestKeyboardCard() {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0x14000000)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Test System Keyboard',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1F2229),
                  ),
                ),
                IconButton(
                  onPressed: () => _testController.clear(),
                  icon: const Icon(Icons.clear_rounded, size: 20, color: Color(0xFF6B7080)),
                  tooltip: 'Clear text',
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            TextField(
              controller: _testController,
              minLines: 3,
              maxLines: 6,
              cursorColor: const Color(0xFFE5A00D),
              cursorWidth: 2.5,
              style: const TextStyle(fontSize: 18, height: 1.4, color: Color(0xFF1B1C20)),
              decoration: const InputDecoration(
                border: InputBorder.none,
                hintText: 'Tap here to type with Typewriter...',
                hintStyle: TextStyle(color: Color(0xFFB4B7C4)),
              ),
              onTap: _refreshStatusAndPrefs,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<int>(
                    showSelectedIcon: false,
                    style: const ButtonStyle(
                      visualDensity: VisualDensity.compact,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    segments: const [
                      ButtonSegment(value: 0, label: Text('Classic', style: TextStyle(fontSize: 12))),
                      ButtonSegment(value: 1, label: Text('Crystal', style: TextStyle(fontSize: 12))),
                      ButtonSegment(value: 2, label: Text('Blueprint', style: TextStyle(fontSize: 12))),
                    ],
                    selected: {_prefs.mechanismView},
                    onSelectionChanged: (sel) {
                      final v = sel.first;
                      _setPref('mechanismView', v, _prefs.copyWith(mechanismView: v));
                    },
                  ),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Slow-Mo', style: TextStyle(fontSize: 12)),
                  selected: _prefs.slowMo,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  onSelected: (v) => _setPref('slowMo', v, _prefs.copyWith(slowMo: v)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsCard() {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0x14000000)),
      ),
      child: Column(
        children: [
          SwitchListTile(
            title: const Text('Mechanical Typewriter Audio'),
            subtitle: const Text('Ribbon strike clack + brass carriage bell'),
            value: _prefs.soundEnabled,
            onChanged: (v) => _setPref('soundEnabled', v, _prefs.copyWith(soundEnabled: v)),
          ),
          ListTile(
            title: const Text('Audio Volume'),
            subtitle: Slider(
              value: _prefs.soundVolume,
              min: 0.1,
              max: 1.0,
              onChanged: _prefs.soundEnabled
                  ? (v) => _setPref('soundVolume', v, _prefs.copyWith(soundVolume: v))
                  : null,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Haptic Feedback',
                  style: TextStyle(fontSize: 16, color: Color(0xFF1F2229)),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Tactile mechanical actuation',
                  style: TextStyle(fontSize: 14, color: Color(0xFF49454F)),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 0, label: Text('Off')),
                      ButtonSegment(value: 1, label: Text('Crisp')),
                      ButtonSegment(value: 2, label: Text('Heavy')),
                    ],
                    selected: {_prefs.hapticsLevel},
                    onSelectionChanged: (sel) {
                      final v = sel.first;
                      _setPref('hapticsLevel', v, _prefs.copyWith(hapticsLevel: v));
                      if (v > 0) CompanionAppBridge.hapticTick(v, heavy: v == 2);
                    },
                  ),
                ),
              ],
            ),
          ),
          SwitchListTile(
            title: const Text('Auto-Capitalization'),
            subtitle: const Text('Capitalize first word of sentences'),
            value: _prefs.autoCaps,
            onChanged: (v) => _setPref('autoCaps', v, _prefs.copyWith(autoCaps: v)),
          ),
          SwitchListTile(
            title: const Text('Predictive Text Bar'),
            subtitle: const Text('Show 3-slot live word suggestions'),
            value: _prefs.predictionsEnabled,
            onChanged: (v) =>
                _setPref('predictionsEnabled', v, _prefs.copyWith(predictionsEnabled: v)),
          ),
          SwitchListTile(
            title: const Text('Auto-Correct on Space'),
            subtitle: const Text('Fix typos & contractions automatically on Space'),
            value: _prefs.autoCorrectOnSpace,
            onChanged: (v) =>
                _setPref('autoCorrectOnSpace', v, _prefs.copyWith(autoCorrectOnSpace: v)),
          ),
          SwitchListTile(
            title: const Text('Spacebar Cursor Trackpad'),
            subtitle: const Text('Hold & slide on Spacebar to move cursor'),
            value: _prefs.spacebarTrackpad,
            onChanged: (v) =>
                _setPref('spacebarTrackpad', v, _prefs.copyWith(spacebarTrackpad: v)),
          ),
          SwitchListTile(
            title: const Text('Double-Space Period'),
            subtitle: const Text('Double-tap Spacebar to insert ". "'),
            value: _prefs.doubleSpacePeriod,
            onChanged: (v) =>
                _setPref('doubleSpacePeriod', v, _prefs.copyWith(doubleSpacePeriod: v)),
          ),
          SwitchListTile(
            title: const Text('Slow-Motion Physics (0.25×)'),
            subtitle: const Text('Inspect typebar plunge & spring return'),
            value: _prefs.slowMo,
            onChanged: (v) => _setPref('slowMo', v, _prefs.copyWith(slowMo: v)),
          ),
        ],
      ),
    );
  }
}
