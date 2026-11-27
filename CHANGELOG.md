# Changelog

All notable changes to **Typewriter** are documented in this file.

## [1.0.0] - 2026-11-28

### Added
- **Unified Open-Source Monorepo**: Combined the Flutter + Kotlin Android IME & Companion App (`app/`) and the React + Three.js 3D Landing Page (`web/`) into `The-habib/Typewriter`.
- **Android IME & Companion App (`app/`)**:
  - 32-key mechanical typewriter layout (`ABC`, `123`, `#+=` layers) with committed plunge kinematics and 17 steel lever bars.
  - Classic, Crystal X-Ray, and Blueprint mechanism views + `0.25×` slow-motion mode.
  - Native `SoundPool` playback for 7 sampled WAV strikes and 3 haptic feedback levels.
  - 4,770-word offline predictive text, Spacebar cursor trackpad, Backspace swipe-left word delete, chorded Shift/123 drag, Emoji drawer, 15-item Clipboard history, and Voice input.
- **3D Showcase & SEO (`web/`)**:
  - Updated branding, official Typewriter logo, multi-size `.ico`/PNG favicons, PWA manifest, and 1200×630 Open Graph social card.
  - Hybrid sampled-WAV + procedural Web Audio engine matching the Android IME sound profile.
  - Real Android screenshots, technical specification strips, and functional Open-Source Release & Quick-Start hub.
  - Technical SEO (`robots.txt`, `sitemap.xml`, canonical tags, Schema.org JSON-LD) and GitHub Actions CI/CD + GitHub Pages deployment.
