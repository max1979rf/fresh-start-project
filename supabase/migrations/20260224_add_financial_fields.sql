-- Migration: Add financial fields and create parcelas table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Add financial columns to contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS vigencia_meses        INTEGER;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS modelo_cobranca       TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_implantacao     TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_manutencao_mensal TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS qtd_pagamentos        INTEGER;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_prestacao       TEXT;

-- 2. Create parcelas table
CREATE TABLE IF NOT EXISTS parcelas (
    id TEXT PRIMARY KEY,
    id_contrato TEXT NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    valor TEXT NOT NULL,
    data_vencimento TEXT NOT NULL, -- ISO date string YYYY-MM-DD
    status TEXT NOT NULL DEFAULT 'pendente',
    quitado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

-- 4. Simple RLS policies (adjust as needed)
CREATE POLICY "Enable all for authenticated users" ON parcelas
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Add comments for documentation
COMMENT ON COLUMN contratos.vigencia_meses IS 'Vigência do contrato em meses';
COMMENT ON COLUMN contratos.modelo_cobranca IS 'Modelo de cobrança: "ti" ou "geral"';
COMMENT ON COLUMN contratos.valor_implantacao IS 'Valor de implantação do contrato';
COMMENT ON COLUMN contratos.valor_manutencao_mensal IS 'Valor mensal recorrente (Manutenção)';
COMMENT ON COLUMN contratos.qtd_pagamentos IS 'Quantidade total de parcelas';
COMMENT ON COLUMN contratos.valor_prestacao IS 'Valor de cada prestação individual';
