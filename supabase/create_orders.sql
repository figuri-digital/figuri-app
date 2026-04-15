-- Tabela de pedidos (pagamentos via Mercado Pago PIX)
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

CREATE TABLE IF NOT EXISTS orders (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id      TEXT        NOT NULL UNIQUE,   -- ID do pagamento no Mercado Pago
  user_id         UUID        REFERENCES auth.users(id),
  image_id        TEXT,                           -- ID da imagem gerada pelo fal.ai
  variation_index INTEGER,                        -- índice da variação escolhida
  product_type    TEXT        NOT NULL DEFAULT 'digital',
  amount_cents    INTEGER     NOT NULL,           -- valor em centavos (ex: 1990 = R$19,90)
  status          TEXT        NOT NULL DEFAULT 'pending',  -- pending | paid | refunded
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS orders_user_id_idx      ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_payment_id_idx   ON orders(payment_id);
CREATE INDEX IF NOT EXISTS orders_status_idx       ON orders(status);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- service_role: acesso total (webhook backend usa service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_service_all'
  ) THEN
    CREATE POLICY "orders_service_all" ON orders
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- usuário autenticado: vê apenas seus próprios pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_user_select'
  ) THEN
    CREATE POLICY "orders_user_select" ON orders
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;
