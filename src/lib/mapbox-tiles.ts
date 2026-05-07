import * as THREE from 'three';

export interface MapboxTextures {
  satellite: THREE.Texture;
  terrainRGB: THREE.Texture;
  // Pre-decoded elevation min/max from the terrain-RGB image (sampled CPU-side once)
  minElev: number;
  maxElev: number;
}

const SIZE = 1024; // static tile size

function buildStaticUrl(style: string, bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }, token: string) {
  const bbox = `[${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}]`;
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${bbox}/${SIZE}x${SIZE}@2x?access_token=${token}&attribution=false&logo=false`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load ${url.slice(0, 80)}…`));
    img.src = url;
  });
}

function imageToTexture(img: HTMLImageElement): THREE.Texture {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function decodeMinMax(img: HTMLImageElement): { min: number; max: number } {
  const c = document.createElement('canvas');
  // downsample for speed
  const W = 256, H = 256;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const elev = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    if (elev < min) min = elev;
    if (elev > max) max = elev;
  }
  return { min, max };
}

export async function loadMapboxTextures(
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  token: string
): Promise<MapboxTextures> {
  const satUrl = buildStaticUrl('satellite-v9', bounds, token);
  // Mapbox terrain-rgb-v1 style for static API; alternative is the raw raster tile endpoint
  const terrainStyleUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${SIZE},${SIZE}@2x.png?access_token=${token}`;
  // Use static-tiles endpoint so we can specify a bbox for terrain too
  const terrainUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/[${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}]/${SIZE}x${SIZE}@2x.pngraw?access_token=${token}`;

  const [satImg, terrainImg] = await Promise.all([loadImage(satUrl), loadImage(terrainUrl)]);
  const { min, max } = decodeMinMax(terrainImg);
  const satellite = imageToTexture(satImg);
  const terrainRGB = imageToTexture(terrainImg);
  // terrain texture must NOT be sRGB (it's data, not color)
  terrainRGB.colorSpace = THREE.NoColorSpace;
  return { satellite, terrainRGB, minElev: min, maxElev: max };
}
