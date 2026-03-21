export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';
const COST_PER_GENERATION_USD = 0.05;
const PRICE_PER_STICKER_BRL = 19.90;
const USD_TO_BRL = 5.80;
const TEST_EMAILS = ['guilhermevto@gmail.com', 'karina_dias125@hotmail.com'];

export async function GET(req: NextRequest) {
  // Auth check
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Identify test user IDs by matching profiles with test emails
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, name');

    const testUserIds = new Set<string>();
    (allProfiles || []).forEach(p => {
      if (TEST_EMAILS.some(e => (p.name || '').toLowerCase().includes(e.split('@')[0]))) {
        testUserIds.add(p.id);
      }
    });

    // Also check images with is_test flag
    const { data: testImages } = await supabase
      .from('images')
      .select('user_id')
      .eq('is_test', true);
    (testImages || []).forEach(i => testUserIds.add(i.user_id));

    // Users (exclude test)
    const totalUsers = (allProfiles || []).filter(p => !testUserIds.has(p.id)).length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // All images
    const { data: allImages } = await supabase
      .from('images')
      .select('id, user_id, status, country, style, cart_status, created_at, is_test')
      .order('created_at', { ascending: false });

    const allImagesArr = allImages || [];

    // Separate real vs test
    const images = allImagesArr.filter(i => !i.is_test && !testUserIds.has(i.user_id));
    const testImagesCount = allImagesArr.length - images.length;

    // Image stats (real users only)
    const totalGenerated = images.length;
    const completed = images.filter(i => i.status === 'completed').length;
    const failed = images.filter(i => i.status === 'failed').length;
    const processing = images.filter(i => i.status === 'processing').length;

    const todayImages = images.filter(i => new Date(i.created_at) >= todayStart).length;
    const weekImages = images.filter(i => new Date(i.created_at) >= weekStart).length;

    // Purchased (cart_status = 'paid')
    const purchased = images.filter(i => i.cart_status === 'paid').length;

    // By country
    const byCountry: Record<string, number> = {};
    images.forEach(i => {
      const c = i.country || 'desconhecido';
      byCountry[c] = (byCountry[c] || 0) + 1;
    });

    // By style
    const byStyle: Record<string, number> = {};
    images.forEach(i => {
      const s = i.style || 'sozinho';
      byStyle[s] = (byStyle[s] || 0) + 1;
    });

    // Unique users who generated
    const uniqueGenerators = new Set(images.map(i => i.user_id)).size;

    // Top users (by generation count)
    const userCounts: Record<string, number> = {};
    images.forEach(i => {
      userCounts[i.user_id] = (userCounts[i.user_id] || 0) + 1;
    });
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Get profiles for top users
    const topUserIds = topUsers.map(u => u.userId);
    const { data: topProfiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', topUserIds);

    const profileMap: Record<string, string> = {};
    (topProfiles || []).forEach(p => {
      profileMap[p.id] = p.name || p.id.slice(0, 8);
    });

    const topUsersWithNames = topUsers.map(u => ({
      ...u,
      name: profileMap[u.userId] || u.userId.slice(0, 8),
    }));

    // Credits usage
    const { data: credits } = await supabase
      .from('usage_credits')
      .select('user_id, credits_used, credits_limit');

    const totalCreditsUsed = (credits || []).reduce((sum, c) => sum + (c.credits_used || 0), 0);
    const totalCreditsLimit = (credits || []).reduce((sum, c) => sum + (c.credits_limit || 0), 0);

    // Financials (cost includes ALL generations — real + test — because fal.ai charges for all)
    const totalCompletedAll = allImagesArr.filter(i => i.status === 'completed').length;
    const costUSD = totalCompletedAll * COST_PER_GENERATION_USD;
    const costBRL = costUSD * USD_TO_BRL;
    const revenueBRL = purchased * PRICE_PER_STICKER_BRL;
    const profitBRL = revenueBRL - costBRL;
    const marginPercent = revenueBRL > 0 ? ((profitBRL / revenueBRL) * 100).toFixed(1) : '0';
    const conversionRate = totalGenerated > 0 ? ((purchased / totalGenerated) * 100).toFixed(1) : '0';

    // Daily generation chart (last 14 days)
    const dailyStats: { date: string; count: number }[] = [];
    for (let d = 13; d >= 0; d--) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      const dayStr = day.toISOString().slice(0, 10);
      const count = images.filter(i => i.created_at?.slice(0, 10) === dayStr).length;
      dailyStats.push({ date: dayStr, count });
    }

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        activeGenerators: uniqueGenerators,
      },
      generations: {
        total: totalGenerated,
        today: todayImages,
        week: weekImages,
        completed,
        failed,
        processing,
        byCountry,
        byStyle,
      },
      sales: {
        purchased,
        conversionRate: `${conversionRate}%`,
      },
      financial: {
        costPerGenUSD: COST_PER_GENERATION_USD,
        totalCostUSD: Math.round(costUSD * 100) / 100,
        totalCostBRL: Math.round(costBRL * 100) / 100,
        revenueBRL: Math.round(revenueBRL * 100) / 100,
        profitBRL: Math.round(profitBRL * 100) / 100,
        marginPercent: `${marginPercent}%`,
        usdToBrl: USD_TO_BRL,
      },
      credits: {
        totalUsed: totalCreditsUsed,
        totalLimit: totalCreditsLimit,
      },
      topUsers: topUsersWithNames,
      dailyStats,
      test: {
        testUserIds: Array.from(testUserIds),
        testGenerations: testImagesCount,
        testCostUSD: Math.round(testImagesCount * COST_PER_GENERATION_USD * 100) / 100,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('Admin stats error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
