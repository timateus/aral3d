const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';

const W = 13.333, H = 7.5;

// Palette mirrors LevelIntroSplash level-1
const DARK   = '06080E';
const WHITE  = 'FFFFFF';
const LAV    = 'F5F1FF';   // italic body color in splash
const BLUE   = '3B82F6';   // pill accent
const FG     = '111418';
const MUTED  = '5B6068';
const PINK   = 'EC4899';
const GREEN  = '10B981';

const FONT_PLAY = 'Trebuchet MS';   // playful uppercase display, as in splash
const FONT_ITAL = 'Georgia';        // italic body, as in splash
const FONT_M    = 'IBM Plex Mono';

function play(s, txt, opts) {
  return s.addText(txt, {
    fontFace: FONT_PLAY, bold: true, charSpacing: 6, ...opts,
  });
}

function ital(s, txt, opts) {
  return s.addText(txt, {
    fontFace: FONT_ITAL, italic: true, ...opts,
  });
}

function kicker(s, txt, color = BLUE, y = 0.9) {
  s.addText(txt, {
    x: 0.6, y, w: 12, h: 0.4,
    fontFace: FONT_M, fontSize: 12, color, charSpacing: 16, bold: true,
  });
}

// Re-create the level-intro pill ("3 · or RB · press to begin" style)
function pill(s, label, x, y) {
  // outer rounded-square pill
  s.addShape(pptx.ShapeType.rect, {
    x, y, w: 4.6, h: 0.85,
    line: { color: BLUE, width: 2 },
    fill: { color: '0E1530' },
    rectRadius: 0.05,
  });
  // inner circle "3"
  s.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.18, y: y + 0.13, w: 0.6, h: 0.6,
    line: { color: BLUE, width: 2 }, fill: { color: BLUE },
  });
  s.addText('3', {
    x: x + 0.18, y: y + 0.13, w: 0.6, h: 0.6,
    fontFace: FONT_M, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle',
  });
  s.addText(label, {
    x: x + 0.95, y: y + 0.18, w: 3.55, h: 0.5,
    fontFace: FONT_M, fontSize: 11, bold: true, color: WHITE, charSpacing: 8, valign: 'middle',
  });
}

const slides = [];

/* ───────────────────────────────────────────────────────────
   1. Title — exactly like Level 1 intro splash
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: DARK };
  s.addText('LEVEL 00', {
    x: 0.6, y: 0.9, w: 12, h: 0.4,
    fontFace: FONT_M, fontSize: 13, color: WHITE, charSpacing: 24, bold: true, align: 'center',
  });
  play(s, 'ARAL3D', {
    x: 0.6, y: 2.2, w: 12, h: 1.8,
    fontSize: 140, color: WHITE, charSpacing: 10, align: 'center',
  });
  ital(s, 'A 3D platform for the Aral Sea basin.', {
    x: 0.6, y: 4.4, w: 12, h: 0.7, fontSize: 30, color: LAV, align: 'center',
  });
  ital(s, 'An educational game and a data exploration tool.', {
    x: 0.6, y: 5.1, w: 12, h: 0.7, fontSize: 24, color: LAV, align: 'center',
  });
  // pill centered
  const pw = 6.4, px = (W - pw) / 2, py = 6.3;
  s.addShape(pptx.ShapeType.rect, {
    x: px, y: py, w: pw, h: 0.85,
    line: { color: BLUE, width: 2 }, fill: { color: '0E1530' }, rectRadius: 0.05,
  });
  s.addShape(pptx.ShapeType.ellipse, {
    x: px + 0.18, y: py + 0.13, w: 0.6, h: 0.6,
    line: { color: BLUE, width: 2 }, fill: { color: BLUE },
  });
  s.addText('3', {
    x: px + 0.18, y: py + 0.13, w: 0.6, h: 0.6,
    fontFace: FONT_M, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle',
  });
  s.addText('OR RB · PRESS TO BEGIN', {
    x: px + 0.95, y: py, w: pw - 1.1, h: 0.85,
    fontFace: FONT_M, fontSize: 11, bold: true, color: WHITE, charSpacing: 8, valign: 'middle',
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   2. The starting question
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'STARTING POINT', PINK);
  play(s, 'WHAT IS WATER?', {
    x: 0.6, y: 1.8, w: 12, h: 1.8,
    fontSize: 120, color: FG, charSpacing: 6,
  });
  ital(s, 'How we picture water shapes how we use it.', {
    x: 0.6, y: 4.1, w: 12, h: 0.9, fontSize: 36, color: BLUE,
  });
  s.addText(
    'Aral3D explores different ways of seeing the basin — as map, as terrain, as climate, as everyday life.',
    { x: 0.6, y: 5.1, w: 11, h: 1.6, fontFace: FONT_PLAY, fontSize: 20, color: MUTED }
  );
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   3. Two modes
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'THE PLATFORM');
  play(s, 'TWO MODES.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 64, color: FG, charSpacing: 4 });

  const colY = 3.2, colH = 3.6;
  s.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: colY, w: 6.0, h: colH,
    line: { color: BLUE, width: 2 }, fill: { color: 'F4F8FF' },
  });
  s.addText('01 — GAME', {
    x: 0.9, y: colY + 0.25, w: 5, h: 0.4,
    fontFace: FONT_M, fontSize: 12, color: BLUE, charSpacing: 12, bold: true,
  });
  play(s, 'PLAY THE BASIN', { x: 0.9, y: colY + 0.85, w: 5.4, h: 0.8, fontSize: 36, color: FG });
  ital(s, 'Short missions, playable worlds. For students, schools and museums.', {
    x: 0.9, y: colY + 1.9, w: 5.4, h: 1.5, fontSize: 20, color: MUTED,
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 6.9, y: colY, w: 6.0, h: colH,
    line: { color: PINK, width: 2 }, fill: { color: 'FFF4F9' },
  });
  s.addText('02 — EXPLORE', {
    x: 7.2, y: colY + 0.25, w: 5, h: 0.4,
    fontFace: FONT_M, fontSize: 12, color: PINK, charSpacing: 12, bold: true,
  });
  play(s, 'READ THE BASIN', { x: 7.2, y: colY + 0.85, w: 5.4, h: 0.8, fontSize: 36, color: FG });
  ital(s, 'Real elevation, historical basins, climate, demographics. Shareable views.', {
    x: 7.2, y: colY + 1.9, w: 5.4, h: 1.5, fontSize: 20, color: MUTED,
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   4-6. Level screenshots — full-bleed image with overlaid title card
   ─────────────────────────────────────────────────────────── */
function levelShot(label, title, subtitle, path, accent = BLUE) {
  const s = pptx.addSlide(); s.background = { color: DARK };
  s.addImage({ path, x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
  // Bottom strip overlay for readable title
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: H - 1.9, w: W, h: 1.9,
    line: { color: WHITE, width: 0, transparency: 100 },
    fill: { color: '06080E', transparency: 15 },
  });
  s.addText(label, {
    x: 0.7, y: H - 1.7, w: 12, h: 0.35,
    fontFace: FONT_M, fontSize: 12, color: accent, charSpacing: 12, bold: true,
  });
  s.addText(title, {
    x: 0.7, y: H - 1.3, w: 12, h: 0.7,
    fontFace: FONT_PLAY, bold: true, fontSize: 36, color: WHITE, charSpacing: 4,
  });
  s.addText(subtitle, {
    x: 0.7, y: H - 0.6, w: 12, h: 0.4,
    fontFace: FONT_ITAL, italic: true, fontSize: 18, color: LAV,
  });
  slides.push(s);
}
levelShot('LEVEL 01 · GAME', 'WELCOME TO NUKUS', 'Travel to the capital of Karakalpakstan.', 'docs/screenshots/04-game-mission1.png', BLUE);
levelShot('LEVEL 02 · VOXEL',  'BUILD AND SURVIVE', 'A playable world on the dried seabed.', 'docs/screenshots/03-voxel-survive.png', GREEN);
levelShot('MODE · EXPLORE',    'READ THE BASIN',    'Real elevation, historical basins, climate.', 'docs/screenshots/02-explore-mode.png', PINK);

/* ───────────────────────────────────────────────────────────
   7. Audiences
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'WHO IT IS FOR');
  play(s, 'AUDIENCES.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 64, color: FG, charSpacing: 4 });
  const rows = [
    ['SCHOOLS',     'Curriculum-ready missions and classroom workshops.', BLUE],
    ['MUSEUMS',     'Touchscreens, projections, controller installations.', PINK],
    ['RESEARCHERS', 'Real elevation and historical layers, shareable views.', GREEN],
    ['MINISTRIES',  'Scenario tools for water, agriculture and ecology.', BLUE],
    ['PUBLIC',      'A playable Aral Sea for festivals and exhibitions.', PINK],
  ];
  let y = 3.2;
  rows.forEach(([k, v, c]) => {
    s.addText(k, {
      x: 0.6, y, w: 3.2, h: 0.5,
      fontFace: FONT_M, fontSize: 12, color: c, charSpacing: 10, bold: true,
    });
    s.addText(v, { x: 3.9, y, w: 9, h: 0.5, fontFace: FONT_PLAY, fontSize: 20, color: FG });
    y += 0.78;
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   8. The ask
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'THE ASK', PINK);
  play(s, '$30,000', { x: 0.6, y: 1.8, w: 12, h: 2.6, fontSize: 220, color: FG, charSpacing: 2 });
  ital(s, 'for six months.', { x: 0.6, y: 4.7, w: 12, h: 0.9, fontSize: 40, color: BLUE });
  s.addText(
    'Product polish, curriculum integration with the Ministry of Education, and museum-ready versions.',
    { x: 0.6, y: 5.8, w: 11, h: 1.4, fontFace: FONT_PLAY, fontSize: 20, color: MUTED }
  );
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   9. Six months
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, '6-MONTH PLAN');
  play(s, 'SIX MONTHS.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });
  const steps = [
    ['M1', 'Polish product, public demo.'],
    ['M2', 'Educational version and ministry talks.'],
    ['M3', 'First curriculum-ready learning module.'],
    ['M4', 'Adapt for Aral Culture Summit 2026.'],
    ['M5', 'Museum versions: Savitsky, Aral Sea Museum, CCA Tashkent.'],
    ['M6', 'Documentation, demo video, 3-year roadmap.'],
  ];
  let y = 3.1;
  steps.forEach(([m, t]) => {
    s.addText(m, { x: 0.6, y, w: 1, h: 0.5, fontFace: FONT_M, fontSize: 16, color: BLUE, bold: true });
    s.addText(t, { x: 1.9, y, w: 11, h: 0.5, fontFace: FONT_PLAY, fontSize: 20, color: FG });
    y += 0.7;
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   10. Budget
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, '6-MONTH BUDGET');
  play(s, 'WHERE IT GOES.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });
  const items = [
    ['Product polishing and frontend',    '$8,000'],
    ['Educational module and curriculum', '$6,000'],
    ['Museum and exhibition adaptation',  '$9,000'],
    ['Visual and interface design',       '$3,000'],
    ['Documentation, video, materials',   '$2,000'],
    ['Coordination and production',       '$2,000'],
  ];
  let y = 3.1;
  items.forEach(([k, v]) => {
    s.addText(k, { x: 0.6, y, w: 9, h: 0.5, fontFace: FONT_PLAY, fontSize: 20, color: FG });
    s.addText(v, {
      x: 9.6, y, w: 3.2, h: 0.5,
      fontFace: FONT_M, fontSize: 18, color: BLUE, align: 'right', bold: true,
    });
    y += 0.6;
  });
  s.addText('TOTAL', {
    x: 0.6, y: y + 0.15, w: 9, h: 0.5,
    fontFace: FONT_M, fontSize: 14, color: MUTED, charSpacing: 10, bold: true,
  });
  play(s, '$30,000', {
    x: 9.6, y: y + 0.05, w: 3.2, h: 0.7,
    fontSize: 32, color: PINK, align: 'right',
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   11. 3-year
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, '3-YEAR PLAN');
  play(s, '$150K · 3 YEARS.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });
  const ys = [
    ['Y1', 'Curriculum alignment, school pilots, museum installations.', BLUE],
    ['Y2', 'New learning modules, exhibition formats, regional stories.', PINK],
    ['Y3', 'Free public platform for education, culture and ecology.', GREEN],
  ];
  let y = 3.4;
  ys.forEach(([k, v, c]) => {
    s.addText(k, { x: 0.6, y, w: 1.2, h: 0.6, fontFace: FONT_M, fontSize: 22, color: c, bold: true });
    s.addText(v, { x: 2.0, y, w: 11, h: 0.7, fontFace: FONT_PLAY, fontSize: 22, color: FG });
    y += 1.1;
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   12. Venues
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'WHERE IT GOES');
  play(s, 'VENUES.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });
  const items = [
    'Aral Culture Summit 2026',
    'Savitsky Museum',
    'History and Aral Sea Museum',
    'Center for Contemporary Art, Tashkent',
    'Tashkent Design Week',
    'Milan Design Week',
    'Venice Architecture Biennale',
    'Venice Art Biennale',
  ];
  const colors = [BLUE, PINK, GREEN, BLUE];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2, y = 3.2 + row * 0.85;
    s.addText(String(i + 1).padStart(2, '0'), {
      x, y, w: 0.7, h: 0.5,
      fontFace: FONT_M, fontSize: 13, color: colors[i % 4], bold: true,
    });
    s.addText(it, { x: x + 0.7, y, w: 5.3, h: 0.5, fontFace: FONT_PLAY, fontSize: 20, color: FG });
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   13. Funding
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'FUNDING MODEL');
  play(s, 'FREE, BY DEFAULT.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });
  ital(s, 'Aral3D stays free for schools, students, teachers, researchers, museums and public institutions.', {
    x: 0.6, y: 3.0, w: 12, h: 1.0, fontSize: 22, color: BLUE,
  });
  s.addText('CORE SUPPORT', {
    x: 0.6, y: 4.5, w: 6, h: 0.3,
    fontFace: FONT_M, fontSize: 11, color: BLUE, charSpacing: 10, bold: true,
  });
  s.addText('Ministry of Education, Ministry of Ecology, public educational and environmental programs, state museums, universities.', {
    x: 0.6, y: 4.9, w: 6, h: 2.4, fontFace: FONT_PLAY, fontSize: 15, color: FG,
  });
  s.addText('OPTIONAL', {
    x: 7.0, y: 4.5, w: 6, h: 0.3,
    fontFace: FONT_M, fontSize: 11, color: PINK, charSpacing: 10, bold: true,
  });
  s.addText('Private museums, festivals, private educational centers, commissioned exhibition versions, international cultural programs.', {
    x: 7.0, y: 4.9, w: 6, h: 2.4, fontFace: FONT_PLAY, fontSize: 15, color: FG,
  });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   14. Team
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  kicker(s, 'TEAM');
  play(s, 'BY.', { x: 0.6, y: 1.6, w: 12, h: 1.2, fontSize: 56, color: FG, charSpacing: 4 });

  play(s, 'TIMOFEY NOSOV', { x: 0.6, y: 3.2, w: 12, h: 1.0, fontSize: 60, color: FG, charSpacing: 4 });
  play(s, 'ROBERT WILLARD', { x: 0.6, y: 4.2, w: 12, h: 1.0, fontSize: 60, color: FG, charSpacing: 4 });

  s.addText('CONTACT', {
    x: 0.6, y: 5.8, w: 12, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: BLUE, charSpacing: 10, bold: true,
  });
  ital(s, 'timnosov@gmail.com', { x: 0.6, y: 6.2, w: 12, h: 0.7, fontSize: 32, color: PINK });
  slides.push(s);
}

/* ───────────────────────────────────────────────────────────
   15. Closing
   ─────────────────────────────────────────────────────────── */
{
  const s = pptx.addSlide(); s.background = { color: WHITE };
  play(s, 'ARAL3D', { x: 0.6, y: 2.6, w: 12, h: 1.8, fontSize: 160, color: FG, charSpacing: 8 });
  ital(s, 'A 3D platform for the Aral Sea basin.', {
    x: 0.6, y: 4.7, w: 12, h: 0.8, fontSize: 30, color: PINK,
  });
  s.addText('aral3d.com', {
    x: 0.6, y: 5.6, w: 12, h: 0.5,
    fontFace: FONT_M, fontSize: 14, color: BLUE, charSpacing: 10, bold: true,
  });
  slides.push(s);
}

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f => {
  console.log('wrote', f, 'slides:', slides.length);
});
