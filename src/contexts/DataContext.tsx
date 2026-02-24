import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Setor, User, Contrato, LogEntry, Alerta, AppConfig, ModeloContrato, Cliente, Empresa, Parcela, ModeloCobranca } from '../types';

import { supabase } from '@/integrations/supabase/client';
import { saveConfiguracoes, loadConfiguracoes } from '@/services/configService';
import { brToIso } from '@/utils/dateUtils';

// --- Simple hash for passwords (sync, deterministic) ---
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

// --- Seed data ---
const SEED_SETORES: Setor[] = [
    { id: 's1', nome: 'Tecnologia da Informação' },
    { id: 's2', nome: 'Logística' },
    { id: 's3', nome: 'Infraestrutura' },
    { id: 's4', nome: 'Nutrição' },
    { id: 's5', nome: 'Saúde' },
    { id: 's6', nome: 'Segurança' },
    { id: 's7', nome: 'Administrativo' },
    { id: 's8', nome: 'Recursos Humanos' },
    { id: 's9', nome: 'Jurídico' },
];

const SEED_USERS: User[] = [
    { id: 'u0', nome: 'Administrador', login: 'admin', senhaHash: simpleHash('admin123'), idSetor: null, role: 'admin', status: 'ativo', criadoEm: '2026-01-01T00:00:00' },
    { id: 'u1', nome: 'Carlos Silva', login: 'carlos', senhaHash: simpleHash('123456'), idSetor: 's1', role: 'setor', status: 'ativo', criadoEm: '2026-01-15T00:00:00' },
    { id: 'u2', nome: 'Maria Santos', login: 'maria', senhaHash: simpleHash('123456'), idSetor: 's2', role: 'setor', status: 'ativo', criadoEm: '2026-01-15T00:00:00' },
    { id: 'u3', nome: 'Pedro Lima', login: 'pedro', senhaHash: simpleHash('123456'), idSetor: 's6', role: 'setor', status: 'inativo', criadoEm: '2026-01-20T00:00:00' },
];

const SEED_CLIENTES: Cliente[] = [
    { id: 'cl1', nomeFantasia: 'TecSistemas', razaoSocial: 'TecSistemas Informática Ltda', cnpj: '12.345.678/0001-90', classificacao: 'Matriz', cidade: 'João Pessoa - PB', contatoNome: 'Carlos Silva', contatoEmail: 'carlos@tecsistemas.com', contatoTelefone: '(83) 3333-4444', criadoEm: '2026-01-01T00:00:00' },
    { id: 'cl2', nomeFantasia: 'MedClean', razaoSocial: 'MedClean Produtos Hospitalares S.A.', cnpj: '98.765.432/0001-10', classificacao: 'Matriz', cidade: 'Recife - PE', contatoNome: 'Maria Santos', contatoEmail: 'maria@medclean.com', contatoTelefone: '(81) 2222-3333', criadoEm: '2026-01-01T00:00:00' },
    { id: 'cl3', nomeFantasia: 'Construtora Norte', razaoSocial: 'Construtora Norte Engenharia Ltda', cnpj: '11.222.333/0001-44', classificacao: 'Filial', cidade: 'Campina Grande - PB', contatoNome: 'João Oliveira', contatoEmail: 'joao@construtoranorte.com', contatoTelefone: '(83) 9999-8888', criadoEm: '2026-01-01T00:00:00' },
    { id: 'cl4', nomeFantasia: 'Alimentos Brasil', razaoSocial: 'Alimentos Brasil Distribuidora', cnpj: '55.666.777/0001-88', classificacao: 'Parceiro', cidade: 'Natal - RN', contatoNome: 'Ana Souza', contatoEmail: 'ana@alimentosbrasil.com', contatoTelefone: '(84) 7777-6666', criadoEm: '2026-01-01T00:00:00' },
    { id: 'cl5', nomeFantasia: 'Seg Total', razaoSocial: 'Seg Total Segurança Patrimonial Ltda', cnpj: '33.444.555/0001-22', classificacao: 'Matriz', cidade: 'João Pessoa - PB', contatoNome: 'Pedro Lima', contatoEmail: 'pedro@segtotal.com', contatoTelefone: '(83) 5555-1111', criadoEm: '2026-01-01T00:00:00' },
];

const SEED_EMPRESAS: Empresa[] = [
    { id: 'em1', nome: 'Fundação Assistencial da Paraíba', sigla: 'FAP', criadoEm: '2026-01-01T00:00:00' },
    { id: 'em2', nome: 'Hospital Regional de Campina Grande', sigla: 'HRCG', criadoEm: '2026-01-01T00:00:00' },
    { id: 'em3', nome: 'Centro de Saúde Integrada', sigla: 'CSI', criadoEm: '2026-01-01T00:00:00' },
];

const SEED_CONTRATOS: Contrato[] = [
    { id: 'c1', numero: 'FAP-2026-0247', descricao: 'Manutenção de equipamentos de TI', empresa: 'TecSistemas Ltda', objeto: 'Manutenção de equipamentos de TI', tipo: 'Serviços de TI', idSetor: 's1', valor: 'R$ 48.000,00', status: 'Vigente', dataInicio: '14/02/2026', dataVencimento: '14/08/2026', criadoPor: 'u0', criadoEm: '2026-02-14T00:00:00', vigenciaMeses: 6, modeloCobranca: 'ti' },
    { id: 'c2', numero: 'FAP-2026-0246', descricao: 'Fornecimento de materiais de limpeza hospitalar', empresa: 'MedClean S.A.', objeto: 'Fornecimento de materiais de limpeza hospitalar', tipo: 'Manutenção', idSetor: 's2', valor: 'R$ 120.000,00', status: 'Vigente', dataInicio: '01/01/2026', dataVencimento: '02/05/2026', criadoPor: 'u0', criadoEm: '2026-01-01T00:00:00', vigenciaMeses: 4 },
    { id: 'c3', numero: 'FAP-2026-0245', descricao: 'Reforma do bloco B', empresa: 'Construtora Norte', objeto: 'Reforma do bloco B', tipo: 'Obra', idSetor: 's3', valor: 'R$ 350.000,00', status: 'Vencendo', dataInicio: '01/06/2025', dataVencimento: '28/02/2026', criadoPor: 'u0', criadoEm: '2025-06-01T00:00:00', vigenciaMeses: 9 },
    { id: 'c4', numero: 'FAP-2026-0244', descricao: 'Fornecimento de alimentação', empresa: 'Alimentos Brasil', objeto: 'Fornecimento de alimentação', tipo: 'Outros', idSetor: 's4', valor: 'R$ 200.000,00', status: 'Vigente', dataInicio: '01/03/2026', dataVencimento: '10/11/2026', criadoPor: 'u0', criadoEm: '2026-03-01T00:00:00', vigenciaMeses: 8 },
    { id: 'c5', numero: 'FAP-2025-0243A', descricao: 'Vigilância patrimonial', empresa: 'Seg Total Ltda', objeto: 'Vigilância patrimonial', tipo: 'Infraestrutura', idSetor: 's6', valor: 'R$ 96.000,00', status: 'Vencido', dataInicio: '01/01/2025', dataVencimento: '01/01/2026', criadoPor: 'u0', criadoEm: '2025-01-01T00:00:00', vigenciaMeses: 12 },
    { id: 'c6', numero: 'FAP-2025-0242', descricao: 'Exames laboratoriais', empresa: 'Lab Análises Clínicas', objeto: 'Exames laboratoriais', tipo: 'Outros', idSetor: 's5', valor: 'R$ 75.000,00', status: 'Encerrado', dataInicio: '01/04/2025', dataVencimento: '01/10/2025', criadoPor: 'u0', criadoEm: '2025-04-01T00:00:00', vigenciaMeses: 6 },
];

const DEFAULT_CONFIG: AppConfig = {};

// --- DB row mappers (snake_case DB <-> camelCase TS) ---
function mapSetorFromDB(row: { id: string; nome: string }): Setor {
    return { id: row.id, nome: row.nome };
}

function mapUsuarioFromDB(row: {
    id: string; nome: string; login: string; senha_hash: string;
    id_setor: string | null; role: string; status: string; criado_em: string;
}): User {
    return {
        id: row.id,
        nome: row.nome,
        login: row.login,
        senhaHash: row.senha_hash,
        idSetor: row.id_setor,
        role: row.role as 'admin' | 'setor',
        status: row.status as 'ativo' | 'inativo',
        criadoEm: row.criado_em,
    };
}

function mapContratoFromDB(row: Record<string, unknown>): Contrato {
    return {
        id: row.id as string,
        numero: row.numero as string,
        descricao: row.descricao as string,
        empresa: row.empresa as string,
        objeto: row.objeto as string,
        tipo: row.tipo as string,
        idSetor: row.id_setor as string,
        valor: row.valor as string,
        status: row.status as Contrato['status'],
        dataInicio: row.data_inicio as string,
        dataVencimento: row.data_vencimento as string,
        criadoPor: row.criado_por as string,
        criadoEm: row.criado_em as string,
        arquivoPdf: (row.arquivo_pdf as string) ?? undefined,
        nomeArquivo: (row.nome_arquivo as string) ?? undefined,
        excluido: row.excluido as boolean,
        excluidoPor: (row.excluido_por as string) ?? undefined,
        excluidoEm: (row.excluido_em as string) ?? undefined,
        // Financial fields
        vigenciaMeses: row.vigencia_meses != null ? Number(row.vigencia_meses) : undefined,
        modeloCobranca: row.modelo_cobranca as ModeloCobranca | undefined,
        valorImplantacao: (row.valor_implantacao as string) ?? undefined,
        valorManutencaoMensal: (row.valor_manutencao_mensal as string) ?? undefined,
        qtdPagamentos: row.qtd_pagamentos != null ? Number(row.qtd_pagamentos) : undefined,
        valorPrestacao: (row.valor_prestacao as string) ?? undefined,
        multaPercentual: undefined, // not in DB schema
        // Fields not in DB but used locally
        saldoContrato: (row.saldo_contrato as string) ?? undefined,
        qtdMedicoes: row.qtd_medicoes != null ? Number(row.qtd_medicoes) : undefined,
        medicaoAtual: row.medicao_atual != null ? Number(row.medicao_atual) : undefined,
        valorMedicao: (row.valor_medicao as string) ?? undefined,
    };
}


function mapParcelaFromDB(row: Record<string, unknown>): Parcela {
    return {
        id: row.id as string,
        idContrato: row.id_contrato as string,
        numero: Number(row.numero),
        valor: row.valor as string,
        dataVencimento: row.data_vencimento as string,
        status: row.status as Parcela['status'],
        quitado: Boolean(row.quitado),
        criadoEm: row.criado_em as string,
        atualizadoEm: (row.atualizado_em as string) ?? undefined,
        multa: row.multa != null ? Number(row.multa) : undefined,
        juros: row.juros != null ? Number(row.juros) : undefined,
    };
}

function mapLogFromDB(row: {
    id: string; id_usuario: string; nome_usuario: string;
    acao: string; detalhes: string; timestamp: string;
}): LogEntry {
    return {
        id: row.id,
        idUsuario: row.id_usuario,
        nomeUsuario: row.nome_usuario,
        acao: row.acao,
        detalhes: row.detalhes,
        timestamp: row.timestamp,
    };
}

function mapAlertaFromDB(row: {
    id: string; tipo: string; mensagem: string; id_contrato: string | null;
    numero_contrato: string | null; empresa: string | null; urgencia: string;
    lido: boolean; criado_em: string;
}): Alerta {
    return {
        id: row.id,
        tipo: row.tipo as Alerta['tipo'],
        mensagem: row.mensagem,
        idContrato: row.id_contrato ?? undefined,
        numeroContrato: row.numero_contrato ?? undefined,
        empresa: row.empresa ?? undefined,
        urgencia: row.urgencia as Alerta['urgencia'],
        lido: row.lido,
        criadoEm: row.criado_em,
    };
}

function mapModeloFromDB(row: {
    id: string; nome: string; tipo: string; descricao: string;
    tags: string[]; conteudo: string; criado_por: string;
    criado_em: string; atualizado_em: string | null;
}): ModeloContrato {
    return {
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        descricao: row.descricao,
        tags: row.tags,
        conteudo: row.conteudo,
        criadoPor: row.criado_por,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em ?? undefined,
    };
}

function mapClienteFromDB(row: {
    id: string; nome_fantasia: string; razao_social: string; cnpj: string;
    classificacao: string; inscricao_estadual: string | null; inscricao_municipal: string | null;
    cep: string | null; logradouro: string | null; bairro: string | null;
    cidade: string | null; estado: string | null; contato_nome: string | null;
    contato_email: string | null; contato_telefone: string | null; criado_em: string;
}): Cliente {
    return {
        id: row.id,
        nomeFantasia: row.nome_fantasia,
        razaoSocial: row.razao_social,
        cnpj: row.cnpj,
        classificacao: row.classificacao as Cliente['classificacao'],
        inscricaoEstadual: row.inscricao_estadual ?? undefined,
        inscricaoMunicipal: row.inscricao_municipal ?? undefined,
        cep: row.cep ?? undefined,
        logradouro: row.logradouro ?? undefined,
        bairro: row.bairro ?? undefined,
        cidade: row.cidade ?? undefined,
        estado: row.estado ?? undefined,
        contatoNome: row.contato_nome ?? undefined,
        contatoEmail: row.contato_email ?? undefined,
        contatoTelefone: row.contato_telefone ?? undefined,
        criadoEm: row.criado_em,
    };
}

function mapEmpresaFromDB(row: {
    id: string; nome: string; sigla: string; logo: string | null; criado_em: string;
}): Empresa {
    return {
        id: row.id,
        nome: row.nome,
        sigla: row.sigla,
        logo: row.logo ?? undefined,
        criadoEm: row.criado_em,
    };
}

// --- Context ---
interface DataContextType {
    loading: boolean;
    setores: Setor[];
    addSetor: (nome: string) => Setor | null;
    updateSetor: (id: string, nome: string) => boolean;
    deleteSetor: (id: string) => boolean;
    getSetorNome: (id: string) => string;
    usuarios: User[];
    addUsuario: (data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }) => User | null;
    updateUsuario: (id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }) => boolean;
    toggleUsuarioStatus: (id: string) => boolean;
    findUserByLogin: (login: string) => User | undefined;
    validatePassword: (user: User, password: string) => boolean;
    contratos: Contrato[];
    addContrato: (data: Omit<Contrato, 'id' | 'criadoEm'>) => Contrato;
    updateContrato: (id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>) => boolean;
    deleteContrato: (id: string, userId: string) => boolean;
    contratosExcluidos: Contrato[];
    // Parcelas
    parcelas: Parcela[];
    addParcelas: (parcelas: Omit<Parcela, 'id' | 'criadoEm'>[]) => void;
    updateParcela: (id: string, data: Partial<Parcela>) => void;
    deleteParcela: (id: string) => void;
    getParcelasContrato: (idContrato: string) => Parcela[];
    // Alertas
    alertas: Alerta[];
    addAlerta: (data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>) => Alerta;
    marcarAlertaLido: (id: string) => void;
    deleteAlerta: (id: string) => void;
    contratosVencendo: Contrato[];
    appConfig: AppConfig;
    setAppConfig: (cfg: Partial<AppConfig>) => void;
    logs: LogEntry[];
    addLog: (idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => void;
    enviarWebhook: (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
    simpleHash: (str: string) => string;
    modelos: ModeloContrato[];
    addModelo: (data: Omit<ModeloContrato, 'id' | 'criadoEm'>) => ModeloContrato;
    updateModelo: (id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>) => boolean;
    deleteModelo: (id: string) => boolean;
    clientes: Cliente[];
    addCliente: (data: Omit<Cliente, 'id' | 'criadoEm'>) => Cliente;
    updateCliente: (id: string, data: Partial<Omit<Cliente, 'id' | 'criadoEm'>>) => boolean;
    deleteCliente: (id: string) => boolean;
    empresas: Empresa[];
    addEmpresa: (data: Omit<Empresa, 'id' | 'criadoEm'>) => Empresa;
    updateEmpresa: (id: string, data: Partial<Omit<Empresa, 'id' | 'criadoEm'>>) => boolean;
    deleteEmpresa: (id: string) => boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within DataProvider');
    return ctx;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Parse DD/MM/YYYY to Date
function parseDateBR(str: string): Date | null {
    if (!str) return null;
    // Handle ISO format YYYY-MM-DD
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length !== 3) return null;
        const [y, m, d] = parts.map(Number);
        return new Date(y, m - 1, d);
    }
    // Handle BR format DD/MM/YYYY
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [setores, setSetores] = useState<Setor[]>(SEED_SETORES);
    const [usuarios, setUsuarios] = useState<User[]>(SEED_USERS);
    const [contratos, setContratos] = useState<Contrato[]>(SEED_CONTRATOS);
    const [parcelas, setParcelas] = useState<Parcela[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [appConfig, setAppConfigState] = useState<AppConfig>(DEFAULT_CONFIG);
    const [modelos, setModelos] = useState<ModeloContrato[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>(SEED_CLIENTES);
    const [empresas, setEmpresas] = useState<Empresa[]>(SEED_EMPRESAS);
    const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const configLoaded = useRef(false);

    // --- Seed initial data to Supabase ---
    const seedToSupabase = useCallback(async () => {
        await supabase.from('setores').insert(SEED_SETORES.map(s => ({ id: s.id, nome: s.nome })));
        await supabase.from('usuarios').insert(SEED_USERS.map(u => ({
            id: u.id, nome: u.nome, login: u.login, senha_hash: u.senhaHash,
            id_setor: u.idSetor, role: u.role, status: u.status, criado_em: u.criadoEm,
        })));
        await supabase.from('contratos').insert(SEED_CONTRATOS.map(c => ({
            id: c.id, numero: c.numero, descricao: c.descricao, empresa: c.empresa,
            objeto: c.objeto, tipo: c.tipo, id_setor: c.idSetor, valor: c.valor,
            status: c.status, data_inicio: brToIso(c.dataInicio), data_vencimento: brToIso(c.dataVencimento),
            criado_por: c.criadoPor, criado_em: c.criadoEm,
            excluido: false,
        })));
        await supabase.from('clientes').insert(SEED_CLIENTES.map(c => ({
            id: c.id, nome_fantasia: c.nomeFantasia, razao_social: c.razaoSocial,
            cnpj: c.cnpj, classificacao: c.classificacao,
            cidade: c.cidade ?? null, contato_nome: c.contatoNome ?? null,
            contato_email: c.contatoEmail ?? null, contato_telefone: c.contatoTelefone ?? null,
            criado_em: c.criadoEm,
        })));
        await supabase.from('empresas').insert(SEED_EMPRESAS.map(e => ({
            id: e.id, nome: e.nome, sigla: e.sigla, criado_em: e.criadoEm,
        })));
    }, []);

    // --- Load all data from Supabase on mount ---
    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true);
            try {
                const [setoresRes, usuariosRes, contratosRes, logsRes, alertasRes, modelosRes, clientesRes, empresasRes, configResult] = await Promise.all([
                    supabase.from('setores').select('*'),
                    supabase.from('usuarios').select('*'),
                    supabase.from('contratos').select('*'),
                    supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(500),
                    supabase.from('alertas').select('*').order('criado_em', { ascending: false }),
                    supabase.from('modelos_contratos').select('*'),
                    supabase.from('clientes').select('*'),
                    supabase.from('empresas').select('*'),
                    loadConfiguracoes(),
                ]);

                // First run: seed if setores table is empty
                if (!setoresRes.data?.length) {
                    await seedToSupabase();
                    const [s2, u2, c2, cl2, em2] = await Promise.all([
                        supabase.from('setores').select('*'),
                        supabase.from('usuarios').select('*'),
                        supabase.from('contratos').select('*'),
                        supabase.from('clientes').select('*'),
                        supabase.from('empresas').select('*'),
                    ]);
                    if (s2.data) setSetores(s2.data.map(mapSetorFromDB));
                    if (u2.data) setUsuarios(u2.data.map(mapUsuarioFromDB));
                    if (c2.data) setContratos(c2.data.map(mapContratoFromDB));
                    if (cl2.data) setClientes(cl2.data.map(mapClienteFromDB));
                    if (em2.data) setEmpresas(em2.data.map(mapEmpresaFromDB));
                } else {
                    if (setoresRes.data) setSetores(setoresRes.data.map(mapSetorFromDB));
                    if (usuariosRes.data) setUsuarios(usuariosRes.data.map(mapUsuarioFromDB));
                    if (contratosRes.data) setContratos(contratosRes.data.map(mapContratoFromDB));
                    if (clientesRes.data) setClientes(clientesRes.data.map(mapClienteFromDB));
                    if (empresasRes.data) setEmpresas(empresasRes.data.map(mapEmpresaFromDB));
                }

                if (logsRes.data) setLogs(logsRes.data.map(mapLogFromDB));
                if (alertasRes.data) setAlertas(alertasRes.data.map(mapAlertaFromDB));
                if (modelosRes.data) setModelos(modelosRes.data.map(mapModeloFromDB));

                // Load parcelas — with localStorage fallback if table doesn't exist
                const parcelasRes = await supabase.from('parcelas').select('*');
                if (parcelasRes.data) {
                    setParcelas(parcelasRes.data.map(mapParcelaFromDB));
                } else if (parcelasRes.error) {
                    console.warn('Parcelas table not available, using localStorage fallback:', parcelasRes.error.message);
                    try {
                        const localParcelas = localStorage.getItem('parcelas_fallback');
                        if (localParcelas) setParcelas(JSON.parse(localParcelas));
                    } catch { /* ignore */ }
                }

                if (configResult) {
                    setAppConfigState(configResult);
                }
            } catch (err) {
                console.error('Failed to load data from Supabase:', err);
            } finally {
                setLoading(false);
                configLoaded.current = true;
            }
        };

        loadAllData();
    }, [seedToSupabase]);

    // Auto-update contract statuses based on dates and parcelas
    useEffect(() => {
        const checkStatuses = () => {
            const now = new Date();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            let changed = false;

            const updatedContratos = contratos.map(c => {
                if (c.excluido) return c;

                // Check parcelas-based status
                const contratoParcelas = parcelas.filter(p => p.idContrato === c.id);
                if (contratoParcelas.length > 0) {
                    const todasPagas = contratoParcelas.every(p => p.status === 'pago');
                    const algumaPendente = contratoParcelas.some(p => p.status === 'pendente');

                    let newStatus = c.status;
                    if (todasPagas) {
                        newStatus = 'Quitado';
                    } else if (algumaPendente) {
                        const venc = parseDateBR(c.dataVencimento);
                        if (venc && venc < now) {
                            newStatus = 'Vencido';
                        } else if (venc && venc.getTime() - now.getTime() <= thirtyDays) {
                            newStatus = 'Vencendo';
                        } else {
                            newStatus = 'Em Aberto';
                        }
                    }

                    if (newStatus !== c.status) {
                        changed = true;
                        return { ...c, status: newStatus as Contrato['status'] };
                    }
                    return c;
                }

                // No parcelas — use date-based status
                if (c.status === 'Encerrado' || c.status === 'Quitado') return c;

                const venc = parseDateBR(c.dataVencimento);
                if (!venc) return c;

                let newStatus = c.status;
                if (venc < now) {
                    newStatus = 'Vencido';
                } else if (venc.getTime() - now.getTime() <= thirtyDays) {
                    newStatus = 'Vencendo';
                } else {
                    newStatus = 'Vigente';
                }

                if (newStatus !== c.status) {
                    changed = true;
                    // Auto-generate alerts for overdue installments
                    if (newStatus === 'Vencido') {
                        addAlerta({
                            tipo: 'geral',
                            urgencia: 'alta',
                            mensagem: `Contrato ${c.numero} está VENCIDO ou com parcelas em atraso.`,
                            idContrato: c.id,
                            numeroContrato: c.numero,
                            empresa: c.empresa
                        });
                    }
                    return { ...c, status: newStatus as Contrato['status'] };
                }
                return c;
            });


            if (changed) {
                setContratos(updatedContratos);
                updatedContratos.forEach(c => {
                    const original = contratos.find(o => o.id === c.id);
                    if (original && original.status !== c.status) {
                        supabase.from('contratos').update({ status: c.status }).eq('id', c.id).then(({ error }) => {
                            if (error) console.error('Failed to sync contract status:', error);
                        });
                    }
                });
            }
        };

        if (!loading) {
            checkStatuses();
        }
        const interval = setInterval(checkStatuses, 3600000);
        return () => clearInterval(interval);
    }, [contratos.length, parcelas.length, loading]);

    // Persist appConfig
    useEffect(() => {
        if (!configLoaded.current) return;
        if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
        configSaveTimer.current = setTimeout(() => {
            saveConfiguracoes(appConfig);
        }, 1000);
    }, [appConfig]);

    // --- Computed state ---
    const contratosAtivos = useMemo(() => contratos.filter(c => !c.excluido), [contratos]);
    const contratosExcluidos = useMemo(() => contratos.filter(c => c.excluido), [contratos]);

    const contratosVencendo = useMemo(() => {
        const now = new Date();
        const limit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return contratosAtivos.filter(c => {
            if (c.status === 'Encerrado' || c.status === 'Quitado') return false;
            const venc = parseDateBR(c.dataVencimento);
            if (!venc) return false;
            return venc <= limit;
        });
    }, [contratosAtivos]);

    // --- Alertas ---
    const addAlerta = useCallback((data: Omit<Alerta, 'id' | 'criadoEm' | 'lido'>): Alerta => {
        const novo: Alerta = {
            ...data,
            id: 'al_' + generateId(),
            lido: false,
            criadoEm: new Date().toISOString(),
        };
        setAlertas(prev => [novo, ...prev]);
        supabase.from('alertas').insert({
            id: novo.id, tipo: novo.tipo, mensagem: novo.mensagem,
            id_contrato: novo.idContrato ?? null, numero_contrato: novo.numeroContrato ?? null,
            empresa: novo.empresa ?? null, urgencia: novo.urgencia, lido: false, criado_em: novo.criadoEm,
        }).then(({ error }) => {
            if (error) console.error('Failed to save alerta:', error);
        });
        return novo;
    }, []);

    const marcarAlertaLido = useCallback((id: string) => {
        setAlertas(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
        supabase.from('alertas').update({ lido: true }).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to mark alerta as read:', error);
        });
    }, []);

    const deleteAlerta = useCallback((id: string) => {
        setAlertas(prev => prev.filter(a => a.id !== id));
        supabase.from('alertas').delete().eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to delete alerta:', error);
        });
    }, []);

    // --- Setores ---
    const addSetor = useCallback((nome: string): Setor | null => {
        const trimmed = nome.trim();
        if (!trimmed) return null;
        if (setores.some(s => s.nome.toLowerCase() === trimmed.toLowerCase())) return null;
        const novo: Setor = { id: 'st_' + generateId(), nome: trimmed };
        setSetores(prev => [...prev, novo]);
        supabase.from('setores').insert({ id: novo.id, nome: novo.nome }).then(({ error }) => {
            if (error) { console.error('Failed to save setor:', error); setSetores(prev => prev.filter(s => s.id !== novo.id)); }
        });
        return novo;
    }, [setores]);

    const updateSetor = useCallback((id: string, nome: string): boolean => {
        const trimmed = nome.trim();
        if (!trimmed) return false;
        if (setores.some(s => s.id !== id && s.nome.toLowerCase() === trimmed.toLowerCase())) return false;
        setSetores(prev => prev.map(s => s.id === id ? { ...s, nome: trimmed } : s));
        supabase.from('setores').update({ nome: trimmed }).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to update setor:', error);
        });
        return true;
    }, [setores]);

    const deleteSetor = useCallback((id: string): boolean => {
        if (usuarios.some(u => u.idSetor === id)) return false;
        if (contratos.some(c => c.idSetor === id)) return false;
        setSetores(prev => prev.filter(s => s.id !== id));
        supabase.from('setores').delete().eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to delete setor:', error);
        });
        return true;
    }, [usuarios, contratos]);

    const getSetorNome = useCallback((id: string): string => {
        return setores.find(s => s.id === id)?.nome || '—';
    }, [setores]);

    // --- Usuarios ---
    const addUsuario = useCallback((data: Omit<User, 'id' | 'senhaHash' | 'criadoEm'> & { senha: string }): User | null => {
        if (usuarios.some(u => u.login.toLowerCase() === data.login.toLowerCase())) return null;
        const novo: User = {
            id: 'us_' + generateId(), nome: data.nome, login: data.login, senhaHash: simpleHash(data.senha),
            idSetor: data.idSetor, role: data.role, status: data.status, criadoEm: new Date().toISOString(),
        };
        setUsuarios(prev => [...prev, novo]);
        supabase.from('usuarios').insert({
            id: novo.id, nome: novo.nome, login: novo.login, senha_hash: novo.senhaHash,
            id_setor: novo.idSetor, role: novo.role, status: novo.status, criado_em: novo.criadoEm,
        }).then(({ error }) => {
            if (error) { console.error('Failed to save usuario:', error); setUsuarios(prev => prev.filter(u => u.id !== novo.id)); }
        });
        return novo;
    }, [usuarios]);

    const updateUsuario = useCallback((id: string, data: Partial<Omit<User, 'id' | 'senhaHash' | 'criadoEm'>> & { senha?: string }): boolean => {
        if (data.login && usuarios.some(u => u.id !== id && u.login.toLowerCase() === data.login!.toLowerCase())) return false;
        setUsuarios(prev => prev.map(u => {
            if (u.id !== id) return u;
            const updated = { ...u };
            if (data.nome !== undefined) updated.nome = data.nome;
            if (data.login !== undefined) updated.login = data.login;
            if (data.idSetor !== undefined) updated.idSetor = data.idSetor;
            if (data.role !== undefined) updated.role = data.role;
            if (data.status !== undefined) updated.status = data.status;
            if (data.senha) updated.senhaHash = simpleHash(data.senha);
            return updated;
        }));
        const dbUpdate: Record<string, unknown> = {};
        if (data.nome !== undefined) dbUpdate.nome = data.nome;
        if (data.login !== undefined) dbUpdate.login = data.login;
        if (data.idSetor !== undefined) dbUpdate.id_setor = data.idSetor;
        if (data.role !== undefined) dbUpdate.role = data.role;
        if (data.status !== undefined) dbUpdate.status = data.status;
        if (data.senha) dbUpdate.senha_hash = simpleHash(data.senha);
        supabase.from('usuarios').update(dbUpdate).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to update usuario:', error);
        });
        return true;
    }, [usuarios]);

    const toggleUsuarioStatus = useCallback((id: string): boolean => {
        setUsuarios(prev => prev.map(u => {
            if (u.id === id) {
                const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo';
                addAlerta({ tipo: 'geral', urgencia: 'media', mensagem: `Status do usuário ${u.nome} alterado para ${newStatus.toUpperCase()}`, empresa: 'Gestão de Acessos' });
                supabase.from('usuarios').update({ status: newStatus }).eq('id', id).then(({ error }) => {
                    if (error) console.error('Failed to toggle usuario status:', error);
                });
                return { ...u, status: newStatus };
            }
            return u;
        }));
        return true;
    }, [addAlerta]);

    const findUserByLogin = useCallback((login: string): User | undefined => {
        return usuarios.find(u => u.login.toLowerCase() === login.toLowerCase());
    }, [usuarios]);

    const validatePassword = useCallback((user: User, password: string): boolean => {
        return user.senhaHash === simpleHash(password);
    }, []);

    // --- Contratos ---
    const addContrato = useCallback((data: Omit<Contrato, 'id' | 'criadoEm'>): Contrato => {
        const novo: Contrato = { ...data, id: 'ct_' + generateId(), criadoEm: new Date().toISOString() };
        setContratos(prev => [...prev, novo]);

        // Garantir data_inicio válida (NOT NULL no banco)
        const dataInicioISO = brToIso(novo.dataInicio) || novo.dataInicio || new Date().toISOString().split('T')[0];
        const dataVencimentoISO = brToIso(novo.dataVencimento) || novo.dataVencimento || new Date().toISOString().split('T')[0];

        supabase.from('contratos').insert({
            id: novo.id, numero: novo.numero, descricao: novo.descricao, empresa: novo.empresa,
            objeto: novo.objeto, tipo: novo.tipo, id_setor: novo.idSetor, valor: novo.valor,
            status: novo.status,
            data_inicio: dataInicioISO,
            data_vencimento: dataVencimentoISO,
            criado_por: novo.criadoPor, criado_em: novo.criadoEm,
            arquivo_pdf: novo.arquivoPdf ?? null, nome_arquivo: novo.nomeArquivo ?? null,
            excluido: false,
            qtd_medicoes: novo.qtdMedicoes ?? null,
            medicao_atual: novo.medicaoAtual ?? null,
            valor_medicao: novo.valorMedicao ?? null,
            saldo_contrato: novo.saldoContrato ?? null,
            // Financial fields
            vigencia_meses: novo.vigenciaMeses ?? null,
            modelo_cobranca: novo.modeloCobranca ?? null,
            valor_implantacao: novo.valorImplantacao ?? null,
            valor_manutencao_mensal: novo.valorManutencaoMensal ?? null,
            qtd_pagamentos: novo.qtdPagamentos ?? null,
            valor_prestacao: novo.valorPrestacao ?? null,
            // multa_percentual not in DB schema — handled locally
        }).then(({ error }) => {

            if (error) {
                console.error('Failed to save contrato:', error);
                console.error('Insert payload data_inicio:', dataInicioISO, 'data_vencimento:', dataVencimentoISO);
                setContratos(prev => prev.filter(c => c.id !== novo.id));
                // Dispara toast de erro para o usuário
                window.dispatchEvent(new CustomEvent('supabase-error', { detail: `Erro ao salvar contrato no banco: ${error.message}` }));
            }
        });
        return novo;
    }, []);

    const updateContrato = useCallback((id: string, data: Partial<Omit<Contrato, 'id' | 'criadoEm'>>): boolean => {
        setContratos(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        const dbUpdate: Record<string, unknown> = {};
        if (data.numero !== undefined) dbUpdate.numero = data.numero;
        if (data.descricao !== undefined) dbUpdate.descricao = data.descricao;
        if (data.empresa !== undefined) dbUpdate.empresa = data.empresa;
        if (data.objeto !== undefined) dbUpdate.objeto = data.objeto;
        if (data.tipo !== undefined) dbUpdate.tipo = data.tipo;
        if (data.idSetor !== undefined) dbUpdate.id_setor = data.idSetor;
        if (data.valor !== undefined) dbUpdate.valor = data.valor;
        if (data.status !== undefined) dbUpdate.status = data.status;
        if (data.dataInicio !== undefined) dbUpdate.data_inicio = brToIso(data.dataInicio) || new Date().toISOString().split('T')[0];
        if (data.dataVencimento !== undefined) dbUpdate.data_vencimento = brToIso(data.dataVencimento) || new Date().toISOString().split('T')[0];
        if (data.criadoPor !== undefined) dbUpdate.criado_por = data.criadoPor;
        if (data.arquivoPdf !== undefined) dbUpdate.arquivo_pdf = data.arquivoPdf;
        if (data.nomeArquivo !== undefined) dbUpdate.nome_arquivo = data.nomeArquivo;
        if (data.excluido !== undefined) dbUpdate.excluido = data.excluido;
        if (data.excluidoPor !== undefined) dbUpdate.excluido_por = data.excluidoPor;
        if (data.excluidoEm !== undefined) dbUpdate.excluido_em = data.excluidoEm;
        // Obra fields that exist in DB
        if (data.qtdMedicoes !== undefined) dbUpdate.qtd_medicoes = data.qtdMedicoes ?? null;
        if (data.medicaoAtual !== undefined) dbUpdate.medicao_atual = data.medicaoAtual ?? null;
        if (data.valorMedicao !== undefined) dbUpdate.valor_medicao = data.valorMedicao ?? null;
        if (data.saldoContrato !== undefined) dbUpdate.saldo_contrato = data.saldoContrato ?? null;
        // Financial fields
        if (data.vigenciaMeses !== undefined) dbUpdate.vigencia_meses = data.vigenciaMeses ?? null;
        if (data.modeloCobranca !== undefined) dbUpdate.modelo_cobranca = data.modeloCobranca ?? null;
        if (data.valorImplantacao !== undefined) dbUpdate.valor_implantacao = data.valorImplantacao ?? null;
        if (data.valorManutencaoMensal !== undefined) dbUpdate.valor_manutencao_mensal = data.valorManutencaoMensal ?? null;
        if (data.qtdPagamentos !== undefined) dbUpdate.qtd_pagamentos = data.qtdPagamentos ?? null;
        if (data.valorPrestacao !== undefined) dbUpdate.valor_prestacao = data.valorPrestacao ?? null;
        // multa_percentual not in DB schema — skip
        supabase.from('contratos').update(dbUpdate).eq('id', id).then(({ error }) => {

            if (error) console.error('Failed to update contrato:', error);
        });
        return true;
    }, []);

    const deleteContrato = useCallback((id: string, userId: string): boolean => {
        setContratos(prev => prev.map(c => {
            if (c.id === id) {
                const now = new Date().toISOString();
                addAlerta({ tipo: 'geral', urgencia: 'alta', mensagem: `Contrato excluído: ${c.numero} — ${c.empresa}`, empresa: 'Auditoria de Contratos' });
                supabase.from('contratos').update({ excluido: true, excluido_por: userId, excluido_em: now }).eq('id', id).then(({ error }) => {
                    if (error) console.error('Failed to soft-delete contrato:', error);
                });
                return { ...c, excluido: true, excluidoPor: userId, excluidoEm: now };
            }
            return c;
        }));
        return true;
    }, [addAlerta]);

    // --- Parcelas ---
    // Helper to persist parcelas to localStorage as fallback
    const persistParcelasLocal = useCallback((updatedParcelas: Parcela[]) => {
        try { localStorage.setItem('parcelas_fallback', JSON.stringify(updatedParcelas)); } catch { /* ignore */ }
    }, []);

    const addParcelas = useCallback((newParcelas: Omit<Parcela, 'id' | 'criadoEm'>[]) => {
        const created = newParcelas.map(p => ({
            ...p,
            id: 'pc_' + generateId(),
            criadoEm: new Date().toISOString(),
        }));
        setParcelas(prev => {
            const updated = [...prev, ...created];
            persistParcelasLocal(updated);
            return updated;
        });
        supabase.from('parcelas').insert(created.map(p => ({
            id: p.id, id_contrato: p.idContrato, numero: p.numero, valor: p.valor,
            data_vencimento: p.dataVencimento, status: p.status, quitado: p.quitado,
            criado_em: p.criadoEm, multa: p.multa ?? null, juros: p.juros ?? null,
        }))).then(({ error }: any) => {
            if (error) console.warn('Failed to save parcelas to DB (using localStorage):', error.message);
        });
    }, [persistParcelasLocal]);

    const updateParcela = useCallback((id: string, data: Partial<Parcela>) => {
        const now = new Date().toISOString();
        setParcelas(prev => {
            const updated = prev.map(p => p.id === id ? { ...p, ...data, atualizadoEm: now } : p);
            persistParcelasLocal(updated);
            return updated;
        });
        const dbUpdate: Record<string, unknown> = { atualizado_em: now };
        if (data.valor !== undefined) dbUpdate.valor = data.valor;
        if (data.dataVencimento !== undefined) dbUpdate.data_vencimento = data.dataVencimento;
        if (data.status !== undefined) dbUpdate.status = data.status;
        if (data.quitado !== undefined) dbUpdate.quitado = data.quitado;
        if (data.multa !== undefined) dbUpdate.multa = data.multa;
        if (data.juros !== undefined) dbUpdate.juros = data.juros;
        supabase.from('parcelas').update(dbUpdate).eq('id', id).then(({ error }) => {
            if (error) console.warn('Failed to update parcela in DB (using localStorage):', error.message);
        });
    }, [parcelas, persistParcelasLocal]);

    const deleteParcela = useCallback((id: string) => {
        const existing = parcelas.find(p => p.id === id);
        if (existing?.status === 'pago') return;
        setParcelas(prev => {
            const updated = prev.filter(p => p.id !== id);
            persistParcelasLocal(updated);
            return updated;
        });
        supabase.from('parcelas').delete().eq('id', id).then(({ error }) => {
            if (error) console.warn('Failed to delete parcela from DB (using localStorage):', error.message);
        });
    }, [parcelas, persistParcelasLocal]);

    const getParcelasContrato = useCallback((idContrato: string): Parcela[] => {
        return parcelas.filter(p => p.idContrato === idContrato).sort((a, b) => a.numero - b.numero);
    }, [parcelas]);

    // --- AppConfig ---
    const setAppConfig = useCallback((cfg: Partial<AppConfig>) => {
        setAppConfigState(prev => ({ ...prev, ...cfg }));
    }, []);

    // --- Logs ---
    const addLog = useCallback((idUsuario: string, nomeUsuario: string, acao: string, detalhes: string) => {
        const entry: LogEntry = {
            id: 'lg_' + generateId(), idUsuario, nomeUsuario, acao, detalhes,
            timestamp: new Date().toISOString(),
        };
        setLogs(prev => [entry, ...prev]);
        supabase.from('logs').insert({
            id: entry.id, id_usuario: entry.idUsuario, nome_usuario: entry.nomeUsuario,
            acao: entry.acao, detalhes: entry.detalhes, timestamp: entry.timestamp,
        }).then(({ error }) => {
            if (error) console.error('Failed to save log:', error);
        });
    }, []);

    // --- Webhook ---
    const enviarWebhook = useCallback(async (tipo: 'gptmaker' | 'n8n', payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
        const url = tipo === 'gptmaker' ? appConfig.webhookGptMaker : appConfig.webhookN8n;
        if (!url) return { ok: false, error: `URL do webhook ${tipo} não configurada.` };
        try {
            const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!resp.ok) return { ok: false, error: `Webhook retornou status ${resp.status}` };
            return { ok: true };
        } catch (err: unknown) {
            return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
        }
    }, [appConfig.webhookGptMaker, appConfig.webhookN8n]);

    // --- Modelos CRUD ---
    const addModelo = useCallback((data: Omit<ModeloContrato, 'id' | 'criadoEm'>): ModeloContrato => {
        const modelo: ModeloContrato = { ...data, id: generateId(), criadoEm: new Date().toISOString() };
        setModelos(prev => [...prev, modelo]);
        supabase.from('modelos_contratos').insert({
            id: modelo.id, nome: modelo.nome, tipo: modelo.tipo, descricao: modelo.descricao,
            tags: modelo.tags, conteudo: modelo.conteudo, criado_por: modelo.criadoPor, criado_em: modelo.criadoEm,
        }).then(({ error }) => { if (error) console.error('Failed to save modelo:', error); });
        return modelo;
    }, []);

    const updateModelo = useCallback((id: string, data: Partial<Omit<ModeloContrato, 'id' | 'criadoEm'>>): boolean => {
        const now = new Date().toISOString();
        setModelos(prev => prev.map(m => m.id === id ? { ...m, ...data, atualizadoEm: now } : m));
        const dbUpdate: Record<string, unknown> = { atualizado_em: now };
        if (data.nome !== undefined) dbUpdate.nome = data.nome;
        if (data.tipo !== undefined) dbUpdate.tipo = data.tipo;
        if (data.descricao !== undefined) dbUpdate.descricao = data.descricao;
        if (data.tags !== undefined) dbUpdate.tags = data.tags;
        if (data.conteudo !== undefined) dbUpdate.conteudo = data.conteudo;
        supabase.from('modelos_contratos').update(dbUpdate).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to update modelo:', error);
        });
        return true;
    }, []);

    const deleteModelo = useCallback((id: string): boolean => {
        setModelos(prev => prev.filter(m => m.id !== id));
        supabase.from('modelos_contratos').delete().eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to delete modelo:', error);
        });
        return true;
    }, []);

    // --- Clientes CRUD ---
    const addCliente = useCallback((data: Omit<Cliente, 'id' | 'criadoEm'>): Cliente => {
        const novo: Cliente = { ...data, id: 'cl_' + generateId(), criadoEm: new Date().toISOString() };
        setClientes(prev => [...prev, novo]);
        supabase.from('clientes').insert({
            id: novo.id, nome_fantasia: novo.nomeFantasia, razao_social: novo.razaoSocial,
            cnpj: novo.cnpj, classificacao: novo.classificacao,
            inscricao_estadual: novo.inscricaoEstadual ?? null, inscricao_municipal: novo.inscricaoMunicipal ?? null,
            cep: novo.cep ?? null, logradouro: novo.logradouro ?? null, bairro: novo.bairro ?? null,
            cidade: novo.cidade ?? null, estado: novo.estado ?? null,
            contato_nome: novo.contatoNome ?? null, contato_email: novo.contatoEmail ?? null,
            contato_telefone: novo.contatoTelefone ?? null, criado_em: novo.criadoEm,
        }).then(({ error }) => {
            if (error) { console.error('Failed to save cliente:', error); setClientes(prev => prev.filter(c => c.id !== novo.id)); }
        });
        return novo;
    }, []);

    const updateCliente = useCallback((id: string, data: Partial<Omit<Cliente, 'id' | 'criadoEm'>>): boolean => {
        setClientes(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
        const dbUpdate: Record<string, unknown> = {};
        if (data.nomeFantasia !== undefined) dbUpdate.nome_fantasia = data.nomeFantasia;
        if (data.razaoSocial !== undefined) dbUpdate.razao_social = data.razaoSocial;
        if (data.cnpj !== undefined) dbUpdate.cnpj = data.cnpj;
        if (data.classificacao !== undefined) dbUpdate.classificacao = data.classificacao;
        if (data.inscricaoEstadual !== undefined) dbUpdate.inscricao_estadual = data.inscricaoEstadual;
        if (data.inscricaoMunicipal !== undefined) dbUpdate.inscricao_municipal = data.inscricaoMunicipal;
        if (data.cep !== undefined) dbUpdate.cep = data.cep;
        if (data.logradouro !== undefined) dbUpdate.logradouro = data.logradouro;
        if (data.bairro !== undefined) dbUpdate.bairro = data.bairro;
        if (data.cidade !== undefined) dbUpdate.cidade = data.cidade;
        if (data.estado !== undefined) dbUpdate.estado = data.estado;
        if (data.contatoNome !== undefined) dbUpdate.contato_nome = data.contatoNome;
        if (data.contatoEmail !== undefined) dbUpdate.contato_email = data.contatoEmail;
        if (data.contatoTelefone !== undefined) dbUpdate.contato_telefone = data.contatoTelefone;
        supabase.from('clientes').update(dbUpdate).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to update cliente:', error);
        });
        return true;
    }, []);

    const deleteCliente = useCallback((id: string): boolean => {
        setClientes(prev => prev.filter(c => c.id !== id));
        supabase.from('clientes').delete().eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to delete cliente:', error);
        });
        return true;
    }, []);

    // --- Empresas CRUD ---
    const addEmpresa = useCallback((data: Omit<Empresa, 'id' | 'criadoEm'>): Empresa => {
        const nova: Empresa = { ...data, id: 'em_' + generateId(), criadoEm: new Date().toISOString() };
        setEmpresas(prev => [...prev, nova]);
        supabase.from('empresas').insert({
            id: nova.id, nome: nova.nome, sigla: nova.sigla, logo: nova.logo ?? null, criado_em: nova.criadoEm,
        }).then(({ error }) => {
            if (error) { console.error('Failed to save empresa:', error); setEmpresas(prev => prev.filter(e => e.id !== nova.id)); }
        });
        return nova;
    }, []);

    const updateEmpresa = useCallback((id: string, data: Partial<Omit<Empresa, 'id' | 'criadoEm'>>): boolean => {
        setEmpresas(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
        const dbUpdate: Record<string, unknown> = {};
        if (data.nome !== undefined) dbUpdate.nome = data.nome;
        if (data.sigla !== undefined) dbUpdate.sigla = data.sigla;
        if (data.logo !== undefined) dbUpdate.logo = data.logo;
        supabase.from('empresas').update(dbUpdate).eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to update empresa:', error);
        });
        return true;
    }, []);

    const deleteEmpresa = useCallback((id: string): boolean => {
        setEmpresas(prev => prev.filter(e => e.id !== id));
        supabase.from('empresas').delete().eq('id', id).then(({ error }) => {
            if (error) console.error('Failed to delete empresa:', error);
        });
        return true;
    }, []);

    return (
        <DataContext.Provider value={{
            loading,
            setores, addSetor, updateSetor, deleteSetor, getSetorNome,
            usuarios, addUsuario, updateUsuario, toggleUsuarioStatus, findUserByLogin, validatePassword,
            contratos: contratosAtivos, addContrato, updateContrato, deleteContrato, contratosExcluidos,
            parcelas, addParcelas, updateParcela, deleteParcela, getParcelasContrato,
            alertas, addAlerta, marcarAlertaLido, deleteAlerta, contratosVencendo,
            appConfig, setAppConfig,
            logs, addLog,
            enviarWebhook,
            simpleHash,
            modelos, addModelo, updateModelo, deleteModelo,
            clientes, addCliente, updateCliente, deleteCliente,
            empresas, addEmpresa, updateEmpresa, deleteEmpresa,
        }}>
            {children}
        </DataContext.Provider>
    );
}
