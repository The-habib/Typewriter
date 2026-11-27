# Contributing to Typewriter

Thank you for helping improve **Typewriter**! Both the Android keyboard application (`app/`) and the interactive 3D landing page (`web/`) live in this monorepo.

## Development Workflow

1. **Fork & Clone**
   ```bash
   git clone https://github.com/<your-username>/Typewriter.git
   cd Typewriter
   ```
2. **Create a Topic Branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Run Checks Locally Before Opening a PR**
   - If you edited `app/`:
     ```bash
     cd app
     flutter pub get
     flutter analyze
     flutter test
     ```
   - If you edited `web/`:
     ```bash
     cd web
     npm install
     npm run lint
     bun test
     npm run build
     ```
4. **Commit & Open a Pull Request**
   - Keep PRs focused on one logical change (`app/` or `web/` or `docs/`).
   - Use clear, descriptive commit messages (e.g., `feat(app): ...`, `fix(web): ...`, `docs: ...`).
   - Fill out the pull request checklist.

## Project Guidelines

- **Zero Telemetry in `app/`**: Never add network tracking, analytics, or keystroke logging to the Android IME.
- **60 FPS Performance**: Keep paint/frame loops allocation-free in both `typewriter_painter.dart` and `MechanismViewport.tsx`.
- **Accessibility & SEO**: Preserve keyboard navigation, ARIA attributes, `prefers-reduced-motion` support, and semantic markup in `web/`.
