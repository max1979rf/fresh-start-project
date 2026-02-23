import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText, Search, Copy, Download, Wand2, CheckCircle2, Eye, X,
    Plus, Pencil, Trash2, Save, Send, Upload, MessageSquare, BookOpen,
    Loader2, Sparkles, Bot, User as UserIcon
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import type { ModeloContrato } from "../types";
import { extractTextFromFile, parseContractFields, analyzeContract, analyzeValues, generateContractNumber, detectTypeFromText } from "../utils/pdfAnalyzer";
import { callLlmApi, analyzeContractWithLlm } from "../utils/llmService";
import { downloadAsPdf, downloadAsDocx } from "../utils/documentExport";
import AnalysisAlert, { type AnalysisResult } from "../components/AnalysisAlert";
import { toast } from "@/hooks/use-toast";
import { brToIso, isoToBr } from "../utils/dateUtils";

// Chat system prompt for contract generation
const CHAT_SYSTEM_PROMPT = `Você é um assistente jurídico especializado em geração e análise de contratos brasileiros. Quando o usuário pedir para gerar um contrato, gere o texto completo do contrato com cláusulas, usando formatação profissional. Inclua campos como número do contrato, partes, objeto, valor, prazo, obrigações, penalidades, foro. Use linguagem jurídica formal em português do Brasil. Quando o usuário enviar um contrato para análise, identifique cláusulas abusivas, dados faltantes e sugira melhorias.`;

// ---- Built-in seed templates (used to initialize if no modelos exist) ----
const SEED_TEMPLATES: Omit<ModeloContrato, "id" | "criadoEm">[] = [
    {
        nome: "Contrato de Prestação de Serviços",
        tipo: "Serviço",
        descricao: "Modelo padrão para contratação de serviços terceirizados.",
        tags: ["serviço", "terceirização", "SLA"],
        criadoPor: "sistema",
        conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº {{NUMERO}}

CONTRATANTE: Fundação Assistencial da Paraíba – FAP, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº XX.XXX.XXX/XXXX-XX, com sede na cidade de João Pessoa/PB.

CONTRATADA: {{EMPRESA}}, inscrita no CNPJ sob o nº {{CNPJ}}, com sede em {{ENDERECO}}.

CLÁUSULA PRIMEIRA – DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{OBJETO}}, conforme especificações constantes no Termo de Referência.

CLÁUSULA SEGUNDA – DO VALOR
O valor total do presente contrato é de {{VALOR}}, a ser pago em parcelas mensais.

CLÁUSULA TERCEIRA – DO PRAZO
O prazo de vigência do contrato será de {{PRAZO}} meses, com início em {{DATA_INICIO}} e término em {{DATA_FIM}}.

CLÁUSULA QUARTA – DAS OBRIGAÇÕES DA CONTRATADA
a) Executar os serviços conforme especificações técnicas;
b) Manter quadro de pessoal qualificado;
c) Cumprir os prazos estabelecidos;
d) Apresentar relatórios mensais de execução.

CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE
a) Efetuar os pagamentos nas datas acordadas;
b) Fornecer as condições necessárias para execução dos serviços;
c) Designar fiscal para acompanhamento do contrato.

CLÁUSULA SEXTA – DAS PENALIDADES
O descumprimento das cláusulas contratuais acarretará multa de 2% sobre o valor total do contrato.

CLÁUSULA SÉTIMA – DA RESCISÃO
O contrato poderá ser rescindido por acordo entre as partes, com aviso prévio de 30 dias.

CLÁUSULA OITAVA – DO FORO
Fica eleito o foro da comarca de João Pessoa/PB.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
CONTRATANTE

_________________________________
CONTRATADA

_________________________________
TESTEMUNHA 1

_________________________________
TESTEMUNHA 2`,
    },
    {
        nome: "Contrato de Fornecimento de Materiais",
        tipo: "Fornecimento",
        descricao: "Modelo para aquisição de materiais e insumos.",
        tags: ["fornecimento", "materiais", "compra"],
        criadoPor: "sistema",
        conteudo: `CONTRATO DE FORNECIMENTO DE MATERIAIS Nº {{NUMERO}}

CONTRATANTE: Fundação Assistencial da Paraíba – FAP, inscrita no CNPJ sob o nº XX.XXX.XXX/XXXX-XX.

CONTRATADA: {{EMPRESA}}, inscrita no CNPJ sob o nº {{CNPJ}}.

CLÁUSULA PRIMEIRA – DO OBJETO
Fornecimento de {{OBJETO}}, conforme quantitativos e especificações do Termo de Referência.

CLÁUSULA SEGUNDA – DO VALOR E PAGAMENTO
Valor total: {{VALOR}}. Pagamento em até 30 dias após entrega e aceite.

CLÁUSULA TERCEIRA – DO PRAZO DE ENTREGA
Entrega em até {{PRAZO}} dias úteis, a contar da emissão da Ordem de Fornecimento.

CLÁUSULA QUARTA – DA GARANTIA
Garantia de {{GARANTIA}} meses a contar da entrega.

CLÁUSULA QUINTA – DA SUBSTITUIÇÃO
Materiais com defeito devem ser substituídos em até 5 dias úteis.

CLÁUSULA SEXTA – DAS PENALIDADES
Atraso na entrega: multa de 0,5% por dia, limitada a 10% do valor total.

CLÁUSULA SÉTIMA – DO FORO
Foro da comarca de João Pessoa/PB.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
CONTRATANTE

_________________________________
CONTRATADA`,
    },
    {
        nome: "Contrato de Execução de Obra",
        tipo: "Obra",
        descricao: "Modelo para contratação de obras civis e reformas.",
        tags: ["obra", "construção", "reforma"],
        criadoPor: "sistema",
        conteudo: `CONTRATO DE EXECUÇÃO DE OBRA Nº {{NUMERO}}

CONTRATANTE: Fundação Assistencial da Paraíba – FAP.
CONTRATADA: {{EMPRESA}}, CNPJ: {{CNPJ}}.

CLÁUSULA PRIMEIRA – DO OBJETO
Execução de obra de {{OBJETO}}, conforme projeto básico e executivo aprovados.

CLÁUSULA SEGUNDA – DO VALOR
Valor global: {{VALOR}}. Pagamento conforme cronograma físico-financeiro.

CLÁUSULA TERCEIRA – DO PRAZO
Prazo de execução: {{PRAZO}} meses. Início: {{DATA_INICIO}}. Conclusão: {{DATA_FIM}}.

CLÁUSULA QUARTA – DAS MEDIÇÕES
Medições mensais para faturamento, sujeitas à aprovação da fiscalização.

CLÁUSULA QUINTA – DO RECEBIMENTO
a) Provisório: até 15 dias após conclusão;
b) Definitivo: até 90 dias após recebimento provisório.

CLÁUSULA SEXTA – DA GARANTIA
Garantia de 5 anos sobre vícios construtivos.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
CONTRATANTE

_________________________________
CONTRATADA`,
    },
    {
        nome: "Contrato de Locação de Imóvel",
        tipo: "Locação",
        descricao: "Modelo para locação de espaços e imóveis.",
        tags: ["locação", "aluguel", "imóvel"],
        criadoPor: "sistema",
        conteudo: `CONTRATO DE LOCAÇÃO Nº {{NUMERO}}

LOCADOR(A): {{EMPRESA}}, CPF/CNPJ: {{CNPJ}}.
LOCATÁRIO(A): Fundação Assistencial da Paraíba – FAP.

CLÁUSULA PRIMEIRA – DO OBJETO
Locação do imóvel situado em {{ENDERECO}}, para uso de {{OBJETO}}.

CLÁUSULA SEGUNDA – DO ALUGUEL
Aluguel mensal: {{VALOR}}. Pagamento até o dia 10 de cada mês.

CLÁUSULA TERCEIRA – DO PRAZO
Vigência: {{PRAZO}} meses. Início: {{DATA_INICIO}}. Término: {{DATA_FIM}}.

CLÁUSULA QUARTA – DO REAJUSTE
Reajuste anual pelo IPCA/IBGE.

CLÁUSULA QUINTA – DO FORO
Foro de João Pessoa/PB.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
LOCADOR(A)

_________________________________
LOCATÁRIO(A)`,
    },
    {
        nome: "Contrato de Consultoria Técnica",
        tipo: "Consultoria",
        descricao: "Modelo para serviços de consultoria especializada.",
        tags: ["consultoria", "assessoria", "técnico"],
        criadoPor: "sistema",
        conteudo: `CONTRATO DE CONSULTORIA TÉCNICA Nº {{NUMERO}}

CONTRATANTE: Fundação Assistencial da Paraíba – FAP.
CONTRATADA: {{EMPRESA}}, CNPJ: {{CNPJ}}.

CLÁUSULA PRIMEIRA – DO OBJETO
Prestação de serviços de consultoria técnica em {{OBJETO}}.

CLÁUSULA SEGUNDA – DO VALOR
Valor total: {{VALOR}}. Pagamento vinculado à entrega de relatórios.

CLÁUSULA TERCEIRA – DO PRAZO
Vigência: {{PRAZO}} meses. Início: {{DATA_INICIO}}.

CLÁUSULA QUARTA – DAS ENTREGAS
a) Relatório de diagnóstico: até 30 dias;
b) Plano de ação: até 60 dias;
c) Relatório final: ao término.

CLÁUSULA QUINTA – DA CONFIDENCIALIDADE
Informações obtidas são confidenciais.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
CONTRATANTE

_________________________________
CONTRATADA`,
    },
    {
        nome: "Acordo de Confidencialidade (NDA)",
        tipo: "NDA",
        descricao: "Acordo de confidencialidade para proteção de informações.",
        tags: ["NDA", "confidencialidade", "sigilo"],
        criadoPor: "sistema",
        conteudo: `ACORDO DE CONFIDENCIALIDADE Nº {{NUMERO}}

PARTE REVELADORA: Fundação Assistencial da Paraíba – FAP.
PARTE RECEPTORA: {{EMPRESA}}, CNPJ: {{CNPJ}}.

CLÁUSULA PRIMEIRA – DO OBJETO
Proteção das informações confidenciais compartilhadas no âmbito de {{OBJETO}}.

CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES
a) Não divulgar a terceiros;
b) Utilizar apenas para os fins acordados;
c) Devolver documentos ao término.

CLÁUSULA TERCEIRA – DO PRAZO
Vigência: {{PRAZO}} meses, permanecendo válido por mais 2 anos após término.

CLÁUSULA QUARTA – DAS PENALIDADES
Violação sujeita a indenização por perdas e danos.

João Pessoa/PB, {{DATA_ASSINATURA}}.

_________________________________
PARTE REVELADORA

_________________________________
PARTE RECEPTORA`,
    },
];

// --- AI text generation (simulated) ---
interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

function generateAIResponse(userMsg: string, modelos: ModeloContrato[]): string {
    const msg = userMsg.toLowerCase();

    // Detect type keywords
    const typeMap: Record<string, string> = {
        'serviço': 'Serviço', 'prestação de serviço': 'Serviço',
        'fornecimento': 'Fornecimento', 'material': 'Fornecimento',
        'obra': 'Obra', 'construção': 'Obra', 'reforma': 'Obra',
        'locação': 'Locação', 'aluguel': 'Locação', 'imóvel': 'Locação',
        'consultoria': 'Consultoria', 'assessoria': 'Consultoria',
        'nda': 'NDA', 'confidencialidade': 'NDA', 'sigilo': 'NDA',
    };

    let detectedType = '';
    for (const [kw, tipo] of Object.entries(typeMap)) {
        if (msg.includes(kw)) { detectedType = tipo; break; }
    }

    // Extract parameters
    const prazoMatch = msg.match(/(\d+)\s*meses?/) || msg.match(/prazo\s*(?:de\s*)?(\d+)/);
    const valorMatch = msg.match(/(?:valor|r\$)\s*([\d.,]+)/i);
    const empresaMatch = msg.match(/(?:empresa|para)\s+(.{3,50}?)(?:\s+(?:com|pelo|no|de\s+prazo))/i);
    const objetoMatch = msg.match(/(?:para|de)\s+(.{5,100}?)(?:\s+(?:com|pelo|no|prazo|valor))/i);

    // Find matching template
    const template = modelos.find(m => m.tipo === detectedType);
    if (template) {
        const now = new Date();
        let conteudo = template.conteudo
            .replace(/\{\{NUMERO\}\}/g, `FAP-${now.getFullYear()}-XXXX`)
            .replace(/\{\{DATA_ASSINATURA\}\}/g, now.toLocaleDateString('pt-BR'))
            .replace(/\{\{PRAZO\}\}/g, prazoMatch ? prazoMatch[1] : '12')
            .replace(/\{\{VALOR\}\}/g, valorMatch ? `R$ ${valorMatch[1]}` : 'R$ [A DEFINIR]')
            .replace(/\{\{EMPRESA\}\}/g, empresaMatch ? empresaMatch[1].trim() : '[NOME DA EMPRESA]')
            .replace(/\{\{OBJETO\}\}/g, objetoMatch ? objetoMatch[1].trim() : '[DESCRIÇÃO DO OBJETO]')
            .replace(/\{\{CNPJ\}\}/g, '[CNPJ]')
            .replace(/\{\{ENDERECO\}\}/g, '[ENDEREÇO]')
            .replace(/\{\{GARANTIA\}\}/g, '12')
            .replace(/\{\{DATA_INICIO\}\}/g, now.toLocaleDateString('pt-BR'));

        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + parseInt(prazoMatch?.[1] || '12'));
        conteudo = conteudo.replace(/\{\{DATA_FIM\}\}/g, endDate.toLocaleDateString('pt-BR'))
            .replace(/\{\{VALOR_MENSAL\}\}/g, '[VALOR MENSAL]');

        return `✅ Identifiquei que você precisa de um **Contrato de ${detectedType}**. Gerei o documento com base no modelo "${template.nome}".\n\n` +
            `📋 **Parâmetros detectados:**\n` +
            (prazoMatch ? `• Prazo: ${prazoMatch[1]} meses\n` : '') +
            (valorMatch ? `• Valor: R$ ${valorMatch[1]}\n` : '') +
            (empresaMatch ? `• Empresa: ${empresaMatch[1].trim()}\n` : '') +
            `\n---\n\n${conteudo}\n\n---\n\n💡 Você pode editar o contrato acima, ajustar cláusulas ou pedir mais alterações.`;
    }

    // No matching template
    if (detectedType) {
        return `🔍 Identifiquei que você precisa de um contrato do tipo **${detectedType}**, mas não encontrei um modelo correspondente na biblioteca.\n\n` +
            `💡 **Sugestões:**\n` +
            `1. Crie um modelo do tipo "${detectedType}" na aba de Modelos\n` +
            `2. Descreva mais detalhes para eu gerar um contrato do zero\n\n` +
            `Posso ajudar com: valor, prazo, empresa, objeto, cláusulas específicas.`;
    }

    // General help
    return `🤖 Posso ajudar com contratos! Tente algo como:\n\n` +
        `• "Gerar contrato de prestação de serviços com prazo de 12 meses"\n` +
        `• "Criar contrato de fornecimento de materiais para Empresa ABC valor R$ 50.000"\n` +
        `• "Gerar NDA para proteção de dados"\n` +
        `• "Contrato de obra para reforma do bloco B"\n\n` +
        `📚 **Modelos disponíveis:** ${modelos.map(m => m.tipo).join(', ') || 'Nenhum — crie modelos primeiro!'}\n\n` +
        `💡 Quanto mais detalhes, melhor será o contrato gerado.`;
}

// --- Tab type ---
type Tab = "modelos" | "chat";

const tipoColors: Record<string, string> = {
    Serviço: "bg-blue-100 text-blue-700",
    Fornecimento: "bg-amber-100 text-amber-700",
    Obra: "bg-orange-100 text-orange-700",
    Locação: "bg-purple-100 text-purple-700",
    Consultoria: "bg-emerald-100 text-emerald-700",
    NDA: "bg-red-100 text-red-700",
};

export default function ModelosContratos() {
    const { contratos, addContrato, modelos, addModelo, updateModelo, deleteModelo, addLog, setores, appConfig } = useData();
    const { currentUser, isAdmin } = useAuth();
    const [tab, setTab] = useState<Tab>("modelos");

    // --- Modelos tab state ---
    const [search, setSearch] = useState("");
    const [filterTipo, setFilterTipo] = useState("");
    const [editingModelo, setEditingModelo] = useState<ModeloContrato | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [preview, setPreview] = useState<ModeloContrato | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    // New/Edit form state
    const [formNome, setFormNome] = useState("");
    const [formTipo, setFormTipo] = useState("Serviço");
    const [formDescricao, setFormDescricao] = useState("");
    const [formTags, setFormTags] = useState("");
    const [formConteudo, setFormConteudo] = useState("");

    // --- Chat tab state ---
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [generatedContract, setGeneratedContract] = useState<string | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // --- Upload analysis state ---
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const uploadRef = useRef<HTMLInputElement>(null);
    const modelUploadRef = useRef<HTMLInputElement>(null);
    const [modelUploading, setModelUploading] = useState(false);

    // Seed models on first render if empty
    useEffect(() => {
        if (modelos.length === 0) {
            SEED_TEMPLATES.forEach(t => addModelo(t));
        }
    }, [modelos.length, addModelo]);

    const allModelos = modelos;
    const tipos = useMemo(() => [...new Set(allModelos.map(m => m.tipo))], [allModelos]);

    const filtered = useMemo(() => {
        return allModelos.filter(m => {
            const matchSearch = !search
                || m.nome.toLowerCase().includes(search.toLowerCase())
                || m.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
            const matchTipo = !filterTipo || m.tipo === filterTipo;
            return matchSearch && matchTipo;
        });
    }, [allModelos, search, filterTipo]);

    // --- Form handlers ---
    const resetForm = () => {
        setFormNome(""); setFormTipo("Serviço"); setFormDescricao("");
        setFormTags(""); setFormConteudo("");
        setEditingModelo(null); setShowNewForm(false);
    };

    const openEdit = (m: ModeloContrato) => {
        setFormNome(m.nome); setFormTipo(m.tipo); setFormDescricao(m.descricao);
        setFormTags(m.tags.join(", ")); setFormConteudo(m.conteudo);
        setEditingModelo(m); setShowNewForm(true);
    };

    const openNew = () => {
        resetForm(); setShowNewForm(true);
    };

    const handleSaveModelo = () => {
        if (!formNome.trim()) {
            toast({ title: "Campo obrigatório", description: "Preencha o nome do modelo.", variant: "destructive" });
            return;
        }
        if (!formTags.trim()) {
            toast({ title: "Campo obrigatório", description: "Preencha ao menos uma tag.", variant: "destructive" });
            return;
        }
        const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
        if (editingModelo) {
            updateModelo(editingModelo.id, {
                nome: formNome.trim(), tipo: formTipo, descricao: formDescricao.trim(),
                tags, conteudo: formConteudo,
            });
            if (currentUser) {
                addLog(currentUser.id, currentUser.nome, "Modelo atualizado", `Modelo: ${formNome.trim()}`);
            }
            toast({ title: "✅ Modelo atualizado", description: `"${formNome.trim()}" salvo com sucesso.` });
        } else {
            addModelo({
                nome: formNome.trim(), tipo: formTipo, descricao: formDescricao.trim(),
                tags, conteudo: formConteudo, criadoPor: currentUser?.id || "sistema",
            });
            if (currentUser) {
                addLog(currentUser.id, currentUser.nome, "Modelo criado", `Modelo: ${formNome.trim()}`);
            }
            toast({ title: "✅ Modelo criado", description: `"${formNome.trim()}" salvo com sucesso.` });
        }
        resetForm();
    };

    const handleDeleteModelo = (m: ModeloContrato) => {
        if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
        deleteModelo(m.id);
        if (currentUser) {
            addLog(currentUser.id, currentUser.nome, "Modelo excluído", `Modelo: ${m.nome}`);
        }
    };

    const handleCopy = (m: ModeloContrato) => {
        const numero = generateContractNumber(contratos.map(c => c.numero));
        const filled = m.conteudo
            .replace(/\{\{NUMERO\}\}/g, numero)
            .replace(/\{\{DATA_ASSINATURA\}\}/g, new Date().toLocaleDateString("pt-BR"));
        navigator.clipboard.writeText(filled);
        setCopied(m.id);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDownloadModelo = (m: ModeloContrato, format: 'pdf' | 'docx') => {
        const numero = generateContractNumber(contratos.map(c => c.numero));
        const filled = m.conteudo
            .replace(/\{\{NUMERO\}\}/g, numero)
            .replace(/\{\{DATA_ASSINATURA\}\}/g, new Date().toLocaleDateString("pt-BR"));
        const safeName = m.nome.replace(/\s+/g, "_");
        if (format === 'pdf') {
            downloadAsPdf(filled, safeName);
        } else {
            downloadAsDocx(filled, safeName);
        }
        if (currentUser) {
            addLog(currentUser.id, currentUser.nome, `Modelo baixado (${format.toUpperCase()})`, `Modelo: ${m.nome}`);
        }
    };

    // --- Upload PDF/DOCX to create model (RF02) ---
    const handleModelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');
        if (!isPdf && !isDocx) {
            toast({ title: "Erro", description: "Selecione um arquivo PDF ou DOCX válido.", variant: "destructive" });
            return;
        }
        setModelUploading(true);

        try {
            toast({ title: "🔍 Transcrevendo...", description: "Processando o documento, aguarde..." });

            const text = await extractTextFromFile(file, appConfig, file.name);

            if (text && text.trim().length > 10) {
                const cleanText = text.trim();
                setFormConteudo(cleanText);

                // --- Intelligent Metadata Detection ---
                let detectedType = detectTypeFromText(cleanText);
                let detectedName = "";
                let detectedDesc = `Modelo importado do arquivo ${file.name}`;
                let detectedTags = detectedType.toLowerCase();

                // If LLM is available, use it for deeper analysis
                if (appConfig.llmApiKey && appConfig.llmStatus === 'connected') {
                    toast({ title: "🧠 IA Analisando conteúdo", description: "Identificando tipo, nome e metadados sugeridos..." });
                    const llmAnalysis = await analyzeContractWithLlm(appConfig, cleanText);

                    if (llmAnalysis) {
                        if (llmAnalysis.tipoServico) detectedType = llmAnalysis.tipoServico;
                        if (llmAnalysis.empresa && llmAnalysis.tipoServico) {
                            detectedName = `Modelo: ${llmAnalysis.tipoServico} — ${llmAnalysis.empresa}`;
                        } else if (llmAnalysis.tipoServico) {
                            detectedName = `Modelo: ${llmAnalysis.tipoServico} (Sugerido)`;
                        }

                        if (llmAnalysis.descricaoObjeto) {
                            detectedDesc = llmAnalysis.descricaoObjeto;
                        }

                        if (llmAnalysis.alertas && llmAnalysis.alertas.length > 0) {
                            // Extract some tags from alerts or type
                            const tagsSet = new Set([detectedType.toLowerCase()]);
                            llmAnalysis.alertas.slice(0, 3).forEach(a => {
                                const words = a.split(' ').filter(w => w.length > 4).slice(0, 1);
                                if (words[0]) tagsSet.add(words[0].toLowerCase());
                            });
                            detectedTags = Array.from(tagsSet).join(', ');
                        }
                    }
                }

                // Apply detections
                setFormTipo(detectedType);

                if (!detectedName) {
                    const baseName = file.name.replace(/\.(pdf|docx?|doc)$/i, '').replace(/[_-]/g, ' ');
                    detectedName = `Modelo: ${baseName}`;
                }

                setFormNome(detectedName);
                setFormDescricao(detectedDesc);
                setFormTags(detectedTags);

                if (currentUser) {
                    addLog(currentUser.id, currentUser.nome, 'Modelo importado via upload (IA)', `Arquivo: ${file.name}, Tipo: ${detectedType}`);
                }

                toast({
                    title: "✅ Documento importado",
                    description: `Metadados sugeridos via IA para "${file.name}". Revise e salve o modelo.`
                });
            } else {
                toast({ title: "⚠️ Erro na importação", description: "Não foi possível extrair texto do documento. Se for .doc (antigo), converta para .docx.", variant: "destructive" });
            }
        } catch (err) {
            console.warn('Model upload failed:', err);
            toast({ title: "❌ Erro na importação", description: `Falha ao processar o documento: ${err instanceof Error ? err.message : 'erro desconhecido'}`, variant: "destructive" });
        } finally {
            setModelUploading(false);
            if (modelUploadRef.current) modelUploadRef.current.value = '';
        }
    }, [formNome, formTags, addLog, currentUser, appConfig]);

    // --- Chat handlers ---
    const handleSendChat = useCallback(async () => {
        if (!chatInput.trim() || chatLoading) return;
        const userMsg: ChatMessage = { role: "user", content: chatInput.trim(), timestamp: new Date().toISOString() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput("");
        setChatLoading(true);

        try {
            // Try real LLM if configured (RF01)
            const apiMessages = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
            const llmResponse = await callLlmApi(appConfig, apiMessages, CHAT_SYSTEM_PROMPT);

            let response: string;
            if (llmResponse) {
                response = llmResponse;
                addLog(currentUser!.id, currentUser!.nome, "Chat IA (LLM)", `Provider: ${appConfig.llmProvider}, Comando: ${userMsg.content.substring(0, 50)}...`);
            } else {
                // Fallback to local template-based generation
                await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));
                response = generateAIResponse(userMsg.content, allModelos);
                addLog(currentUser!.id, currentUser!.nome, "Chat IA (local)", `Comando: ${userMsg.content.substring(0, 60)}...`);
            }

            const assistantMsg: ChatMessage = { role: "assistant", content: response, timestamp: new Date().toISOString() };
            setChatMessages(prev => [...prev, assistantMsg]);

            // Extract contract text if generated
            const contractMatch = response.match(/---\n\n([\s\S]+?)\n\n---/);
            if (contractMatch) {
                setGeneratedContract(contractMatch[1]);
            } else if (response.length > 200 && (response.includes('CLÁUSULA') || response.includes('CONTRAT'))) {
                // LLM likely returned a full contract
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
    }, [chatInput, chatLoading, allModelos, addLog, currentUser, appConfig, chatMessages]);

    // --- Upload handler (Chat IA tab — PDF/DOCX, redirects to Modelos tab) ---
    const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isDocx = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc');
        if (!isPdf && !isDocx) return;

        setAnalysisLoading(true);
        setAnalysisResult(null);

        try {
            // Extract text using universal utility
            toast({ title: "🔍 Analisando documento", description: "Processando arquivo para análise inteligente..." });
            const text = await extractTextFromFile(file, appConfig);

            if (!text || text.trim().length < 10) {
                toast({ title: "⚠️ Erro na extração", description: "Não foi possível extrair texto do documento.", variant: "destructive" });
                return;
            }

            const cleanText = text.trim();

            // Local regex analysis
            const fields = parseContractFields(text);
            const analysis = analyzeContract(text);
            const valueAnalysis = analyzeValues(text);


            const autoNumero = fields.numero || generateContractNumber(contratos.map(c => c.numero));

            // LLM-powered analysis (if configured)
            const llmResult = await (async () => {
                if (appConfig.llmApiKey && appConfig.llmStatus === 'connected') {
                    toast({
                        title: "🧠 IA Analisando Documento",
                        description: "Extraindo riscos, cláusulas e resumo estruturado..."
                    });
                    const result = await analyzeContractWithLlm(appConfig, text);
                    return result;
                }
                return null;
            })();

            const startDate = llmResult?.dataInicio || fields.dataInicio;
            const endDate = llmResult?.dataVencimento || fields.dataVencimento;

            // Build initial summary from local analysis
            let summary = `📄 **Análise do documento "${file.name}":**\n\n` +
                `• Nº do Contrato: ${autoNumero}\n` +
                (fields.empresa ? `• Empresa: ${fields.empresa}\n` : "") +
                (fields.objeto ? `• Objeto: ${fields.objeto}\n` : "") +
                (fields.valor ? `• Valor: ${fields.valor}\n` : "") +
                (fields.tipo ? `• Tipo identificado: ${fields.tipo}\n` : "") +
                (startDate ? `• Data início: ${startDate.includes('-') ? isoToBr(startDate) : startDate}\n` : "• Data início: ❓ não encontrada\n") +
                (endDate ? `• Data vencimento: ${endDate.includes('-') ? isoToBr(endDate) : endDate}\n` : "• Data vencimento: ❓ não encontrada\n");

            let allFindings = [...analysis.findings, ...valueAnalysis.alertas];
            let hasAbusive = analysis.hasAbusiveClauses;

            if (llmResult) {
                summary += `\n🧠 **Análise aprofundada via IA (${appConfig.llmProvider?.toUpperCase()}):**\n`;
                if (llmResult.empresa) summary += `• Empresa (IA): ${llmResult.empresa}\n`;
                if (llmResult.descricaoObjeto) summary += `• Objeto (IA): ${llmResult.descricaoObjeto}\n`;
                if (llmResult.valorTotal) summary += `• Valor total (IA): ${llmResult.valorTotal}\n`;
                if (llmResult.dataInicio) summary += `• Início (IA): ${llmResult.dataInicio}\n`;
                if (llmResult.dataVencimento) summary += `• Vencimento (IA): ${llmResult.dataVencimento}\n`;
                if (llmResult.tipoServico) summary += `• Tipo (IA): ${llmResult.tipoServico}\n`;

                if (llmResult.clausulasAbusivas.length > 0) {
                    hasAbusive = true;
                    summary += `\n⚠️ **Cláusulas abusivas detectadas pela IA:**\n`;
                    llmResult.clausulasAbusivas.forEach(c => {
                        const icon = c.severidade === 'alta' ? '🔴' : c.severidade === 'media' ? '🟡' : '🟢';
                        summary += `${icon} [${c.severidade.toUpperCase()}] ${c.descricao}\n`;
                        allFindings.push(`⚠️ [IA] ${c.descricao}`);
                    });
                } else {
                    summary += `\n✅ Nenhuma cláusula abusiva detectada pela IA.\n`;
                }

                if (llmResult.alertas.length > 0) {
                    summary += `\n📝 **Observações da IA:**\n`;
                    llmResult.alertas.forEach(a => {
                        summary += `• ${a}\n`;
                        allFindings.push(`ℹ️ [IA] ${a}`);
                    });
                }
            } else {
                summary += `\n**Análise de cláusulas (local):**\n` +
                    (analysis.findings.length > 0 ? analysis.findings.join("\n") : "✅ Nenhuma irregularidade detectada") +
                    (valueAnalysis.alertas.length > 0 ? "\n\n**Análise de valores:**\n" + valueAnalysis.alertas.join("\n") : "");
            }


            setChatMessages(prev => [
                ...prev,
                { role: "user", content: `📎 Upload: ${file.name}`, timestamp: new Date().toISOString() },
                { role: "assistant", content: summary, timestamp: new Date().toISOString() },
            ]);

            setAnalysisResult({
                hasAbusiveClauses: hasAbusive,
                missingSignature: analysis.missingSignature,
                findings: allFindings,
                autoFilled: !!fields.numero || !!fields.empresa,
            });

            // Pre-fill the model form and switch to Modelos tab
            setFormConteudo(cleanText);
            const tipo = fields.tipo || detectTypeFromText(cleanText);
            const baseName = file.name.replace(/\.(pdf|docx?|doc)$/i, '').replace(/[_-]/g, ' ');
            setFormTipo(tipo);
            setFormNome(`Modelo: ${baseName}`);
            setFormDescricao(`Modelo importado do arquivo ${file.name}`);
            setFormTags(tipo.toLowerCase());
            setEditingModelo(null);
            setShowNewForm(true);
            setTab("modelos");

            const source = llmResult ? 'IA (LLM + local)' : 'IA (local)';
            if (currentUser) {
                addLog(currentUser.id, currentUser.nome, "Contrato analisado via upload", `Arquivo: ${file.name} via ${source}`);
            }
        } catch (err) {
            console.warn(err);
        } finally {
            setAnalysisLoading(false);
            if (uploadRef.current) uploadRef.current.value = "";
        }
    }, [contratos, addLog, currentUser, appConfig]);

    // --- Save generated contract ---
    const handleSaveContract = () => {
        if (!generatedContract) return;
        const numero = generateContractNumber(contratos.map(c => c.numero));
        addContrato({
            numero,
            descricao: "Contrato gerado via IA",
            empresa: "[Preencher]",
            objeto: "Gerado automaticamente",
            tipo: "Serviço",
            idSetor: setores[0]?.id || "",
            valor: "",
            status: "Vigente",
            dataInicio: new Date().toLocaleDateString("pt-BR"),
            dataVencimento: "",
            criadoPor: currentUser?.id || 'sistema',
        });
        if (currentUser) {
            addLog(currentUser.id, currentUser.nome, "Contrato salvo via IA", `Nº: ${numero}`);
        }
        alert(`Contrato ${numero} salvo com sucesso! Edite os detalhes na página Contratos.`);
        setGeneratedContract(null);
    };

    const handleDownloadContract = () => {
        if (!generatedContract) return;
        const blob = new Blob([generatedContract], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `contrato_gerado_${Date.now()}.txt`; a.click();
        URL.revokeObjectURL(url);
    };

    // =============== RENDER ===============
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Modelos & IA</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Gerencie modelos e gere contratos com inteligência artificial</p>
                </div>
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-xs text-muted-foreground">{allModelos.length} modelo(s)</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setTab("modelos")}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "modelos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                ><BookOpen className="w-4 h-4" /> Modelos</button>
                <button
                    onClick={() => setTab("chat")}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                ><MessageSquare className="w-4 h-4" /> Chat IA</button>
            </div>

            {/* ====== MODELOS TAB ====== */}
            {tab === "modelos" && (
                <div className="space-y-4">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar modelo..."
                                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" />
                        </div>
                        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-input bg-card text-sm outline-none">
                            <option value="">Todos os tipos</option>
                            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={openNew}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 accent-glow">
                            <Plus className="w-4 h-4" /> Criar Novo Modelo
                        </button>
                    </div>

                    {/* New/Edit Form */}
                    <AnimatePresence>
                        {showNewForm && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {editingModelo ? `✏️ Editar: ${editingModelo.nome}` : "✨ Novo Modelo de Contrato"}
                                    </h3>
                                    <button onClick={resetForm} className="p-1 rounded-md hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                                            <input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome do modelo"
                                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                                            <select value={formTipo} onChange={(e) => setFormTipo(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                                                <option>Serviço</option><option>Fornecimento</option><option>Obra</option>
                                                <option>Locação</option><option>Consultoria</option><option>NDA</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Tags (vírgulas)</label>
                                            <input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="serviço, SLA"
                                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                                            <input value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} placeholder="Breve descrição"
                                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-muted-foreground underline decoration-dotted decoration-muted-foreground/30">Conteúdo do Modelo <span className="text-[10px] italic">(opcional — use {'{{NUMERO}}'}, {'{{EMPRESA}}'}, {'{{VALOR}}'}, etc.)</span></label>
                                            <button
                                                onClick={() => modelUploadRef.current?.click()}
                                                disabled={modelUploading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary transition-all"
                                            >
                                                {modelUploading ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Upload className="w-3.5 h-3.5" />
                                                )}
                                                {modelUploading ? "Transcrevendo..." : "Importar Documento (PDF/DOCX)"}
                                            </button>
                                            <input type="file" ref={modelUploadRef} onChange={handleModelUpload} className="hidden" accept=".pdf,.docx,.doc" />
                                        </div>
                                        <textarea value={formConteudo} onChange={(e) => setFormConteudo(e.target.value)} rows={12}
                                            placeholder="Digite o conteúdo do contrato modelo ou importe de um arquivo..."
                                            className="w-full px-4 py-3 rounded-lg border border-input bg-background font-mono text-xs outline-none focus:ring-2 focus:ring-ring resize-y min-h-[300px]" />
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button onClick={handleSaveModelo} disabled={!formNome.trim() || !formTags.trim()}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-sm transition-all active:scale-[0.98]">
                                            {editingModelo ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                            {editingModelo ? "Salvar Alterações" : "Criar Novo Modelo"}
                                        </button>
                                        {formConteudo.trim() && (
                                            <button onClick={() => {
                                                const safeName = (formNome || 'modelo').replace(/\s+/g, '_');
                                                downloadAsDocx(formConteudo, safeName);
                                            }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">
                                                <Download className="w-4 h-4" /> Baixar DOCX
                                            </button>
                                        )}
                                        {formConteudo.trim() && (
                                            <button onClick={() => {
                                                const safeName = (formNome || 'modelo').replace(/\s+/g, '_');
                                                downloadAsPdf(formConteudo, safeName);
                                            }}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">
                                                <Download className="w-4 h-4" /> Baixar PDF
                                            </button>
                                        )}
                                        <button onClick={resetForm} className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Models Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((m) => (
                            <div key={m.id} className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                                style={{ boxShadow: "var(--shadow-sm)" }}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                                        <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{m.nome}</h3>
                                    </div>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${tipoColors[m.tipo] || "bg-muted text-muted-foreground"}`}>
                                        {m.tipo}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{m.descricao}</p>
                                <div className="flex flex-wrap gap-1">
                                    {m.tags.map((tag: string) => (
                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                                    ))}
                                </div>
                                {m.atualizadoEm && (
                                    <p className="text-[10px] text-muted-foreground/60">Atualizado: {new Date(m.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/50 flex-wrap">
                                    <button onClick={() => setPreview(m)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
                                        <Eye className="w-3.5 h-3.5" /> Ver
                                    </button>
                                    <button onClick={() => openEdit(m)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button onClick={() => handleCopy(m)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
                                        {copied === m.id ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copied === m.id ? "Ok!" : "Copiar"}
                                    </button>
                                    <button onClick={() => handleDownloadModelo(m, 'pdf')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors" title="Baixar PDF">
                                        <Download className="w-3.5 h-3.5" /> PDF
                                    </button>
                                    <button onClick={() => handleDownloadModelo(m, 'docx')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors" title="Baixar DOCX">
                                        <Download className="w-3.5 h-3.5" /> DOCX
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => handleDeleteModelo(m)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
                            Nenhum modelo encontrado. <button onClick={openNew} className="text-primary underline">Criar primeiro modelo</button>
                        </div>
                    )}
                </div>
            )}

            {/* ====== CHAT IA TAB ====== */}
            {tab === "chat" && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: "65vh" }}>
                    {/* Chat Panel */}
                    <div className="lg:col-span-3 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Assistente IA</h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        {appConfig.llmStatus === 'connected'
                                            ? `🟢 ${appConfig.llmProvider?.toUpperCase()} conectado`
                                            : '🔵 Modo local (configure LLM em Configurações)'}
                                    </p>
                                </div>
                            </div>
                            <input ref={uploadRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleUpload} />
                            <button onClick={() => uploadRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
                                <Upload className="w-3.5 h-3.5" /> Upload PDF/DOCX
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(65vh - 120px)" }}>
                            {chatMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Wand2 className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">Como posso ajudar?</h4>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            Digite uma instrução para gerar um contrato ou faça upload de um PDF para análise automática.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-w-lg">
                                        {[
                                            "Gerar contrato de prestação de serviços com prazo de 12 meses",
                                            "Criar NDA para empresa ABC",
                                            "Contrato de fornecimento de materiais no valor de R$ 50.000",
                                        ].map((s) => (
                                            <button key={s} onClick={() => { setChatInput(s); }}
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
                                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/50 text-foreground border border-border/50"
                                        }`}>
                                        <div className="whitespace-pre-wrap break-words">
                                            {msg.content.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                                                part.startsWith("**") && part.endsWith("**")
                                                    ? <strong key={j}>{part.slice(2, -2)}</strong>
                                                    : <span key={j}>{part}</span>
                                            )}
                                        </div>
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

                            {chatLoading && (
                                <div className="flex gap-3 items-start">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                    <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                            <span className="text-xs text-muted-foreground">Gerando contrato...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-border bg-muted/10">
                            <div className="flex items-center gap-2">
                                <button onClick={() => uploadRef.current?.click()} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Upload PDF">
                                    <Upload className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                    placeholder="Digite uma instrução para gerar um contrato..."
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                                <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading}
                                    className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-2 bg-card rounded-xl border border-border flex flex-col overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <h3 className="text-sm font-semibold text-foreground">📄 Contrato Gerado</h3>
                            {generatedContract && (
                                <div className="flex items-center gap-1.5">
                                    <button onClick={handleSaveContract}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                                        <Save className="w-3.5 h-3.5" /> Salvar
                                    </button>
                                    <button onClick={handleDownloadContract}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary">
                                        <Download className="w-3.5 h-3.5" /> Baixar
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {generatedContract ? (
                                <textarea
                                    value={generatedContract}
                                    onChange={(e) => setGeneratedContract(e.target.value)}
                                    className="w-full h-full min-h-[400px] px-3 py-2 text-xs font-mono leading-relaxed bg-transparent outline-none resize-none text-foreground"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                                    <FileText className="w-10 h-10 text-muted-foreground/30" />
                                    <p className="text-xs text-muted-foreground">
                                        O contrato gerado aparecerá aqui.<br />
                                        Use o chat ou faça upload de um PDF/DOCX.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {preview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{preview.nome}</h3>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tipoColors[preview.tipo] || "bg-gray-100 text-gray-600"}`}>{preview.tipo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { openEdit(preview); setPreview(null); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-100">
                                    <Pencil className="w-3.5 h-3.5 inline mr-1" /> Editar
                                </button>
                                <button onClick={() => setPreview(null)} className="p-2 rounded-lg hover:bg-gray-100">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">{preview.conteudo}</pre>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <button onClick={() => { handleCopy(preview); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                                <Copy className="w-4 h-4" /> Copiar
                            </button>
                            <button onClick={() => handleDownloadModelo(preview, 'pdf')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">
                                <Download className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={() => handleDownloadModelo(preview, 'docx')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary">
                                <Download className="w-4 h-4" /> DOCX
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Alert */}
            <AnalysisAlert
                result={analysisResult}
                loading={analysisLoading}
                onClose={() => { setAnalysisResult(null); setAnalysisLoading(false); }}
            />
        </motion.div>
    );
}
