// Sebald-mode literary passages, each pinned to a NARRATIVE_STEPS index.
// The map is the medium; this is the voice over it.

export interface ReadingPassage {
  stepIndex: number; // index into NARRATIVE_STEPS — drives camera + year
  marker: string;    // e.g. "i.", "ii."
  title: string;
  body: string;      // long-form serif prose
  margin?: string;   // optional small numerical residue
}

export const READING_PASSAGES: ReadingPassage[] = [
  {
    stepIndex: 0,
    marker: 'i.',
    title: 'The approach.',
    body:
      'When we set out from Nukus the road went on for a long time without anything happening, the asphalt giving way after some kilometres to a kind of dust that the wind had laid down in long sheets. There had once been a sea here, of course, but the strangeness was that no one we passed thought it odd that there no longer was.',
    margin: '53.4 m above sea\n67,500 km²\n— 1960',
  },
  {
    stepIndex: 1,
    marker: 'ii.',
    title: 'The arithmetic of the diversion.',
    body:
      'The story, as it is usually told, begins with two rivers. The Amu Darya, which the Greeks knew as the Oxus, and the Syr Darya, the Jaxartes — both running down out of the Pamirs and the Tien Shan and emptying, after a long quiet journey, into a basin without an outlet. For some thousands of years this arrangement held.',
    margin: 'Amu Darya\nSyr Darya\n— the two rivers',
  },
  {
    stepIndex: 2,
    marker: 'iii.',
    title: 'What happened, in one sentence.',
    body:
      'The water of both rivers was, by degrees, taken away — into canals, into fields, into long parallel rows of cotton — and what had once arrived at the sea no longer arrived. By the early eighties, of the fifty-six cubic kilometres of water the Amu Darya had once delivered each year, only two were left. The remainder had become shirts.',
    margin: '56 → 2 km³/yr\ninflow\n1960 → 1985',
  },
  {
    stepIndex: 3,
    marker: 'iv.',
    title: 'The withdrawal.',
    body:
      'The sea, deprived of its rivers, did what any body of water in a warm dry place will do. It went on evaporating. The shoreline, year by year, drew back, slowly at first and then less slowly, and the inhabitants of the small ports along its rim found themselves living a little further inland each summer than they had the summer before.',
    margin: '−14 m\nby 1990',
  },
  {
    stepIndex: 4,
    marker: 'v.',
    title: 'The sea becomes plural.',
    body:
      'By the late eighties the recession had become so evident that the sea ceased, in any meaningful sense, to be one sea, and instead became two; and then, by the early two-thousands, three. The dotted outline of what was once the shore is, for the people who lived on its margins, the actual sea — the one they refer to when they say the sea, as one might refer to a relative who has died.',
    margin: '−22 m\nby 2005',
  },
  {
    stepIndex: 5,
    marker: 'vi.',
    title: 'The wind that is now made of seabed.',
    body:
      'The new desert has a name now. It is called the Aralkum, which means simply the sand of the Aral, and it covers more than five million hectares of what was, within living memory, water. The wind that comes off this desert is not like other winds. It carries, in its lower layers, the residues of sixty years of upstream agriculture. The children in Muynak cough in their sleep.',
    margin: '5 M ha\nof new desert\n— Aralkum',
  },
  {
    stepIndex: 6,
    marker: 'vii.',
    title: 'A note in the margin.',
    body:
      'What I have tried to set down here is not a report. A report is a thing one writes from outside, and the Aral, like every ecological thing, refuses to be looked at from outside. We are downstream of it, breathing the dust of it, wearing the cotton of it. The difficulty is not that the catastrophe is too large to grasp. The difficulty is that we are inside it, and there is no margin from which to take its measurements.',
  },
];
