import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY!;
export const maxDuration = 60;

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

    // Check/create credits
    let { data: credits } = await supabase
      .from('usage_credits')
      .select('credits_used, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!credits) {
      await supabase.from('usage_credits').insert({
        user_id: user.id,
        credits_used: 0,
        credits_limit: 5,
      });
      credits = { credits_used: 0, credits_limit: 5 };
    }

    if (credits.credits_used >= credits.credits_limit) {
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
    const file = formData.get('photo') as File | null;
    const style = (formData.get('style') as string) || 'sozinho';
    const name = (formData.get('name') as string) || '';
    const birth = (formData.get('birth') as string) || '';
    const height = (formData.get('height') as string) || '';
    const country = (formData.get('country') as string) || 'brasil';

    if (!file) {
      return NextResponse.json({ error: 'Envie uma foto' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageId = uuidv4();

    // Upload original to Supabase Storage
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

    // Build prompt with country-specific template
    const prompt = buildPrompt(style, { name, birth, height, country });

    // Get the template image as base64 for structure_reference
    const templateBase64 = await getTemplateBase64(country, req);

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
    });

    // Call Freepik Mystic API (async — returns task_id)
    console.log('Calling Freepik Mystic API...');
    console.log('Country:', country, '| Style:', style);

    // Build request body per Freepik Mystic docs
    const freepikBody: Record<string, unknown> = {
      prompt,
      resolution: '2k',
      aspect_ratio: 'traditional_3_4',
      model: 'realism',
      creative_detailing: 50,
      structure_strength: 80,
    };

    // Add structure reference (country template as base64)
    if (templateBase64) {
      freepikBody.structure_reference = templateBase64;
    }

    // Add user photo as style reference (closest to face reference in Mystic)
    const userPhotoBase64 = buffer.toString('base64');
    freepikBody.style_reference = userPhotoBase64;
    freepikBody.adherence = 30; // Low adherence = more prompt, less style copy

    const freepikRes = await fetch('https://api.freepik.com/v1/ai/mystic', {
      method: 'POST',
      headers: {
        'x-freepik-api-key': FREEPIK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(freepikBody),
    });

    if (!freepikRes.ok) {
      const errText = await freepikRes.text();
      console.error('Freepik Mystic error:', freepikRes.status, errText);
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ error: `Freepik API error ${freepikRes.status}: ${errText}` }, { status: 500 });
    }

    const freepikData = await freepikRes.json();
    console.log('Freepik Mystic response:', JSON.stringify(freepikData).slice(0, 500));

    // Extract task_id from response
    const taskId = freepikData.data?.task_id || freepikData.task_id || freepikData.data?.id;

    if (!taskId) {
      // If Mystic returns the image directly (synchronous response)
      const generated = freepikData.data?.generated || freepikData.data?.images;
      if (generated?.length) {
        const genUrl = typeof generated[0] === 'string' ? generated[0] : generated[0].url || generated[0].base64;

        if (genUrl) {
          // Download, watermark, save
          const { applyWatermark } = await import('@/lib/watermark');
          const genRes = await fetch(genUrl);
          const genBuffer = Buffer.from(await genRes.arrayBuffer());

          const hiresPath = `generated/${user.id}/${imageId}.jpg`;
          await supabase.storage.from('images').upload(hiresPath, genBuffer, { contentType: 'image/jpeg' });
          const { data: hiresUrlData } = supabase.storage.from('images').getPublicUrl(hiresPath);

          const watermarkedBuffer = await applyWatermark(genBuffer);
          const previewPath = `previews/${user.id}/${imageId}.jpg`;
          await supabase.storage.from('images').upload(previewPath, watermarkedBuffer, { contentType: 'image/jpeg' });
          const { data: previewUrlData } = supabase.storage.from('images').getPublicUrl(previewPath);

          await supabase.from('images').update({
            generated_url: hiresUrlData.publicUrl,
            watermark_url: previewUrlData.publicUrl,
            status: 'completed',
          }).eq('id', imageId);

          const newCreditsUsed = (credits.credits_used || 0) + 1;
          await supabase.from('usage_credits').update({ credits_used: newCreditsUsed }).eq('user_id', user.id);

          return NextResponse.json({
            success: true,
            imageId,
            userId: user.id,
            taskId: 'sync',
            previewUrl: previewUrlData.publicUrl,
            status: 'completed',
            creditsUsed: newCreditsUsed,
            creditsLimit: credits.credits_limit || 5,
          });
        }
      }

      console.error('No taskId in Freepik response:', JSON.stringify(freepikData).slice(0, 500));
      await supabase.from('images').update({ status: 'failed' }).eq('id', imageId);
      return NextResponse.json({ error: 'Erro na API Freepik — sem task_id' }, { status: 500 });
    }

    console.log('Freepik task started:', taskId);

    return NextResponse.json({
      success: true,
      imageId,
      userId: user.id,
      taskId,
      status: 'processing',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Generate error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Template Base64 ──

async function getTemplateBase64(country: string, req: NextRequest): Promise<string | null> {
  try {
    const host = req.headers.get('host') || 'figuri-app.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const countryFile: Record<string, string> = {
      brasil: 'brasil.jpg',
      argentina: 'argentina.jpg',
      franca: 'franca.jpg',
      alemanha: 'alemanha.jpg',
      espanha: 'espanha.jpg',
      portugal: 'portugal.jpg',
      uruguai: 'uruguai.jpg',
      colombia: 'colombia.jpg',
    };

    const file = countryFile[country] || countryFile.brasil;
    const url = `${baseUrl}/templates/${file}`;

    console.log('Fetching template from:', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Failed to fetch template:', res.status);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    console.log('Template base64 length:', base64.length);
    return base64;
  } catch (err) {
    console.error('Error loading template:', err);
    return null;
  }
}

// ── Prompts por país ──

interface StickerData {
  name?: string;
  birth?: string;
  height?: string;
  country?: string;
}

const COUNTRY_PROMPTS: Record<string, (data: StickerData) => string> = {
  brasil: (d) => `Create a high-quality sports poster identical in layout and style to the reference image provided.
Keep ALL design elements exactly the same, including:
Green background with layered shapes
FIFA World Cup trophy icon on the left
Brazil 2026 badge on the top right
Large white number "2" in the background
Clean, modern, minimal sports card layout
Typography style, spacing, and alignment
Replace ONLY the following elements:
The central player photo: use the uploaded image of a different person, cropped from chest up, centered, wearing a Brazil national team jersey (yellow shirt with green details)
Player name: replace "NEYMAR JR" with "${d.name || 'JOGADOR'}"
Height: replace "M 1,75" with "M ${d.height || '1,75'}"
Date of birth: replace "5-2-1992" with "${d.birth || '1-1-2000'}"
Keep lighting, shadows, and color grading consistent with the original image. The final result must look like an official FIFA-style player card, realistic and professionally designed.
Ensure the face blends naturally with the jersey and background, maintaining photorealism.`,

  argentina: (d) => `Create a high-quality football player card identical in layout, composition, and style to the reference image provided.Keep ALL visual elements exactly the same, including:
* Light blue (Argentina-themed) background with geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Argentina badge with flag and "ARG 2026" on the top right
* Bottom rounded white panel
* Green stylized "26" on the bottom right
* Clean, modern, minimal sports card design
* Same typography, font weight, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing an Argentina national team jersey (white and sky blue stripes, realistic fabric and lighting)
* Player name: replace "LIONEL MESSI" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,70" with "M ${d.height || '1,75'}"
* Date of birth: replace "24-6-1987" with "${d.birth || '1-1-2000'}"
Maintain consistent lighting, shadows, and color grading so the new face blends naturally with the body and background. Ensure photorealism and professional sports branding quality.The final image must look like an official FIFA-style player card, with no layout changes.`,

  franca: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Blue background with layered geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* France badge with flag and "FRA 2026" on the top right
* Bottom rounded white panel
* Green stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a France national team jersey (dark blue shirt with subtle texture and details, realistic lighting and shadows)
* Player name: replace "KYLIAN MBAPPÉ" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,78" with "M ${d.height || '1,75'}"
* Date of birth: replace "20-12-1998" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final result must look like an official FIFA-style player card, photorealistic, with no changes to layout, proportions, or design elements.`,

  alemanha: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Grey background with layered geometric shapes and a dark top-right corner
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Germany badge with flag and "GER 2026" on the top right
* Bottom rounded white panel
* Green stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a Germany national team jersey (white shirt with black, red, and yellow gradient shoulder details, realistic texture and lighting)
* Player name: replace "JAMAL MUSIALA" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,83" with "M ${d.height || '1,75'}"
* Date of birth: replace "26-02-2003" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final result must look like an official FIFA-style player card, photorealistic, with no changes to layout, proportions, or design elements.`,

  espanha: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Red background with layered geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Spain badge with flag and "ESP 2026" on the top right
* Bottom rounded white panel
* Green stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a Spain national team jersey (red shirt with subtle vertical details and yellow accents, realistic texture and lighting)
* Player name: replace "LAMINE YAMAL" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,81" with "M ${d.height || '1,75'}"
* Date of birth: replace "13-7-2007" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final result must look like an official FIFA-style player card, photorealistic, with no changes to layout, proportions, or design elements.`,

  portugal: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Red background with layered geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Portugal badge with flag and "POR 2026" on the top right
* Bottom rounded white panel
* Green stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a Portugal national team jersey (red shirt with green details, realistic texture and lighting)
* Player name: replace "CRISTIANO RONALDO" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,87" with "M ${d.height || '1,75'}"
* Date of birth: replace "5-2-1985" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final result must look like an official FIFA-style player card, photorealistic, with no changes to layout, proportions, or design elements.`,

  uruguai: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Light blue background with layered geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Uruguay badge with flag and "URU 2026" on the top right
* Bottom rounded white panel
* Orange stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a Uruguay national team jersey (light blue shirt, subtle texture, realistic lighting and shadows)
* Player name: replace "GIORGIAN DE ARRASCAETA" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,72" with "M ${d.height || '1,75'}"
* Date of birth: replace "1-6-1994" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final image must look like an official FIFA-style player card, photorealistic, with no changes to layout, proportions, or design elements.`,

  colombia: (d) => `Create a high-quality football player card identical in layout, composition, and design to the reference image provided.Keep ALL visual elements exactly the same, including:
* Yellow/gold background with layered geometric shapes
* Large white number "2" behind the player
* FIFA World Cup trophy icon on the left with "FIFA" text
* Colombia badge with flag and "COL 2026" on the top right
* Bottom rounded white panel
* Orange stylized "26" on the bottom right
* Clean, modern, minimal sports card layout
* Same typography, font style, sizes, spacing, and alignment
Replace ONLY the following elements:
* The central portrait: use the uploaded photo of a different person, cropped from chest up, centered, facing forward
* The person must be wearing a Colombia national team jersey (yellow shirt with subtle patterns and blue/red details, realistic texture and lighting)
* Player name: replace "JAMES RODRÍGUEZ" with "${d.name || 'JOGADOR'}"
* Height: replace "M 1,80" with "M ${d.height || '1,75'}"
* Date of birth: replace "12-7-1991" with "${d.birth || '1-1-2000'}"
Maintain identical lighting, shadows, and color grading so the new face blends naturally with the body and background.The final result must look like an official FIFA-style player card, photorealistic, with no changes to layout or design elements.`,
};

function buildPrompt(style: string, data: StickerData): string {
  const country = data.country || 'brasil';

  if (style === 'sozinho') {
    const promptFn = COUNTRY_PROMPTS[country] || COUNTRY_PROMPTS.brasil;
    return promptFn(data);
  }

  if (style === 'pet') {
    return `Create a high-quality football player card identical in layout and style to the reference image provided. Keep ALL design elements exactly the same. Replace ONLY the central portrait: use the uploaded image of an animal/pet, dressed as a team mascot wearing the national team jersey, cropped from chest up, centered. Pet name: "${data.name || 'MASCOTE'}", Height: "M ${data.height || '0,50'}", Date: "${data.birth || '1-1-2020'}". Maintain photorealism and professional sports branding quality.`;
  }

  if (style === 'grupo') {
    return `Create a high-quality football player card identical in layout and style to the reference image provided. Keep ALL design elements exactly the same. Replace ONLY the central portrait: use the uploaded group photo, all wearing the national team jersey, cropped and centered. Group name: "${data.name || 'FAMÍLIA'}", Info: "M ${data.height || '---'}", Date: "${data.birth || '---'}". Maintain photorealism and professional sports branding quality.`;
  }

  const promptFn = COUNTRY_PROMPTS[country] || COUNTRY_PROMPTS.brasil;
  return promptFn(data);
}
