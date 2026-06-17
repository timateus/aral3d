const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Aral3D';
pptx.author = 'Aral3D';

const W = 13.333, H = 7.5;

// Light palette
const BG = 'FFFFFF';
const FG = '111418';
const MUTED = '6B7077';
const ACCENT = '0F766E'; // deep teal
const RULE = 'E5E5E2';

const FONT_H = 'Inter';
const FONT_M = 'IBM Plex Mono';

function bg(slide, color=BG){ slide.background={color}; }
function kicker(slide, txt, opts={}){
  slide.addText(txt, { x:0.6, y:0.5, w:10, h:0.3, fontFace:FONT_M, fontSize:9, color:ACCENT, charSpacing:8, ...opts });
}
function pageNum(slide, n, total){
  slide.addText(`${String(n).padStart(2,'0')} / ${String(total).padStart(2,'0')}`, {
    x:W-1.6, y:H-0.5, w:1.2, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, align:'right', charSpacing:4
  });
  slide.addText('ARAL3D', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, charSpacing:6 });
}
function thinRule(slide, y){
  slide.addShape(pptx.ShapeType.line, { x:0.6, y, w:W-1.2, h:0, line:{ color:RULE, width:0.75 } });
}

const slides = [];

// 1. Title
{
  const s = pptx.addSlide(); bg(s);
  s.addText('ARAL SCHOOL · 2026', { x:0.6, y:0.5, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:12 });
  s.addText('Aral3D', { x:0.6, y:2.4, w:12, h:1.6, fontFace:FONT_H, fontSize:120, color:FG, charSpacing:-4 });
  s.addText('A 3D platform for the Aral Sea basin.', { x:0.6, y:4.2, w:12, h:0.8, fontFace:FONT_H, fontSize:32, color:FG });
  thinRule(s, 5.4);
  s.addText('Free and public. An educational game and a data exploration tool.', {
    x:0.6, y:5.6, w:11, h:0.5, fontFace:FONT_M, fontSize:13, color:MUTED
  });
  s.addText('aral3d.com', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:MUTED, charSpacing:6 });
  slides.push(s);
}

// 2. Pitch
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'WHAT IT IS');
  s.addText('An interactive 3D environment of the Aral Sea basin for schools, museums and researchers.', {
    x:0.6, y:2.2, w:12, h:3.5, fontFace:FONT_H, fontSize:40, color:FG, charSpacing:-1, valign:'top'
  });
  slides.push(s);
}

// 3. Starting question
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'STARTING POINT');
  s.addText('What is water?', { x:0.6, y:2.0, w:12, h:1.4, fontFace:FONT_H, fontSize:88, color:FG, charSpacing:-3 });
  s.addText('How we picture water shapes how we use it. The project explores different ways of seeing the Aral basin — as map, as terrain, as climate, as everyday life.', {
    x:0.6, y:4.0, w:11, h:2.2, fontFace:FONT_H, fontSize:20, color:MUTED
  });
  slides.push(s);
}

// 4. Two modes
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'THE PLATFORM');
  s.addText('Two modes.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:44, color:FG });

  const colY = 2.4, colH = 4.4;
  s.addShape(pptx.ShapeType.rect, { x:0.6, y:colY, w:6.0, h:colH, line:{color:RULE, width:1}, fill:{color:'FAFAF8'} });
  s.addText('01 — GAME', { x:0.9, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:ACCENT, charSpacing:8 });
  s.addText('Educational levels', { x:0.9, y:colY+0.75, w:5, h:0.7, fontFace:FONT_H, fontSize:28, color:FG });
  s.addText('Short missions and playable worlds for students, schools and museum visitors.', {
    x:0.9, y:colY+1.8, w:5.4, h:2.4, fontFace:FONT_H, fontSize:16, color:MUTED
  });

  s.addShape(pptx.ShapeType.rect, { x:6.9, y:colY, w:6.0, h:colH, line:{color:RULE, width:1}, fill:{color:'FAFAF8'} });
  s.addText('02 — EXPLORE', { x:7.2, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:ACCENT, charSpacing:8 });
  s.addText('Data exploration', { x:7.2, y:colY+0.75, w:5, h:0.7, fontFace:FONT_H, fontSize:28, color:FG });
  s.addText('Real elevation, historical basins, demographics, climate and water timeline. Shareable views.', {
    x:7.2, y:colY+1.8, w:5.4, h:2.4, fontFace:FONT_H, fontSize:16, color:MUTED
  });
  slides.push(s);
}

// 5-7 screenshots
function shotSlide(label, title, path){
  const s = pptx.addSlide(); bg(s, '000000');
  s.addImage({ path, x:0, y:0, w:W, h:H, sizing:{type:'cover', w:W, h:H} });
  s.addShape(pptx.ShapeType.rect, { x:0, y:H-2.0, w:W, h:2.0, fill:{color:'FFFFFF'}, line:{type:'none'} });
  s.addText(label, { x:0.6, y:H-1.7, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText(title, { x:0.6, y:H-1.3, w:12, h:0.9, fontFace:FONT_H, fontSize:32, color:FG });
  slides.push(s);
}
shotSlide('LANDING', 'Entry point.', 'docs/screenshots/01-landing.png');
shotSlide('EXPLORE MODE', 'Data exploration view.', 'docs/screenshots/02-explore-mode.png');
shotSlide('GAME MODE — VOXEL', 'A playable level.', 'docs/screenshots/03-voxel-survive.png');

// 8. Audiences
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'WHO IT IS FOR');
  s.addText('Audiences.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:44, color:FG });
  const rows = [
    ['SCHOOLS', 'Curriculum-ready missions and classroom workshops.'],
    ['MUSEUMS', 'Touchscreens, projections and controller installations.'],
    ['RESEARCHERS', 'Real elevation and historical layers with shareable views.'],
    ['MINISTRIES', 'Scenario tools for water, agriculture and ecology.'],
    ['PUBLIC', 'A playable Aral Sea for festivals and exhibitions.'],
  ];
  let y = 2.4;
  rows.forEach(([k,v])=>{
    s.addText(k, { x:0.6, y, w:3.0, h:0.4, fontFace:FONT_M, fontSize:11, color:ACCENT, charSpacing:6 });
    s.addText(v, { x:3.8, y, w:9, h:0.4, fontFace:FONT_H, fontSize:16, color:FG });
    thinRule(s, y+0.55);
    y += 0.85;
  });
  slides.push(s);
}

// 9. The ask
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'THE ASK');
  s.addText('$30,000', { x:0.6, y:1.8, w:12, h:2.0, fontFace:FONT_H, fontSize:160, color:FG, charSpacing:-6 });
  s.addText('Six months of work: product polish, curriculum integration with the Ministry of Education, and museum-ready versions.', {
    x:0.6, y:4.6, w:11, h:2, fontFace:FONT_H, fontSize:20, color:MUTED
  });
  slides.push(s);
}

// 10. 6-month plan
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '6-MONTH PLAN');
  s.addText('Six months.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const steps = [
    ['M1', 'Polish product, public demo.'],
    ['M2', 'Educational version and ministry talks.'],
    ['M3', 'First curriculum-ready learning module.'],
    ['M4', 'Adapt for Aral Culture Summit 2026.'],
    ['M5', 'Museum versions: Savitsky, Aral Sea Museum, CCA Tashkent.'],
    ['M6', 'Documentation, demo video, 3-year roadmap.'],
  ];
  let y = 2.3;
  steps.forEach(([m,t])=>{
    s.addText(m, { x:0.6, y, w:1, h:0.5, fontFace:FONT_M, fontSize:14, color:ACCENT });
    s.addText(t, { x:1.8, y, w:11, h:0.5, fontFace:FONT_H, fontSize:18, color:FG });
    thinRule(s, y+0.6);
    y += 0.75;
  });
  slides.push(s);
}

// 11. Budget
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '6-MONTH BUDGET');
  s.addText('Where it goes.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const items = [
    ['Product polishing and frontend', '$8,000'],
    ['Educational module and curriculum', '$6,000'],
    ['Museum and exhibition adaptation', '$9,000'],
    ['Visual and interface design', '$3,000'],
    ['Documentation, video, materials', '$2,000'],
    ['Coordination and production', '$2,000'],
  ];
  let y = 2.0;
  items.forEach(([k,v])=>{
    s.addText(k, { x:0.6, y, w:9, h:0.5, fontFace:FONT_H, fontSize:18, color:FG });
    s.addText(v, { x:9.6, y, w:3.2, h:0.5, fontFace:FONT_M, fontSize:18, color:ACCENT, align:'right' });
    thinRule(s, y+0.6);
    y += 0.65;
  });
  s.addText('TOTAL', { x:0.6, y:y+0.1, w:9, h:0.5, fontFace:FONT_M, fontSize:14, color:MUTED, charSpacing:8 });
  s.addText('$30,000', { x:9.6, y:y+0.05, w:3.2, h:0.6, fontFace:FONT_H, fontSize:28, color:FG, align:'right' });
  slides.push(s);
}

// 12. 3-year
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, '3-YEAR PLAN');
  s.addText('$150K over 3 years.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const ys = [
    ['Y1', 'Curriculum alignment, school pilots, museum installations.'],
    ['Y2', 'New learning modules, exhibition formats, regional stories.'],
    ['Y3', 'Free public platform for education, culture and ecology.'],
  ];
  let y = 2.6;
  ys.forEach(([k,v])=>{
    s.addText(k, { x:0.6, y, w:1.2, h:0.5, fontFace:FONT_M, fontSize:18, color:ACCENT });
    s.addText(v, { x:2.0, y, w:11, h:0.7, fontFace:FONT_H, fontSize:20, color:FG });
    y += 1.1;
  });
  slides.push(s);
}

// 13. Installations
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'WHERE IT GOES');
  s.addText('Venues.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
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
  items.forEach((it,i)=>{
    const col = i%2, row = Math.floor(i/2);
    const x = 0.6 + col*6.2, y = 2.4 + row*0.85;
    s.addText(String(i+1).padStart(2,'0'), { x, y, w:0.7, h:0.5, fontFace:FONT_M, fontSize:11, color:ACCENT });
    s.addText(it, { x:x+0.7, y, w:5.3, h:0.5, fontFace:FONT_H, fontSize:18, color:FG });
  });
  slides.push(s);
}

// 14. Funding model
{
  const s = pptx.addSlide(); bg(s);
  kicker(s, 'FUNDING MODEL');
  s.addText('Free, by default.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  s.addText('Aral3D stays free for schools, students, teachers, researchers, museums and public institutions.', {
    x:0.6, y:2.1, w:12, h:1.0, fontFace:FONT_H, fontSize:18, color:MUTED
  });
  s.addText('CORE SUPPORT', { x:0.6, y:3.6, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText('Ministry of Education, Ministry of Ecology, public educational and environmental programs, state museums, universities.', {
    x:0.6, y:4.0, w:6, h:2.6, fontFace:FONT_H, fontSize:14, color:FG
  });
  s.addText('OPTIONAL', { x:7.0, y:3.6, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText('Private museums, festivals, private educational centers, commissioned exhibition versions, international cultural programs.', {
    x:7.0, y:4.0, w:6, h:2.6, fontFace:FONT_H, fontSize:14, color:FG
  });
  slides.push(s);
}

// 15. Closing
{
  const s = pptx.addSlide(); bg(s);
  s.addText('Aral3D', { x:0.6, y:2.4, w:12, h:1.2, fontFace:FONT_H, fontSize:80, color:FG, charSpacing:-3 });
  s.addText('A 3D platform for the Aral Sea basin.', { x:0.6, y:3.7, w:12, h:0.8, fontFace:FONT_H, fontSize:24, color:MUTED });
  thinRule(s, 5.6);
  s.addText('aral3d.com  ·  Aral School 2026', { x:0.6, y:5.9, w:12, h:0.4, fontFace:FONT_M, fontSize:12, color:ACCENT, charSpacing:6 });
  slides.push(s);
}

const total = slides.length;
slides.forEach((s,i)=>{ if(i!==0 && i!==total-1) pageNum(s, i+1, total); });

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f=>{
  console.log('wrote', f, 'slides:', total);
});
