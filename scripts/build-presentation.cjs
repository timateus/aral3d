const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';

const W = 13.333, H = 7.5;

// Palette taken from the Level 1 splash page
const BG    = 'F5F0E8';
const FG    = '2B2B2B';
const MUTED = '8A8A8A';
const RULE  = 'BFB9AE';

const RED    = 'E84C2C';
const GREEN  = '1FAE52';
const BLUE   = '1A1FE0';
const PINK   = 'EC4899';
const CYAN   = '22D3EE';
const ORANGE = 'F59E0B';
const COLORS = [RED, GREEN, BLUE, PINK, ORANGE, CYAN];

const FONT_PLAY = 'Trebuchet MS';
const FONT_ITAL = 'Georgia';
const FONT_M    = 'Helvetica';

const slides = [];

function chrome(s, levelLabel, title) {
  s.addText(levelLabel, {
    x: 0, y: 0.35, w: W, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8, align: 'center',
  });
  s.addText(title, {
    x: 0, y: 0.7, w: W, h: 0.45,
    fontFace: FONT_M, fontSize: 16, color: FG, charSpacing: 8, align: 'center',
  });
  s.addShape(pptx.ShapeType.line, {
    x: W / 2 - 0.8, y: 1.25, w: 1.6, h: 0,
    line: { color: RULE, width: 0.75 },
  });
}

function playful(s, words, opts) {
  const runs = words.map((w, i) => ({
    text: (i === 0 ? '' : ' ') + w,
    options: { color: COLORS[i % COLORS.length] },
  }));
  s.addText(runs, {
    x: 0.3, y: opts.y, w: W - 0.6, h: opts.h ?? 1.6,
    fontFace: FONT_ITAL, italic: true, bold: true,
    fontSize: opts.fontSize ?? 88,
    align: 'center', valign: 'middle',
  });
}

function subtitle(s, words, opts = {}) {
  const runs = words.map((w, i) => ({
    text: (i === 0 ? '' : ' ') + w,
    options: { color: COLORS[(i + 2) % COLORS.length] },
  }));
  s.addText(runs, {
    x: 0.6, y: opts.y ?? 5.0, w: W - 1.2, h: opts.h ?? 1.0,
    fontFace: FONT_ITAL, italic: true,
    fontSize: opts.fontSize ?? 24,
    align: 'center', valign: 'middle',
  });
}

function bgShot(s, path) {
  s.addImage({ path, x: 1.0, y: 2.0, w: W - 2.0, h: 4.2, sizing: { type: 'contain', w: W - 2.0, h: 4.2 } });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 2.0, w: W, h: 4.2,
    line: { color: BG, width: 0, transparency: 100 },
    fill: { color: BG, transparency: 55 },
  });
}

function bodyPara(s, txt, y, opts = {}) {
  s.addText(txt, {
    x: opts.x ?? 1.4, y, w: opts.w ?? (W - 2.8), h: opts.h ?? 0.5,
    fontFace: FONT_M, fontSize: opts.fontSize ?? 15, color: opts.color ?? FG,
    align: opts.align ?? 'left', italic: opts.italic ?? false,
  });
}

/* size headline based on word length so it fits */
function autoSize(words) {
  const len = words.join(' ').length;
  if (len <= 12) return 110;
  if (len <= 20) return 88;
  if (len <= 30) return 70;
  return 56;
}

function makeHero(level, title, headline, subWords) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, level, title);
  playful(s, headline, { y: 2.6, fontSize: autoSize(headline) });
  if (subWords) subtitle(s, subWords, { y: 5.4, fontSize: 24 });
  slides.push(s);
  return s;
}

function makeShot(level, title, headline, subWords, shot) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, level, title);
  bgShot(s, shot);
  playful(s, headline, { y: 2.6, fontSize: autoSize(headline) });
  if (subWords) subtitle(s, subWords, { y: 5.4, fontSize: 24 });
  slides.push(s);
  return s;
}

function makeList(level, title, headline, items, opts = {}) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, level, title);
  playful(s, headline, { y: 1.8, fontSize: opts.headlineSize ?? 72 });
  let y = opts.startY ?? 4.0;
  const gap = opts.gap ?? 0.5;
  items.forEach((it, i) => {
    if (Array.isArray(it)) {
      const [k, v] = it;
      s.addText(k, {
        x: 1.4, y, w: 3.0, h: 0.45,
        fontFace: FONT_ITAL, italic: true, bold: true,
        fontSize: 18, color: COLORS[i % COLORS.length],
      });
      s.addText(v, {
        x: 4.6, y: y + 0.04, w: 7.5, h: 0.45,
        fontFace: FONT_M, fontSize: 14, color: FG,
      });
    } else {
      s.addText(String(i + 1).padStart(2, '0'), {
        x: 1.4, y, w: 0.6, h: 0.45,
        fontFace: FONT_ITAL, italic: true, bold: true,
        fontSize: 16, color: COLORS[i % COLORS.length],
      });
      s.addText(it, {
        x: 2.1, y: y + 0.03, w: 10.0, h: 0.45,
        fontFace: FONT_M, fontSize: 15, color: FG,
      });
    }
    y += gap;
  });
  slides.push(s);
  return s;
}

/* paragraph slide — playful headline + 1-2 prose paragraphs below */
function makeProse(level, title, headline, paragraphs) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, level, title);
  playful(s, headline, { y: 1.8, fontSize: autoSize(headline) });
  let y = 4.2;
  paragraphs.forEach((p) => {
    s.addText(p, {
      x: 1.4, y, w: W - 2.8, h: 0.9,
      fontFace: FONT_M, fontSize: 15, color: FG, align: 'center',
    });
    y += 1.0;
  });
  slides.push(s);
  return s;
}

/* ───── 1. Title ───── */
makeShot(
  'INTRO',
  'ARAL3D',
  ['a', 'playable', 'aral', 'sea'],
  ['a', 'public', '3D', 'platform', 'for', 'learning,', 'memory,', 'and', 'environmental', 'imagination'],
  'docs/screenshots/01-landing.png',
);

/* ───── 2. Clear intro ───── */
makeProse(
  'CHAPTER 1',
  'WHAT IT IS',
  ['one', 'browser,', 'one', 'basin'],
  [
    'Aral3D is a browser-based 3D platform about the Aral Sea region.',
    'It combines maps, terrain, stories, environmental data, and interactive scenarios into one public learning tool — for schools, museums, festivals, and cultural institutions.',
  ],
);

/* ───── 3. Why the Aral Sea ───── */
makeProse(
  'CHAPTER 2',
  'WHY THE ARAL SEA',
  ['more', 'than', 'a', 'disappearing', 'sea'],
  [
    'The Aral Sea is one of the most important environmental stories of the region.',
    'But it is not only about a vanishing sea — it is about water, health, infrastructure, agriculture, memory, climate, borders, and future choices. Aral3D helps people see these layers together.',
  ],
);

/* ───── 4. The Problem ───── */
makeProse(
  'CHAPTER 3',
  'THE PROBLEM',
  ['flat', 'maps,', 'distant', 'stories'],
  [
    'Most people meet the Aral Sea through flat maps, old photographs, statistics, or disaster narratives — important, but distant.',
    'Aral3D makes the region spatial, interactive, and easier to understand. Instead of only reading about change, users can move through it, test scenarios, and ask questions.',
  ],
);

/* ───── 5. Core Philosophy ───── */
makeProse(
  'CHAPTER 4',
  'CORE PHILOSOPHY',
  ['maps', 'are', 'not', 'neutral'],
  [
    'The way we imagine water affects the way we treat it.',
    'Water can appear as a resource, a border, a memory, a health issue, an infrastructure system, a political question, or a shared future. Aral3D turns the map into a space for learning, questioning, and imagination.',
  ],
);

/* ───── 6. What the platform does ───── */
makeShot(
  'CHAPTER 5',
  'WHAT IT DOES',
  ['explore', 'the', 'basin', 'in', '3D'],
  ['terrain,', 'water,', 'settlements,', 'canals,', 'dams,', 'ecology,', 'and', 'future', 'scenarios'],
  'docs/screenshots/02-explore-mode.png',
);

/* ───── 7. Current status ───── */
makeShot(
  'CHAPTER 6',
  'CURRENT STATUS',
  ['the', 'prototype', 'works'],
  ['3D', 'terrain,', 'map', 'layers,', 'water', 'scenarios,', 'and', 'interactive', 'exploration'],
  'docs/screenshots/04-game-mission1.png',
);

/* ───── 8. First public uses ───── */
makeList(
  'CHAPTER 7',
  'FIRST PUBLIC USES',
  ['where', 'it', 'lands', 'first'],
  [
    'Aral Culture Summit 2026',
    'Savitsky Museum',
    'History and Aral Sea Museum',
    'Center for Contemporary Art, Tashkent',
    'Schools and educational programs',
    'Public workshops and festivals',
  ],
  { startY: 3.7, gap: 0.5 },
);

/* ───── 9. Education potential ───── */
makeList(
  'CHAPTER 8',
  'EDUCATION POTENTIAL',
  ['a', 'tool', 'for', 'classrooms'],
  [
    ['Geography',  'How water systems work and how landscapes change.'],
    ['Ecology',    'How human decisions shape fragile ecosystems.'],
    ['History',    'Memory of a region told through its terrain.'],
    ['Design',     'Visual literacy for maps, data, and storytelling.'],
    ['Civics',     'Shared decisions about water, land, and future.'],
  ],
  { startY: 3.8, gap: 0.6 },
);

/* ───── 10. Cultural and design potential ───── */
makeList(
  'CHAPTER 9',
  'CULTURAL & DESIGN POTENTIAL',
  ['installation,', 'archive,', 'speculation'],
  [
    'Tashkent Design Week',
    'Milan Design Week',
    'Venice Architecture Biennale',
    'Venice Art Biennale',
  ],
  { startY: 4.2, gap: 0.6, headlineSize: 64 },
);

/* ───── 11. Business model ───── */
{
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, 'CHAPTER 10', 'INSTITUTIONAL MODEL');
  playful(s, ['free,', 'by', 'default'], { y: 1.8, fontSize: 92 });
  subtitle(s, ['for', 'schools,', 'museums,', 'researchers,', 'and', 'the', 'public'], { y: 3.7, fontSize: 22 });
  s.addText('CORE SUPPORT', {
    x: 1.0, y: 4.8, w: 5.5, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8,
  });
  s.addText('Ministries, museums, schools, cultural foundations, environmental organisations, and international institutions.', {
    x: 1.0, y: 5.2, w: 5.5, h: 1.8, fontFace: FONT_M, fontSize: 14, color: FG,
  });
  s.addText('OPTIONAL', {
    x: 7.0, y: 4.8, w: 5.5, h: 0.35,
    fontFace: FONT_M, fontSize: 11, color: MUTED, charSpacing: 8,
  });
  s.addText('Paid adaptations for private museums, festivals, educational centres, and commissioned exhibitions.', {
    x: 7.0, y: 5.2, w: 5.5, h: 1.8, fontFace: FONT_M, fontSize: 14, color: FG,
  });
  slides.push(s);
}

/* ───── 12. Implementation support ───── */
{
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, 'CHAPTER 11', 'IMPLEMENTATION SUPPORT');
  playful(s, ['from', 'prototype', 'to', 'platform'], { y: 1.8, fontSize: 70 });
  // Two big numbers side by side
  s.addText('$30,000', {
    x: 0.6, y: 3.6, w: 6.0, h: 1.4,
    fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 80, color: BLUE, align: 'center',
  });
  s.addText('for the first 6 months', {
    x: 0.6, y: 4.9, w: 6.0, h: 0.5,
    fontFace: FONT_M, fontSize: 14, color: MUTED, align: 'center',
  });
  s.addText('polish, learning materials, audience testing, museum & festival formats', {
    x: 0.6, y: 5.4, w: 6.0, h: 1.2,
    fontFace: FONT_M, fontSize: 13, color: FG, align: 'center',
  });

  s.addText('$50,000', {
    x: 6.7, y: 3.6, w: 6.0, h: 1.4,
    fontFace: FONT_ITAL, italic: true, bold: true, fontSize: 80, color: PINK, align: 'center',
  });
  s.addText('per year, 3-year phase', {
    x: 6.7, y: 4.9, w: 6.0, h: 0.5,
    fontFace: FONT_M, fontSize: 14, color: MUTED, align: 'center',
  });
  s.addText('maintain the platform, expand content, support workshops, keep it free', {
    x: 6.7, y: 5.4, w: 6.0, h: 1.2,
    fontFace: FONT_M, fontSize: 13, color: FG, align: 'center',
  });
  slides.push(s);
}

/* ───── 13. First 6 months ───── */
makeList(
  'CHAPTER 12',
  'FIRST 6 MONTHS',
  ['six', 'months,', 'one', 'public', 'version'],
  [
    ['Polish',     'Product and user experience.'],
    ['Demo',       'A presentable public version.'],
    ['Materials',  'Educational content for classrooms.'],
    ['Testing',    'With students, teachers, museum audiences.'],
    ['Formats',    'Festival and exhibition adaptations.'],
    ['Partners',   'Institutional partnerships and documentation.'],
  ],
  { startY: 3.6, gap: 0.5, headlineSize: 62 },
);

/* ───── 14. Three-year vision ───── */
makeProse(
  'CHAPTER 13',
  'THREE-YEAR VISION',
  ['a', 'living', 'public', 'platform'],
  [
    'Over three years Aral3D can grow into a long-term public platform for the Aral Sea region.',
    'New layers, new stories, new educational modules and installations — a learning tool and a cultural archive that stays alive, updates over time, and remains accessible.',
  ],
);

/* ───── 15. Expansion ───── */
makeList(
  'CHAPTER 14',
  'EXPANSION POTENTIAL',
  ['aral', 'is', 'the', 'first', 'case'],
  [
    'Caspian Sea',
    'Venice',
    'River deltas',
    'Drylands',
    'Irrigation landscapes',
    'Other climate-affected regions',
  ],
  { startY: 3.7, gap: 0.5, headlineSize: 70 },
);

/* ───── 16. Why now ───── */
makeProse(
  'CHAPTER 15',
  'WHY NOW',
  ['the', 'prototype', 'is', 'already', 'alive'],
  [
    'Environmental education needs better tools. Museums and schools need formats that are visual, interactive, and accessible.',
    'The Aral Sea story needs to be told not only as a past disaster, but as a living question about the future. With support, Aral3D moves from prototype to public platform.',
  ],
);

/* ───── 17. Team ───── */
{
  const s = pptx.addSlide();
  s.background = { color: BG };
  chrome(s, 'CHAPTER 16', 'TEAM');
  playful(s, ['timofey', 'and', 'robert'], { y: 2.4, fontSize: 96 });
  subtitle(s, ['the', 'people', 'behind', 'aral3d'], { y: 4.4, fontSize: 26 });
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

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f => {
  console.log('wrote', f, 'slides:', slides.length);
});
