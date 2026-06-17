const PptxGenJS = require('/nix/store/31sh8fzcbg4sjahp3zj002j0ca8sfvvr-nodejs-22.22.0/lib/node_modules/pptxgenjs');
const fs = require('fs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pptx.title = 'Aral3D — Spectral Earth';
pptx.author = 'Aral3D';

const W = 13.333, H = 7.5;

// Palette — dark scientific, off-white paper variant accents
const BG = '06080E';        // near-black blue
const FG = 'F2EFE6';        // warm off-white
const MUTED = '8A8E96';     // grey
const ACCENT = '2DD4BF';    // teal
const INK = '111418';

const FONT_H = 'Inter';
const FONT_M = 'IBM Plex Mono';

function bg(slide, color=BG){ slide.background={color}; }
function kicker(slide, txt, opts={}){
  slide.addText(txt, { x:0.6, y:0.5, w:8, h:0.3, fontFace:FONT_M, fontSize:9, color:ACCENT, charSpacing:8, ...opts });
}
function pageNum(slide, n, total){
  slide.addText(`${String(n).padStart(2,'0')} / ${String(total).padStart(2,'0')}`, {
    x:W-1.6, y:H-0.5, w:1.2, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, align:'right', charSpacing:4
  });
  slide.addText('ARAL3D — SPECTRAL EARTH', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:9, color:MUTED, charSpacing:6 });
}
function thinRule(slide, y, color=FG, opacity=20){
  slide.addShape(pptx.ShapeType.line, { x:0.6, y, w:W-1.2, h:0, line:{ color, width:0.5, transparency:100-opacity } });
}

const slides = [];

// ── 1. Title
{
  const s = pptx.addSlide(); bg(s, BG);
  s.addText('ARAL SCHOOL · 2026', { x:0.6, y:0.5, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:12 });
  s.addText('ARAL3D', { x:0.6, y:2.4, w:12, h:1.6, fontFace:FONT_H, fontSize:120, bold:false, color:FG, charSpacing:-4 });
  s.addText('Spectral Earth of the Aral Sea', { x:0.6, y:4.2, w:12, h:0.8, fontFace:FONT_H, fontSize:36, italic:true, color:FG });
  thinRule(s, 5.4);
  s.addText('A free public 3D platform — educational game + GIS-like explore tool.', {
    x:0.6, y:5.6, w:11, h:0.5, fontFace:FONT_M, fontSize:13, color:MUTED
  });
  s.addText('aral3d.com', { x:0.6, y:H-0.5, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:MUTED, charSpacing:6 });
  slides.push(s);
}

// ── 2. One-sentence pitch
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'PITCH');
  s.addText('Aral3D turns the Aral Sea basin into an interactive educational, cultural, and museum-ready environment — free and public.', {
    x:0.6, y:2.2, w:12, h:3.5, fontFace:FONT_H, fontSize:44, color:FG, charSpacing:-1, valign:'top'
  });
  slides.push(s);
}

// ── 3. The starting question
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'PHILOSOPHY · 01');
  s.addText('What water is.', { x:0.6, y:2.0, w:12, h:1.4, fontFace:FONT_H, fontSize:96, color:FG, charSpacing:-3 });
  s.addText('Not where water is. Not how much. Not how it flows or evaporates —\nbut what water is imagined to be. Because what we imagine water to be\ndefines how we engage with it.', {
    x:0.6, y:4.0, w:11, h:2.2, fontFace:FONT_H, fontSize:20, italic:true, color:MUTED, charSpacing:0
  });
  slides.push(s);
}

// ── 4. Comparative water-logy — two scales
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'PHILOSOPHY · 02 — COMPARATIVE WATER-LOGY');
  s.addText('Two scales.', { x:0.6, y:1.1, w:12, h:0.8, fontFace:FONT_H, fontSize:40, color:FG });

  // axes
  const cx = W/2, cy = 4.7, len = 4.2;
  // horizontal
  s.addShape(pptx.ShapeType.line, { x:cx-len, y:cy, w:len*2, h:0, line:{color:FG, width:0.75, transparency:40} });
  // vertical
  s.addShape(pptx.ShapeType.line, { x:cx, y:cy-2, w:0, h:4, line:{color:FG, width:0.75, transparency:40} });

  s.addText('personal', { x:cx-len-1, y:cy-0.2, w:1.6, h:0.4, fontFace:FONT_M, fontSize:11, color:MUTED, align:'right' });
  s.addText('planetary', { x:cx+len-0.6, y:cy-0.2, w:1.8, h:0.4, fontFace:FONT_M, fontSize:11, color:MUTED });
  s.addText('playful', { x:cx-0.5, y:cy-2.5, w:1.4, h:0.4, fontFace:FONT_M, fontSize:11, color:MUTED, align:'center' });
  s.addText('serious', { x:cx-0.5, y:cy+2.1, w:1.4, h:0.4, fontFace:FONT_M, fontSize:11, color:MUTED, align:'center' });

  // dots
  const pts = [
    [cx-2.8, cy-1.4, 'river swim'],
    [cx+2.6, cy+1.3, 'canal network'],
    [cx-1.2, cy+0.6, 'school class'],
    [cx+1.5, cy-1.0, 'game level'],
  ];
  pts.forEach(([x,y,label])=>{
    s.addShape(pptx.ShapeType.ellipse, { x:x-0.08, y:y-0.08, w:0.16, h:0.16, fill:{color:ACCENT}, line:{type:'none'} });
    s.addText(label, { x:x+0.15, y:y-0.18, w:2, h:0.3, fontFace:FONT_M, fontSize:10, color:FG });
  });
  slides.push(s);
}

// ── 5. The map mode
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'PHILOSOPHY · 03');
  s.addText('The map\nhas limits.', { x:0.6, y:1.6, w:7, h:2.6, fontFace:FONT_H, fontSize:64, color:FG, charSpacing:-2 });
  s.addText('A line makes a river feel like a pipe — it starts here, ends there. But rivers leak and absorb. They are the mud and silt they carry, the mosquitos and fishermen, the children swimming, the willows growing.', {
    x:0.6, y:5.0, w:7.5, h:2, fontFace:FONT_H, fontSize:16, color:MUTED
  });
  s.addText('We don\'t reject maps —\nwe hack them, stress them,\nand explore their limits.', {
    x:8.6, y:2.6, w:4.2, h:2.5, fontFace:FONT_M, fontSize:14, italic:true, color:ACCENT
  });
  slides.push(s);
}

// ── 6. Two modes
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'THE PLATFORM');
  s.addText('Two modes.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:44, color:FG });

  // columns
  const colY = 2.4, colH = 4.4;
  // game
  s.addShape(pptx.ShapeType.rect, { x:0.6, y:colY, w:6.0, h:colH, line:{color:FG, width:0.75, transparency:70}, fill:{type:'none'} });
  s.addText('01 — GAME', { x:0.9, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:ACCENT, charSpacing:8 });
  s.addText('Educational levels', { x:0.9, y:colY+0.75, w:5, h:0.7, fontFace:FONT_H, fontSize:28, color:FG });
  s.addText('Missions, characters, voxel worlds, satellite GeoGuessr, ministry sims. For schools, museums and festivals.', {
    x:0.9, y:colY+1.8, w:5.4, h:2.4, fontFace:FONT_H, fontSize:14, color:MUTED
  });

  // explore
  s.addShape(pptx.ShapeType.rect, { x:6.9, y:colY, w:6.0, h:colH, line:{color:FG, width:0.75, transparency:70}, fill:{type:'none'} });
  s.addText('02 — EXPLORE', { x:7.2, y:colY+0.25, w:5, h:0.4, fontFace:FONT_M, fontSize:11, color:ACCENT, charSpacing:8 });
  s.addText('GIS-like data tool', { x:7.2, y:colY+0.75, w:5, h:0.7, fontFace:FONT_H, fontSize:28, color:FG });
  s.addText('Real DEMs, historical basins, demographics, climate, water extent timeline. Shareable URLs, exportable views.', {
    x:7.2, y:colY+1.8, w:5.4, h:2.4, fontFace:FONT_H, fontSize:14, color:MUTED
  });
  slides.push(s);
}

// ── 7-9 screenshots
function shotSlide(label, title, path){
  const s = pptx.addSlide(); bg(s, INK);
  s.addImage({ path, x:0, y:0, w:W, h:H, sizing:{type:'cover', w:W, h:H} });
  // bottom gradient overlay strip
  s.addShape(pptx.ShapeType.rect, { x:0, y:H-2.2, w:W, h:2.2, fill:{color:'000000', transparency:35}, line:{type:'none'} });
  s.addText(label, { x:0.6, y:H-1.9, w:8, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText(title, { x:0.6, y:H-1.5, w:12, h:0.9, fontFace:FONT_H, fontSize:36, color:FG });
  slides.push(s);
  return s;
}
shotSlide('LANDING', 'Enter the basin.', 'docs/screenshots/01-landing.png');
shotSlide('EXPLORE MODE', 'A serious instrument.', 'docs/screenshots/02-explore-mode.png');
shotSlide('GAME MODE — VOXEL SURVIVE', 'A playful one.', 'docs/screenshots/03-voxel-survive.png');

// ── 10. Audiences
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'AUDIENCE AS METHOD');
  s.addText('Who plays it.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:44, color:FG });
  const rows = [
    ['SCHOOLS', 'Curriculum-ready missions, teacher notes, workshops.'],
    ['MUSEUMS', 'Touchscreens, projections, controller-based installations.'],
    ['RESEARCHERS', 'Real DEM + historical layers, shareable analytical views.'],
    ['POLICY & MINISTRIES', 'Scenario interfaces for water, agriculture, ecology.'],
    ['PUBLIC & FESTIVALS', 'Playable Aral Sea — flood it, dry it, restore it.'],
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

// ── 11. The ask
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'BUSINESS · THE ASK');
  s.addText('$30,000', { x:0.6, y:1.8, w:12, h:2.0, fontFace:FONT_H, fontSize:160, color:FG, charSpacing:-6 });
  s.addText('for 6 months — polish the product, prepare curriculum integration with the Ministry of Education, and adapt for museum installations.', {
    x:0.6, y:4.6, w:11, h:2, fontFace:FONT_H, fontSize:20, color:MUTED
  });
  slides.push(s);
}

// ── 12. 6-month plan
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'BUSINESS · 6-MONTH PLAN');
  s.addText('Six months.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const steps = [
    ['M1', 'Polish product, clean public demo'],
    ['M2', 'Educational version + Ministry talks'],
    ['M3', 'First curriculum-ready learning module'],
    ['M4', 'Adapt for Aral Culture Summit 2026'],
    ['M5', 'Museum versions: Savitsky, Aral Sea Museum, CCA Tashkent'],
    ['M6', 'Docs, demo video, 3-year roadmap'],
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

// ── 13. Budget
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'BUSINESS · 6-MONTH BUDGET');
  s.addText('Where it goes.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const items = [
    ['Product polishing & frontend', '$8,000'],
    ['Educational module & curriculum', '$6,000'],
    ['Museum & exhibition adaptation', '$9,000'],
    ['Visual / interface design', '$3,000'],
    ['Documentation, video, materials', '$2,000'],
    ['Coordination & production', '$2,000'],
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

// ── 14. 3-year vision
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'BUSINESS · 3-YEAR PLAN');
  s.addText('$150K / 3 years.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const ys = [
    ['Y1', 'Curriculum alignment, school pilots, museum installations.'],
    ['Y2', 'New learning modules, exhibition formats, regional stories.'],
    ['Y3', 'Free public platform — education, culture, ecological storytelling.'],
  ];
  let y = 2.6;
  ys.forEach(([k,v])=>{
    s.addText(k, { x:0.6, y, w:1.2, h:0.5, fontFace:FONT_M, fontSize:18, color:ACCENT });
    s.addText(v, { x:2.0, y, w:11, h:0.7, fontFace:FONT_H, fontSize:20, color:FG });
    y += 1.1;
  });
  slides.push(s);
}

// ── 15. Installations
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'WHERE IT GOES');
  s.addText('Installations & venues.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  const items = [
    'Aral Culture Summit 2026',
    'Savitsky Museum',
    'History & Aral Sea Museum',
    'Center for Contemporary Art, Tashkent',
    'Tashkent Design Week',
    'Milan Design Week',
    'Venice Architecture Biennale',
    'Venice Art Biennale',
  ];
  // 2 columns
  items.forEach((it,i)=>{
    const col = i%2, row = Math.floor(i/2);
    const x = 0.6 + col*6.2, y = 2.4 + row*0.85;
    s.addText(String(i+1).padStart(2,'0'), { x, y, w:0.7, h:0.5, fontFace:FONT_M, fontSize:11, color:ACCENT });
    s.addText(it, { x:x+0.7, y, w:5.3, h:0.5, fontFace:FONT_H, fontSize:18, color:FG });
  });
  slides.push(s);
}

// ── 16. Funding model
{
  const s = pptx.addSlide(); bg(s, BG);
  kicker(s, 'PUBLIC FUNDING MODEL');
  s.addText('Free, by default.', { x:0.6, y:1.0, w:12, h:0.9, fontFace:FONT_H, fontSize:40, color:FG });
  s.addText('Aral3D should remain free for schools, students, teachers, researchers, museums and public institutions.', {
    x:0.6, y:2.1, w:12, h:1.0, fontFace:FONT_H, fontSize:18, color:MUTED
  });
  s.addText('CORE SUPPORT', { x:0.6, y:3.6, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText('Ministry of Education · Ministry of Ecology · public educational & environmental programs · state-supported museums · universities.', {
    x:0.6, y:4.0, w:6, h:2.6, fontFace:FONT_H, fontSize:14, color:FG
  });
  s.addText('OPTIONAL', { x:7.0, y:3.6, w:6, h:0.3, fontFace:FONT_M, fontSize:10, color:ACCENT, charSpacing:8 });
  s.addText('Private museums · festivals · private educational centers · commissioned exhibition versions · international cultural programs.', {
    x:7.0, y:4.0, w:6, h:2.6, fontFace:FONT_H, fontSize:14, color:FG
  });
  slides.push(s);
}

// ── 17. Closing
{
  const s = pptx.addSlide(); bg(s, BG);
  s.addText('What models of water', { x:0.6, y:2.4, w:12, h:1.2, fontFace:FONT_H, fontSize:56, italic:true, color:MUTED, charSpacing:-2 });
  s.addText('are we playing with?', { x:0.6, y:3.5, w:12, h:1.2, fontFace:FONT_H, fontSize:56, italic:true, color:FG, charSpacing:-2 });
  thinRule(s, 5.6);
  s.addText('aral3d.com  ·  Aral School 2026', { x:0.6, y:5.9, w:12, h:0.4, fontFace:FONT_M, fontSize:12, color:ACCENT, charSpacing:6 });
  slides.push(s);
}

// add page numbers to all but title & closing
const total = slides.length;
slides.forEach((s,i)=>{ if(i!==0 && i!==total-1) pageNum(s, i+1, total); });

pptx.writeFile({ fileName: 'public/aral3d-presentation.pptx' }).then(f=>{
  console.log('wrote', f);
});
