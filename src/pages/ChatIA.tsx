import { useState, useRef, useCallback } from "react";
import type { AppConfig } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FileText, Send, Upload, Loader2, Bot, User as UserIcon, Wand2,
  Download, Printer, Save, AlertTriangle, CheckCircle, Info,
  Settings, X, ChevronDown, ChevronUp, Building2, Calendar, DollarSign,
  Tag, ClipboardList,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import {
  extractTextFromFile, parseContractFields, analyzeContract,
  analyzeValues, generateContractNumber,
} from "../utils/pdfAnalyzer";
import { callLlmApi, analyzeContractWithLlm, type LlmContractAnalysis } from "../utils/llmService";
import { downloadAsPdf, downloadAsDocx } from "../utils/documentExport";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface LocalAnalysis {
  fields: ReturnType<typeof parseContractFields>;
  findings: string[];
  hasAbusiveClauses: boolean;
  missingSignature: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatIsoDateBr(iso?: string): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

const SEVERITY_STYLE: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/20",
  media: "bg-warning/10 text-warning border-warning/20",
  baixa: "bg-success/10 text-success border-success/20",
};

const SEVERITY_LABEL: Record<string, string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};

// ─── Build system prompt merging training from settings ────────
function buildChatSystemPrompt(config: AppConfig): string {
  let prompt = `Você é um assistente jurídico especializado em análise de contratos brasileiros.
Quando o usuário enviar um contrato para análise, identifique:
- Cláusulas abusivas (multas excessivas, renúncia de direitos, rescisão unilateral, etc.)
- Assinaturas ausentes ou campos em branco
- Vulnerabilidades jurídicas (falta de foro, LGPD, confidencialidade, etc.)
- Valor contratual
- Nome das partes (contratante e contratada)
- Data de início e fim do contrato
- Objeto do contrato
- Alertas e observações importantes
Seja detalhado e use linguagem jurídica formal em português do Brasil.
Quando o usuário pedir para gerar um contrato, gere o texto completo com cláusulas profissionais.`;

  // Merge custom training from Configurações
  if (config.llmCustomPrompt) {
    prompt += `\n\nINSTRUÇÕES DE TREINAMENTO PERSONALIZADO:\n${config.llmCustomPrompt}`;
  }
  if (config.llmKnowledgeBase) {
    prompt += `\n\nBASE DE CONHECIMENTO:\n${config.llmKnowledgeBase}`;
  }
  if (config.llmTone) {
    prompt += `\n\nTOM DE VOZ: ${config.llmTone}`;
  }
  if (config.llmSpecialization) {
    prompt += `\n\nESPECIALIZAÇÃO: ${config.llmSpecialization}`;
  }
  if (config.llmExamples && config.llmExamples.length > 0) {
    prompt += `\n\nEXEMPLOS DE COMPORTAMENTO:\n`;
    config.llmExamples.forEach((ex, i) => {
      prompt += `Exemplo ${i + 1}:\nUsuário: ${ex.user}\nAssistente: ${ex.assistant}\n\n`;
    });
  }
  return prompt;
}

// ─── Component ───────────────────────────────────────────────────

export default function ChatIA() {
  const { contratos, addContrato, modelos, addLog, setores, appConfig } = useData();
  const { currentUser } = useAuth();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [llmAnalysis, setLlmAnalysis] = useState<LlmContractAnalysis | null>(null);
  const [localAnalysis, setLocalAnalysis] = useState<LocalAnalysis | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [generatedContract, setGeneratedContract] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [contractTranscript, setContractTranscript] = useState<string | null>(null);

  // Derived
  const llmConnected = appConfig.llmStatus === 'connected' && !!appConfig.llmApiKey;
  const providerLabel = appConfig.llmProvider?.toUpperCase() ?? '';
  const hasTraining = !!(appConfig.llmCustomPrompt || appConfig.llmKnowledgeBase || appConfig.llmTone || appConfig.llmSpecialization || (appConfig.llmExamples && appConfig.llmExamples.length > 0));

  // ── Local fallback ──
  function generateLocalResponse(userMsg: string): string {
    const msg = userMsg.toLowerCase();
    const typeMap: Record<string, string> = {
      'serviço': 'Serviço', 'prestação de serviço': 'Serviço',
      'fornecimento': 'Fornecimento', 'material': 'Fornecimento',
      'obra': 'Obra', 'construção': 'Obra', 'reforma': 'Obra',
      'locação': 'Locação', 'aluguel': 'Locação',
      'consultoria': 'Consultoria', 'assessoria': 'Consultoria',
    };
    let detectedType = '';
    for (const [kw, tipo] of Object.entries(typeMap)) {
      if (msg.includes(kw)) { detectedType = tipo; break; }
    }
    if (detectedType) {
      return `🔍 Identifiquei que você precisa de um contrato do tipo **${detectedType}**.\n\n` +
        `💡 Configure uma LLM em **Configurações** para análise completa.\n\n` +
        `📚 Modelos disponíveis: ${modelos.map(m => m.tipo).join(', ') || 'Nenhum'}`;
    }
    return `🤖 Posso ajudar com análise de contratos!\n\n` +
      `• Faça **upload de um PDF/DOCX** para análise automática\n` +
      `• "Analisar cláusulas abusivas do meu contrato"\n` +
      `• "Gerar contrato de fornecimento de materiais"\n\n` +
      `💡 Para respostas mais completas, configure uma LLM em **Configurações**.`;
  }

  // ── Send chat message ──
  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const apiMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const llmResponse = await callLlmApi(appConfig, apiMessages, buildChatSystemPrompt(appConfig));

      let response: string;
      if (llmResponse) {
        response = llmResponse;
        if (currentUser) addLog(currentUser.id, currentUser.nome, "Chat IA (LLM)", `${providerLabel}: ${userMsg.content.substring(0, 60)}`);
      } else {
        await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
        response = generateLocalResponse(userMsg.content);
        if (currentUser) addLog(currentUser.id, currentUser.nome, "Chat IA (local)", userMsg.content.substring(0, 60));
      }

      const assistantMsg: ChatMessage = { role: "assistant", content: response, timestamp: new Date().toISOString() };
      setChatMessages(prev => [...prev, assistantMsg]);

      // Detect generated contract in response
      const contractMatch = response.match(/---\n\n([\s\S]+?)\n\n---/);
      if (contractMatch) {
        setGeneratedContract(contractMatch[1]);
      } else if (response.length > 200 && (response.includes('CLÁUSULA') || response.includes('CONTRAT'))) {
        setGeneratedContract(response);
      }

      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ Erro ao processar a solicitação. Tente novamente.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, modelos, addLog, currentUser, appConfig, providerLabel]);

  // ── Upload & Analyze ──
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');
    if (!isPdf && !isDocx) return;

    setAnalysisLoading(true);
    setLlmAnalysis(null);
    setLocalAnalysis(null);
    setGeneratedContract(null);
    setUploadedFileName(file.name);
    setContractTranscript(null);

    try {
      toast({ title: "🔍 Processando documento", description: file.name });
      const text = await extractTextFromFile(file, appConfig);

      if (!text || text.trim().length < 10) {
        toast({ title: "⚠️ Texto não extraído", description: "Não foi possível ler o conteúdo do arquivo.", variant: "destructive" });
        return;
      }

      setContractTranscript(text.trim());

      const fields = parseContractFields(text);
      const analysis = analyzeContract(text);
      const valueAnalysis = analyzeValues(text);
      const allFindings = [...analysis.findings, ...valueAnalysis.alertas];

      setLocalAnalysis({
        fields,
        findings: allFindings,
        hasAbusiveClauses: analysis.hasAbusiveClauses,
        missingSignature: analysis.missingSignature,
      });

      // Show user message in chat
      setChatMessages(prev => [...prev, {
        role: "user",
        content: `📎 Upload: ${file.name}`,
        timestamp: new Date().toISOString(),
      }]);

      // Try LLM analysis
      let llmResult: LlmContractAnalysis | null = null;
      if (llmConnected) {
        toast({ title: `🧠 Analisando com ${providerLabel}`, description: "Extraindo cláusulas, riscos e dados estruturados..." });
        llmResult = await analyzeContractWithLlm(appConfig, text);
        if (llmResult) setLlmAnalysis(llmResult);
      }

      // Build short chat assistant message
      const sourceBadge = llmResult ? `🧠 ${providerLabel}` : '🔵 Análise local';
      const empresa = llmResult?.empresa || fields.empresa || '—';
      const valor = llmResult?.valorTotal || fields.valor || '—';
      const tipo = llmResult?.tipoServico || fields.tipo || '—';
      const abusivas = llmResult
        ? llmResult.clausulasAbusivas.length
        : (analysis.hasAbusiveClauses ? allFindings.length : 0);

      const shortSummary =
        `**[${sourceBadge}] Análise concluída — ${file.name}**\n\n` +
        `• Empresa: ${empresa}\n` +
        `• Tipo: ${tipo}\n` +
        `• Valor: ${valor}\n` +
        (abusivas > 0
          ? `• ⚠️ ${abusivas} cláusula(s) abusiva(s) detectada(s)\n`
          : `• ✅ Nenhuma cláusula abusiva detectada\n`) +
        `\n📋 Veja a análise completa no painel direito.`;

      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: shortSummary,
        timestamp: new Date().toISOString(),
      }]);

      const source = llmResult ? `IA (${providerLabel})` : 'análise local';
      if (currentUser) addLog(currentUser.id, currentUser.nome, "Contrato analisado via Chat IA", `${file.name} via ${source}`);

      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      console.warn(err);
      toast({ title: "❌ Erro na análise", description: "Ocorreu um erro ao processar o documento.", variant: "destructive" });
    } finally {
      setAnalysisLoading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }, [appConfig, llmConnected, providerLabel, currentUser, addLog]);

  // ── Save generated contract ──
  const handleSaveContract = () => {
    if (!generatedContract) return;
    const numero = generateContractNumber(contratos.map(c => c.numero));
    addContrato({
      numero, descricao: "Contrato gerado via IA", empresa: "[Preencher]",
      objeto: "Gerado automaticamente", tipo: "Serviço",
      idSetor: setores[0]?.id || "", valor: "", status: "Vigente",
      dataInicio: new Date().toLocaleDateString("pt-BR"), dataVencimento: "",
      criadoPor: currentUser?.id || 'sistema',
    });
    if (currentUser) addLog(currentUser.id, currentUser.nome, "Contrato salvo via Chat IA", `Nº: ${numero}`);
    toast({ title: "✅ Contrato salvo", description: `${numero} salvo. Edite na página Contratos.` });
    setGeneratedContract(null);
  };

  // ── Download helpers ──
  const handleDownloadAnalysis = (format: 'pdf' | 'docx') => {
    const content = buildExportText();
    if (!content) return;
    const name = `analise_${(uploadedFileName ?? 'contrato').replace(/\.[^.]+$/, '')}_${Date.now()}`;
    if (format === 'pdf') downloadAsPdf(content, name);
    else downloadAsDocx(content, name);
  };

  const handlePrintAnalysis = () => {
    const content = buildExportText();
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Análise de Contrato</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;line-height:1.6;color:#1a1a1a;max-width:800px;margin:0 auto;}
      h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px;}
      pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:13px;}
      @media print{body{padding:20px;}}</style></head><body>
      <h1>📄 Análise de Contrato — ${new Date().toLocaleDateString('pt-BR')}</h1>
      <pre>${content}</pre></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  function buildExportText(): string | null {
    if (generatedContract) return generatedContract;
    if (!llmAnalysis && !localAnalysis) return null;
    const lines: string[] = [`ANÁLISE DE CONTRATO\nArquivo: ${uploadedFileName ?? '—'}\nData: ${new Date().toLocaleDateString('pt-BR')}\n`];
    if (llmAnalysis) {
      if (llmAnalysis.nomeContrato) lines.push(`Nome: ${llmAnalysis.nomeContrato}`);
      if (llmAnalysis.empresa) lines.push(`Empresa: ${llmAnalysis.empresa}`);
      if (llmAnalysis.tipoServico) lines.push(`Tipo: ${llmAnalysis.tipoServico}`);
      if (llmAnalysis.valorTotal) lines.push(`Valor Total: ${llmAnalysis.valorTotal}`);
      if (llmAnalysis.breakdownValor) lines.push(`Detalhes: ${llmAnalysis.breakdownValor}`);
      if (llmAnalysis.dataInicio) lines.push(`Data Início: ${formatIsoDateBr(llmAnalysis.dataInicio)}`);
      if (llmAnalysis.dataVencimento) lines.push(`Data Vencimento: ${formatIsoDateBr(llmAnalysis.dataVencimento)}`);
      if (llmAnalysis.descricaoObjeto) lines.push(`\nObjeto: ${llmAnalysis.descricaoObjeto}`);
      if (llmAnalysis.clausulasAbusivas.length > 0) {
        lines.push(`\nCLÁUSULAS ABUSIVAS (${llmAnalysis.clausulasAbusivas.length}):`);
        llmAnalysis.clausulasAbusivas.forEach(c => lines.push(`[${c.severidade.toUpperCase()}] ${c.descricao}`));
      }
      if (llmAnalysis.assinaturasAusentes.length > 0) {
        lines.push(`\nASSINATURAS AUSENTES (${llmAnalysis.assinaturasAusentes.length}):`);
        llmAnalysis.assinaturasAusentes.forEach(a => lines.push(`• ${a}`));
      }
      if (llmAnalysis.vulnerabilidades.length > 0) {
        lines.push(`\nVULNERABILIDADES (${llmAnalysis.vulnerabilidades.length}):`);
        llmAnalysis.vulnerabilidades.forEach(v => lines.push(`• ${v}`));
      }
      if (llmAnalysis.alertas.length > 0) {
        lines.push(`\nOBSERVAÇÕES:`);
        llmAnalysis.alertas.forEach(a => lines.push(`• ${a}`));
      }
    } else if (localAnalysis) {
      const f = localAnalysis.fields;
      if (f.empresa) lines.push(`Empresa: ${f.empresa}`);
      if (f.tipo) lines.push(`Tipo: ${f.tipo}`);
      if (f.valor) lines.push(`Valor: ${f.valor}`);
      if (localAnalysis.findings.length > 0) {
        lines.push(`\nACHADOS (análise local):`);
        localAnalysis.findings.forEach(x => lines.push(`• ${x}`));
      }
    }
    return lines.join('\n');
  }

  // ── Render helpers ──
  function renderMarkdown(text: string) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  }

  const hasAnalysis = !!(llmAnalysis || localAnalysis);
  const exportable = hasAnalysis || !!generatedContract;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Assistente Jurídico IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Faça upload de contratos para transcrição e análise inteligente de cláusulas, valores e riscos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {llmConnected ? (
            <>
              <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">
                🟢 {providerLabel} — {appConfig.llmModel ?? 'modelo padrão'}
              </span>
              {hasTraining && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  🎓 Treinamento ativo
                </span>
              )}
            </>
          ) : (
            <Link
              to="/configuracoes"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning font-medium hover:bg-warning/20 transition-colors"
            >
              <Settings className="w-3 h-3" /> Configurar LLM
            </Link>
          )}
        </div>
      </div>

      {/* LLM not configured banner */}
      {!llmConnected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-3.5 rounded-lg bg-warning/8 border border-warning/20 text-sm"
        >
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">LLM não configurada</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A análise local está ativa, mas para extração estruturada de cláusulas abusivas, valores e datas configure uma LLM em{" "}
              <Link to="/configuracoes" className="underline text-primary hover:opacity-80">Configurações → Integração LLM</Link>.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: "72vh" }}>

        {/* ── Left: Chat ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>

          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Chat Jurídico</h3>
                <p className="text-[10px] text-muted-foreground">Perguntas, geração e análise via chat</p>
              </div>
            </div>
            <input ref={uploadRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={analysisLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {analysisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {analysisLoading ? "Analisando..." : "Upload PDF/DOCX"}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(72vh - 120px)" }}>
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Análise Inteligente de Contratos</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Faça upload de um PDF/DOCX para transcrição e análise automática,
                    ou faça uma pergunta jurídica.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 max-w-lg justify-center">
                  {[
                    "Quais cláusulas abusivas existem?",
                    "Gerar contrato de prestação de serviços",
                    "Quais são os riscos deste contrato?",
                  ].map((s) => (
                    <button key={s} onClick={() => setChatInput(s)}
                      className="px-3 py-1.5 rounded-full border border-border text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground border border-border/50"
                }`}>
                  <div className="whitespace-pre-wrap break-words">{renderMarkdown(msg.content)}</div>
                  <p className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {(chatLoading || analysisLoading) && (
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {analysisLoading ? "Transcrevendo e analisando contrato..." : "Processando..."}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <button onClick={() => uploadRef.current?.click()} disabled={analysisLoading}
                className="p-2 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40" title="Upload PDF/DOCX">
                <Upload className="w-4 h-4 text-muted-foreground" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Pergunte sobre contratos ou faça upload para análise..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading || analysisLoading}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Analysis Panel ────────────────────────────────── */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>

          {/* Panel Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {generatedContract ? '📄 Contrato Gerado' : '📋 Análise do Contrato'}
            </h3>
            {exportable && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {generatedContract && (
                  <button onClick={handleSaveContract}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                    <Save className="w-3 h-3" /> Salvar
                  </button>
                )}
                <button onClick={() => handleDownloadAnalysis('pdf')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button onClick={() => handleDownloadAnalysis('docx')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Download className="w-3 h-3" /> DOCX
                </button>
                <button onClick={handlePrintAnalysis}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                  <Printer className="w-3 h-3" /> Imprimir
                </button>
              </div>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Generated contract (plain text) */}
            {generatedContract && (
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {renderMarkdown(generatedContract)}
              </div>
            )}

            {/* Loading */}
            {!generatedContract && analysisLoading && (
              <div className="flex flex-col items-center justify-center h-full py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground text-center">
                  Transcrevendo documento e analisando<br />cláusulas com {llmConnected ? providerLabel : 'análise local'}...
                </p>
              </div>
            )}

            {/* Empty state */}
            {!generatedContract && !analysisLoading && !hasAnalysis && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum contrato analisado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Faça upload de um PDF ou DOCX no chat para ver a análise estruturada aqui.
                  </p>
                </div>
                <button
                  onClick={() => uploadRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary transition-colors mt-2"
                >
                  <Upload className="w-3.5 h-3.5" /> Carregar contrato
                </button>
              </div>
            )}

            {/* ── Structured LLM Analysis ── */}
            {!generatedContract && !analysisLoading && (llmAnalysis || localAnalysis) && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* Source badge + filename */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {uploadedFileName && (
                      <span className="text-xs font-medium text-foreground truncate max-w-[200px]" title={uploadedFileName}>
                        📎 {uploadedFileName}
                      </span>
                    )}
                    {llmAnalysis ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        🧠 {providerLabel}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        🔵 Análise local
                      </span>
                    )}
                  </div>

                  {/* Contract name */}
                  {llmAnalysis?.nomeContrato && (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Nome do Contrato</p>
                      <p className="text-sm font-medium text-foreground leading-snug">{llmAnalysis.nomeContrato}</p>
                    </div>
                  )}

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        icon: <Building2 className="w-3.5 h-3.5" />,
                        label: "Empresa",
                        value: llmAnalysis?.empresa || localAnalysis?.fields.empresa,
                      },
                      {
                        icon: <Tag className="w-3.5 h-3.5" />,
                        label: "Tipo",
                        value: llmAnalysis?.tipoServico || localAnalysis?.fields.tipo,
                      },
                      {
                        icon: <DollarSign className="w-3.5 h-3.5" />,
                        label: "Valor Total",
                        value: llmAnalysis?.valorTotal || localAnalysis?.fields.valor,
                      },
                      {
                        icon: <Calendar className="w-3.5 h-3.5" />,
                        label: "Início",
                        value: llmAnalysis?.dataInicio
                          ? formatIsoDateBr(llmAnalysis.dataInicio)
                          : localAnalysis?.fields.dataInicio,
                      },
                      {
                        icon: <Calendar className="w-3.5 h-3.5" />,
                        label: "Vencimento",
                        value: llmAnalysis?.dataVencimento
                          ? formatIsoDateBr(llmAnalysis.dataVencimento)
                          : localAnalysis?.fields.dataVencimento,
                      },
                      {
                        icon: <ClipboardList className="w-3.5 h-3.5" />,
                        label: "Vigência",
                        value: llmAnalysis?.vigenciaMeses ? `${llmAnalysis.vigenciaMeses} meses` : undefined,
                      },
                    ].filter(item => item.value).map(({ icon, label, value }) => (
                      <div key={label} className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-muted-foreground">{icon}</span>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                        </div>
                        <p className="text-sm text-foreground font-medium leading-tight truncate" title={value}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Breakdown valor */}
                  {llmAnalysis?.breakdownValor && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Composição do valor: </span>
                      {llmAnalysis.breakdownValor}
                    </div>
                  )}

                  {/* Objeto */}
                  {(llmAnalysis?.descricaoObjeto || localAnalysis?.fields.objeto) && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Objeto</p>
                      <p className="text-xs text-foreground leading-relaxed">
                        {llmAnalysis?.descricaoObjeto || localAnalysis?.fields.objeto}
                      </p>
                    </div>
                  )}

                  {/* Cláusulas abusivas — LLM */}
                  {llmAnalysis && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Cláusulas Abusivas
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          llmAnalysis.clausulasAbusivas.length > 0
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-success/10 text-success'
                        }`}>
                          {llmAnalysis.clausulasAbusivas.length > 0
                            ? `${llmAnalysis.clausulasAbusivas.length} encontrada(s)`
                            : 'Nenhuma'}
                        </span>
                      </div>
                      {llmAnalysis.clausulasAbusivas.length > 0 ? (
                        llmAnalysis.clausulasAbusivas.map((c, i) => (
                          <div key={i} className={`p-2.5 rounded-lg border text-xs ${SEVERITY_STYLE[c.severidade] || SEVERITY_STYLE.baixa}`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              <span className="font-semibold text-[10px] uppercase">
                                {SEVERITY_LABEL[c.severidade] ?? c.severidade}
                              </span>
                            </div>
                            <p className="leading-relaxed">{c.descricao}</p>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/8 border border-success/20 text-xs text-success">
                          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          Nenhuma cláusula abusiva detectada pela IA.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assinaturas Ausentes — LLM */}
                  {llmAnalysis && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Assinaturas Ausentes
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          llmAnalysis.assinaturasAusentes.length > 0
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-success/10 text-success'
                        }`}>
                          {llmAnalysis.assinaturasAusentes.length > 0
                            ? `${llmAnalysis.assinaturasAusentes.length} problema(s)`
                            : 'Completas'}
                        </span>
                      </div>
                      {llmAnalysis.assinaturasAusentes.length > 0 ? (
                        llmAnalysis.assinaturasAusentes.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/8 border border-destructive/20 text-xs text-destructive">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{a}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/8 border border-success/20 text-xs text-success">
                          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          Todas as assinaturas estão presentes.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vulnerabilidades — LLM */}
                  {llmAnalysis && llmAnalysis.vulnerabilidades.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Vulnerabilidades Jurídicas
                        </p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-warning/10 text-warning">
                          {llmAnalysis.vulnerabilidades.length} encontrada(s)
                        </span>
                      </div>
                      {llmAnalysis.vulnerabilidades.map((v, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/8 border border-warning/20 text-xs text-warning">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Findings — local analysis (when no LLM) */}
                  {!llmAnalysis && localAnalysis && localAnalysis.findings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Achados (análise local)
                      </p>
                      {localAnalysis.findings.map((f, i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-warning/20 bg-warning/8 text-xs text-warning leading-relaxed">
                          {f}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Missing signature warning — local */}
                  {!llmAnalysis && localAnalysis?.missingSignature && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/8 border border-destructive/20 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Assinatura pode estar ausente no documento.
                    </div>
                  )}
                  {/* Alertas / Observações — LLM */}
                  {llmAnalysis && llmAnalysis.alertas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
                      {llmAnalysis.alertas.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground">
                          <Info className="w-3.5 h-3.5 flex-shrink-0 text-primary mt-0.5" />
                          <span className="leading-relaxed">{a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Transcript toggle */}
                  {contractTranscript && (
                    <div className="border border-border/50 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowTranscript(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                      >
                        <span>📄 Transcrição do documento</span>
                        {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {showTranscript && (
                        <div className="px-3 pb-3 max-h-48 overflow-y-auto">
                          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono">
                            {contractTranscript}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
