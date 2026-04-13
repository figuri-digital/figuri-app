-- Tabela de configurações de figurinhas (layouts, molduras, prompts)
-- Rodar no Supabase SQL Editor: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

CREATE TABLE IF NOT EXISTS figurinha_configs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  style       TEXT        NOT NULL,   -- sozinho | pet | casal
  country     TEXT        NOT NULL,   -- brasil | argentina | ...
  layout_file TEXT        NOT NULL,   -- ex: brasil.jpg
  moldura_file TEXT,                  -- ex: 01-sozinho.png (nullable)
  prompt      TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(style, country)
);

-- RLS: somente service_role tem acesso (a API usa service role key)
ALTER TABLE figurinha_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON figurinha_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
