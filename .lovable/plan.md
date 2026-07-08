## Delete slides/presentation functionality

Remove all presentation-related code, assets, and build tooling.

**Delete:**
- `src/pages/Presentation.tsx`
- `scripts/build-presentation.cjs`
- `public/presentation/` (all slide-*.jpg thumbnails)
- `public/aral3d-presentation.pdf`
- `public/aral3d-presentation.pptx`

**Edit `src/App.tsx`:**
- Remove `import PresentationPage from "./pages/Presentation"`
- Remove `<Route path="/presentation" element={<PresentationPage />} />`

Unrelated matches (`AgmarTourOverlay`, `SchoolTwelveOverlay`, `breadcrumb.tsx`) are left alone — they don't relate to the slides feature.