const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;
const BASE_URL = 'https://api.freepik.com/v1/ai';

const PROMPTS: Record<string, (name?: string) => string> = {
  jogador: (name) =>
    `Official World Cup 2026 Panini sticker card, photorealistic portrait, wearing green Brazil national team jersey number 10, gold decorative border frame, player name "${name || 'BRASIL'}" at bottom in bold white text, Brazilian flag icon top right, white card background, studio lighting, 2K quality`,
  pet: () =>
    `Official World Cup 2026 Panini sticker card, cute animal as team mascot wearing green Brazil national team jersey, gold decorative border frame, team badge, white card background, studio lighting, 2K quality`,
  familia: () =>
    `Official World Cup 2026 Panini sticker card, family group photo wearing green Brazil national team jerseys, gold decorative border frame, "FAMÍLIA" text at bottom, Brazilian flag, white card background, studio lighting, 2K quality`,
  rara: (name) =>
    `Official World Cup 2026 Panini RARE holographic sticker card, photorealistic portrait, wearing green Brazil national team jersey number 10, silver holographic border with rainbow reflections, RARE badge top left, player name "${name || 'BRASIL'}" at bottom in bold metallic text, Brazilian flag icon, premium card background with sparkle effects, studio lighting, 2K quality`,
};

export function getPrompt(style: string, name?: string): string {
  const fn = PROMPTS[style] || PROMPTS.jogador;
  return fn(name);
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
      aspect_ratio: 'portrait_3_4',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freepik API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.task_id;
}

export async function pollTask(taskId: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${BASE_URL}/beta/text-to-image/reimagine-flux/${taskId}`, {
      headers: { 'x-freepik-api-key': FREEPIK_API_KEY },
    });

    if (!res.ok) continue;

    const data = await res.json();
    const task = data.data;

    if (task.status === 'COMPLETED' && task.generated?.length > 0) {
      return task.generated[0];
    }
    if (task.status === 'FAILED') {
      throw new Error('Geração falhou. Tente novamente com outra foto.');
    }
  }
  throw new Error('Timeout: a geração demorou muito. Tente novamente.');
}

export { FREEPIK_API_KEY };
