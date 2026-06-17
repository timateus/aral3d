const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';

const W = 13.333, H = 7.5;

// Light + playful palette (matches level 1 splash vibe but on white)
const BG = 'FFFFFF';
const FG = '111418';
const MUTED = '5B6068';
const BLUE = '3B82F6';   // level 1 accent pill blue
const PINK = 'EC4899';
const YELLOW = 'F59E0B';
const GREEN = '10B981';
const RULE = 'E5E5E2';

// Playful display font as in LevelIntroSplash + italic Georgia accents
const FONT_PLAY = 'Trebuchet MS';
const FONT_BODY = 'Trebuchet MS';
const FONT_ITAL = 'Georgia';
const FONT_M = 'IBM Plex Mono';

function bg(s, color=BG){ s.background={color}; }
function kicker(s, txt, color=BLUE){
  s.addText(txt, { x:0.6, y:0.5, w:10, h:0.3, fontFace:FONT_M, fontSize:9, color, charSpacing:8, bold:true });
}
function pageNum(s, n, total){
  s.addText(`${String(n).padStart(2,'0')} / ${String(total).padStart(2,'0')}`, {
    x:W-1.6, y:H-0.5, w:1.2, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, align:'right'
  });
  s.addText('ARAL3D', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, charSpacing:6 });
}
function rule(s, y){ s.addShape(pptx.ShapeType.line, { x:0.6, y, w:W-1.2, h:0, line:{color:RULE, width:0.75} }); }
function play(s, txt, opts){
  // Playful uppercase tracked display, like the level title
  return s.addText(txt, { fontFace:FONT_PLAY, bold:true, charSpacing:6, ...opts });
}

const slides = [];

// 1. Title — playful hero
{
  const s = pptx.addSlide(); bg(s);
  s.addText('ARAL SCHOOL · 2026', { x:0.6, y:0.5, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:BLUE, charSpacing:12, bold:true });
  play(s, 'ARAL3D', { x:0.6, y:2.0, w:12, h:2.0, fontSize:160, color:FG, charSpacing:8 });
  s.addText('A 3D platform for the Aral Sea basin.', {
    x:0.6, y:4.4, w:12, h:0.7, fontFace:FONT_ITAL, italic:true, fontSize:32, color:PINK
  });
  rule(s, 5.6);
  s.addText('Free and public. An educational game and a data exploration tool.', {
    x:0.6, y:5.8, w:11, h:0.5, fontFace:FONT_M, fontSize:13, color:MUTED
  });
  s.addText('aral3d.com', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:MUTED, charSpacing:6 });
  slides.push(s);
}

// 2. Starting question — playful
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'STARTING POINT', PINK);
  play(s, 'WHAT IS WATER?', { x:0.6, y:1.8, w:12, h:1.6, fontSize:110, color:FG, charSpacing:6 });
  s.addText('How we picture water shapes how we use it.', {
    x:0.6, y:3.9, w:12, h:0.8, fontFace:FONT_ITAL, italic:true, fontSize:34, color:BLUE
  });
  s.addText('Aral3D explores different ways of seeing the basin — as map, as terrain, as climate, as everyday life.', {
    x:0.6, y:4.9, w:11, h:1.6, fontFace:FONT_BODY, fontSize:20, color:MUTED
  });
  slides.push(s);
}

// 3. Two modes
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'THE PLATFORM');
  play(s, 'TWO MODES.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:54, color:FG, charSpacing:4 });

  const colY = 2.6, colH = 4.2;
  // Game
  s.addShape(pptx.ShapeType.rect, { x:0.6, y:colY, w:6.0, h:colH, line:{color:BLUE, width:2}, fill:{color:'F4F8FF'} });
  s.addText('01 — GAME', { x:0.9, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:BLUE, charSpacing:8, bold:true });
  play(s, 'PLAY THE BASIN', { x:0.9, y:colY+0.8, w:5.4, h:0.8, fontSize:34, color:FG, charSpacing:3 });
  s.addText('Short missions and playable worlds for students, schools and museum visitors.', {
    x:0.9, y:colY+2.0, w:5.4, h:2.0, fontFace:FONT_BODY, fontSize:17, color:MUTED
  });

  // Explore
  s.addShape(pptx.ShapeType.rect, { x:6.9, y:colY, w:6.0, h:colH, line:{color:PINK, width:2}, fill:{color:'FFF4F9'} });
  s.addText('02 — EXPLORE', { x:7.2, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:PINK, charSpacing:8, bold:true });
  play(s, 'READ THE BASIN', { x:7.2, y:colY+0.8, w:5.4, h:0.8, fontSize:34, color:FG, charSpacing:3 });
  s.addText('Real elevation, historical basins, demographics, climate and water timeline. Shareable views.', {
    x:7.2, y:colY+2.0, w:5.4, h:2.0, fontFace:FONT_BODY, fontSize:17, color:MUTED
  });
  slides.push(s);
}

// 4-6 screenshots (light bottom strip)
function shotSlide(label, title, path, accent=BLUE){
  const s = pptx.addSlide(); bg(s);
  s.addImage({ path, x:0, y:0, w:W, h:H-2.0, sizing:{type:'cover', w:W, h:H-2.0} });
  s.addShape(pptx.ShapeType.rect, { x:0, y:H-2.0, w:W, h:2.0, fill:{color:'FFFFFF'}, line:{type:'none'} });
  s.addText(label, { x:0.6, y:H-1.7, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:accent, charSpacing:8, bold:true });
  play(s, title, { x:0.6, y:H-1.3, w:12, h:0.9, fontSize:40, color:FG, charSpacing:4 });
  slides.push(s);
}
shotSlide('GAME · MISSION 01', 'WELCOME TO NUKUS', 'docs/screenshots/04-game-mission1.png', BLUE);
shotSlide('GAME · VOXEL', 'BUILD AND SURVIVE', 'docs/screenshots/03-voxel-survive.png', GREEN);
shotSlide('EXPLORE', 'REAL DATA, REAL TERRAIN', 'docs/screenshots/02-explore-mode.png', PINK);

// 7. Audiences
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'WHO IT IS FOR');
  play(s, 'AUDIENCES.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:54, color:FG, charSpacing:4 });
  const rows = [
    ['SCHOOLS',     'Curriculum-ready missions and classroom workshops.', BLUE],
    ['MUSEUMS',     'Touchscreens, projections and controller installations.', PINK],
    ['RESEARCHERS', 'Real elevation and historical layers with shareable views.', GREEN],
    ['MINISTRIES',  'Scenario tools for water, agriculture and ecology.', YELLOW],
    ['PUBLIC',      'A playable Aral Sea for festivals and exhibitions.', BLUE],
  ];
  let y = 2.6;
  rows.forEach(([k,v,c])=>{
    s.addText(k, { x:0.6, y, w:3.2, h:0.4, fontFace:FONT_M, fontSize:11, color:c, charSpacing:6, bold:true });
    s.addText(v, { x:3.8, y, w:9, h:0.4, fontFace:FONT_BODY, fontSize:17, color:FG });
    rule(s, y+0.55);
    y += 0.78;
  });
  slides.push(s);
}

// 8. The ask
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'THE ASK', PINK);
  play(s, '$30,000', { x:0.6, y:1.6, w:12, h:2.4, fontSize:200, color:FG, charSpacing:0 });
  s.addText('for six months.', { x:0.6, y:4.2, w:12, h:0.8, fontFace:FONT_ITAL, italic:true, fontSize:36, color:BLUE });
  s.addText('Product polish, curriculum integration with the Ministry of Education, and museum-ready versions.', {
    x:0.6, y:5.2, w:11, h:1.5, fontFace:FONT_BODY, fontSize:18, color:MUTED
  });
  slides.push(s);
}

// 9. 6-month plan
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '6-MONTH PLAN');
  play(s, 'SIX MONTHS.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:48, color:FG, charSpacing:4 });
  const steps = [
    ['M1', 'Polish product, public demo.'],
    ['M2', 'Educational version and ministry talks.'],
    ['M3', 'First curriculum-ready learning module.'],
    ['M4', 'Adapt for Aral Culture Summit 2026.'],
    ['M5', 'Museum versions: Savitsky, Aral Sea Museum, CCA Tashkent.'],
    ['M6', 'Documentation, demo video, 3-year roadmap.'],
  ];
  let y = 2.5;
  steps.forEach(([m,t])=>{
    s.addText(m, { x:0.6, y, w:1, h:0.5, fontFace:FONT_M, fontSize:14, color:BLUE, bold:true });
    s.addText(t, { x:1.8, y, w:11, h:0.5, fontFace:FONT_BODY, fontSize:18, color:FG });
    rule(s, y+0.6);
    y += 0.72;
  });
  slides.push(s);
}

// 10. Budget
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '6-MONTH BUDGET');
  play(s, 'WHERE IT GOES.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:48, color:FG, charSpacing:4 });
  const items = [
    ['Product polishing and frontend',   '$8,000'],
    ['Educational module and curriculum','$6,000'],
    ['Museum and exhibition adaptation', '$9,000'],
    ['Visual and interface design',      '$3,000'],
    ['Documentation, video, materials',  '$2,000'],
    ['Coordination and production',      '$2,000'],
  ];
  let y = 2.4;
  items.forEach(([k,v])=>{
    s.addText(k, { x:0.6, y, w:9, h:0.5, fontFace:FONT_BODY, fontSize:18, color:FG });
    s.addText(v, { x:9.6, y, w:3.2, h:0.5, fontFace:FONT_M, fontSize:18, color:BLUE, align:'right', bold:true });
    rule(s, y+0.6);
    y += 0.62;
  });
  s.addText('TOTAL', { x:0.6, y:y+0.1, w:9, h:0.5, fontFace:FONT_M, fontSize:14, color:MUTED, charSpacing:8 });
  play(s, '$30,000', { x:9.6, y:y, w:3.2, h:0.7, fontSize:30, color:PINK, align:'right', charSpacing:2 });
  slides.push(s);
}

// 11. 3-year
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '3-YEAR PLAN');
  play(s, '$150K · 3 YEARS.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:48, color:FG, charSpacing:4 });
  const ys = [
    ['Y1', 'Curriculum alignment, school pilots, museum installations.', BLUE],
    ['Y2', 'New learning modules, exhibition formats, regional stories.', PINK],
    ['Y3', 'Free public platform for education, culture and ecology.', GREEN],
  ];
  let y = 2.8;
  ys.forEach(([k,v,c])=>{
    s.addText(k, { x:0.6, y, w:1.2, h:0.6, fontFace:FONT_M, fontSize:20, color:c, bold:true });
    s.addText(v, { x:2.0, y, w:11, h:0.7, fontFace:FONT_BODY, fontSize:20, color:FG });
    y += 1.1;
  });
  slides.push(s);
}

// 12. Venues
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'WHERE IT GOES');
  play(s, 'VENUES.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:48, color:FG, charSpacing:4 });
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
  const colors = [BLUE, PINK, GREEN, YELLOW];
  items.forEach((it,i)=>{
    const col = i%2, row = Math.floor(i/2);
    const x = 0.6 + col*6.2, y = 2.6 + row*0.85;
    s.addText(String(i+1).padStart(2,'0'), { x, y, w:0.7, h:0.5, fontFace:FONT_M, fontSize:11, color:colors[i%4], bold:true });
    s.addText(it, { x:x+0.7, y, w:5.3, h:0.5, fontFace:FONT_BODY, fontSize:18, color:FG });
  });
  slides.push(s);
}

// 13. Funding model
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'FUNDING MODEL');
  play(s, 'FREE, BY DEFAULT.', { x:0.6, y:1.0, w:12, h:1.0, fontSize:48, color:FG, charSpacing:4 });
  s.addText('Aral3D stays free for schools, students, teachers, researchers, museums and public institutions.', {
    x:0.6, y:2.4, w:12, h:1.0, fontFace:FONT_ITAL, italic:true, fontSize:20, color:BLUE
  });
  s.addText('CORE SUPPORT', { x:0.6, y:4.0, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:BLUE, charSpacing:8, bold:true });
  s.addText('Ministry of Education, Ministry of Ecology, public educational and environmental programs, state museums, universities.', {
    x:0.6, y:4.4, w:6, h:2.4, fontFace:FONT_BODY, fontSize:14, color:FG
  });
  s.addText('OPTIONAL', { x:7.0, y:4.0, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:PINK, charSpacing:8, bold:true });
  s.addText('Private museums, festivals, private educational centers, commissioned exhibition versions, international cultural programs.', {
    x:7.0, y:4.4, w:6, h:2.4, fontFace:FONT_BODY, fontSize:14, color:FG
  });
  slides.push(s);
}

// 14. Closing
{
  const s = pptx.addSlide(); bg(s);
  play(s, 'ARAL3D', { x:0.6, y:2.2, w:12, h:1.6, fontSize:140, color:FG, charSpacing:8 });
  s.addText('A 3D platform for the Aral Sea basin.', {
    x:0.6, y:4.2, w:12, h:0.8, fontFace:FONT_ITAL, italic:true, fontSize:28, color:PINK
  });
  rule(s, 5.8);
  s.addText('aral3d.com  ·  Aral School 2026', { x:0.6, y:6.1, w:12, h:0.4, fontFace:FONT_M, fontSize:12, color:BLUE, charSpacing:6, bold:true });
  slides.push(s);
}

const total = slides.length;
slides.forEach((s,i)=>{ if(i!==0 && i!==total-1) pageNum(s, i+1, total); });

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f=>{
  console.log('wrote', f, 'slides:', total);
});
