const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';

const W = 13.333, H = 7.5;
const BG = 'FFFFFF';
const FG = '000000';
const MUTED = '666666';
const FONT = 'Helvetica';

function slide() {
  const s = pptx.addSlide();
  s.background = { color: BG };
  return s;
}

function label(s, txt) {
  s.addText(txt, {
    x: 0.6, y: 0.5, w: W - 1.2, h: 0.35,
    fontFace: FONT, fontSize: 10, color: MUTED, charSpacing: 6,
  });
}

function title(s, txt, opts = {}) {
  s.addText(txt, {
    x: 0.6, y: opts.y ?? 1.0, w: W - 1.2, h: opts.h ?? 1.0,
    fontFace: FONT, fontSize: opts.size ?? 36, color: FG, bold: true,
  });
}

function body(s, txt, y, opts = {}) {
  s.addText(txt, {
    x: 0.6, y, w: W - 1.2, h: opts.h ?? 0.6,
    fontFace: FONT, fontSize: opts.size ?? 18, color: FG,
  });
}

function bullets(s, items, y) {
  const runs = items.map((it) => ({
    text: it + '\n',
    options: { bullet: { code: '2022' } },
  }));
  s.addText(runs, {
    x: 0.6, y, w: W - 1.2, h: H - y - 0.6,
    fontFace: FONT, fontSize: 18, color: FG, paraSpaceAfter: 8,
  });
}

function kv(s, items, y) {
  let cy = y;
  items.forEach(([k, v]) => {
    s.addText(k, { x: 0.6, y: cy, w: 3.0, h: 0.4, fontFace: FONT, fontSize: 16, color: FG, bold: true });
    s.addText(v, { x: 3.8, y: cy, w: W - 4.4, h: 0.4, fontFace: FONT, fontSize: 16, color: FG });
    cy += 0.55;
  });
}

/* 1. Title */
{
  const s = slide();
  s.addText('Aral3D', {
    x: 0.6, y: 2.8, w: W - 1.2, h: 1.2,
    fontFace: FONT, fontSize: 80, bold: true, color: FG,
  });
  s.addText('A public 3D platform for learning, memory, and environmental imagination.', {
    x: 0.6, y: 4.2, w: W - 1.2, h: 0.8,
    fontFace: FONT, fontSize: 22, color: FG,
  });
}

/* 2. Intro */
{
  const s = slide();
  label(s, '02 — INTRO');
  title(s, 'What it is');
  body(s, 'Aral3D is a browser-based 3D platform about the Aral Sea region.', 2.4);
  body(s, 'It combines maps, terrain, stories, environmental data, and interactive scenarios into one public learning tool — for schools, museums, festivals, and cultural institutions.', 3.2, { h: 1.6 });
}

/* 3. Why the Aral Sea */
{
  const s = slide();
  label(s, '03 — CONTEXT');
  title(s, 'Why the Aral Sea');
  body(s, 'The Aral Sea is one of the most important environmental stories of the region.', 2.4);
  body(s, 'It is not only about a vanishing sea — it is about water, health, infrastructure, agriculture, memory, climate, borders, and future choices. Aral3D helps people see these layers together.', 3.2, { h: 1.8 });
}

/* 4. Problem */
{
  const s = slide();
  label(s, '04 — PROBLEM');
  title(s, 'Flat maps, distant stories');
  body(s, 'Most people meet the Aral Sea through flat maps, old photographs, statistics, or disaster narratives — important, but distant.', 2.4, { h: 1.2 });
  body(s, 'Aral3D makes the region spatial, interactive, and easier to understand. Instead of only reading about change, users can move through it, test scenarios, and ask questions.', 3.8, { h: 1.6 });
}

/* 5. Philosophy */
{
  const s = slide();
  label(s, '05 — PHILOSOPHY');
  title(s, 'Maps are not neutral');
  body(s, 'The way we imagine water affects the way we treat it.', 2.4);
  body(s, 'Water can appear as a resource, a border, a memory, a health issue, an infrastructure system, a political question, or a shared future. Aral3D turns the map into a space for learning, questioning, and imagination.', 3.2, { h: 1.8 });
}

/* 6. What it does */
{
  const s = slide();
  label(s, '06 — PLATFORM');
  title(s, 'What it does');
  bullets(s, [
    'Explore the basin in 3D — terrain, water, settlements, canals, dams.',
    'See environmental data layered on real geography.',
    'Test future water scenarios and policy choices.',
    'Move between modes: explore, learn, play, build.',
  ], 2.6);
}

/* 7. Current status */
{
  const s = slide();
  label(s, '07 — STATUS');
  title(s, 'The prototype works');
  body(s, 'A working public version is live today.', 2.4);
  bullets(s, [
    '3D terrain across the Aral Sea basin.',
    'Map layers: water history, population, ecology, infrastructure.',
    'Interactive water scenarios.',
    'A game mode and a voxel survival mode for younger audiences.',
  ], 3.2);
}

/* 8. First public uses */
{
  const s = slide();
  label(s, '08 — FIRST USES');
  title(s, 'Where it lands first');
  bullets(s, [
    'Aral Culture Summit 2026',
    'Savitsky Museum',
    'History and Aral Sea Museum',
    'Center for Contemporary Art, Tashkent',
    'Schools and educational programs',
    'Public workshops and festivals',
  ], 2.4);
}

/* 9. Education */
{
  const s = slide();
  label(s, '09 — EDUCATION');
  title(s, 'A tool for classrooms');
  kv(s, [
    ['Geography', 'How water systems work and how landscapes change.'],
    ['Ecology',   'How human decisions shape fragile ecosystems.'],
    ['History',   'Memory of a region told through its terrain.'],
    ['Design',    'Visual literacy for maps, data, and storytelling.'],
    ['Civics',    'Shared decisions about water, land, and future.'],
  ], 2.6);
}

/* 10. Cultural & design */
{
  const s = slide();
  label(s, '10 — CULTURE & DESIGN');
  title(s, 'Installation, archive, speculation');
  body(s, 'Aral3D can also live as a cultural object — an installation, an archive, a speculative tool.', 2.4, { h: 0.9 });
  bullets(s, [
    'Tashkent Design Week',
    'Milan Design Week',
    'Venice Architecture Biennale',
    'Venice Art Biennale',
  ], 3.6);
}

/* 11. Business model */
{
  const s = slide();
  label(s, '11 — MODEL');
  title(s, 'Free, by default');
  body(s, 'Aral3D is free for schools, museums, researchers, and the public.', 2.4, { h: 0.6 });
  s.lastSlide;
  s.addText('Core support', { x: 0.6, y: 3.3, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED, charSpacing: 4 });
  s.addText('Ministries, museums, schools, cultural foundations, environmental organisations, and international institutions.', {
    x: 0.6, y: 3.8, w: 5.5, h: 2.0, fontFace: FONT, fontSize: 16, color: FG,
  });
  s.addText('Optional', { x: 6.8, y: 3.3, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED, charSpacing: 4 });
  s.addText('Paid adaptations for private museums, festivals, educational centres, and commissioned exhibitions.', {
    x: 6.8, y: 3.8, w: 5.5, h: 2.0, fontFace: FONT, fontSize: 16, color: FG,
  });
}

/* 12. Implementation support */
{
  const s = slide();
  label(s, '12 — SUPPORT');
  title(s, 'From prototype to platform');
  s.addText('$30,000', { x: 0.6, y: 2.6, w: 6.0, h: 1.2, fontFace: FONT, fontSize: 56, bold: true, color: FG });
  s.addText('for the first 6 months', { x: 0.6, y: 3.8, w: 6.0, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED });
  s.addText('Polish, learning materials, audience testing, museum & festival formats.', {
    x: 0.6, y: 4.3, w: 6.0, h: 1.4, fontFace: FONT, fontSize: 16, color: FG,
  });
  s.addText('$50,000', { x: 6.8, y: 2.6, w: 6.0, h: 1.2, fontFace: FONT, fontSize: 56, bold: true, color: FG });
  s.addText('per year, 3-year phase', { x: 6.8, y: 3.8, w: 6.0, h: 0.4, fontFace: FONT, fontSize: 14, color: MUTED });
  s.addText('Maintain the platform, expand content, support workshops, keep it free.', {
    x: 6.8, y: 4.3, w: 6.0, h: 1.4, fontFace: FONT, fontSize: 16, color: FG,
  });
}

/* 13. First 6 months */
{
  const s = slide();
  label(s, '13 — FIRST 6 MONTHS');
  title(s, 'Six months, one public version');
  kv(s, [
    ['Polish',    'Product and user experience.'],
    ['Demo',      'A presentable public version.'],
    ['Materials', 'Educational content for classrooms.'],
    ['Testing',   'With students, teachers, museum audiences.'],
    ['Formats',   'Festival and exhibition adaptations.'],
    ['Partners',  'Institutional partnerships and documentation.'],
  ], 2.6);
}

/* 14. Three-year vision */
{
  const s = slide();
  label(s, '14 — THREE-YEAR VISION');
  title(s, 'A living public platform');
  body(s, 'Over three years Aral3D can grow into a long-term public platform for the Aral Sea region.', 2.4, { h: 1.0 });
  body(s, 'New layers, new stories, new educational modules and installations — a learning tool and a cultural archive that stays alive, updates over time, and remains accessible.', 3.6, { h: 1.8 });
}

/* 15. Expansion */
{
  const s = slide();
  label(s, '15 — EXPANSION');
  title(s, 'Aral is the first case');
  bullets(s, [
    'Caspian Sea',
    'Venice',
    'River deltas',
    'Drylands',
    'Irrigation landscapes',
    'Other climate-affected regions',
  ], 2.6);
}

/* 16. Why now */
{
  const s = slide();
  label(s, '16 — WHY NOW');
  title(s, 'The prototype is already alive');
  body(s, 'Environmental education needs better tools. Museums and schools need formats that are visual, interactive, and accessible.', 2.4, { h: 1.2 });
  body(s, 'The Aral Sea story needs to be told not only as a past disaster, but as a living question about the future. With support, Aral3D moves from prototype to public platform.', 3.8, { h: 1.8 });
}

/* 17. Team */
{
  const s = slide();
  label(s, '17 — TEAM');
  title(s, 'Team');
  s.addText('Timofey Nosov', { x: 0.6, y: 2.6, w: W - 1.2, h: 0.7, fontFace: FONT, fontSize: 32, bold: true, color: FG });
  s.addText('Robert Willard', { x: 0.6, y: 3.4, w: W - 1.2, h: 0.7, fontFace: FONT, fontSize: 32, bold: true, color: FG });
  s.addText('Contact', { x: 0.6, y: 4.8, w: W - 1.2, h: 0.4, fontFace: FONT, fontSize: 12, color: MUTED, charSpacing: 4 });
  s.addText('timnosov@gmail.com', { x: 0.6, y: 5.2, w: W - 1.2, h: 0.6, fontFace: FONT, fontSize: 24, color: FG });
}

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f => {
  console.log('wrote', f);
});
