const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;
const BASE_URL = 'https://api.freepik.com/v1/ai';

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const COUNTRY_MAP: Record<string, { jersey: string; flag: string }> = {
  brasil:    { jersey: 'yellow Brazil national team jersey with green details', flag: 'Brazilian' },
  argentina: { jersey: 'white and light blue striped Argentina national team jersey', flag: 'Argentine' },
  franca:    { jersey: 'dark blue France national team jersey', flag: 'French' },
  alemanha:  { jersey: 'white Germany national team jersey with black details', flag: 'German' },
  espanha:   { jersey: 'red Spain national team jersey', flag: 'Spanish' },
  portugal:  { jersey: 'dark red Portugal national team jersey', flag: 'Portuguese' },
  uruguai:   { jersey: 'light blue Uruguay national team jersey', flag: 'Uruguayan' },
  colombia:  { jersey: 'yellow Colombia national team jersey', flag: 'Colombian' },
};

function getCountryInfo(country?: string) {
  return COUNTRY_MAP[country || 'brasil'] || COUNTRY_MAP.brasil;
}

const PROMPTS: Record<string, (data: StickerData) => string> = {
  jogador: (d) => {
    const c = getCountryInfo(d.country);
    const info = [d.name, d.height, d.birth].filter(Boolean).join(' · ');
    return `Official World Cup 2026 Panini sticker card, photorealistic portrait, wearing ${c.jersey} number 10, gold decorative border frame, player name "${d.name || 'JOGADOR'}" at bottom in bold white text, ${c.flag} flag icon top right, player info "${info}" in small text, white card background, studio lighting, 2K quality`;
  },
  pet: (d) => {
    const c = getCountryInfo(d.country);
    return `Official World Cup 2026 Panini sticker card, cute animal as team mascot wearing ${c.jersey}, gold decorative border frame, name "${d.name || 'MASCOTE'}" at bottom, ${c.flag} flag, team badge, white card background, studio lighting, 2K quality`;
  },
  familia: (d) => {
    const c = getCountryInfo(d.country);
    return `Official World Cup 2026 Panini sticker card, family group photo wearing ${c.jersey}, gold decorative border frame, "${d.name || 'FAMÍLIA'}" text at bottom, ${c.flag} flag, white card background, studio lighting, 2K quality`;
  },
  rara: (d) => {
    const c = getCountryInfo(d.country);
    const info = [d.name, d.height, d.birth].filter(Boolean).join(' · ');
    return `Official World Cup 2026 Panini RARE holographic sticker card, photorealistic portrait, wearing ${c.jersey} number 10, silver holographic border with rainbow reflections, RARE badge top left, player name "${d.name || 'JOGADOR'}" at bottom in bold metallic text, player info "${info}", ${c.flag} flag icon, premium card background with sparkle effects, studio lighting, 2K quality`;
  },
};

export function getPrompt(style: string, data: StickerData): string {
  const fn = PROMPTS[style] || PROMPTS.jogador;
  return fn(data);
}

export async function createGeneration(imageBase64: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/beta/text-to-image/reimagine-flux`, {
    method: 'POST',
    headers: {
      'x-freepik-api-key': FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageBase64,
      prompt: prompt,
      imagination: 'subtle',
      aspect_ratio: 'traditional_3_4',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freepik API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.task_id;
}

export { FREEPIK_API_KEY };
