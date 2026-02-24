import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, FileText, Pencil, Trash2, Clock, X, AlertCircle, Eye, Download, Upload, Send, Loader2, CheckCircle2, CreditCard } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import ContratoViewer from "../components/ContratoViewer";
import AnalysisAlert, { type AnalysisResult } from "../components/AnalysisAlert";
import { extractTextFromPdf, extractTextFromDocx, parseContractFields, parseVigenciaMeses, analyzeContract, analyzeValues, generateContractNumber } from "../utils/pdfAnalyzer";
import { analyzeContractWithLlm } from "../utils/llmService";
import { brToIso, isoToBr } from "../utils/dateUtils";
import { uploadContratoFile, isStorageUrl } from "../services/storageService";
import type { TipoContrato, ModeloCobranca, Parcela } from "../types";

const TIPOS_CONTRATO_DEFAULT: string[] = ['Serviços de TI', 'Sistema / Software', 'Infraestrutura', 'Implantação', 'Manutenção', 'Obra', 'Outros'];

// Map tipo -> setor suggestion
const TIPO_SETOR_MAP: Record<string, string> = {
  'Serviços de TI': 'Tecnologia da Informação',
  'Sistema / Software': 'Tecnologia da Informação',
  'Infraestrutura': 'Infraestrutura',
  'Implantação': 'Tecnologia da Informação',
  'Manutenção': 'Infraestrutura',
  'Obra': 'Infraestrutura',
};

const statusStyle: Record<string, string> = {
  Vigente: "bg-success/10 text-success",
  Vencendo: "bg-warning/10 text-warning",
  Vencido: "bg-destructive/10 text-destructive",
  Encerrado: "bg-muted text-muted-foreground",
  Quitado: "bg-primary/10 text-primary",
  "Em Aberto": "bg-accent/10 text-accent-foreground",
};

function parseCurrency(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[^\d.,]/g, '').replace('.', '').replace(',', '.')) || 0;
}

function formatCurrency(val: number): string {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + months, d);
  // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28)
  if (date.getDate() !== d) {
    date.setDate(0); // Last day of previous month
  }
  return date.toISOString().split('T')[0];
}

// ─── Component ──────────────────────────────────────────────────

export default function Contratos() {
  const { contratos, addContrato, updateContrato, deleteContrato, setores, getSetorNome, addLog, enviarWebhook, addAlerta, appConfig, setAppConfig, parcelas, addParcelas, updateParcela, deleteParcela, getParcelasContrato } = useData();
  const { currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterSetor, setFilterSetor] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // PDF viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerData, setViewerData] = useState<{ pdf?: string; nome?: string; numero: string; objeto?: string; empresa?: string; status?: string; vencimento?: string }>({ numero: '' });

  // Webhook state
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);

  // Parcelas view state
  const [parcelasViewId, setParcelasViewId] = useState<string | null>(null);

  // Form fields
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [objeto, setObjeto] = useState("");
  const [tipo, setTipo] = useState<string>("Serviços de TI");
  const [idSetor, setIdSetor] = useState("");
  const [valor, setValor] = useState("");
  const [statusContrato, setStatusContrato] = useState<string>('Vigente');
  const [dataInicio, setDataInicio] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [vigenciaMeses, setVigenciaMeses] = useState<string>("");
  const [arquivoPdf, setArquivoPdf] = useState<string | undefined>(undefined);
  const [nomeArquivo, setNomeArquivo] = useState<string | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Financial model
  const [modeloCobranca, setModeloCobranca] = useState<ModeloCobranca>('geral');
  const [valorImplantacao, setValorImplantacao] = useState("");
  const [valorManutencaoMensal, setValorManutencaoMensal] = useState("");
  const [qtdPagamentos, setQtdPagamentos] = useState<string>("");
  const [valorPrestacao, setValorPrestacao] = useState("");
  const [multaPercentual, setMultaPercentual] = useState<number>(0);

  // Obra fields
  const [qtdMedicoes, setQtdMedicoes] = useState<string>("");
  const [medicaoAtual, setMedicaoAtual] = useState<string>("");
  const [valorMedicao, setValorMedicao] = useState<string>("");
  const [saldoContrato, setSaldoContrato] = useState<string>("");

  // AI Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiBreakdown, setAiBreakdown] = useState<{
    valorImplantacao?: string;
    valorMensalidade?: string;
    breakdownValor?: string;
    vigenciaMeses?: number;
    vigenciaTexto?: string;
  } | null>(null);
  const [showAddTipo, setShowAddTipo] = useState(false);
  const [novoTipo, setNovoTipo] = useState("");

  // Dynamic contract types
  const tiposContrato = appConfig.tiposContrato?.length ? appConfig.tiposContrato : TIPOS_CONTRATO_DEFAULT;

  const handleAddTipo = () => {
    const nome = novoTipo.trim();
    if (!nome) return;
    if (tiposContrato.includes(nome)) { toast({ title: "Tipo já existe", variant: "destructive" }); return; }
    const updated = [...tiposContrato, nome];
    setAppConfig({ tiposContrato: updated });
    setNovoTipo("");
    setShowAddTipo(false);
    toast({ title: "Tipo adicionado", description: nome });
  };

  // Listener para erros do Supabase
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast({ title: "❌ Erro ao salvar", description: detail, variant: "destructive" });
    };
    window.addEventListener('supabase-error', handler);
    return () => window.removeEventListener('supabase-error', handler);
  }, []);

  useEffect(() => {
    if (dataInicio && vigenciaMeses && parseInt(vigenciaMeses) > 0) {
      const calculated = addMonths(dataInicio, parseInt(vigenciaMeses));
      setDataVencimento(calculated);
    }
  }, [dataInicio, vigenciaMeses]);

  // Auto-sync qtdPagamentos with vigenciaMeses
  useEffect(() => {
    if (vigenciaMeses && parseInt(vigenciaMeses) > 0) {
      setQtdPagamentos(vigenciaMeses);
    }
  }, [vigenciaMeses]);

  // Auto-calculate valor total and valor prestação based on modelo
  useEffect(() => {
    if (modeloCobranca === 'ti') {
      const impl = parseCurrency(valorImplantacao);
      const mensal = parseCurrency(valorManutencaoMensal);
      const meses = parseInt(vigenciaMeses) || 0;
      const total = impl + (mensal * meses);
      if (total > 0) setValor(formatCurrency(total));
      // Valor da prestação = valor mensal (manutenção)
      if (mensal > 0) setValorPrestacao(formatCurrency(mensal));
    } else if (modeloCobranca === 'geral') {
      const qtd = parseInt(qtdPagamentos) || 0;
      const vlr = parseCurrency(valorPrestacao);
      const total = qtd * vlr;
      if (total > 0) setValor(formatCurrency(total));
    }
  }, [modeloCobranca, valorImplantacao, valorManutencaoMensal, vigenciaMeses, qtdPagamentos, valorPrestacao]);

  // Auto-set setor based on tipo
  const handleTipoChange = (newTipo: string) => {
    setTipo(newTipo);
    if (isAdmin) {
      const suggestedSetorName = TIPO_SETOR_MAP[newTipo];
      if (suggestedSetorName) {
        const found = setores.find(s => s.nome === suggestedSetorName);
        if (found && !idSetor) setIdSetor(found.id);
      }
    }
    // Auto-set modelo_cobranca based on tipo
    if (newTipo === 'Serviços de TI' || newTipo === 'Sistema / Software' || newTipo === 'Implantação' || newTipo === 'Manutenção') {
      setModeloCobranca('ti');
    } else {
      setModeloCobranca('geral');
    }
  };

  // Filter by sector for non-admin
  const visibleContracts = isAdmin
    ? contratos
    : contratos.filter(c => c.idSetor === currentUser?.idSetor);

  const filtered = visibleContracts.filter(c => {
    const s = search.toLowerCase();
    const matchesSearch =
      c.numero.toLowerCase().includes(s) ||
      c.empresa.toLowerCase().includes(s) ||
      c.objeto.toLowerCase().includes(s) ||
      getSetorNome(c.idSetor).toLowerCase().includes(s);
    const matchesFilter = !filterSetor || c.idSetor === filterSetor;
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesFilter && matchesStatus;
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNumero(""); setDescricao(""); setEmpresa(""); setObjeto("");
    setTipo("Serviços de TI"); setIdSetor(isAdmin ? "" : (currentUser?.idSetor || ""));
    setValor(""); setStatusContrato('Vigente');
    setDataInicio(""); setDataVencimento(""); setVigenciaMeses("");
    setArquivoPdf(undefined); setNomeArquivo(undefined); setUploadedFile(null);
    setModeloCobranca('geral');
    setValorImplantacao(""); setValorManutencaoMensal("");
    setQtdPagamentos(""); setValorPrestacao("");
    setMultaPercentual(0);
    setQtdMedicoes(""); setMedicaoAtual(""); setValorMedicao(""); setSaldoContrato("");
    setError(null);
    setAiBreakdown(null);
    setAnalysisResult(null);
  };

  const handleNew = () => {
    resetForm();
    setIdSetor(isAdmin ? "" : (currentUser?.idSetor || ""));
    setShowForm(true);
  };

  const handleEdit = (c: typeof contratos[0]) => {
    setEditingId(c.id);
    setNumero(c.numero);
    setDescricao(c.descricao);
    setEmpresa(c.empresa);
    setObjeto(c.objeto);
    setTipo(c.tipo);
    setIdSetor(c.idSetor);
    setValor(c.valor);
    setStatusContrato(c.status);
    setDataInicio(brToIso(c.dataInicio));
    setDataVencimento(brToIso(c.dataVencimento));
    setVigenciaMeses(c.vigenciaMeses != null ? String(c.vigenciaMeses) : "");
    setArquivoPdf(c.arquivoPdf);
    setNomeArquivo(c.nomeArquivo);
    setModeloCobranca(c.modeloCobranca || 'geral');
    setValorImplantacao(c.valorImplantacao || "");
    setValorManutencaoMensal(c.valorManutencaoMensal || "");
    setQtdPagamentos(c.qtdPagamentos != null ? String(c.qtdPagamentos) : "");
    setValorPrestacao(c.valorPrestacao || "");
    setMultaPercentual(c.multaPercentual || 0);
    setQtdMedicoes(c.qtdMedicoes != null ? String(c.qtdMedicoes) : "");
    setMedicaoAtual(c.medicaoAtual != null ? String(c.medicaoAtual) : "");
    setValorMedicao(c.valorMedicao ?? "");
    setSaldoContrato(c.saldoContrato ?? "");
    setShowForm(true);
    setError(null);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isPdf && !isDocx) { setError('Apenas arquivos PDF ou DOCX são permitidos.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Arquivo muito grande. Limite de 200MB.'); return; }

    const dataUri = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setArquivoPdf(dataUri);
    setNomeArquivo(file.name);
    setUploadedFile(file);
    setError(null);

    if (!showForm) { setShowForm(true); setEditingId(null); }

    setAnalysisLoading(true);
    setAnalysisResult(null);

    const checkAutoStatus = (venc: string) => {
      if (!venc) return;
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const [y, m, d] = venc.split('-').map(Number);
      const vencDate = new Date(y, m - 1, d);
      if (vencDate < now) setStatusContrato('Vencido');
      else if (vencDate.getTime() - now.getTime() <= thirtyDays) setStatusContrato('Vencendo');
      else setStatusContrato('Vigente');
    };

    try {
      toast({ title: "🔍 Transcrevendo...", description: `Processando "${file.name}"...` });

      const text = isDocx ? await extractTextFromDocx(file) : await extractTextFromPdf(dataUri, appConfig);

      let autoFilled = false;
      let fields: ReturnType<typeof parseContractFields> = {};
      if (text.length > 20) {
        fields = parseContractFields(text);
        const autoNumero = fields.numero || generateContractNumber(contratos.map(c => c.numero));
        if (!numero) { setNumero(autoNumero); autoFilled = true; }
        if (fields.empresa && !empresa) {
          const autoEmpresa = fields.nomeContrato ? `${fields.empresa} - ${fields.nomeContrato}` : fields.empresa;
          setEmpresa(autoEmpresa);
          autoFilled = true;
        }

        if (!descricao) {
          const localDescr = fields.nomeContrato || fields.objeto;
          if (localDescr) { setDescricao(localDescr); autoFilled = true; }
        }
        if (fields.objeto) { setObjeto(fields.objeto); }
        if (fields.valor) { setValor(fields.valor); autoFilled = true; }
        if (fields.dataInicio) { setDataInicio(fields.dataInicio); autoFilled = true; }
        if (fields.dataVencimento) { setDataVencimento(fields.dataVencimento); checkAutoStatus(fields.dataVencimento); autoFilled = true; }
        if (fields.tipo) { setTipo(fields.tipo); autoFilled = true; }
        if (fields.vigenciaMeses) {
          setVigenciaMeses(String(fields.vigenciaMeses));
          setAiBreakdown(prev => ({ ...prev, vigenciaMeses: fields.vigenciaMeses, vigenciaTexto: `${fields.vigenciaMeses} ${fields.vigenciaMeses === 1 ? 'mês' : 'meses'}` }));
        }
      } else {
        const vm = parseVigenciaMeses(text);
        if (vm) { setVigenciaMeses(String(vm)); setAiBreakdown(prev => ({ ...prev, vigenciaMeses: vm, vigenciaTexto: `${vm} ${vm === 1 ? 'mês' : 'meses'}` })); }
        if (!numero) { setNumero(generateContractNumber(contratos.map(c => c.numero))); autoFilled = true; }
      }

      const analysis = analyzeContract(text);
      const valueAnalysis = analyzeValues(text);
      let allFindings = [...analysis.findings, ...valueAnalysis.alertas];
      let hasAbusive = analysis.hasAbusiveClauses;

      const llmConfigured = !!(appConfig.llmApiKey && appConfig.llmStatus === 'connected');
      const llmResult = await (async () => {
        if (llmConfigured) {
          toast({ title: "🧠 IA Analisando Contrato", description: "Identificando cláusulas, valores e datas..." });
          return analyzeContractWithLlm(appConfig, text);
        }
        toast({ title: "Análise local concluída", description: "Configure a IA em Configurações para extração avançada." });
        return null;
      })();

      if (llmResult) {
        // Preencher empresa: priorizar contratada (quem presta o serviço), depois contratante, depois genérico
        const llmEmpresa = llmResult.empresaContratada || llmResult.empresaContratante || llmResult.empresa;
        if (llmEmpresa) {
          setEmpresa(llmEmpresa);
          autoFilled = true;
          const llmDescr = llmResult.nomeContrato || llmResult.descricaoObjeto;
          if (llmDescr) { setDescricao(llmDescr); autoFilled = true; }
          if (llmResult.descricaoObjeto) { setObjeto(llmResult.descricaoObjeto); }
          if (llmResult.empresa && !empresa) {
            const autoEmpresa = llmResult.nomeContrato ? `${llmResult.empresa} - ${llmResult.nomeContrato}` : llmResult.empresa;
            setEmpresa(autoEmpresa);
            autoFilled = true;
          }

          // REGRA DE LOCAÇÃO: Para Locação de Imóvel, o campo Empresa/Contrato deve ser o CONTRATANTE
          if (llmResult.tipoServico?.toLowerCase().includes('locação') && llmResult.tipoServico?.toLowerCase().includes('imóvel') && llmResult.empresaContratante) {
            const autoEmpresa = llmResult.nomeContrato ? `${llmResult.empresaContratante} - ${llmResult.nomeContrato}` : llmResult.empresaContratante;
            setEmpresa(autoEmpresa);
          }


          if (llmResult.dataInicio) {
            const normalized = llmResult.dataInicio.includes('/') ? brToIso(llmResult.dataInicio) : llmResult.dataInicio;
            setDataInicio(normalized); autoFilled = true;
          }
          if (llmResult.dataVencimento) {
            const normalized = llmResult.dataVencimento.includes('/') ? brToIso(llmResult.dataVencimento) : llmResult.dataVencimento;
            setDataVencimento(normalized); checkAutoStatus(normalized); autoFilled = true;
          }
          if (llmResult.tipoServico) {
            // Map LLM tipo to our enum
            const tipoMap: Record<string, string> = {
              'serviço': 'Serviços de TI', 'serviços': 'Serviços de TI', 'serviços de ti': 'Serviços de TI',
              'software': 'Sistema / Software', 'sistema': 'Sistema / Software',
              'infraestrutura': 'Infraestrutura', 'implantação': 'Implantação',
              'manutenção': 'Manutenção', 'obra': 'Obra',
            };
            const mapped = tipoMap[llmResult.tipoServico.toLowerCase()] ||
              tiposContrato.find(t => t.toLowerCase().includes(llmResult.tipoServico!.toLowerCase())) ||
              llmResult.tipoServico;
            handleTipoChange(mapped); // This also sets setor and modeloCobranca
            autoFilled = true;
          }
          if (llmResult.vigenciaMeses) {
            setVigenciaMeses(String(llmResult.vigenciaMeses));
            // Qtd prestações = meses de vigência
            setQtdPagamentos(String(llmResult.vigenciaMeses));
            autoFilled = true;
          }

          // ── Apply financial values from LLM ──
          if (llmResult.valorImplantacao) {
            setValorImplantacao(llmResult.valorImplantacao);
            autoFilled = true;
          }
          if (llmResult.valorMensalidade) {
            setValorManutencaoMensal(llmResult.valorMensalidade);
            // Valor da prestação = valor mensal recorrente
            setValorPrestacao(llmResult.valorMensalidade);
            setModeloCobranca('ti');
            autoFilled = true;
          }

          // REGRA DE LOCAÇÃO: O valor da prestação é igual ao valor total (da cláusula Do Valor)
          if (llmResult.tipoServico?.toLowerCase().includes('locação') && llmResult.valorTotal) {
            setValorPrestacao(llmResult.valorTotal);
            setValor(llmResult.valorTotal);
            setModeloCobranca('geral');
            autoFilled = true;
          }


          setAiBreakdown({
            valorImplantacao: llmResult.valorImplantacao || undefined,
            valorMensalidade: llmResult.valorMensalidade || undefined,
            breakdownValor: llmResult.breakdownValor || undefined,
            vigenciaMeses: llmResult.vigenciaMeses,
            vigenciaTexto: llmResult.vigenciaMeses ? `${llmResult.vigenciaMeses} ${llmResult.vigenciaMeses === 1 ? 'mês' : 'meses'}` : undefined,
          });

          if (llmResult.multaPercentual) {
            setMultaPercentual(llmResult.multaPercentual);
          }

          if (llmResult.clausulasAbusivas.length > 0) {
            hasAbusive = true;
            llmResult.clausulasAbusivas.forEach(c => {
              const icon = c.severidade === 'alta' ? '🔴' : c.severidade === 'media' ? '⚠️' : '⚡';
              allFindings.push(`${icon} [IA] ${c.descricao}`);
            });
          }
          llmResult.alertas.forEach(a => { allFindings.push(`ℹ️ [IA] ${a}`); });
        }

        let dateFindings: string[] = [];
        if (fields.dataInicio || llmResult?.dataInicio) dateFindings.push(`📅 Data de assinatura identificada`);
        else { dateFindings.push(`⚠️ Data de assinatura NÃO encontrada — preencha manualmente`); addAlerta({ tipo: 'geral', mensagem: `Data de assinatura não encontrada em "${file.name}"`, empresa: empresa || undefined, urgencia: 'alta' }); }
        if (fields.dataVencimento || llmResult?.dataVencimento) dateFindings.push(`📅 Data de vencimento identificada`);
        else dateFindings.push(`❓ Data de vencimento será calculada pela vigência`);
        if (!llmResult?.vigenciaMeses && !fields.vigenciaMeses) { dateFindings.push(`⚠️ Vigência NÃO identificada — preencha manualmente`); addAlerta({ tipo: 'geral', mensagem: `Vigência não encontrada em "${file.name}"`, empresa: empresa || undefined, urgencia: 'media' }); }
        if (!llmResult?.valorTotal && !fields.valor) { dateFindings.push(`⚠️ Valor total NÃO identificado — preencha manualmente`); }

        setAnalysisResult({ hasAbusiveClauses: hasAbusive, missingSignature: analysis.missingSignature, findings: [...allFindings, ...dateFindings], autoFilled });
        toast({ title: "✅ Análise concluída", description: autoFilled ? "Campos preenchidos automaticamente." : "Documento analisado." });

        if (hasAbusive) addAlerta({ tipo: 'clausula_abusiva', mensagem: `Cláusula(s) abusiva(s) em "${file.name}"`, empresa: empresa || undefined, urgencia: 'alta' });
        if (analysis.missingSignature) addAlerta({ tipo: 'geral', mensagem: `Assinatura não identificada em "${file.name}"`, empresa: empresa || undefined, urgencia: 'alta' });

        addLog(currentUser!.id, currentUser!.nome, 'Análise IA executada', `Arquivo: ${file.name}`);
      }
    } catch (err) {
      console.warn('Analysis failed:', err);
      setAnalysisResult({ hasAbusiveClauses: false, missingSignature: false, findings: ['⚡ Não foi possível analisar automaticamente'], autoFilled: false });
    } finally {
      setAnalysisLoading(false);
    }
  }, [showForm, numero, empresa, descricao, valor, dataInicio, dataVencimento, addAlerta, addLog, currentUser, appConfig, contratos]);

  const generateParcelas = (contratoId: string, overrideData?: any) => {
    const activeModelo = overrideData?.modeloCobranca || modeloCobranca;
    const activeDataInicio = overrideData?.dataInicio || dataInicio;
    const activeVigencia = parseInt(overrideData?.vigenciaMeses || vigenciaMeses) || 0;
    const activeValorMensal = parseCurrency(overrideData?.valorManutencaoMensal || valorManutencaoMensal);
    const activeValorImpl = parseCurrency(overrideData?.valorImplantacao || valorImplantacao);
    const activeQtdPag = parseInt(overrideData?.qtdPagamentos || qtdPagamentos) || 0;
    const activeValorPrest = parseCurrency(overrideData?.valorPrestacao || valorPrestacao);
    const activeMultaPerc = overrideData?.multaPercentual || multaPercentual;

    const inicio = activeDataInicio;

    if (activeModelo === 'ti') {
      const qtd = activeVigencia;
      const vlrParcela = activeValorMensal;
      const impl = activeValorImpl;

      const newParcelas: Omit<Parcela, 'id' | 'criadoEm'>[] = [];
      let parcelaNum = 1;

      if (impl > 0) {
        newParcelas.push({
          idContrato: contratoId, numero: parcelaNum, valor: formatCurrency(impl),
          dataVencimento: inicio, status: 'pendente', quitado: false,
          multa: 0, juros: 0
        });
        parcelaNum++;
      }

      for (let i = 0; i < qtd; i++) {
        newParcelas.push({
          idContrato: contratoId, numero: parcelaNum + i,
          valor: formatCurrency(vlrParcela),
          dataVencimento: addMonths(inicio, i + 1),
          status: 'pendente', quitado: false,
          multa: 0, juros: 0
        });
      }
      if (newParcelas.length > 0) addParcelas(newParcelas);
    } else {
      const qtd = activeQtdPag;
      const vlrParcela = activeValorPrest;

      if (qtd > 0 && vlrParcela > 0) {
        const newParcelas: Omit<Parcela, 'id' | 'criadoEm'>[] = [];
        for (let i = 0; i < qtd; i++) {
          newParcelas.push({
            idContrato: contratoId, numero: i + 1,
            valor: formatCurrency(vlrParcela),
            dataVencimento: addMonths(inicio, i + 1),
            status: 'pendente', quitado: false,
            multa: 0, juros: 0
          });
        }
        addParcelas(newParcelas);
      }
    }
  };

  const handleSave = async () => {
    setError(null);
    const missing: string[] = [];
    if (!numero.trim()) missing.push("Nº Contrato");
    if (!descricao.trim()) missing.push("Nome / Descrição");
    if (!empresa.trim()) missing.push("Empresa");
    if (!idSetor) missing.push("Setor");
    if (missing.length > 0) {
      setError(`Preencha os campos obrigatórios: ${missing.join(', ')}`);
      return;
    }

    // Upload file to Supabase Storage if there's a new file
    let finalArquivoPdf = arquivoPdf;
    let finalNomeArquivo = nomeArquivo;

    if (uploadedFile) {
      toast({ title: "📤 Enviando arquivo...", description: "Salvando documento no servidor..." });
      const tempId = editingId || ('ct_' + Date.now().toString(36));
      const result = await uploadContratoFile(uploadedFile, tempId);
      if (result) {
        finalArquivoPdf = result.url;
        finalNomeArquivo = nomeArquivo;
        toast({ title: "✅ Arquivo enviado", description: "Documento salvo com sucesso." });
      } else {
        toast({ title: "❌ Erro no upload", description: "Não foi possível enviar o arquivo. O contrato será salvo sem o documento.", variant: "destructive" });
        finalArquivoPdf = undefined;
      }
    }

    const obraFields = tipo === 'Obra' ? {
      qtdMedicoes: qtdMedicoes ? parseInt(qtdMedicoes, 10) : undefined,
      medicaoAtual: medicaoAtual ? parseInt(medicaoAtual, 10) : undefined,
      valorMedicao: valorMedicao.trim() || undefined,
      saldoContrato: saldoContrato.trim() || undefined,
    } : { qtdMedicoes: undefined, medicaoAtual: undefined, valorMedicao: undefined, saldoContrato: undefined };

    const financialFields = {
      vigenciaMeses: vigenciaMeses ? parseInt(vigenciaMeses) : undefined,
      modeloCobranca: modeloCobranca,
      valorImplantacao: valorImplantacao.trim() || undefined,
      valorManutencaoMensal: valorManutencaoMensal.trim() || undefined,
      qtdPagamentos: qtdPagamentos ? parseInt(qtdPagamentos) : undefined,
      valorPrestacao: valorPrestacao.trim() || undefined,
      multaPercentual: multaPercentual || undefined,
    };

    if (editingId) {
      updateContrato(editingId, {
        numero: numero.trim(), descricao: descricao.trim(), empresa: empresa.trim(),
        objeto: objeto.trim() || descricao.trim(), tipo, idSetor, valor, status: statusContrato as any,
        dataInicio: isoToBr(dataInicio), dataVencimento: isoToBr(dataVencimento),
        arquivoPdf: finalArquivoPdf, nomeArquivo: finalNomeArquivo,
        ...obraFields, ...financialFields,
      });
      addLog(currentUser!.id, currentUser!.nome, 'Contrato editado', `Contrato: ${numero.trim()}`);
    } else {
      // Garantir data de início válida (NOT NULL no banco)
      const dataInicioFinal = dataInicio || new Date().toISOString().split('T')[0];
      const dataVencimentoFinal = dataVencimento || dataInicioFinal;
      const novoContrato = addContrato({
        numero: numero.trim(), descricao: descricao.trim(), empresa: empresa.trim(),
        objeto: objeto.trim() || descricao.trim(), tipo, idSetor, valor, status: statusContrato as any,
        dataInicio: isoToBr(dataInicioFinal), dataVencimento: isoToBr(dataVencimentoFinal),
        criadoPor: currentUser!.id, arquivoPdf: finalArquivoPdf, nomeArquivo: finalNomeArquivo,
        ...obraFields, ...financialFields,
      });
      // Generate parcelas for new contract
      generateParcelas(novoContrato.id);
      addLog(currentUser!.id, currentUser!.nome, 'Contrato criado', `Contrato: ${numero.trim()}`);
    }
    resetForm();
  };

  const handleDelete = (c: typeof contratos[0]) => {
    if (!isAdmin) return;
    if (!confirm(`Deseja excluir o contrato "${c.numero}"?`)) return;
    deleteContrato(c.id, currentUser!.id);
    addLog(currentUser!.id, currentUser!.nome, 'Contrato excluído', `Contrato: ${c.numero}`);
  };

  const handleView = (c: typeof contratos[0]) => {
    setViewerData({ pdf: c.arquivoPdf, nome: c.nomeArquivo, numero: c.numero, objeto: c.objeto, empresa: c.empresa, status: c.status, vencimento: c.dataVencimento });
    setViewerOpen(true);
  };

  const handleDownload = (c: typeof contratos[0]) => {
    if (!c.arquivoPdf) return;
    if (isStorageUrl(c.arquivoPdf)) {
      // Open storage URL in new tab for download
      window.open(c.arquivoPdf, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = c.arquivoPdf;
      link.download = c.nomeArquivo || `${c.numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendToIA = async (c: typeof contratos[0]) => {
    setSendingWebhook(c.id);
    const payload = { contratoId: c.id, numero: c.numero, descricao: c.descricao, empresa: c.empresa, objeto: c.objeto, tipo: c.tipo, valor: c.valor, status: c.status, dataInicio: c.dataInicio, dataVencimento: c.dataVencimento, temPdf: !!c.arquivoPdf };
    const result = await enviarWebhook('gptmaker', payload);
    if (result.ok) {
      addLog(currentUser!.id, currentUser!.nome, 'Contrato enviado para IA', `Contrato: ${c.numero}`);
      addAlerta({ tipo: 'analise_ia', mensagem: `Contrato ${c.numero} enviado para análise da IA`, idContrato: c.id, numeroContrato: c.numero, empresa: c.empresa, urgencia: 'media' });
    } else {
      setError(result.error || 'Erro ao enviar para IA');
    }
    setSendingWebhook(null);
  };

  const handleSyncFinancials = async (c: typeof contratos[0]) => {
    if (!c.arquivoPdf) {
      toast({ title: "Arquivo ausente", description: "O contrato não possui um PDF anexado para análise.", variant: "destructive" });
      return;
    }

    const llmConfigured = !!(appConfig.llmApiKey && appConfig.llmStatus === 'connected');
    if (!llmConfigured) {
      toast({ title: "IA não configurada", description: "Configure a API da IA nas configurações primeiro.", variant: "destructive" });
      return;
    }

    setAnalysisLoading(true);
    setSendingWebhook(c.id);

    try {
      toast({ title: "🔍 Analisando Financeiro...", description: `A IA está processando os termos de "${c.numero}"...` });

      const text = await extractTextFromPdf(c.arquivoPdf, appConfig);
      const llmResult = await analyzeContractWithLlm(appConfig, text);

      if (llmResult) {
        // Build update object
        const updates: any = {};
        if (llmResult.valorTotal) updates.valor = llmResult.valorTotal;
        if (llmResult.vigenciaMeses) updates.vigenciaMeses = llmResult.vigenciaMeses;
        if (llmResult.qtdParcelas) updates.qtdPagamentos = llmResult.qtdParcelas;
        if (llmResult.valorMensalidade) updates.valorPrestacao = llmResult.valorMensalidade;
        if (llmResult.valorImplantacao) updates.valorImplantacao = llmResult.valorImplantacao;
        if (llmResult.multaPercentual) updates.multaPercentual = llmResult.multaPercentual;

        // Determine pricing model if possible
        if (llmResult.valorImplantacao && llmResult.valorMensalidade) {
          updates.modeloCobranca = 'ti';
          updates.valorManutencaoMensal = llmResult.valorMensalidade;
        } else if (llmResult.valorMensalidade) {
          updates.modeloCobranca = 'geral';
          updates.valorPrestacao = llmResult.valorMensalidade;
        }

        // Apply contract data changes
        updateContrato(c.id, updates);

        // Ask to regenerate parcelas if there are none
        const existingParcelas = getParcelasContrato(c.id);
        if (existingParcelas.length === 0) {
          generateParcelas(c.id, {
            ...updates,
            dataInicio: brToIso(c.dataInicio)
          });
          toast({ title: "Financeiro Atualizado", description: "Dados sincronizados e parcelas geradas." });
        } else {
          toast({ title: "Financeiro Atualizado", description: "Dados sincronizados com sucesso." });
        }

        addLog(currentUser!.id, currentUser!.nome, 'Sincronização Financeira IA', `Contrato: ${c.numero}`);
      }
    } catch (err) {
      toast({ title: "Erro na análise", description: "Não foi possível extrair dados do contrato.", variant: "destructive" });
    } finally {
      setAnalysisLoading(false);
      setSendingWebhook(null);
    }
  };

  const handleToggleParcelaStatus = (parcela: Parcela) => {
    const newStatus = parcela.status === 'pendente' ? 'pago' : 'pendente';
    updateParcela(parcela.id, { status: newStatus, quitado: newStatus === 'pago' });
    addLog(currentUser!.id, currentUser!.nome, 'Parcela atualizada', `Parcela ${parcela.numero} → ${newStatus}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Gerencie todos os contratos da instituição" : `Contratos do setor: ${getSetorNome(currentUser?.idSetor || '')}`}
          </p>
        </div>
        <button onClick={handleNew} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow">
          <Plus className="w-4 h-4" /> Novo Contrato
        </button>
      </div>

      {/* Global error */}
      <AnimatePresence>
        {error && !showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            <button onClick={() => setError(null)} className="ml-auto p-1 rounded hover:bg-destructive/10"><X className="w-3 h-3" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border border-border p-6 space-y-4" style={{ boxShadow: "var(--shadow-md)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{editingId ? "Editar Contrato" : "Novo Contrato"}</h3>
              <button onClick={resetForm} className="p-1 rounded hover:bg-secondary transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Basic fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nº Contrato *</label>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FAP-2026-XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Empresa / Nome do Contrato *</label>
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex: Empresa - Nome do Contrato"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  Tipo de Contrato *
                  <button type="button" onClick={() => setShowAddTipo(!showAddTipo)} className="text-primary hover:text-primary/80 text-xs font-normal">
                    {showAddTipo ? '✕ Cancelar' : '+ Novo tipo'}
                  </button>
                </label>
                {showAddTipo && (
                  <div className="flex gap-2 mb-1">
                    <input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Nome do novo tipo"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTipo()} />
                    <button type="button" onClick={handleAddTipo} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90">Adicionar</button>
                  </div>
                )}
                <select value={tipo} onChange={(e) => handleTipoChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                  {tiposContrato.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">Nome / Descrição do Contrato *</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE IMPLANTAÇÃO, MANUTENÇÃO E ATUALIZAÇÃO DE SISTEMA"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring uppercase"
                  style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Setor *</label>
                <select value={idSetor} onChange={(e) => setIdSetor(e.target.value)} disabled={!isAdmin}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60">
                  <option value="">Selecione...</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={statusContrato} onChange={(e) => setStatusContrato(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                  <option>Vigente</option>
                  <option>Vencendo</option>
                  <option>Vencido</option>
                  <option>Encerrado</option>
                  <option>Quitado</option>
                  <option>Em Aberto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data de Assinatura</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vigência (meses)</label>
                <input type="number" min="1" value={vigenciaMeses} onChange={(e) => setVigenciaMeses(e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data de Vencimento {vigenciaMeses && dataInicio ? "(calculada)" : ""}</label>
                <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>

              {/* PDF Upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Arquivo PDF</label>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileUpload} className="hidden" />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:bg-secondary transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Upload PDF/DOCX
                  </button>
                  {nomeArquivo && <span className="text-xs text-success truncate max-w-[160px]" title={nomeArquivo}>✓ {nomeArquivo}</span>}
                </div>
              </div>
            </div>

            {/* ── Financial Model ──────────────────────────── */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Modelo Financeiro {modeloCobranca === 'ti' ? '— Serviços de TI' : '— Geral'}
                </p>
                <span className="ml-auto text-[10px] text-muted-foreground italic">
                  {modeloCobranca === 'ti' ? 'Implantação + Manutenção mensal' : 'Prestações fixas'}
                </span>
              </div>

              {modeloCobranca === 'ti' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor de Implantação</label>
                    <input value={valorImplantacao} onChange={(e) => setValorImplantacao(e.target.value)} placeholder="R$ 0,00 (opcional)"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Manutenção Mensal *</label>
                    <input value={valorManutencaoMensal} onChange={(e) => setValorManutencaoMensal(e.target.value)} placeholder="R$ 0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Qtd. Prestações</label>
                    <input type="number" min="1" value={qtdPagamentos} disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm outline-none cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground">= Vigência em meses</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor da Prestação (calc.)</label>
                    <input value={valorPrestacao} disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm outline-none cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground">Manutenção + (Implant. ÷ meses)</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor Total (calculado)</label>
                    <input value={valor} disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm outline-none font-semibold cursor-not-allowed" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Qtd. Prestações</label>
                    <input type="number" min="1" value={qtdPagamentos} disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm outline-none cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground">= Vigência em meses</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor de Cada Prestação</label>
                    <input value={valorPrestacao} onChange={(e) => setValorPrestacao(e.target.value)} placeholder="R$ 0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor Total (calculado)</label>
                    <input value={valor} disabled
                      className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-sm outline-none font-semibold cursor-not-allowed" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Campos de Obra ──────────────────────────────── */}
            {tipo === 'Obra' && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medições — Contrato de Obra</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Qtd. Medições Previstas</label>
                    <input type="number" min="0" value={qtdMedicoes} onChange={(e) => setQtdMedicoes(e.target.value)} placeholder="Ex: 12"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Medição Atual (Nº)</label>
                    <input type="number" min="0" value={medicaoAtual} onChange={(e) => setMedicaoAtual(e.target.value)} placeholder="Ex: 3"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Valor da Medição</label>
                    <input value={valorMedicao} onChange={(e) => setValorMedicao(e.target.value)} placeholder="R$ 0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Saldo do Contrato</label>
                    <input value={saldoContrato} onChange={(e) => setSaldoContrato(e.target.value)} placeholder="R$ 0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              </div>
            )}

            {/* AI Breakdown Panel */}
            <AnimatePresence>
              {aiBreakdown && (aiBreakdown.breakdownValor || aiBreakdown.vigenciaTexto || aiBreakdown.valorImplantacao || aiBreakdown.valorMensalidade) && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-sm">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Detalhamento identificado pela IA</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(aiBreakdown.valorImplantacao || aiBreakdown.valorMensalidade || aiBreakdown.breakdownValor) && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Composição do Valor</p>
                        {aiBreakdown.valorImplantacao && <p className="text-foreground"><span className="text-muted-foreground">Implantação:</span> <span className="font-medium">{aiBreakdown.valorImplantacao}</span></p>}
                        {aiBreakdown.valorMensalidade && <p className="text-foreground"><span className="text-muted-foreground">Mensalidade:</span> <span className="font-medium">{aiBreakdown.valorMensalidade}</span></p>}
                        {aiBreakdown.breakdownValor && <p className="text-xs text-muted-foreground italic">{aiBreakdown.breakdownValor}</p>}
                      </div>
                    )}
                    {aiBreakdown.vigenciaTexto && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Vigência</p>
                        <p className="text-foreground"><span className="font-medium">{aiBreakdown.vigenciaTexto}</span></p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                {editingId ? "Salvar Alterações" : "Criar Contrato"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nº, empresa ou objeto..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" />
        </div>
        {isAdmin && (
          <select value={filterSetor} onChange={(e) => setFilterSetor(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground">
            <option value="">Todos os setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground">
          <option value="">Todos os status</option>
          <option>Vigente</option>
          <option>Vencendo</option>
          <option>Vencido</option>
          <option>Encerrado</option>
          <option>Quitado</option>
          <option>Em Aberto</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Nº Contrato</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Empresa / Nome do Contrato</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Objeto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Parcelas</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Vencidas</th>
                
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden xl:table-cell">Vencimento</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const contratoParcelas = getParcelasContrato(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${c.arquivoPdf ? 'text-primary' : 'text-muted-foreground'}`} />
                          {c.numero}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-foreground">{c.empresa}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{c.objeto}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{c.tipo}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{getSetorNome(c.idSetor)}</td>
                      <td className="px-5 py-3.5 font-medium text-foreground hidden md:table-cell">{c.valor}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">{contratoParcelas.filter(p => p.status === 'pago').length} / {contratoParcelas.length}</span>
                          <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-success transition-all"
                              style={{ width: `${contratoParcelas.length > 0 ? (contratoParcelas.filter(p => p.status === 'pago').length / contratoParcelas.length * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {(() => {
                          const vencidas = contratoParcelas.filter(p => {
                            if (p.status === 'pago') return false;
                            const venc = p.dataVencimento.includes('-') ? new Date(p.dataVencimento) : brToIso(p.dataVencimento) ? new Date(brToIso(p.dataVencimento)) : null;
                            if (!venc) return false;
                            return venc < new Date();
                          }).length;
                          return vencidas > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/10 text-destructive font-bold text-xs">
                              {vencidas}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>;
                        })()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle[c.status] || ''}`}>{c.status}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden xl:table-cell">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.dataVencimento}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => handleView(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Visualizar">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {c.arquivoPdf && (
                            <button onClick={() => handleDownload(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Baixar PDF">
                              <Download className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          {contratoParcelas.length > 0 && (
                            <button onClick={() => setParcelasViewId(parcelasViewId === c.id ? null : c.id)}
                              className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Ver Parcelas">
                              <CreditCard className={`w-4 h-4 ${parcelasViewId === c.id ? 'text-primary' : 'text-muted-foreground'}`} />
                            </button>
                          )}
                          <button onClick={() => handleEdit(c)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Editar">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Excluir">
                              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                          <button onClick={() => handleSendToIA(c)} disabled={sendingWebhook === c.id}
                            className="p-1.5 rounded-md hover:bg-accent/10 transition-colors disabled:opacity-50" title="Webhook Integrado">
                            {sendingWebhook === c.id ? <Loader2 className="w-4 h-4 text-accent animate-spin" /> : <Send className="w-4 h-4 text-accent" />}
                          </button>
                          <button onClick={() => handleSyncFinancials(c)} disabled={sendingWebhook === c.id}
                            className="p-1.5 rounded-md hover:bg-emerald-500/10 transition-colors disabled:opacity-50" title="Sincronizar Financeiro via IA">
                            <CreditCard className={`w-4 h-4 ${sendingWebhook === c.id ? 'text-muted-foreground animate-pulse' : 'text-emerald-500'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Parcelas expandable row */}
                    {parcelasViewId === c.id && contratoParcelas.length > 0 && (
                      <tr>
                        <td colSpan={9} className="px-5 py-3 bg-muted/10">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Parcelas ({contratoParcelas.filter(p => p.status === 'pago').length}/{contratoParcelas.length} pagas)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {contratoParcelas.map(p => (
                                <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${p.status === 'pago' ? 'bg-success/5 border-success/20' : 'bg-card border-border'}`}>
                                  <div>
                                    <span className="font-medium">#{p.numero}</span>
                                    <span className="text-muted-foreground ml-2">{p.valor}</span>
                                    <span className="text-muted-foreground ml-2">{p.dataVencimento}</span>
                                  </div>
                                  <button onClick={() => handleToggleParcelaStatus(p)}
                                    className={`p-1 rounded transition-colors ${p.status === 'pago' ? 'text-success hover:bg-success/10' : 'text-muted-foreground hover:bg-secondary'}`}
                                    title={p.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}>
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum contrato encontrado.</div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      <ContratoViewer open={viewerOpen} onClose={() => setViewerOpen(false)} arquivoPdf={viewerData.pdf} nomeArquivo={viewerData.nome}
        numeroContrato={viewerData.numero} objeto={viewerData.objeto} empresa={viewerData.empresa} status={viewerData.status} vencimento={viewerData.vencimento} />

      {/* AI Analysis Alert */}
      <AnalysisAlert result={analysisResult} loading={analysisLoading} onClose={() => { setAnalysisResult(null); setAnalysisLoading(false); }} />
    </motion.div>
  );
}
