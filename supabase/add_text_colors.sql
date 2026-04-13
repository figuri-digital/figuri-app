-- Migração: text_colors por moldura com cor própria por campo (nome, data, altura)
-- Rodar em: https://supabase.com/dashboard/project/ytzkwhozesiomcvmkgyl/sql

-- Adiciona coluna text_colors (se não existir ainda)
ALTER TABLE figurinha_configs
  ADD COLUMN IF NOT EXISTS text_colors JSONB NOT NULL
  DEFAULT '{"01":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"02":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"03":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"04":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"}}'::jsonb;

-- Atualiza o DEFAULT para o novo formato (caso a coluna já existia com formato antigo)
ALTER TABLE figurinha_configs
  ALTER COLUMN text_colors SET DEFAULT '{"01":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"02":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"03":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"},"04":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"}}'::jsonb;

-- Migra linhas existentes que ainda usam o formato antigo (string por moldura)
-- Ex: {"01":"#FFFFFF"} → {"01":{"name":"#FFFFFF","birth":"#FFFFFF","height":"#FFFFFF"}}
UPDATE figurinha_configs
SET text_colors = (
  SELECT jsonb_object_agg(
    key,
    CASE
      WHEN jsonb_typeof(value) = 'string'
      THEN jsonb_build_object('name', value, 'birth', value, 'height', value)
      ELSE value
    END
  )
  FROM jsonb_each(text_colors)
)
WHERE text_colors IS NOT NULL;

-- Remove coluna antiga text_color (singular) se ainda existir
ALTER TABLE figurinha_configs DROP COLUMN IF EXISTS text_color;
