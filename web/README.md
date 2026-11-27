# Typewriter Web 3D Showcase (`web/`)

The interactive Three.js + React + Tailwind CSS landing page for **Typewriter**.

## Highlights

- **3D Mechanical Assembly (`src/mechanism/`)**: Parametric blueprint (`blueprint.ts`), procedural geometry (`geometryBuilders.ts`), custom GLSL chrome/porcelain/SDF shadow shaders (`typewriterShaders.ts`), 2nd-order symplectic spring solver (`kinematics.ts`), hybrid sampled-WAV + procedural Web Audio engine (`mechanicalAudio.ts`), and 5-chapter scroll choreography (`scrollChoreography.ts`).
- **UI & Dossier (`src/components/`)**: CNC-notched navigation (`TopNav.tsx`), scroll story overlay (`ScrollStoryOverlay.tsx`), interactive CAD dial + Android showcase + metallic finishes (`EngineeringDossier.tsx`), interactive 3D workbench (`WorkbenchDock.tsx`), and open-source release hub (`InquiryFooter.tsx`).
- **SEO & PWA**: Complete Open Graph, Twitter Card, Schema.org JSON-LD (`SoftwareApplication` + `SoftwareSourceCode`), `robots.txt`, `sitemap.xml`, favicons, and `site.webmanifest`.

## Commands

```bash
npm install
npm run dev      # Local Vite dev server
npm run lint     # TypeScript check (tsc --noEmit)
bun test         # Mechanism kinematics & scroll choreography unit tests
npm run build    # Production bundle in dist/
```
