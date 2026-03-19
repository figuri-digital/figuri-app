import sharp from 'sharp';

export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1050;
  const height = metadata.height || 1417;

  // Create diagonal watermark text SVG
  const fontSize = Math.round(width * 0.06);
  const watermarkSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="${fontSize * 8}" height="${fontSize * 6}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${fontSize}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.35)" letter-spacing="4">FIGURI IA</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)"/>
    </svg>
  `;

  return image
    .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}
