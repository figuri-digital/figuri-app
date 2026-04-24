export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Aceita tanto SUPABASE_SERVICE_ROLE_KEY (maiúsculo padrão) quanto supabase_service_role_key (minúsculo)
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.supabase_service_role_key ||
  supabaseAnonKey;
const FAL_KEY = process.env.FAL_KEY!;

export const maxDuration = 60;

const FAL_FLUX_URL = 'https://queue.fal.run/fal-ai/flux-2-pro/edit';
const NUM_VARIATIONS = 2;

// ── Config cache (5 min TTL) to avoid DB hit on every generation ─────────────
type FieldColors = { name: string; birth: string; height: string };
type ConfigRow = { layout_file: string; moldura_file: string | null; prompt: string; text_colors: Record<string, FieldColors> };
const configCache = new Map<string, { data: ConfigRow; ts: number }>();
const CACHE_TTL = 0; // sem cache — sempre lê do banco para refletir mudanças do admin imediatamente

async function getConfig(style: string, country: string): Promise<ConfigRow | null> {
  const cacheKey = `${style}__${country}`;
  const cached = configCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const supa = createClient(supabaseUrl, supabaseServiceKey);
    const { data } = await supa
      .from('figurinha_configs')
      .select('layout_file, moldura_file, prompt, text_colors')
      .eq('style', style)
      .eq('country', country)
      .single();
    if (data) {
      configCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    }
  } catch { /* fallback to hardcoded */ }
  return null;
}

// Test emails — unlimited credits, flagged as test in dashboard
const TEST_EMAILS = ['guilhermevto@gmail.com', 'karina_dias125@hotmail.com'];

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    const isTestUser = TEST_EMAILS.includes(user.email || '');

    // Check/create credits (skip limit for test users)
    let { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      await supabase.from('usage_credits').insert({
        user_id: user.id,
        credits_used: 0,
        credits_limit: isTestUser ? 99999 : 5,
      });
      credits = { credits_used: 0, credits_limit: isTestUser ? 99999 : 5 };
    }

    if (!isTestUser && credits.credits_used >= credits.credits_limit) {
      return NextResponse.json({
        error: 'Você usou todos os previews gratuitos.',
      }, { status: 403 });
    }

    // Ensure profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('profiles').insert({
        id: user.id,
        name: user.user_metadata?.full_name || user.email || '',
      });
    }

    // Parse form data
    const formData = await req.formData();
    const file  = formData.get('photo')  as File | null;
    const file2 = formData.get('photo2') as File | null; // segunda pessoa (casal)
    const style = (formData.get('style') as string) || 'sozinho';
    const name = (formData.get('name') as string) || '';
    const birth = (formData.get('birth') as string) || '';
    const height = (formData.get('height') as string) || '';
    const country = (formData.get('country') as string) || 'brasil';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }
    if (style === 'familia' && !file2) {
      return NextResponse.json({ error: 'Para o estilo casal envie as duas fotos' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageId = uuidv4();

    // Upload foto principal (pessoa 1 / sozinho / pet)
    const originalPath = `originals/${user.id}/${imageId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(originalPath, buffer, { contentType: file.type || 'image/jpeg' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Erro ao salvar foto' }, { status: 500 });
    }

    const { data: originalUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(originalPath);

    // Upload foto da segunda pessoa (casal)
    let photo2PublicUrl: string | null = null;
    if (style === 'familia' && file2) {
      const bytes2  = await file2.arrayBuffer();
      const buffer2 = Buffer.from(bytes2);
      const path2   = `originals/${user.id}/${imageId}-2.jpg`;
      const { error: uploadError2 } = await supabase.storage
        .from('images')
        .upload(path2, buffer2, { contentType: file2.type || 'image/jpeg' });
      if (uploadError2) {
        console.error('Upload photo2 error:', uploadError2);
        return NextResponse.json({ error: 'Erro ao salvar segunda foto' }, { status: 500 });
      }
      const { data: url2Data } = supabase.storage.from('images').getPublicUrl(path2);
      photo2PublicUrl = url2Data.publicUrl;
    }

    // Get layout URL — try DB config first, fallback to hardcoded
    const host = req.headers.get('host') || 'figuri-app.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const dbConfig = await getConfig(style === 'familia' ? 'casal' : style, country);

    let layoutUrl: string;
    if (dbConfig?.layout_file) {
      // Full URL (Supabase Storage upload) or relative path
      layoutUrl = dbConfig.layout_file.startsWith('http')
        ? dbConfig.layout_file
        : `${protocol}://${host}/assets/layouts/${dbConfig.layout_file}`;
    } else if (style === 'pet') {
      const petFile = PET_LAYOUTS[country] || PET_LAYOUTS.brasil;
      layoutUrl = `${protocol}://${host}/assets/layouts/Pet/${petFile}`;
    } else if (style === 'familia') {
      const casalFile = CASAL_LAYOUTS[country] || CASAL_LAYOUTS.brasil;
      layoutUrl = `${protocol}://${host}/assets/layouts/Casal/${casalFile}`;
    } else {
      const layoutFile = COUNTRY_LAYOUTS[country] || COUNTRY_LAYOUTS.brasil;
      layoutUrl = `${protocol}://${host}/assets/layouts/${layoutFile}`;
    }

    // Build prompt — DB config takes priority over hardcoded
    const prompt = dbConfig?.prompt ?? buildPrompt(style, { name, birth, height, country });

    // Create image record
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('images').insert({
      id: imageId,
      user_id: user.id,
      original_url: originalUrlData.publicUrl,
      generated_url: '',
      watermark_url: '',
      style,
      prompt,
      status: 'processing',
      expires_at: expiresAt,
      cart_status: 'preview',
      is_test: isTestUser,
    });

    // Submit 3 generation tasks to fal.ai Flux 2 Pro in parallel
    console.log(`Submitting ${NUM_VARIATIONS} Flux 2 Pro tasks via fal.ai...`);
    console.log('Country:', country, '| Style:', style, '| Test:', isTestUser);

    // Monta image_urls:
    // - sozinho/pet: [foto_pessoa, layout]
    // - casal:       [foto_pessoa1, foto_pessoa2, layout]
    const imageUrls = style === 'familia' && photo2PublicUrl
      ? [originalUrlData.publicUrl, photo2PublicUrl, layoutUrl]
      : [originalUrlData.publicUrl, layoutUrl];

    const taskPromises = Array.from({ length: NUM_VARIATIONS }, () =>
      fetch(FAL_FLUX_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_urls: imageUrls,
          image_size: 'portrait_4_3',
          output_format: 'jpeg',
          safety_tolerance: '3',
        }),
      })
    );

    const responses = await Promise.all(taskPromises);
    const tasks: { requestId: string; statusUrl: string; responseUrl: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (!res.ok) {
        const errText = await res.text();
        console.error(`fal.ai task ${i + 1} error:`, res.status, errText);
        errors.push(`Task ${i + 1}: ${res.status} - ${errText.slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      console.log(`Task ${i + 1} response:`, JSON.stringify(data).slice(0, 500));
      const requestId = data.request_id;
      if (requestId) {
        tasks.push({
          requestId,
          statusUrl: data.status_url || '',
          responseUrl: data.response_url || '',
        });
        console.log(`Task ${i + 1} queued:`, requestId, '| status_url:', data.status_url);
      } else {
        errors.push(`Task ${i + 1}: sem request_id - ${JSON.stringify(data).slice(0, 200)}`);
      }
    }

    if (tasks.length === 0) {
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      const errorDetail = errors.join(' | ') || 'Sem detalhes';
      console.error('All tasks failed:', errorDetail);
      return NextResponse.json({ error: `Falha na geração: ${errorDetail}` }, { status: 500 });
    }

    console.log(`${tasks.length} tasks queued for imageId ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskIds: tasks.map(t => t.requestId),
      statusUrls: tasks.map(t => t.statusUrl),
      responseUrls: tasks.map(t => t.responseUrl),
      status: 'processing',
      textColors: dbConfig?.text_colors ?? { '01': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '02': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '03': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' }, '04': { name: '#FFFFFF', birth: '#FFFFFF', height: '#FFFFFF' } },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Country layouts (player only, no frame/moldura) ──

const COUNTRY_LAYOUTS: Record<string, string> = {
  brasil: 'brasil.jpg',
  argentina: 'argentina.jpg',
  colombia: 'colombia.jpg',
  uruguai: 'uruguai.jpg',
  franca: 'franca.png',
  alemanha: 'alemanha.png',
  espanha: 'espanha.png',
  portugal: 'portugal.png',
};

const PET_LAYOUTS: Record<string, string> = {
  brasil: 'brasil.png',
  argentina: 'argentina.png',
  colombia: 'colombia.png',
  uruguai: 'uruguai.png',
  franca: 'franca.png',
  alemanha: 'alemanha.png',
  espanha: 'espanha.png',
  portugal: 'portugal.png',
};

const CASAL_LAYOUTS: Record<string, string> = {
  brasil: 'brasil.png',
  argentina: 'argentina.png',
  colombia: 'colombia.png',
  uruguai: 'uruguai.png',
  franca: 'franca.png',
  alemanha: 'alemanha.png',
  espanha: 'espanha.png',
  portugal: 'portugal.png',
};

// ── Prompts ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const SOZINHO_PROMPTS: Record<string, string> = {
  brasil:    'Create a new version of the provided sports poster by replacing only the player, while keeping the entire design exactly the same.\nUse the uploaded image as a strict visual reference and template.\nKEEP EXACTLY THE SAME:\n Green background with layered shapes\n Large white number "2" behind the player\n Color tones and gradients\n Lighting, shadows, and contrast of the composition\n Brazil national team jersey style (yellow with green details)\n Framing and crop (chest-up portrait, centered)\n Overall layout, spacing, and alignment\nREPLACE ONLY:\n The player\'s face and body with the person from the uploaded image\nREQUIREMENTS FOR THE NEW PERSON:\n Same pose (front-facing, centered)\n Same framing (chest up)\n Neutral/confident expression\n Wearing the Brazil national team jersey (yellow with green collar and details)\n Maintain realistic anatomy and proportions\nREALISM AND INTEGRATION:\n Match lighting direction from the original image\n Match skin tones to the scene lighting\n Ensure natural blending between face, neck, and jersey\n Preserve shadows and highlights consistent with the original\n Keep photorealistic quality (no artificial or cartoon look)\nSTRICT RULES:\n Do NOT change background, colors, or layout\n Do NOT modify the number "2"\n Do NOT alter jersey design or colors\n Do NOT add or remove any design elements\n Do NOT change composition or camera angle\nThe final image must look like the same original poster, with only the player replaced seamlessly and realistically.',
  argentina: 'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire blue background with abstract shapes and the large number behind unchanged. Keep the Argentina national team jersey identical (colors, stripes, texture, logo, and details). The new person must be centered, facing forward, with realistic skin tones and natural shadows, seamlessly blended with the original lighting and composition.',
  colombia:  'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire yellow background with abstract shapes and the large number behind completely unchanged. Keep the Colombia national team jersey identical (colors, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  uruguai:   'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and facial expression (slight smile). Preserve the entire light blue background with abstract shapes and the large number behind completely unchanged. Keep the Uruguay national team jersey identical (colors, texture, logo, collar, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  franca:    'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire blue background with abstract shapes and the large number behind completely unchanged. Keep the France national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  alemanha:  'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire gray/black background with abstract shapes and the large number behind completely unchanged. Keep the Germany national team jersey identical (colors, pattern, texture, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  espanha:   'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and friendly smiling expression. Preserve the entire red background with abstract shapes and the large number behind completely unchanged. Keep the Spain national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
  portugal:  'Replace only the person in the image with a different one (new model), keeping exactly the same framing, lighting, position, and neutral facial expression. Preserve the entire red background with abstract shapes and the large number behind completely unchanged. Keep the Portugal national team jersey identical (colors, texture, pattern, logo, and all details). The new person must be centered, facing forward, with a realistic appearance, natural skin tones, and seamless integration with the original lighting and composition.',
};

const PET_PROMPTS: Record<string, string> = {
  brasil:    'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, green background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same yellow Brazil national team jersey with green details. Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Do not change colors, layout, background, or graphic elements — only replace the pet.',
  argentina: 'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Argentina national team jersey (white and light blue stripes with black collar). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Ensure the perspective, scale, and pose match perfectly with the original layout. Do not change colors, layout, background, jersey, or graphic elements — only replace the pet.',
  colombia:  'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, yellow background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Colombia national team jersey (yellow shirt with red and blue details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog fits seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  uruguai:   'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, light blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Uruguay national team jersey (light blue shirt with white collar and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  franca:    'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, blue background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same France national team jersey (dark blue shirt with subtle pattern, white collar, and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog blends seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  alemanha:  'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, gray and black background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Germany national team jersey (white shirt with black, red, and yellow details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  espanha:   'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, red background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Spain national team jersey (red shirt with blue sleeves and yellow details, including the crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
  portugal:  'Replace only the dog in the image with a different dog, keeping exactly the same composition, framing, lighting, red background with abstract shapes, and background typography. The new dog should be in the same position (front-facing, half body), wearing the same Portugal national team jersey (red shirt with green details and crest). Maintain a realistic photographic style, studio-quality lighting, and a friendly expression (mouth open, happy look). Match the original perspective, proportions, and pose precisely so the new dog integrates seamlessly into the design. Do not change colors, layout, background, jersey, or any graphic elements — only replace the pet.',
};

const CASAL_PROMPTS: Record<string, string> = {
  brasil: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Brazil national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge, blend, or average the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and natural pose from the template
• Preserve body proportions, shoulder alignment, and the subtle tilt/angle of each person
• Keep the same crop and overall composition

DESIGN — DO NOT ALTER:
• Brazil national team yellow jerseys with green collar and CBF crest — preserve colors, texture, folds, and badge exactly
• Green background with layered abstract shapes and large white number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon, illustrated, or AI-artifact appearance
• Natural hair rendering and realistic anatomical proportions for both people`,

  argentina: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Argentina national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Argentina national team white jersey with light blue vertical stripes, black collar, and AFA crest — preserve exactly
• Blue background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  colombia: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Colombia national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Colombia national team yellow jersey with red and dark blue trim details and FCF crest — preserve colors, texture, and badge exactly
• Yellow/gold background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  uruguai: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Uruguay national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Uruguay national team sky-blue (celeste) jersey with white collar, subtle trim, and AUF crest — preserve colors, texture, and badge exactly
• Light blue background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  franca: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = France national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• France national team dark navy blue jersey with subtle texture pattern, white collar detail, and FFF rooster crest — preserve colors, texture, and badge exactly
• Deep blue background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  alemanha: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Germany national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Germany national team white jersey with black and red-gold details, three-stripe shoulder accents, and DFB eagle crest — preserve colors, texture, and badge exactly
• Dark gray/charcoal background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  espanha: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Spain national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Spain national team red jersey with dark navy blue sleeve panels, yellow trim details, and RFEF crest — preserve colors, texture, and badge exactly
• Vivid red background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,

  portugal: `Three images are provided:
• [Image 1] = reference photo of PERSON 1 — place on the LEFT side of the final image
• [Image 2] = reference photo of PERSON 2 — place on the RIGHT side of the final image
• [Image 3] = Portugal national team sports card template — use as the immutable base layout

TASK: Replace the couple in the sports card template by inserting Person 1 (left) and Person 2 (right) using their respective reference photos. Keep every design element of the template exactly as it is.

FACE & IDENTITY — CRITICAL PRIORITY:
• Reproduce each person's face with maximum fidelity to their reference photo
• Preserve facial structure, eye shape/color, nose, lips, skin tone, hair color and texture
• Both people must be immediately and unmistakably recognizable compared to [Image 1] and [Image 2]
• Do not merge or blend the two faces — each must remain a distinct individual

POSE & COMPOSITION — DO NOT CHANGE:
• Maintain the exact chest-up framing, side-by-side positioning, and pose from the template
• Keep body proportions, shoulder alignment, and the angle of each person
• Preserve the same crop and composition

DESIGN — DO NOT ALTER:
• Portugal national team deep red jersey with green shoulder trim, white collar details, and FPF crest — preserve colors, texture, and badge exactly
• Deep red background with abstract layered shapes and large number behind the figures
• All typographic elements, decorative shapes, and layout spacing

REALISM & INTEGRATION:
• Match studio lighting direction and soft shadows from the template to both faces
• Seamless blending at the face-neck-jersey boundary for each person
• Consistent skin tone rendering under the scene lighting
• Photorealistic quality — no cartoon or AI-artifact appearance
• Natural hair and realistic anatomical proportions for both people`,
};

function buildPrompt(style: string, data: StickerData): string {
  const country = data.country || 'brasil';
  if (style === 'pet') {
    return PET_PROMPTS[country] || PET_PROMPTS.brasil;
  }
  if (style === 'familia') {
    return CASAL_PROMPTS[country] || CASAL_PROMPTS.brasil;
  }
  return SOZINHO_PROMPTS[country] || SOZINHO_PROMPTS.brasil;
}
