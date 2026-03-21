import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Cache the logo SVG content
let logoSvgCache: string | null = null;

function getLogoSvg(): string {
  if (!logoSvgCache) {
    const logoPath = path.join(process.cwd(), 'public', 'logo-figuri.svg');
    logoSvgCache = fs.readFileSync(logoPath, 'utf-8');
  }
  return logoSvgCache;
}

export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1050;
  const height = metadata.height || 1417;

  // Logo dimensions for watermark (proportional to image)
  const logoWidth = Math.round(width * 0.35);
  const logoHeight = Math.round(logoWidth * 0.5); // ~2:1 aspect ratio

  // Render the logo SVG at desired size with transparency
  const logoBuffer = await sharp(Buffer.from(getLogoSvg()))
    .resize(logoWidth, logoHeight, { fit: 'inside' })
    .png()
    .toBuffer();

  // Create a transparent version of the logo (20% opacity)
  const transparentLogo = await sharp(logoBuffer)
    .ensureAlpha()
    .modulate({ brightness: 1 })
    .composite([{
      input: Buffer.from([255, 255, 255, 50]), // 50/255 ≈ 20% opacity
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  // Create tiled pattern: repeat the logo across the image diagonally
  const spacingX = Math.round(logoWidth * 1.6);
  const spacingY = Math.round(logoHeight * 2.5);

  // Build composite array with multiple logo placements
  const composites: sharp.OverlayOptions[] = [];

  for (let row = -1; row < Math.ceil(height / spacingY) + 1; row++) {
    for (let col = -1; col < Math.ceil(width / spacingX) + 1; col++) {
      const offsetX = (row % 2 === 0) ? 0 : Math.round(spacingX / 2); // stagger rows
      const x = col * spacingX + offsetX;
      const y = row * spacingY;

      if (x >= -logoWidth && x < width + logoWidth && y >= -logoHeight && y < height + logoHeight) {
        composites.push({
          input: transparentLogo,
          top: Math.max(0, y),
          left: Math.max(0, x),
        });
      }
    }
  }

  return image
    .composite(composites)
    .jpeg({ quality: 85 })
    .toBuffer();
}
