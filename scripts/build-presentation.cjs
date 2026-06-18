const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';

const W = 13.333, H = 7.5;

// Palette taken from the Level 1 splash page
const BG    = 'F5F0E8';   // cream background
const FG    = '2B2B2B';   // chrome text
const MUTED = '8A8A8A';   // small label color
const RULE  = 'BFB9AE';   // thin divider line color

// Playful word colors (each headline word picks one)
const RED   = 'E84C2C';
const GREEN = '1FAE52';
const BLUE  = '1A1FE0';
const PINK  = 'EC4899';
const CYAN  = '22D3EE';
const ORANGE= 'F59E0B';

const COLORS = [RED, GREEN, BLUE, PINK, ORANGE, CYAN];

const FONT_PLAY = 'Trebuchet MS';   // playful display
const FONT_ITAL = 'Georgia';        // italic accents
const FONT_M    = 'Helvetica';      // chrome (matches level page sans)

const slides = [];

/* ── chrome header: LEVEL N · TITLE · thin rule ───────────── */
function chrome(s, levelLabel, title) {
  s.addText(levelLabel, {
    x: 0, y: 0.35, w: W, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8,
    align: 'center', bold: false,
  });
  s.addText(title, {
    x: 0, y: 0.7, w: W, h: 0.45,
    fontFace: FONT_M, fontSize: 16, color: FG, charSpacing: 8,
    align: 'center',
  });
  // thin rule under title
  s.addShape(pptx.ShapeType.line, {
    x: W / 2 - 0.8, y: 1.25, w: 1.6, h: 0,
    line: { color: RULE, width: 0.75 },
  });
}

/* ── playful multi-colored headline ───────────────────────── */
function playful(s, words, opts) {
  const runs = words.map((w, i) => ({
    text: (i === 0 ? '' : ' ') + w,
    options: { color: COLORS[i % COLORS.length] },
  }));
  s.addText(runs, {
    x: 0.3, y: opts.y, w: W - 0.6, h: opts.h ?? 1.6,
    fontFace: FONT_ITAL, italic: true, bold: true,
    fontSize: opts.fontSize ?? 96,
    align: 'center', valign: 'middle',
    charSpacing: 0,
  });
}

/* ── italic colored subtitle ──────────────────────────────── */
function subtitle(s, words, opts = {}) {
  const runs = words.map((w, i) => ({
    text: (i === 0 ? '' : ' ') + w,
    options: { color: COLORS[(i + 2) % COLORS.length] },
  }));
  s.addText(runs, {
    x: 0.3, y: opts.y ?? 5.0, w: W - 0.6, h: 0.7,
    fontFace: FONT_ITAL, italic: true,
    fontSize: opts.fontSize ?? 28,
    align: 'center', valign: 'middle',
  });
}

/* ── optional faded background screenshot in middle band ── */
function bgShot(s, path) {
  // light fade by placing image then a translucent cream rect on top
  s.addImage({ path, x: 1.0, y: 2.0, w: W - 2.0, h: 4.2, sizing: { type: 'contain', w: W - 2.0, h: 4.2 } });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 2.0, w: W, h: 4.2,
    line: { color: BG, width: 0, transparency: 100 },
    fill: { color: BG, transparency: 55 },
  });
}

/* ── plain body line (for budget/team/etc lists) ──────────── */
function body(s, txt, y, opts = {}) {
  s.addText(txt, {
    x: 0.6, y, w: W - 1.2, h: 0.5,
    fontFace: FONT_M, fontSize: opts.fontSize ?? 16, color: opts.color ?? FG,
    align: opts.align ?? 'left',
  });
}

function makeSlide(level, title, headline, sub, shot) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, level, title);
  if (shot) bgShot(s, shot);
  playful(s, headline, { y: 2.6, fontSize: headline.join(' ').length > 22 ? 76 : 100 });
  if (sub) subtitle(s, sub, { y: 5.4 });
  slides.push(s);
  return s;
}

/* 1. Title */
makeSlide(
  'INTRO',
  'ARAL3D',
  ['a', 'playable', 'aral', 'sea'],
  ['a', '3D', 'platform', 'for', 'education', 'and', 'exploration'],
);

/* 2. Question */
makeSlide(
  'LEVEL 1',
  'THE STARTING QUESTION',
  ['what', 'is', 'water?'],
  ['how', 'we', 'picture', 'water', 'shapes', 'how', 'we', 'use', 'it'],
);

/* 3. Two modes */
makeSlide(
  'LEVEL 2',
  'THE PLATFORM',
  ['two', 'modes,', 'one', 'basin'],
  ['a', 'game', 'to', 'play', '—', 'an', 'explorer', 'to', 'read'],
);

/* 4. Game */
makeSlide(
  'LEVEL 3',
  'GAME MODE',
  ['play', 'the', 'basin'],
  ['short', 'missions', 'for', 'schools,', 'museums,', 'and', 'the', 'public'],
  'docs/screenshots/04-game-mission1.png',
);

/* 5. Voxel */
makeSlide(
  'LEVEL 4',
  'BUILD AND SURVIVE',
  ['a', 'world', 'on', 'the', 'seabed'],
  ['mine,', 'plant,', 'flood,', 'restore'],
  'docs/screenshots/03-voxel-survive.png',
);

/* 6. Explore */
makeSlide(
  'LEVEL 5',
  'EXPLORE MODE',
  ['read', 'the', 'basin'],
  ['real', 'elevation,', 'historical', 'lakes,', 'climate,', 'demographics'],
  'docs/screenshots/02-explore-mode.png',
);

/* 7. Audiences */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 6', 'WHO IT IS FOR');
  playful(s, ['who', 'plays', 'with', 'it'], { y: 1.8, fontSize: 84 });
  const rows = [
    ['Schools',     'Curriculum-ready missions and classroom workshops.'],
    ['Museums',     'Touchscreens, projections, controller installations.'],
    ['Researchers', 'Real elevation and historical layers, shareable views.'],
    ['Ministries',  'Scenario tools for water, agriculture and ecology.'],
    ['Public',      'A playable Aral Sea for festivals and exhibitions.'],
  ];
  let y = 4.2;
  rows.forEach(([k, v], i) => {
    s.addText(k, {
      x: 1.0, y, w: 3.0, h: 0.45,
      fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 22, color: COLORS[i % COLORS.length],
    });
    s.addText(v, {
      x: 4.2, y: y + 0.05, w: 8.2, h: 0.45,
      fontFace: FONT_M, fontSize: 14, color: FG,
    });
    y += 0.55;
  });
  slides.push(s);
}

/* 8. Ask */
makeSlide(
  'LEVEL 7',
  'THE ASK',
  ['$30,000', 'for', '6', 'months'],
  ['polish,', 'curriculum,', 'and', 'museum-ready', 'versions'],
);

/* 9. Six months */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 8', 'SIX-MONTH PLAN');
  playful(s, ['six', 'months,', 'six', 'moves'], { y: 1.8, fontSize: 80 });
  const steps = [
    ['M1', 'Polish product, public demo.'],
    ['M2', 'Educational version, ministry talks.'],
    ['M3', 'First curriculum-ready learning module.'],
    ['M4', 'Adapt for Aral Culture Summit 2026.'],
    ['M5', 'Museum versions: Savitsky, Aral Sea Museum, CCA Tashkent.'],
    ['M6', 'Documentation, demo video, 3-year roadmap.'],
  ];
  let y = 4.0;
  steps.forEach(([m, t], i) => {
    s.addText(m, {
      x: 1.4, y, w: 0.9, h: 0.45,
      fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 20, color: COLORS[i % COLORS.length],
    });
    s.addText(t, {
      x: 2.5, y: y + 0.03, w: 9.5, h: 0.45,
      fontFace: FONT_M, fontSize: 15, color: FG,
    });
    y += 0.5;
  });
  slides.push(s);
}

/* 10. Budget */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 9', 'WHERE THE BUDGET GOES');
  playful(s, ['$30,000', 'in', 'six', 'parts'], { y: 1.8, fontSize: 78 });
  const items = [
    ['Product polishing and frontend',    '$8,000'],
    ['Educational module and curriculum', '$6,000'],
    ['Museum and exhibition adaptation',  '$9,000'],
    ['Visual and interface design',       '$3,000'],
    ['Documentation, video, materials',   '$2,000'],
    ['Coordination and production',       '$2,000'],
  ];
  let y = 4.0;
  items.forEach(([k, v], i) => {
    s.addText(k, {
      x: 1.4, y, w: 8.0, h: 0.45,
      fontFace: FONT_M, fontSize: 15, color: FG,
    });
    s.addText(v, {
      x: 9.6, y, w: 2.4, h: 0.45,
      fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 16, color: COLORS[i % COLORS.length],
      align: 'right',
    });
    y += 0.45;
  });
  s.addText('TOTAL', {
    x: 1.4, y: y + 0.2, w: 8.0, h: 0.45, fontFace: FONT_M, fontSize: 12, color: MUTED, charSpacing: 8,
  });
  s.addText('$30,000', {
    x: 9.6, y: y + 0.15, w: 2.4, h: 0.5, fontFace: FONT_ITAL, italic: true, bold: true,
    fontSize: 24, color: PINK, align: 'right',
  });
  slides.push(s);
}

/* 11. 3-year plan */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 10', 'THREE-YEAR PLAN');
  playful(s, ['$150k', 'over', '3', 'years'], { y: 1.8, fontSize: 80 });
  const ys = [
    ['Y1', 'Curriculum alignment, school pilots, museum installations.'],
    ['Y2', 'New learning modules, exhibition formats, regional stories.'],
    ['Y3', 'Free public platform for education, culture and ecology.'],
  ];
  let y = 4.4;
  ys.forEach(([k, v], i) => {
    s.addText(k, {
      x: 1.4, y, w: 1.0, h: 0.6,
      fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 26, color: COLORS[i % COLORS.length],
    });
    s.addText(v, {
      x: 2.6, y: y + 0.05, w: 9.5, h: 0.6,
      fontFace: FONT_M, fontSize: 17, color: FG,
    });
    y += 0.85;
  });
  slides.push(s);
}

/* 12. Venues */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 11', 'VENUES');
  playful(s, ['where', 'it', 'travels'], { y: 1.8, fontSize: 90 });
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
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 1.0 + col * 5.8, y = 4.0 + row * 0.55;
    s.addText(String(i + 1).padStart(2, '0'), {
      x, y, w: 0.6, h: 0.45,
      fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 16, color: COLORS[i % COLORS.length],
    });
    s.addText(it, {
      x: x + 0.7, y: y + 0.03, w: 5.0, h: 0.45,
      fontFace: FONT_M, fontSize: 15, color: FG,
    });
  });
  slides.push(s);
}

/* 13. Funding */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 12', 'FUNDING MODEL');
  playful(s, ['free,', 'by', 'default'], { y: 1.8, fontSize: 96 });
  subtitle(s, ['for', 'schools,', 'museums,', 'researchers,', 'and', 'the', 'public'], { y: 4.0, fontSize: 24 });
  s.addText('CORE SUPPORT', {
    x: 1.0, y: 5.0, w: 5.5, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8,
  });
  s.addText('Ministry of Education, Ministry of Ecology, state museums, universities, public programs.', {
    x: 1.0, y: 5.4, w: 5.5, h: 1.6, fontFace: FONT_M, fontSize: 14, color: FG,
  });
  s.addText('OPTIONAL', {
    x: 7.0, y: 5.0, w: 5.5, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8,
  });
  s.addText('Private museums, festivals, commissioned exhibition versions, international cultural programs.', {
    x: 7.0, y: 5.4, w: 5.5, h: 1.6, fontFace: FONT_M, fontSize: 14, color: FG,
  });
  slides.push(s);
}

/* 14. Team */
{
  const s = pptx.addSlide(); s.background = { color: BG };
  chrome(s, 'LEVEL 13', 'TEAM');
  playful(s, ['timofey', 'and', 'robert'], { y: 2.4, fontSize: 96 });
  subtitle(s, ['the', 'people', 'behind', 'aral3d'], { y: 4.4, fontSize: 28 });
  s.addText('CONTACT', {
    x: 0, y: 5.6, w: W, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8, align: 'center',
  });
  s.addText('timnosov@gmail.com', {
    x: 0, y: 5.95, w: W, h: 0.6,
    fontFace: FONT_ITAL, italic: true, fontSize: 28, color: BLUE, align: 'center',
  });
  slides.push(s);
}

/* 15. Closing */
makeSlide(
  'OUTRO',
  'ARAL3D',
  ['thank', 'you'],
  ['aral3d.com'],
);

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f => {
  console.log('wrote', f, 'slides:', slides.length);
});
