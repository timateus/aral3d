import { Link } from 'react-router-dom';

interface Source {
  title: string;
  provider: string;
  license: string;
  url: string;
  locations: string[];
  notes?: string;
}

interface Category {
  name: string;
  sources: Source[];
}

const ALL_LOCS = ['Aral', 'Suaq', 'Almaty', 'Balqash', 'Lake Balqash', 'Alakol'];
const OSM_LOCS = ['Suaq', 'Almaty', 'Balqash', 'Lake Balqash', 'Alakol'];

const CATEGORIES: Category[] = [
  {
    name: 'Elevation',
    sources: [
      {
        title: 'Mapterhorn DEM',
        provider: 'Mapterhorn',
        license: 'Open (attribution)',
        url: 'https://mapterhorn.com/',
        locations: OSM_LOCS,
        notes: 'Global terrain tiles streamed on demand; cached client-side in IndexedDB.',
      },
      {
        title: 'Merged local GeoTIFFs (Copernicus GLO-30 derived)',
        provider: 'ESA Copernicus / project research',
        license: 'CC BY 4.0',
        url: 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model',
        locations: ['Aral'],
        notes: 'aral_region.tif, khorezm.tif, lower_amudarya.tif merged in the browser.',
      },
    ],
  },
  {
    name: 'Imagery',
    sources: [
      {
        title: 'Satlas Super-Resolution 2023',
        provider: 'Allen Institute for AI',
        license: 'CC BY 4.0',
        url: 'https://satlas.allen.ai/',
        locations: ALL_LOCS,
      },
    ],
  },
  {
    name: 'Population',
    sources: [
      {
        title: 'GHS-POP R2023A',
        provider: 'European Commission — Joint Research Centre (JRC)',
        license: 'CC BY 4.0',
        url: 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php',
        locations: ['Aral'],
        notes: '100 m Mollweide raster, epoch 2020 (public/data/population_density.tif).',
      },
      {
        title: 'OpenStreetMap populated places (Overpass API)',
        provider: 'OpenStreetMap contributors',
        license: 'ODbL',
        url: 'https://wiki.openstreetmap.org/wiki/Key:population',
        locations: OSM_LOCS,
        notes: 'Live query for place=city|town|village|hamlet|suburb|... with population tags. Cached per-bbox in IndexedDB.',
      },
    ],
  },
  {
    name: 'Buildings',
    sources: [
      {
        title: 'OpenStreetMap buildings',
        provider: 'OpenStreetMap contributors',
        license: 'ODbL',
        url: 'https://wiki.openstreetmap.org/wiki/Buildings',
        locations: OSM_LOCS,
      },
      {
        title: 'Overture Maps Foundation buildings',
        provider: 'Overture Maps Foundation',
        license: 'ODbL / CDLA-Permissive 2.0',
        url: 'https://overturemaps.org/',
        locations: OSM_LOCS,
        notes: 'Optional toggle in the layers menu.',
      },
    ],
  },
  {
    name: 'Waterways & water bodies',
    sources: [
      {
        title: 'OpenStreetMap water (Overpass API)',
        provider: 'OpenStreetMap contributors',
        license: 'ODbL',
        url: 'https://wiki.openstreetmap.org/wiki/Water',
        locations: OSM_LOCS,
        notes: 'natural=water and waterway=* over each location bbox, cached per-bbox.',
      },
    ],
  },
  {
    name: 'Biodiversity observations',
    sources: [
      {
        title: 'iNaturalist observations',
        provider: 'iNaturalist community',
        license: 'CC BY-NC (per observer)',
        url: 'https://api.inaturalist.org/v1/docs/',
        locations: OSM_LOCS,
        notes: 'Live API pull with photo thumbnails; results cached in localStorage.',
      },
    ],
  },
  {
    name: 'Historical shorelines & basins',
    sources: [
      {
        title: 'Aral Sea historical basin & shoreline vectors',
        provider: 'Project research (Robert)',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
        notes: '13th/19th/21st-century basins and Area_1974–2015 shoreline extents.',
      },
    ],
  },
  {
    name: 'Time series',
    sources: [
      {
        title: 'Aral Sea annual level / volume / salinity',
        provider: 'Project research (compiled)',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
      },
      {
        title: 'Karakalpakstan monthly climate',
        provider: 'Project research (compiled)',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
      },
    ],
  },
  {
    name: 'Demographics',
    sources: [
      {
        title: 'Karakalpakstan demographic CSVs',
        provider: 'Project research',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
        notes: 'Adolescent childbirth, arranged marriages, arrivals, child/infant/maternal mortality, drinking water, emigrants, housing, natural gas, sewage coverage, life expectancy.',
      },
    ],
  },
  {
    name: 'Groundwater',
    sources: [
      {
        title: 'Groundwater level shapefile',
        provider: 'Project research',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
      },
    ],
  },
  {
    name: 'Land cover',
    sources: [
      {
        title: 'GlobCover / project landcover.tif',
        provider: 'ESA GlobCover derived',
        license: 'CC BY',
        url: 'http://due.esrin.esa.int/page_globcover.php',
        locations: ['Aral'],
      },
    ],
  },
  {
    name: 'Schools, dwellings, vocabulary',
    sources: [
      {
        title: 'Field research (schools, dwellings, cultural vocabulary)',
        provider: 'Project field research',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
      },
    ],
  },
  {
    name: 'Audio',
    sources: [
      {
        title: 'Kobyz music & Aralkum field recordings',
        provider: 'Project field recordings',
        license: 'Project-internal',
        url: '#',
        locations: ['Aral'],
      },
    ],
  },
];

export default function DataSources() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            Data sources
          </h1>
          <Link to="/" className="tech-font text-xs text-muted-foreground hover:text-primary underline">
            ← back
          </Link>
        </div>

        <p className="tech-font text-sm text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Every dataset used across the Aral experience and the smaller
          location viewers (Suaq, Almaty, Balqash city, Lake Balqash, Alakol).
          Live datasets are fetched from public APIs on demand and cached
          client-side so repeat visits are instant.
        </p>

        <div className="space-y-10">
          {CATEGORIES.map((cat) => (
            <section key={cat.name}>
              <h2 className="font-display text-2xl mb-4 border-b border-border/40 pb-2">
                {cat.name}
              </h2>
              <div className="space-y-4">
                {cat.sources.map((s) => (
                  <div key={s.title} className="border border-border/40 bg-card/40 p-4">
                    <div className="flex items-baseline justify-between gap-4 flex-wrap">
                      <div className="font-display text-lg">{s.title}</div>
                      <div className="tech-font text-[10px] px-2 py-0.5 border border-border/60 text-muted-foreground uppercase tracking-wider">
                        {s.license}
                      </div>
                    </div>
                    <div className="tech-font text-xs text-muted-foreground mt-1">
                      {s.provider}
                    </div>
                    {s.notes && (
                      <div className="tech-font text-xs text-foreground/80 mt-2 leading-relaxed">
                        {s.notes}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 gap-4 flex-wrap">
                      <div className="flex flex-wrap gap-1">
                        {s.locations.map((loc) => (
                          <span
                            key={loc}
                            className="tech-font text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary uppercase tracking-wider"
                          >
                            {loc}
                          </span>
                        ))}
                      </div>
                      {s.url !== '#' && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tech-font text-xs text-primary hover:underline"
                        >
                          source →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 tech-font text-[10px] text-muted-foreground/70 border-t border-border/40 pt-4">
          Map data © OpenStreetMap contributors. Population raster: GHS-POP
          R2023A © European Union, 1995–present. Imagery: Satlas / Allen
          Institute for AI. Observations © respective iNaturalist observers.
        </div>
      </div>
    </div>
  );
}
