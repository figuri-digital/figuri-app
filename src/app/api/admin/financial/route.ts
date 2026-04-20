export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_KEY        = process.env.ADMIN_SECRET_KEY || 'figuri-admin-2026';

interface OrderRow {
  amount_cents:   number;
  status:         string;
  product_type:   string;
  coupon_code:    string | null;
  discount_cents: number | null;
  paid_at:        string | null;
  created_at:     string;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const period = req.nextUrl.searchParams.get('period') || '30'; // dias

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Busca todos os pedidos pagos
  const { data: allPaid, error: err1 } = await supabase
    .from('orders')
    .select('amount_cents, status, product_type, coupon_code, discount_cents, paid_at, created_at')
    .eq('status', 'paid')
    .order('paid_at', { ascending: true });

  if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });

  // Também busca pendentes para funil
  const { data: allPending } = await supabase
    .from('orders')
    .select('amount_cents, status, product_type, coupon_code, discount_cents, paid_at, created_at')
    .eq('status', 'pending');

  const paid    = (allPaid    || []) as OrderRow[];
  const pending = (allPending || []) as OrderRow[];

  const periodDays = parseInt(period, 10);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const paidInPeriod = paid.filter(o => {
    const d = o.paid_at || o.created_at;
    return d && new Date(d) >= since;
  });

  // ── Totais gerais ───────────────────────────────────────────────────────
  const totalRevenue     = paid.reduce((s, o) => s + (o.amount_cents || 0), 0);
  const totalDiscount    = paid.reduce((s, o) => s + (o.discount_cents || 0), 0);
  const totalOrders      = paid.length;
  const ticketMedio      = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const periodRevenue    = paidInPeriod.reduce((s, o) => s + (o.amount_cents || 0), 0);
  const periodOrders     = paidInPeriod.length;
  const periodTicket     = periodOrders > 0 ? Math.round(periodRevenue / periodOrders) : 0;

  // ── Receita por dia (período selecionado) ────────────────────────────────
  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let d = periodDays - 1; d >= 0; d--) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    dailyMap[day.toISOString().slice(0, 10)] = { revenue: 0, orders: 0 };
  }
  paidInPeriod.forEach(o => {
    const dayStr = (o.paid_at || o.created_at).slice(0, 10);
    if (dailyMap[dayStr]) {
      dailyMap[dayStr].revenue += o.amount_cents || 0;
      dailyMap[dayStr].orders  += 1;
    }
  });
  const dailyStats = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

  // ── Receita por mês (últimos 6 meses) ────────────────────────────────────
  const monthlyMap: Record<string, { revenue: number; orders: number }> = {};
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    monthlyMap[d.toISOString().slice(0, 7)] = { revenue: 0, orders: 0 };
  }
  paid.forEach(o => {
    const monthStr = (o.paid_at || o.created_at).slice(0, 7);
    if (monthlyMap[monthStr]) {
      monthlyMap[monthStr].revenue += o.amount_cents || 0;
      monthlyMap[monthStr].orders  += 1;
    }
  });
  const monthlyStats = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

  // ── Receita por tipo de produto ──────────────────────────────────────────
  const byProduct: Record<string, { revenue: number; orders: number }> = {};
  paid.forEach(o => {
    const types = (o.product_type || 'digital').split(',');
    types.forEach(t => {
      const pt = t.trim() || 'digital';
      if (!byProduct[pt]) byProduct[pt] = { revenue: 0, orders: 0 };
      // Distribui valor igualmente entre tipos se for múltiplo
      byProduct[pt].revenue += Math.round((o.amount_cents || 0) / types.length);
      byProduct[pt].orders  += 1;
    });
  });

  // ── Top cupons usados ────────────────────────────────────────────────────
  const couponMap: Record<string, { count: number; discount_total: number }> = {};
  paid.forEach(o => {
    if (o.coupon_code) {
      if (!couponMap[o.coupon_code]) couponMap[o.coupon_code] = { count: 0, discount_total: 0 };
      couponMap[o.coupon_code].count       += 1;
      couponMap[o.coupon_code].discount_total += (o.discount_cents || 0);
    }
  });
  const topCoupons = Object.entries(couponMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([code, v]) => ({ code, ...v }));

  // ── Funil pendente vs pago ───────────────────────────────────────────────
  const pendingRevenue = pending.reduce((s, o) => s + (o.amount_cents || 0), 0);

  return NextResponse.json({
    summary: {
      totalRevenue,
      totalOrders,
      ticketMedio,
      totalDiscount,
      pendingOrders:   pending.length,
      pendingRevenue,
    },
    period: {
      days:    periodDays,
      revenue: periodRevenue,
      orders:  periodOrders,
      ticket:  periodTicket,
    },
    dailyStats,
    monthlyStats,
    byProduct,
    topCoupons,
  });
}
