-- Migration: Create configuracoes table with individual typed columns
-- Replaces the opaque JSONB blob in app_config with a proper relational structure.
-- Each setting field gets its own column for type safety, indexability and clarity.

CREATE TABLE IF NOT EXISTS public.configuracoes (
  id TEXT PRIMARY KEY DEFAULT 'default',

  -- ── Identidade Visual ─────────────────────────────────────────────────────
  nome_empresa          TEXT,
  logo_base64           TEXT,        -- base64 data URI (PNG/JPG/SVG ≤ 6 MB)
  logo_nome             TEXT,

  -- ── Integração LLM ────────────────────────────────────────────────────────
  llm_provider          TEXT,        -- 'openai' | 'anthropic' | 'google' | …
  llm_api_key           TEXT,        -- provider API key (sensitive)
  llm_model             TEXT,        -- model identifier
  llm_base_url          TEXT,        -- custom endpoint override
  llm_status            TEXT         DEFAULT 'disconnected',
  llm_custom_prompt     TEXT,
  llm_knowledge_base    TEXT,
  llm_tone              TEXT         DEFAULT 'formal',
  llm_specialization    TEXT         DEFAULT 'Geral',
  llm_examples          JSONB        DEFAULT '[]'::jsonb,
  llm_temperature       NUMERIC(5,3) DEFAULT 0.700,
  llm_top_p             NUMERIC(5,3) DEFAULT 1.000,
  llm_frequency_penalty NUMERIC(5,3) DEFAULT 0.000,
  llm_presence_penalty  NUMERIC(5,3) DEFAULT 0.000,

  -- ── Webhooks ──────────────────────────────────────────────────────────────
  webhook_gptmaker      TEXT,
  webhook_n8n           TEXT,

  -- ── Alertas ───────────────────────────────────────────────────────────────
  alerta_email_ativo    BOOLEAN      DEFAULT false,
  alertas_ativos        BOOLEAN      DEFAULT true,
  emails_alerta_setor   JSONB        DEFAULT '{}'::jsonb,   -- { [setorId]: email }

  -- ── API Aberta ────────────────────────────────────────────────────────────
  api_key               TEXT,
  empresa_id            TEXT,
  api_key_created_at    TIMESTAMPTZ,

  -- ── Metadata ──────────────────────────────────────────────────────────────
  updated_at            TIMESTAMPTZ  DEFAULT now()
);

-- Row-Level Security (permissive for custom-auth app; tighten when migrating to Supabase Auth)
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on configuracoes"
  ON public.configuracoes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure the singleton default row always exists
INSERT INTO public.configuracoes (id)
  VALUES ('default')
  ON CONFLICT (id) DO NOTHING;
