import type { AppConfig } from '../types';

// ─── Shared LLM API call ─────────────────────────────────────────
// Supports Anthropic, Google Gemini and OpenAI-compatible providers

export async function callLlmApi(
    config: AppConfig,
    messages: { role: string; content: string; imageBase64?: string }[],
    systemPrompt: string,
): Promise<string | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;

    // Merge custom training/instructions if available
    let finalSystemPrompt = systemPrompt;

    if (config.llmTone || config.llmSpecialization) {
        finalSystemPrompt += `\n\nPERSONA E ESTILO:\n`;
        if (config.llmTone) finalSystemPrompt += `- Tom de voz: ${config.llmTone}\n`;
        if (config.llmSpecialization) finalSystemPrompt += `- Especialização: ${config.llmSpecialization}\n`;
    }

    if (config.llmCustomPrompt) {
        finalSystemPrompt += `\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${config.llmCustomPrompt}`;
    }

    if (config.llmExamples && config.llmExamples.length > 0) {
        finalSystemPrompt += `\n\nEXEMPLOS DE COMPORTAMENTO (FEW-SHOT):\n`;
        config.llmExamples.forEach((ex, i) => {
            finalSystemPrompt += `Exemplo ${i + 1}:\nUsuário: ${ex.user}\nAssistente: ${ex.assistant}\n\n`;
        });
    }

    if (config.llmKnowledgeBase) {
        finalSystemPrompt += `\n\nBASE DE CONHECIMENTO / CONTEXTO:\n${config.llmKnowledgeBase}`;
    }

    try {
        if (config.llmProvider === 'anthropic') {
            const baseUrl = config.llmBaseUrl || 'https://api.anthropic.com/v1';
            const resp = await fetch(`${baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'x-api-key': config.llmApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: config.llmModel || 'claude-3-5-sonnet-20241022',
                    max_tokens: 4096,
                    system: finalSystemPrompt,
                    messages: messages.map((m) => {
                        const content: any[] = [{ type: 'text', text: m.content }];
                        if (m.imageBase64) {
                            content.push({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: m.imageBase64,
                                },
                            });
                        }
                        return {
                            role: m.role as 'user' | 'assistant',
                            content,
                        };
                    }),
                    temperature: config.llmTemperature ?? 0.7,
                    top_p: config.llmTopP ?? 1,
                }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.content?.[0]?.text || null;
        }

        if (config.llmProvider === 'google') {
            const baseUrl =
                config.llmBaseUrl ||
                'https://generativelanguage.googleapis.com/v1beta';
            const model = config.llmModel || 'gemini-2.0-flash';
            const url = `${baseUrl}/models/${model}:generateContent?key=${config.llmApiKey}`;

            // Convert chat messages to Gemini format
            const contents = messages.map((m) => {
                const parts: any[] = [{ text: m.content }];
                if (m.imageBase64) {
                    parts.push({
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: m.imageBase64,
                        }
                    });
                }
                return {
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts,
                };
            });

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: finalSystemPrompt }] },
                    contents,
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: config.llmTemperature ?? 0.7,
                        topP: config.llmTopP ?? 1,
                    },
                }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }

        // GPTMaker — uses v2/agent/{agentId}/conversation endpoint
        if (config.llmProvider === 'gptmaker') {
            const agentId = (config as any).gptMakerAgentId;
            const apiKey = (config as any).gptMakerApiKey || config.llmApiKey;
            if (!agentId || !apiKey) return null;

            const baseUrl = config.llmBaseUrl || 'https://api.gptmaker.ai';
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            const prompt = lastUserMsg?.content || '';

            const resp = await fetch(`${baseUrl}/v2/agent/${agentId}/conversation`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contextId: `legal-whisperer-${Date.now()}`,
                    prompt: `${finalSystemPrompt}\n\n${prompt}`,
                }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data.message || null;
        }

        // OpenAI-compatible (OpenAI, DeepSeek, Groq, Mistral, xAI, custom…)
        const baseUrl = config.llmBaseUrl || 'https://api.openai.com/v1';
        const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.llmApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.llmModel || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    ...messages.map(m => {
                        if (m.imageBase64) {
                            return {
                                role: m.role,
                                content: [
                                    { type: 'text', text: m.content },
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.imageBase64}` } }
                                ]
                            };
                        }
                        return { role: m.role, content: m.content };
                    })
                ],
                max_tokens: 4096,
                temperature: config.llmTemperature ?? 0.7,
                top_p: config.llmTopP ?? 1,
                frequency_penalty: config.llmFrequencyPenalty ?? 0,
                presence_penalty: config.llmPresencePenalty ?? 0,
            }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

// ─── LLM-powered contract analysis ──────────────────────────────
// Returns structured data extracted from contract text, or null if LLM unavailable

export interface LlmContractAnalysis {
    /** Full title/name of the contract as written in the heading (e.g. "CONTRATO DE PRESTAÇÃO DE SERVIÇOS"). */
    nomeContrato?: string;
    /** Date written at the END of the contract body, before the signature block (YYYY-MM-DD). */
    dataInicio?: string;
    /** Contract validity in whole months (e.g. 12, 24, 36). */
    vigenciaMeses?: number;
    /** Expiry date — dataInicio + vigenciaMeses keeping the same calendar day (YYYY-MM-DD). */
    dataVencimento?: string;
    /** One-time implementation / setup / activation fee (formatted "R$ X.XXX,XX" or null). */
    valorImplantacao?: string;
    /** Monthly / recurring maintenance or subscription fee (formatted "R$ X.XXX,XX" or null). */
    valorMensalidade?: string;
    /** Total contract value = valorImplantacao + (valorMensalidade × vigenciaMeses). */
    valorTotal?: string;
    /** Human-readable explanation of how valorTotal was calculated. */
    breakdownValor?: string;
    /** The CONTRATANTE company (the one hiring/contracting the service). */
    empresaContratante?: string;
    /** The CONTRATADA company (the one providing the service). */
    empresaContratada?: string;
    /** @deprecated Use empresaContratante or empresaContratada instead */
    empresa?: string;
    tipoServico?: string;
    descricaoObjeto?: string;
    clausulasAbusivas: { descricao: string; severidade: 'alta' | 'media' | 'baixa' }[];
    /** Missing signatures or authentication issues found. */
    assinaturasAusentes: string[];
    /** General vulnerabilities found in the contract. */
    vulnerabilidades: string[];
    alertas: string[];
}

const CONTRACT_ANALYSIS_PROMPT = `Você é um analista jurídico especializado em contratos brasileiros. Analise o texto do contrato e retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem explicações) com esta estrutura exata:

{
  "nomeContrato": "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE IMPLANTAÇÃO E MANUTENÇÃO",
  "dataInicio": "YYYY-MM-DD",
  "vigenciaMeses": 12,
  "dataVencimento": "YYYY-MM-DD",
  "valorImplantacao": "R$ 2.000,00",
  "valorMensalidade": "R$ 500,00",
  "valorTotal": "R$ 8.000,00",
  "breakdownValor": "Implantação R$ 2.000,00 + Mensalidade R$ 500,00 × 12 meses = R$ 8.000,00",
  "empresaContratante": "nome da empresa CONTRATANTE (quem está contratando o serviço)",
  "empresaContratada": "nome da empresa CONTRATADA (quem presta o serviço)",
  "tipoServico": "Serviço|Fornecimento|Obra|Consultoria|Locação",
  "descricaoObjeto": "descrição resumida (máx 200 chars)",
  "clausulasAbusivas": [{ "descricao": "descrição", "severidade": "alta|media|baixa" }],
  "assinaturasAusentes": ["descrição de cada assinatura ausente ou problema de autenticação"],
  "vulnerabilidades": ["descrição de cada vulnerabilidade jurídica encontrada"],
  "alertas": ["observações adicionais"]
}

REGRAS CRÍTICAS:

1. NOME DO CONTRATO (nomeContrato):
   - Extraia o TÍTULO completo do contrato como escrito no cabeçalho/início do documento.
   - Exemplos: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA", "INSTRUMENTO PARTICULAR DE MANUTENÇÃO DE SOFTWARE", "TERMO DE CONTRATO Nº 001/2026".
   - Inclua o número do contrato se fizer parte do título.
   - Use null se não encontrar.

2. DATA DE INÍCIO (dataInicio):
   - Procure a data escrita ao FINAL do corpo do contrato, logo antes do bloco de assinaturas.
   - Esta é a DATA DE ASSINATURA / CELEBRAÇÃO do contrato.
   - Formatos comuns: "Brasília, 20 de fevereiro de 2026.", "São Paulo, 15/03/2025.", "aos 20 dias do mês de fevereiro de dois mil e vinte e seis".
   - Converta para YYYY-MM-DD.
   - Use null se não encontrar.

3. VIGÊNCIA (vigenciaMeses):
   - Extraia o prazo em meses inteiros.
   - "12 (doze) meses" → 12 | "1 (um) ano" → 12 | "24 meses" → 24 | "3 anos" → 36.
   - Use null se não encontrar.

4. DATA DE VENCIMENTO (dataVencimento):
   - REGRA: dataVencimento = dataInicio + vigenciaMeses, mantendo o MESMO DIA DO MÊS.
   - Exemplo CORRETO: dataInicio=2026-02-21, vigenciaMeses=12 → dataVencimento=2027-02-21.
   - Exemplo CORRETO: dataInicio=2026-01-15, vigenciaMeses=6 → dataVencimento=2026-07-15.
   - Se o dia não existe no mês destino (ex: 31 em fevereiro), use o último dia do mês.
   - Se houver data explícita de término no contrato: use-a.
   - Use null se não for possível calcular.

5. VALORES:
   - valorImplantacao: Taxa única de implantação/setup/ativação (null se inexistente).
   - valorMensalidade: Valor mensal de manutenção/recorrência/assinatura (null se inexistente).
   - valorTotal: SOME implantação + mensalidade × vigência:
     * Se implantação E mensalidade existem: valorTotal = valorImplantacao + (valorMensalidade × vigenciaMeses).
     * Se apenas mensalidade: valorTotal = valorMensalidade × vigenciaMeses.
     * Se apenas implantação: valorTotal = valorImplantacao.
     * Se vigenciaMeses é null: valorTotal = valorImplantacao + valorMensalidade (soma simples).
   - breakdownValor: Descreva o cálculo (ex: "R$ 2.000,00 (implantação) + R$ 500,00 × 12 meses (manutenção) = R$ 8.000,00").
   - Formate todos os valores como "R$ X.XXX,XX".

6. ASSINATURAS AUSENTES (assinaturasAusentes):
   - Verifique se há campos de assinatura em branco, testemunhas ausentes, falta de reconhecimento de firma.
   - Identifique se CONTRATANTE ou CONTRATADA não possui campo de assinatura.
   - Verifique se há datas de assinatura ausentes.
   - Array vazio se tudo está completo.

7. VULNERABILIDADES (vulnerabilidades):
   - Identifique fragilidades jurídicas: prazos sem penalidade, falta de cláusula de confidencialidade, ausência de foro, omissão de LGPD, falta de garantias, etc.
   - Identifique riscos financeiros: ausência de reajuste, multas desproporcionais, etc.
   - Array vazio se nenhuma vulnerabilidade encontrada.

8. CONTRATOS DE LOCAÇÃO:
   - Se o contrato for do tipo "Locação" (especialmente Locação de Imóvel):
     * A REGRAL GERAL é que o valorTotal seja o valor que consta na cláusula "Do Valor" (geralmente o valor global do contrato).
     * PARA LOCAÇÃO, o "valor da prestação" (valorMensalidade) deve ser igual ao valor global total se não houver divisão explícita.
     * PARA LOCAÇÃO DE IMÓVEL, identifique o contratante (locatário) e o contratada (locador).

9. JSON APENAS: Não inclua nenhum texto fora do objeto JSON.`;

/** Adds N months to an ISO date string (YYYY-MM-DD) and returns the result as YYYY-MM-DD. */
function addMonthsToIso(isoDate: string, months: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    // Use day 0 of (month + months + 1) to get the last valid day of the target month
    const target = new Date(y, m - 1 + months, d);
    // If the day overflowed (e.g., Jan 31 + 1 month), clamp to last day of the month
    if (target.getDate() !== d) {
        target.setDate(0); // last day of previous (= correct) month
    }
    return [
        target.getFullYear(),
        String(target.getMonth() + 1).padStart(2, '0'),
        String(target.getDate()).padStart(2, '0'),
    ].join('-');
}

export async function analyzeContractWithLlm(
    config: AppConfig,
    contractText: string,
): Promise<LlmContractAnalysis | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;
    if (!contractText || contractText.trim().length < 50) return null;

    // Limit text to avoid token overflow but prioritize both start and end
    // Signature dates are often at the very end of Brazilian contracts
    let processedText = contractText;
    if (contractText.length > 12000) {
        const start = contractText.substring(0, 6000);
        const end = contractText.substring(contractText.length - 6000);
        processedText = `${start}\n\n[... TEXTO INTERMEDIÁRIO OMITIDO ...]\n\n${end}`;
    }

    const response = await callLlmApi(
        config,
        [{ role: 'user', content: `Analise o seguinte contrato:\n\n${processedText}` }],
        CONTRACT_ANALYSIS_PROMPT,
    );

    if (!response) return null;

    try {
        // Extract JSON from response — handle cases where LLM wraps in markdown
        let jsonStr = response.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        // Also handle if wrapped in just curly braces with leading text
        const braceStart = jsonStr.indexOf('{');
        const braceEnd = jsonStr.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
            jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
        }

        const parsed = JSON.parse(jsonStr);

        // Auto-calculate dataVencimento if missing but dataInicio + vigenciaMeses exist
        let dataVencimento: string | undefined = parsed.dataVencimento || undefined;
        const vigenciaMeses: number | undefined = parsed.vigenciaMeses
            ? Number(parsed.vigenciaMeses)
            : undefined;
        if (!dataVencimento && parsed.dataInicio && vigenciaMeses) {
            dataVencimento = addMonthsToIso(parsed.dataInicio, vigenciaMeses);
        }

        return {
            nomeContrato: parsed.nomeContrato || undefined,
            dataInicio: parsed.dataInicio || undefined,
            vigenciaMeses,
            dataVencimento,
            valorImplantacao: parsed.valorImplantacao || undefined,
            valorMensalidade: parsed.valorMensalidade || undefined,
            valorTotal: parsed.valorTotal || undefined,
            breakdownValor: parsed.breakdownValor || undefined,
            empresaContratante: parsed.empresaContratante || undefined,
            empresaContratada: parsed.empresaContratada || undefined,
            empresa: parsed.empresa || parsed.empresaContratante || parsed.empresaContratada || undefined,
            tipoServico: parsed.tipoServico || undefined,
            descricaoObjeto: parsed.descricaoObjeto || undefined,
            clausulasAbusivas: Array.isArray(parsed.clausulasAbusivas)
                ? parsed.clausulasAbusivas
                : [],
            assinaturasAusentes: Array.isArray(parsed.assinaturasAusentes)
                ? parsed.assinaturasAusentes
                : [],
            vulnerabilidades: Array.isArray(parsed.vulnerabilidades)
                ? parsed.vulnerabilidades
                : [],
            alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
        };
    } catch {
        console.warn('LLM contract analysis: failed to parse JSON response');
        return null;
    }
}

// ─── AI Audit Log Summary ────────────────────────────────────────

export async function generateAuditSummary(
    config: AppConfig,
    logs: { usuario: string; acao: string; detalhes: string; data: string }[]
): Promise<string | null> {
    if (!config.llmApiKey || config.llmStatus !== 'connected') return null;
    if (logs.length === 0) return "Nenhum log disponível para análise.";

    const logsText = logs.map(l =>
        `[${l.data}] ${l.usuario}: ${l.acao} - ${l.detalhes}`
    ).join('\n');

    const prompt = `Você é um Auditor Profissional de TI e Segurança Cibernética. Analise os seguintes logs de atividade do sistema "Legal Whisperer Pro" e gere um resumo executivo de alto nível.

ESTRUTURA DESEJADA (Use Markdown):
1. **Visão Geral**: Resumo em 2 frases da atividade recente.
2. **Tendências e Padrões**: Quais ações são mais frequentes? Algum horário de pico?
3. **Riscos e Alertas**: Identifique logins falhos, exclusões de contratos ou alterações críticas de configuração.
4. **Recomendações**: 3 ações práticas para melhorar a segurança ou eficiência.

LOGS PARA ANÁLISE:
${logsText}`;

    return await callLlmApi(
        config,
        [{ role: 'user', content: prompt }],
        "Você é um especialista em auditoria e segurança. Seja conciso, profissional e focado em riscos."
    );
}
