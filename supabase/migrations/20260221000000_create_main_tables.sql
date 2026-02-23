-- Migration: Create main application tables
-- Migrates all business data from localStorage to Supabase

-- Setores (departments)
CREATE TABLE IF NOT EXISTS public.setores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on setores" ON public.setores FOR ALL USING (true) WITH CHECK (true);

-- Usuarios (users - custom auth, not Supabase auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  id_setor TEXT REFERENCES public.setores(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'setor')),
  status TEXT NOT NULL CHECK (status IN ('ativo', 'inativo')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

-- Contratos (contracts)
CREATE TABLE IF NOT EXISTS public.contratos (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  descricao TEXT NOT NULL,
  empresa TEXT NOT NULL,
  objeto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  id_setor TEXT NOT NULL REFERENCES public.setores(id),
  valor TEXT NOT NULL,
  status TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_vencimento TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  arquivo_pdf TEXT,
  nome_arquivo TEXT,
  excluido BOOLEAN NOT NULL DEFAULT false,
  excluido_por TEXT,
  excluido_em TIMESTAMPTZ
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on contratos" ON public.contratos FOR ALL USING (true) WITH CHECK (true);

-- Logs (audit log)
CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  id_usuario TEXT NOT NULL,
  nome_usuario TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhes TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);

-- Alertas (alerts)
CREATE TABLE IF NOT EXISTS public.alertas (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  id_contrato TEXT,
  numero_contrato TEXT,
  empresa TEXT,
  urgencia TEXT NOT NULL,
  lido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on alertas" ON public.alertas FOR ALL USING (true) WITH CHECK (true);

-- Modelos de contratos (contract templates)
CREATE TABLE IF NOT EXISTS public.modelos_contratos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  conteudo TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ
);

ALTER TABLE public.modelos_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on modelos_contratos" ON public.modelos_contratos FOR ALL USING (true) WITH CHECK (true);

-- Clientes (contracted client companies)
CREATE TABLE IF NOT EXISTS public.clientes (
  id TEXT PRIMARY KEY,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  classificacao TEXT NOT NULL CHECK (classificacao IN ('Matriz', 'Filial', 'Parceiro')),
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  cep TEXT,
  logradouro TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  contato_nome TEXT,
  contato_email TEXT,
  contato_telefone TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- Empresas (contracting organizations)
CREATE TABLE IF NOT EXISTS public.empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL,
  logo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access on empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
