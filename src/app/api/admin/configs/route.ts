export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

// ── Hardcoded defaults (fallback when DB has no row yet) ─────────────────────

const DEFAULT_LAYOUTS: Record<string, Record<string, string>> = {
  sozinho: {
    brasil: 'brasil.jpg', argentina: 'argentina.jpg', colombia: 'colombia.jpg',
    uruguai: 'uruguai.jpg', franca: 'franca.png', alemanha: 'alemanha.png',
    espanha: 'espanha.png', portugal: 'portugal.png',
  },
  pet: {
    brasil: 'Pet/brasil.png', argentina: 'Pet/argentina.png', colombia: 'Pet/colombia.png',
    uruguai: 'Pet/uruguai.png', franca: 'Pet/franca.png', alemanha: 'Pet/alemanha.png',
    espanha: 'Pet/espanha.png', portugal: 'Pet/portugal.png',
  },
  casal: {
    brasil: 'Casal/brasil.png', argentina: 'Casal/argentina.png', colombia: 'Casal/colombia.png',
    uruguai: 'Casal/uruguai.png', franca: 'Casal/franca.png', alemanha: 'Casal/alemanha.png',
    espanha: 'Casal/espanha.png', portugal: 'Casal/portugal.png',
  },
};

const SOZINHO_PROMPTS: Record<string, string> = {
  brasil: 'Create a new version of the provided sports poster by replacing only the player, while keeping the entire design exactly the same.\nUse the uploaded image as a strict visual reference and template.\nKEEP EXACTLY THE SAME:\n Green background with layered shapes\n Large white number "2" behind the player\n Color tones and gradients\n Lighting, shadows, and contrast of the composition\n Brazil national team jersey style (yellow with green details)\n Framing and crop (chest-up portrait, centered)\n Overall layout, spacing, and alignment\nREPLACE ONLY:\n The player\'s face and body with the person from the uploaded image\nREQUIREMENTS FOR THE NEW PERSON:\n Same pose (front-facing, centered)\n Same framing (chest up)\n Neutral/confident expression\n Wearing the Brazil national team jersey (yellow with green collar and details)\n Maintain realistic anatomy and proportions\nREALISM AND INTEGRATION:\n Match lighting direction from the original image\n Match skin tones to the scene lighting\n Ensure natural blending between face, neck, and jersey\n Preserve shadows and highlights consistent with the original\n Keep photorealistic quality (no artificial or cartoon look)\nSTRICT RULES:\n Do NOT change background, colors, or layout\n Do NOT modify the number "2"\n Do NOT alter jersey design or colors\n Do NOT add or remove any design elements\n Do NOT change composition or camera angle\nThe final image must look like the same original poster, with only the player replaced seamlessly and realistically.',
  argentina: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire blue background with abstract shapes and the large number behind unchanged. Keep the Argentina national team jersey identical (colors, stripes, texture, logo, and details). The new person must be centered, facing forward, with realistic skin tones and natural shadows, seamlessly blended with the original lighting and composition.',
  colombia: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire yellow background with abstract shapes and the large number behind completely unchanged. Keep the Colombia national team jersey identical (colors, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  uruguai: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and facial expression (slight smile). Preserve the entire light blue background with abstract shapes and the large number behind completely unchanged. Keep the Uruguay national team jersey identical (colors, texture, logo, collar, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  franca: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire blue background with abstract shapes and the large number behind completely unchanged. Keep the France national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  alemanha: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire gray/black background with abstract shapes and the large number behind completely unchanged. Keep the Germany national team jersey identical (colors, pattern, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  espanha: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire red background with abstract shapes and the large number behind completely unchanged. Keep the Spain national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  portugal: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire red background with abstract shapes and the large number behind completely unchanged. Keep the Portugal national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
};

const PET_PROMPTS: Record<string, string> = {
  brasil: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, green background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same yellow Brazil national team jersey with green details. Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Do not change colors, layout, background, or graphic elements — only replace the pet.',
  argentina: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Argentina national team jersey (white and light blue stripes with black collar). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Ensure the perspective, scale, and pose match perfectly with the original layout. Do not change colors, layout, background, jersey, or graphic elements — only replace the pet.',
  colombia: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, yellow background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Colombia national team jersey (yellow shirt with red and blue details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog fits seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  uruguai: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, light blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Uruguay national team jersey (light blue shirt with white collar and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  franca: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same France national team jersey (dark blue shirt with subtle pattern, white collar, and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog blends seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  alemanha: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, gray and black background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Germany national team jersey (white shirt with black, red, and yellow details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  espanha: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, red background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Spain national team jersey (red shirt with blue sleeves and yellow details, including the crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  portugal: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, red background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Portugal national team jersey (red shirt with green details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
};

const CASAL_PROMPTS: Record<string, string> = {
  brasil: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face and appearance to the corresponding position in the original image. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Brazil national team yellow jerseys exactly as they are, including logo, texture, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged. Ensure realistic blending, matching skin tones, lighting, shadows, and perspective so the new couple looks naturally integrated into the original scene.',
  argentina: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Argentina national team jersey exactly as it is, including stripes, logo, texture, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  colombia: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Colombia national team yellow jersey exactly as it is, including logo, number, texture, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  uruguai: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Uruguay national team light blue jersey exactly as it is, including logo, texture, collar, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  franca: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the France national team blue jersey exactly as it is, including logo, texture, patterns, collar, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  alemanha: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Germany national team jersey exactly as it is, including colors, stripes, logo, texture, patterns, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  espanha: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Spain national team red jersey exactly as it is, including colors, stripes, logo, texture, patterns, collar, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
  portugal: 'Replace the couple in the image using the two provided reference photos (one for each person). Match each reference face precisely to the corresponding position in the original image. The new faces must be highly faithful to the reference images, preserving identity, facial features, proportions, skin tone, and expression as accurately as possible. Keep the exact same pose, body position, facial direction, framing, and proportions. Preserve the Portugal national team red jersey exactly as it is, including logo, patterns, texture, collar details, folds, and lighting. Do not change the clothing. Maintain the original background, colors, shapes, and layout completely unchanged.',
};

const COUNTRIES = ['brasil', 'argentina', 'colombia', 'uruguai', 'franca', 'alemanha', 'espanha', 'portugal'];
const STYLES = ['sozinho', 'pet', 'casal'];

function getDefaultPrompt(style: string, country: string): string {
  if (style === 'pet') return PET_PROMPTS[country] || PET_PROMPTS.brasil;
  if (style === 'casal') return CASAL_PROMPTS[country] || CASAL_PROMPTS.brasil;
  return SOZINHO_PROMPTS[country] || SOZINHO_PROMPTS.brasil;
}

function getDefaultLayout(style: string, country: string): string {
  return DEFAULT_LAYOUTS[style]?.[country] || DEFAULT_LAYOUTS.sozinho.brasil;
}

// ── GET — list all configs (DB rows merged with defaults) ────────────────────

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: rows, error: selectError } = await supabase
    .from('figurinha_configs')
    .select('*');

  if (selectError) {
    console.error('GET figurinha_configs error:', selectError);
    return NextResponse.json({ error: selectError.message, configs: [] }, { status: 500 });
  }

  const DEFAULT_FIELD_COLORS = { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' };
  const DEFAULT_TEXT_COLORS = { '01': DEFAULT_FIELD_COLORS, '02': DEFAULT_FIELD_COLORS, '03': DEFAULT_FIELD_COLORS, '04': DEFAULT_FIELD_COLORS };
  type FieldColors = { name: string; birth: string; height: string };
  type DBRow = { style: string; country: string; layout_file: string; moldura_file: string | null; prompt: string; text_colors: Record<string, FieldColors>; updated_at: string | null };
  const dbMap: Record<string, DBRow> = {};
  (rows || []).forEach(r => { dbMap[`${r.style}__${r.country}`] = r; });

  const configs = STYLES.flatMap(style =>
    COUNTRIES.map(country => {
      const key = `${style}__${country}`;
      const db = dbMap[key];
      return {
        style,
        country,
        layout_file: db?.layout_file ?? getDefaultLayout(style, country),
        moldura_file: db?.moldura_file ?? null,
        prompt: db?.prompt ?? getDefaultPrompt(style, country),
        text_colors: db?.text_colors ?? DEFAULT_TEXT_COLORS,
        updated_at: db?.updated_at ?? null,
        from_db: !!db,
      };
    })
  );

  return NextResponse.json({ configs, db_rows: rows?.length ?? 0 });
}

// ── PUT — save (upsert) a single config ──────────────────────────────────────

export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const body = await req.json();
  const { style, country, layout_file, moldura_file, prompt, text_colors } = body;

  if (!style || !country || !layout_file || !prompt) {
    return NextResponse.json({ error: 'Campos obrigatórios: style, country, layout_file, prompt' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const basePayload = {
    style,
    country,
    layout_file,
    moldura_file: moldura_file || null,
    prompt,
    updated_at: new Date().toISOString(),
  };

  const defaultTextColors = { '01': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '02': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '03': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '04': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' } };

  // Try with text_colors first; if column doesn't exist yet, save without it
  let { error } = await supabase
    .from('figurinha_configs')
    .upsert({ ...basePayload, text_colors: text_colors || defaultTextColors }, { onConflict: 'style,country' });

  if (error && (error.message.includes('text_colors') || error.code === 'PGRST204')) {
    console.warn('text_colors column missing, saving without it. Run add_text_colors.sql migration.');
    const fallback = await supabase
      .from('figurinha_configs')
      .upsert(basePayload, { onConflict: 'style,country' });
    error = fallback.error;
  }

  if (error) {
    console.error('Config upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
