import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import boatImg from '@/assets/report/boat.jpg';
import saltImg from '@/assets/report/salt.jpg';
import dustImg from '@/assets/report/dust.jpg';
import fishImg from '@/assets/report/fish.jpg';
import cottonImg from '@/assets/report/cotton.jpg';
import shorelineImg from '@/assets/report/shoreline.jpg';

/* ------------------------------------------------------------------ */
/*  A small breathing simulation. The sea recedes, very slowly,       */
/*  while the page is open. No buttons. Numbers in the margin          */
/*  are residue, not the subject.                                      */
/* ------------------------------------------------------------------ */

const ReceedingSea = () => {
  const [t, setT] = useState(0); // 0 .. 1, 1960 .. 2025
  const raf = useRef<number>();
  const start = useRef<number>(0);

  useEffect(() => {
    const loop = (ts: number) => {
      if (!start.current) start.current = ts;
      const elapsed = (ts - start.current) / 1000;
      // 26 second cycle, then pause, then restart
      const cycle = 30;
      const phase = (elapsed % cycle) / cycle;
      const eased = phase < 0.85 ? phase / 0.85 : 1; // hold at the end
      setT(eased);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const year = Math.round(1960 + t * 65);
  // basin shapes
  const k = t;
  const northH = 28 - k * 10;
  const westW = 30 - k * 20;
  const westH = 70 - k * 50;
  const eastW = 60 - k * 58;
  const eastH = 60 - k * 58;

  const inkBlue = 'hsl(212 35% 35%)';
  const ink = 'hsl(35 12% 28%)';

  return (
    <figure className="my-20">
      <div className="relative mx-auto" style={{ maxWidth: 520 }}>
        <svg viewBox="0 0 200 160" className="w-full h-auto">
          {/* 1960 outline — the ghost */}
          <path
            d="M55 22 Q95 14 145 28 Q165 55 158 95 Q145 135 100 138 Q55 135 42 95 Q40 55 55 22 Z"
            fill="none" stroke={ink} strokeWidth="0.35" strokeDasharray="1.5 1.5" opacity="0.45"
          />
          {/* current water — soft, watery */}
          <g fill={inkBlue} opacity="0.55">
            <ellipse cx="80" cy="32" rx="26" ry={Math.max(2, northH / 2)} />
            <rect x={62} y={50} width={Math.max(0, westW)} height={Math.max(0, westH)} rx="4" />
            <rect x={108} y={55} width={Math.max(0, eastW)} height={Math.max(0, eastH)} rx="4" />
          </g>
        </svg>
        <div
          className="absolute right-0 top-0 font-serif italic text-[13px]"
          style={{ color: ink, opacity: 0.6 }}
        >
          {year}
        </div>
      </div>
      <figcaption className="mt-6 text-center font-serif italic text-[13px] leading-relaxed text-foreground/55 max-w-md mx-auto">
        the sea, withdrawing.<br/>
        the dotted line is what the water once touched.
      </figcaption>
    </figure>
  );
};

/* ------------------------------------------------------------------ */
/*  Marginalia — small numerical residues that float in the margin    */
/* ------------------------------------------------------------------ */

const Margin = ({ children }: { children: React.ReactNode }) => (
  <aside
    className="md:absolute md:left-[-180px] md:w-[150px] md:top-1 mt-3 md:mt-0
               font-serif italic text-[12px] leading-[1.5] text-foreground/45
               border-l border-foreground/20 pl-3 md:border-none md:pl-0 md:text-right md:pr-3 md:border-r md:border-foreground/15"
  >
    {children}
  </aside>
);

const Para = ({ children, margin }: { children: React.ReactNode; margin?: React.ReactNode }) => (
  <div className="relative">
    {margin && <Margin>{margin}</Margin>}
    <p className="font-serif text-[17px] leading-[1.85] text-foreground/85 mb-7">
      {children}
    </p>
  </div>
);

const DropCapPara = ({ first, children, margin }: { first: string; children: React.ReactNode; margin?: React.ReactNode }) => (
  <div className="relative">
    {margin && <Margin>{margin}</Margin>}
    <p className="font-serif text-[17px] leading-[1.85] text-foreground/85 mb-7">
      <span className="float-left font-serif text-[58px] leading-[0.85] mr-2 mt-1 text-foreground/80">
        {first}
      </span>
      {children}
    </p>
  </div>
);

const Plate = ({ src, caption, alt }: { src: string; caption: string; alt: string }) => (
  <figure className="my-16 -mx-4 md:mx-0">
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full h-auto"
      style={{ filter: 'sepia(0.18) saturate(0.85) contrast(0.95)' }}
    />
    <figcaption className="mt-4 font-serif italic text-[13px] leading-relaxed text-foreground/55 max-w-md">
      {caption}
    </figcaption>
  </figure>
);

const Movement = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <section className="mb-32">
    <header className="mb-12">
      <div className="font-serif italic text-[12px] text-foreground/40 mb-1 tracking-wide">
        {n}
      </div>
      <h2 className="font-serif text-[26px] leading-tight text-foreground/85 italic">
        {title}
      </h2>
    </header>
    <div className="md:pl-0">{children}</div>
  </section>
);

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const Report = () => {
  useEffect(() => {
    document.title = 'A Field Notebook of the Aral';
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        // bone-paper palette — overrides the dark theme for this page only
        background: 'hsl(36 28% 94%)',
        color: 'hsl(30 18% 18%)',
      }}
    >
      {/* slim top bar */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid hsla(30, 18%, 18%, 0.18)' }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 font-serif italic text-[13px] text-foreground/60 hover:text-foreground transition-colors"
          style={{ color: 'hsl(30 18% 30%)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          return to the map
        </Link>
        <div className="font-serif italic text-[12px]" style={{ color: 'hsl(30 18% 45%)' }}>
          a field notebook
        </div>
      </header>

      {/* Title */}
      <section className="px-6 pt-28 pb-20 max-w-[680px] mx-auto">
        <div className="font-serif italic text-[13px] mb-8" style={{ color: 'hsl(30 18% 45%)' }}>
          i.
        </div>
        <h1 className="font-serif text-[46px] md:text-[58px] leading-[1.05] tracking-tight" style={{ color: 'hsl(30 18% 18%)' }}>
          A field notebook<br/>
          <span className="italic" style={{ color: 'hsl(30 18% 38%)' }}>of the Aral.</span>
        </h1>
        <div className="mt-10 font-serif italic text-[14px]" style={{ color: 'hsl(30 18% 50%)' }}>
          — written from the inside, where the sea used to be.
        </div>
      </section>

      {/* Body */}
      <main className="px-6 pb-32 max-w-[680px] mx-auto">

        {/* I. Approaching */}
        <Movement n="i." title="The approach.">
          <DropCapPara
            first="W"
            margin={<>53.4 m above sea<br/>67,500 km²<br/>—1960</>}
          >
            hen we set out from Nukus the road went on for a long time without
            anything happening, the asphalt giving way after some kilometres to
            a kind of dust that the wind had laid down in long sheets. There
            had once been a sea here, of course, but the strangeness was that
            no one we passed thought it odd that there no longer was. A boy
            standing by a low wall watched our car pass and did not turn his
            head.
          </DropCapPara>

          <Para>
            I had been told, by way of preparation, that the Aral was the
            fourth-largest lake on earth. The sentence is grammatically still
            in the present tense in a few books I had read on the journey,
            books printed in the late nineteen-seventies, in which the Aral
            occupies a great oval blue space on the page, larger than several
            European countries placed end to end, and labelled in a small
            confident type.
          </Para>

          <Plate
            src={boatImg}
            alt="A rusted fishing boat stranded on cracked salt earth, far from any water."
            caption="Plate I — A boat near Muynak. The sea, when this vessel last floated, was perhaps one hundred and fifty kilometres further to the south."
          />
        </Movement>

        {/* II. The arithmetic */}
        <Movement n="ii." title="The arithmetic of the diversion.">
          <Para margin={<>Amu Darya<br/>Syr Darya<br/>—the two rivers</>}>
            The story, as it is usually told, begins with two rivers. The Amu
            Darya, which the Greeks knew as the Oxus, and the Syr Darya, the
            Jaxartes, both running down out of the Pamirs and the Tien Shan
            and emptying, after a long quiet journey, into a basin without an
            outlet. For some thousands of years this arrangement held; the
            water that arrived was approximately the water that evaporated, and
            the sea sat in its hollow at fifty-three metres above the level of
            the world's other seas, and changed only very slowly.
          </Para>

          <Para margin={<>56 → 2 km³/yr<br/>inflow,<br/>1960 → 1985</>}>
            What happened then is, in one sense, very simple. The water of
            both rivers was, by degrees, taken away — into canals, into fields,
            into long parallel rows of cotton — and what had once arrived at
            the sea no longer arrived. By the early eighties, of the fifty-six
            cubic kilometres of water that the Amu Darya had once delivered
            each year, only two were left. The remainder had become shirts.
          </Para>

          <Plate
            src={cottonImg}
            alt="A vast cotton field with a thin irrigation channel running down the middle."
            caption="Plate II — Cotton, near Khorezm. The narrow channel in the foreground is one of perhaps a hundred thousand such furrows that, taken together, drank a sea."
          />
        </Movement>

        {/* III. The breathing simulation */}
        <Movement n="iii." title="The withdrawal.">
          <Para margin={<>−27.6 m<br/>by 2025</>}>
            The sea, deprived of its rivers, did what any body of water in a
            warm dry place will do. It went on evaporating. The shoreline,
            year by year, drew back, slowly at first and then less slowly, and
            the inhabitants of the small ports along its rim found themselves
            living a little further inland each summer than they had the
            summer before. By the late eighties the recession had become so
            evident that the sea ceased, in any meaningful sense, to be one
            sea, and instead became two; and then, by the early two-thousands,
            three.
          </Para>

          <ReceedingSea />

          <Para>
            A diagram of this process, which one could draw on the back of an
            envelope, would show three pale shapes shrinking inside a dotted
            outline. It is not, in itself, a very interesting diagram. What is
            interesting is that the dotted outline is the memory of a sea, and
            that for the people who once lived on its margins it remains, in
            some difficult sense, the actual sea — the one they refer to when
            they say <em>the sea</em>, as one might refer to a relative who has
            died.
          </Para>
        </Movement>

        {/* IV. Salt */}
        <Movement n="iv." title="On salt, and what it does.">
          <Plate
            src={saltImg}
            alt="A close-up of dry cracked earth crusted with salt crystals."
            caption="Plate III — The exposed bed, fifty kilometres east of Muynak. The white is salt; the brown was, until quite recently, the bottom of the sea."
          />

          <DropCapPara
            first="S"
            margin={<>10 → 270 g/L<br/>salinity,<br/>1960 → 2025</>}
          >
            alt is what the sea leaves behind. As the water goes the salt
            stays, in the remaining water at first, where it concentrates
            until the fish can no longer breathe in it, and then on the
            ground, in great pale crusts that the wind picks up and carries.
            By 2010 the southern remnants held no fish at all. Twenty
            species, in the space of fifty years, simply ceased.
          </DropCapPara>

          <Plate
            src={fishImg}
            alt="A small fish skeleton resting on pale dry sand."
            caption="Plate IV — A specimen, picked up by the road. Of the twenty species recorded here in 1960, none are still living in these waters."
          />
        </Movement>

        {/* V. Dust */}
        <Movement n="v." title="The wind that is now made of seabed.">
          <Para margin={<>5 M ha<br/>of new desert<br/>—Aralkum</>}>
            The new desert has a name now. It is called the Aralkum, which
            means simply <em>the sand of the Aral</em>, and it covers more
            than five million hectares — an area larger than Switzerland — of
            what was, within living memory, water. The wind that comes off
            this desert is not like other winds. It carries, in its lower
            layers, the residues of sixty years of upstream agriculture:
            pesticide salts, fine particles of fertiliser, the chemistry of
            an entire watershed laid down on a now-exposed floor.
          </Para>

          <Plate
            src={dustImg}
            alt="A pale dust haze rolling across an empty plain at dusk."
            caption="Plate V — A dust event at dusk. Such storms reach Karakalpakstan, on average, on one hundred days of the year."
          />

          <Para margin={<>per 100,000<br/>in Karakalpakstan,<br/>2005–2009</>}>
            One can read, in the regional health statistics, what this wind
            does to the people who live in it. Asthma rates climb from five
            hundred to eight hundred per hundred thousand inhabitants in the
            space of three years. Bronchitis, anaemia, kidney complaints
            and certain cancers all rise in the same period. The figures are
            real but they are not, in the end, the most truthful description.
            The most truthful description is that the children in Muynak
            cough in their sleep.
          </Para>
        </Movement>

        {/* VI. The dam */}
        <Movement n="vi." title="An attempt at repair.">
          <Para margin={<>Kokaral, 2005<br/>13 km of earth<br/>and concrete</>}>
            In the north, where the Syr Darya still arrives, an attempt has
            been made. A dam, thirteen kilometres long, was built across the
            narrow strait that had once connected the northern basin to what
            was left of the south. The water of the Syr Darya, which had been
            pouring into this strait and then disappearing into the dry
            southern bed, was now held. The northern sea began, slowly, to
            return. By the time we visited it had risen by some metres; the
            fish had come back; small boats were once again going out from a
            port called Aralsk that, twenty years earlier, had been a port in
            name only.
          </Para>

          <Para>
            The southern sea has not been repaired. The Amu Darya, by the
            time it reaches what remains of its delta, is reduced to a
            collection of brackish lakes, and there is no engineering of any
            kind, however well-intentioned, that can restore a body of water
            from which the rivers have been taken. The sea in the south is
            not coming back. This is not, in the end, a sentence about the
            sea. It is a sentence about us.
          </Para>
        </Movement>

        {/* VII. Coda */}
        <Movement n="vii." title="A note in the margin.">
          <figure className="my-12 mx-auto" style={{ maxWidth: 280 }}>
            <img
              src={shorelineImg}
              alt="A faint sepia ink outline of a shoreline on aged paper."
              loading="lazy"
              className="w-full h-auto"
              style={{ filter: 'sepia(0.3) saturate(0.7) contrast(0.95)', mixBlendMode: 'multiply' }}
            />
          </figure>

          <Para>
            What I have tried to set down here is not a report. A report is a
            thing one writes from outside, and the Aral, like every ecological
            thing, refuses to be looked at from outside. We are downstream of
            it, breathing the dust of it, wearing the cotton of it. The
            difficulty is not that the catastrophe is too large to grasp. The
            difficulty is that we are inside it, and there is no margin from
            which to take its measurements.
          </Para>

          <Para>
            What remains to be done, then, is mostly to look. To stand on the
            old shore, in the silence that is left there. To say the names of
            the species that are gone. To watch the wind move over the salt,
            and to recognise, perhaps for the first time, that the wind is
            ours.
          </Para>

          <div
            className="font-serif italic text-[13px] mt-16 text-center"
            style={{ color: 'hsl(30 18% 50%)' }}
          >
            — finis.
          </div>
        </Movement>

      </main>

      <footer
        className="px-6 py-8 max-w-[680px] mx-auto"
        style={{ borderTop: '1px solid hsla(30, 18%, 18%, 0.18)' }}
      >
        <div
          className="font-serif italic text-[12px] leading-relaxed"
          style={{ color: 'hsl(30 18% 50%)' }}
        >
          A reading. Compiled from MFSA / Aral School materials and from the
          author's own visits, in the spring of the year. The numbers in the
          margins are given as residue; the subject is not the numbers.
        </div>
      </footer>
    </div>
  );
};

export default Report;
