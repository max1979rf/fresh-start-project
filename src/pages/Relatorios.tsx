import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
    BarChart3, Filter, Printer, Download, FileText, Building2, Users, Calendar,
    ChevronDown, ChevronUp, Clock
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

type ReportType = 'contratos' | 'setores' | 'usuarios';
type VencimentoFilter = '' | '30' | '60' | '90';

const REPORT_TYPES: { key: ReportType; label: string; icon: typeof FileText; desc: string }[] = [
    { key: 'contratos', label: 'Contratos', icon: FileText, desc: 'Relatório de todos os contratos cadastrados' },
    { key: 'setores', label: 'Setores', icon: Building2, desc: 'Relatório por setor com totais' },
    { key: 'usuarios', label: 'Usuários', icon: Users, desc: 'Relatório de usuários cadastrados' },
];

const VENCIMENTO_OPTIONS: { key: VencimentoFilter; label: string }[] = [
    { key: '', label: 'Todos' },
    { key: '30', label: '30 dias' },
    { key: '60', label: '60 dias' },
    { key: '90', label: '90 dias' },
];

export default function Relatorios() {
    const { contratos, setores, usuarios, getSetorNome, appConfig, contratosExcluidos } = useData();
    const { isAdmin } = useAuth();
    const [reportType, setReportType] = useState<ReportType>('contratos');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    // Filters
    const [filterSetor, setFilterSetor] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterSearch, setFilterSearch] = useState("");
    const [incluirExcluidos, setIncluirExcluidos] = useState(false);
    const [filterVencimento, setFilterVencimento] = useState<VencimentoFilter>('');

    const handlePrint = () => {
        const printArea = reportRef.current;
        if (!printArea) return;
        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) return;
        printWin.document.write(`<!DOCTYPE html><html><head><title>Relatório</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', Arial, sans-serif; padding: 24px; color: #1a1a2e; font-size: 12px; }
      .header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; border-bottom: 2px solid #1a2d5a; padding-bottom: 12px; }
      .header img { height: 48px; }
      .header h1 { font-size: 18px; font-weight: 700; color: #1a2d5a; }
      .header p { font-size: 11px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #f0f2f5; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; color: #555; border-bottom: 2px solid #ddd; text-transform: uppercase; letter-spacing: 0.5px; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) { background: #fafbfc; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center; }
      .meta { font-size: 10px; color: #888; margin-bottom: 8px; }
      @media print { body { padding: 12px; } }
    </style></head><body>`);
        printWin.document.write(printArea.innerHTML);
        printWin.document.write('</body></html>');
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 300);
    };

    // --- DOCX Export ---
    const handleExportDocx = async () => {
        const data = reportData as any[];
        if (!data || data.length === 0) return;

        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const currentReport = REPORT_TYPES.find(r => r.key === reportType)!;

        const headerRow = (cells: string[]) => new TableRow({
            tableHeader: true,
            children: cells.map(c => new TableCell({
                width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                shading: { fill: "1a2d5a" },
                children: [new Paragraph({
                    children: [new TextRun({ text: c, bold: true, color: "FFFFFF", size: 18, font: "Arial" })],
                    spacing: { before: 40, after: 40 },
                })],
            })),
        });

        const dataRow = (cells: string[]) => new TableRow({
            children: cells.map(c => new TableCell({
                width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                children: [new Paragraph({
                    children: [new TextRun({ text: c, size: 18, font: "Arial" })],
                    spacing: { before: 30, after: 30 },
                })],
            })),
        });

        let rows: TableRow[] = [];
        if (reportType === 'contratos') {
            rows = [
                headerRow(['Nº', 'Empresa', 'Objeto/Descrição', 'Valor', 'Início', 'Vencimento', 'Status']),
                ...(data as typeof contratos).map(c => dataRow([
                    c.numero, c.empresa, c.objeto || c.descricao, c.valor || '—',
                    c.dataInicio, c.dataVencimento, c.status
                ]))
            ];
        } else if (reportType === 'setores') {
            rows = [
                headerRow(['Setor', 'Usuários', 'Contratos', 'Valor Total']),
                ...(data as { nome: string; totalUsuarios: number; totalContratos: number; valorTotal: number }[]).map(s => dataRow([
                    s.nome, String(s.totalUsuarios), String(s.totalContratos),
                    `R$ ${s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]))
            ];
        } else if (reportType === 'usuarios') {
            rows = [
                headerRow(['Nome', 'Login', 'Setor', 'Perfil', 'Status']),
                ...(data as typeof usuarios).map(u => dataRow([
                    u.nome, u.login, u.idSetor ? getSetorNome(u.idSetor) : 'Administração',
                    u.role === 'admin' ? 'Admin' : 'Setor', u.status
                ]))
            ];
        }

        const table = new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        });

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: companyName, bold: true, size: 32, font: "Arial", color: "1a2d5a" })],
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 80 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Relatório de ${currentReport.label} — Gerado em ${dateStr}`, size: 18, font: "Arial", color: "666666", italics: true })],
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: `Total: ${data.length} registro(s)`, size: 18, font: "Arial", color: "888888" })],
                        spacing: { after: 200 },
                    }),
                    table,
                    new Paragraph({
                        children: [new TextRun({ text: `${companyName} — Relatório gerado automaticamente pelo Sistema de Gestão de Contratos — ${dateStr}`, size: 14, font: "Arial", color: "999999" })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400 },
                    }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `Relatorio_${currentReport.label}_${now.toISOString().slice(0, 10)}.docx`);
    };

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const companyName = appConfig.nomeEmpresa || 'Fundação Assistencial da Paraíba';

    // --- Helper: parse DD/MM/YYYY to Date ---
    const parseBrDate = (br: string): Date | null => {
        if (!br) return null;
        const p = br.split('/');
        if (p.length !== 3) return null;
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    };

    // --- Report Data ---
    const reportData = useMemo(() => {
        switch (reportType) {
            case 'contratos': {
                let data = incluirExcluidos ? [...contratos, ...contratosExcluidos] : contratos;
                if (filterSetor) data = data.filter(c => c.idSetor === filterSetor);
                if (filterStatus) data = data.filter(c => c.status === filterStatus);
                if (filterSearch) data = data.filter(c =>
                    c.numero.toLowerCase().includes(filterSearch.toLowerCase()) ||
                    c.empresa.toLowerCase().includes(filterSearch.toLowerCase()) ||
                    (c.objeto || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
                    (c.descricao || '').toLowerCase().includes(filterSearch.toLowerCase()));
                if (filterDateFrom) data = data.filter(c => {
                    const p = c.dataInicio.split('/');
                    if (p.length !== 3) return true;
                    return `${p[2]}-${p[1]}-${p[0]}` >= filterDateFrom;
                });
                if (filterDateTo) data = data.filter(c => {
                    const p = c.dataVencimento.split('/');
                    if (p.length !== 3) return true;
                    return `${p[2]}-${p[1]}-${p[0]}` <= filterDateTo;
                });
                // Filter by expiration window (30, 60, 90 days)
                if (filterVencimento) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const days = parseInt(filterVencimento);
                    const futureDate = new Date(today);
                    futureDate.setDate(futureDate.getDate() + days);
                    data = data.filter(c => {
                        const venc = parseBrDate(c.dataVencimento);
                        if (!venc) return false;
                        return venc >= today && venc <= futureDate;
                    });
                }
                return data;
            }
            case 'setores':
                return setores.map(s => ({
                    ...s,
                    totalUsuarios: usuarios.filter(u => u.idSetor === s.id).length,
                    totalContratos: contratos.filter(c => c.idSetor === s.id).length,
                    valorTotal: contratos.filter(c => c.idSetor === s.id)
                        .reduce((sum, c) => sum + (parseFloat(c.valor?.replace(/[^\d.,]/g, '').replace(',', '.') || '0') || 0), 0),
                }));
            case 'usuarios': {
                let data = [...usuarios];
                if (filterSetor) data = data.filter(u => u.idSetor === filterSetor);
                if (filterSearch) data = data.filter(u =>
                    u.nome.toLowerCase().includes(filterSearch.toLowerCase()) ||
                    u.login.toLowerCase().includes(filterSearch.toLowerCase()));
                return data;
            }
            default: return [];
        }
    }, [reportType, contratos, contratosExcluidos, setores, usuarios, filterSetor, filterStatus, filterSearch, filterDateFrom, filterDateTo, incluirExcluidos, filterVencimento]);

    const statusStyle: Record<string, string> = {
        Vigente: "bg-emerald-100 text-emerald-700",
        Vencendo: "bg-amber-100 text-amber-700",
        Vencido: "bg-red-100 text-red-700",
        Encerrado: "bg-gray-100 text-gray-500",
        Quitado: "bg-blue-100 text-blue-700",
        "Em Aberto": "bg-orange-100 text-orange-700",
    };

    const renderTable = () => {
        switch (reportType) {
            case 'contratos':
                return (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Nº</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Empresa</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Objeto / Descrição</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Setor</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Valor</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Início</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Vencimento</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(reportData as typeof contratos).map((c) => (
                                <tr key={c.id} className="border-b border-border/30 hover:bg-muted/10">
                                    <td className="px-4 py-2 text-xs font-medium">{c.numero} {c.excluido && <span className="text-[9px] text-red-500 ml-1">(excluído)</span>}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.empresa}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{c.objeto || c.descricao}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{getSetorNome(c.idSetor)}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.valor || '—'}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.dataInicio}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.dataVencimento}</td>
                                    <td className="px-4 py-2">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle[c.status]}`}>{c.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            case 'setores':
                return (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Setor</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Usuários</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Contratos</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(reportData as { id: string; nome: string; totalUsuarios: number; totalContratos: number; valorTotal: number }[]).map(s => (
                                <tr key={s.id} className="border-b border-border/30 hover:bg-muted/10">
                                    <td className="px-4 py-2 text-xs font-medium">{s.nome}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{s.totalUsuarios}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{s.totalContratos}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">R$ {s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            case 'usuarios':
                return (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Nome</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Login</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Setor</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Perfil</th>
                                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b-2 border-border">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(reportData as typeof usuarios).map(u => (
                                <tr key={u.id} className="border-b border-border/30 hover:bg-muted/10">
                                    <td className="px-4 py-2 text-xs font-medium">{u.nome}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{u.login}</td>
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{u.idSetor ? getSetorNome(u.idSetor) : 'Administração'}</td>
                                    <td className="px-4 py-2"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role === 'admin' ? 'Admin' : 'Setor'}</span></td>
                                    <td className="px-4 py-2"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
        }
    };

    const currentReport = REPORT_TYPES.find(r => r.key === reportType)!;
    const totalItems = Array.isArray(reportData) ? reportData.length : 0;

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Relatórios</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gere relatórios com filtros abrangentes de todos os dados do sistema</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportDocx}
                        disabled={totalItems === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" /> Baixar / DOCX
                    </button>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
                    >
                        <Printer className="w-4 h-4" /> Imprimir / PDF
                    </button>
                </div>
            </div>

            {/* Report Type Selector */}
            <div className="flex flex-wrap gap-2">
                {REPORT_TYPES.filter(r => isAdmin || r.key === 'contratos').map(r => {
                    const Icon = r.icon;
                    return (
                        <button
                            key={r.key}
                            onClick={() => setReportType(r.key)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${reportType === r.key
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                                }`}
                        >
                            <Icon className="w-4 h-4" /> {r.label}
                        </button>
                    );
                })}
            </div>

            {/* Quick Expiration Filters — only for Contratos */}
            {reportType === 'contratos' && (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                        <Clock className="w-3.5 h-3.5" /> Vencimento em:
                    </div>
                    {VENCIMENTO_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilterVencimento(opt.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterVencimento === opt.key
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Filter className="w-4 h-4 text-muted-foreground" /> Filtros
                    </div>
                    {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {filtersOpen && (
                    <div className="px-5 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-border/50">
                        <div className="space-y-1">
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Buscar</label>
                            <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Nº, empresa, objeto..."
                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        {(reportType === 'contratos' || reportType === 'usuarios') && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Setor</label>
                                <select value={filterSetor} onChange={(e) => setFilterSetor(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none">
                                    <option value="">Todos</option>
                                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                            </div>
                        )}
                        {reportType === 'contratos' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none">
                                    <option value="">Todos</option>
                                    <option>Vigente</option><option>Vencendo</option><option>Vencido</option><option>Encerrado</option>
                                </select>
                            </div>
                        )}
                        {reportType === 'contratos' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data de</label>
                                    <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data até</label>
                                    <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none" />
                                </div>
                            </>
                        )}
                        {reportType === 'contratos' && isAdmin && (
                            <div className="space-y-1 flex items-end">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                    <input type="checkbox" checked={incluirExcluidos} onChange={(e) => setIncluirExcluidos(e.target.checked)}
                                        className="rounded border-input" />
                                    Incluir excluídos (auditoria)
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Report (printable) */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div ref={reportRef}>
                    {/* Report Header (with logo for print) */}
                    <div className="header flex items-center gap-4 px-5 py-4 border-b border-border">
                        {appConfig.logoBase64 && (
                            <img src={appConfig.logoBase64} alt="Logo" style={{ height: '48px' }} className="object-contain" />
                        )}
                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                                {companyName}
                            </h1>
                            <p className="text-[11px] text-muted-foreground">
                                Relatório de {currentReport.label} — Gerado em {formattedDate}
                                {reportType === 'contratos' && filterVencimento && (
                                    <span className="ml-2 text-primary font-medium">
                                        — Vencimento em {filterVencimento} dias
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <BarChart3 className="w-4 h-4" /> {totalItems} registro(s)
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        {renderTable()}
                    </div>

                    {totalItems === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            Nenhum registro encontrado com os filtros aplicados.
                        </div>
                    )}

                    {/* Print footer */}
                    <div className="footer text-center text-[10px] text-muted-foreground py-3 border-t border-border/50">
                        {companyName} — Relatório gerado automaticamente pelo Sistema de Gestão de Contratos — {formattedDate}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
