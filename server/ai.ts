import OpenAI from "openai";
import { Audience, DashboardMetrics, Script } from "../src/types";

let cachedKey: string | undefined;
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  if (apiKey !== cachedKey || !openaiClient) {
    cachedKey = apiKey;
    openaiClient = new OpenAI({
      apiKey: apiKey.trim(),
    });
  }
  return openaiClient;
}

const AI_UNAVAILABLE_MESSAGE = "Inteligência artificial temporariamente indisponível.";

export interface PrintAnalysisResult {
  suggestedClass: "A" | "B" | "C" | "INCONCLUSIVE";
  confidence: number;
  visibleFacts: {
    username?: string;
    followerText?: string;
    bioSummary?: string;
    contentPattern?: string;
  };
  strengths: string[];
  risks: string[];
  opportunity: string;
  rationale: string;
  missingInformation: string[];
}

/**
 * Lead scoring by analyzing Instagram profile screenshot using OpenAI Vision
 */
export async function analyzeProfilePrint(
  imageBase64: string,
  mimeType: string,
  audience: Audience,
  additionalNotes?: string,
  modelName = "gpt-5.6-luna"
): Promise<{ success: boolean; data?: PrintAnalysisResult; error?: string }> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const cleanMime = mimeType || "image/jpeg";
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:${cleanMime};base64,${imageBase64}`;

    const prompt = `Você é um analista comercial sênior especializado em prospecção de clientes para edição de vídeo de alta conversão.
Analise este print do perfil do Instagram para avaliar se o perfil é Classe A, B ou C para os serviços da nossa agência de edição.

Critérios do Público Selecionado (${audience.name}):
- Descrição: ${audience.description}
- Critérios Classe A: ${audience.criteriaA}
- Critérios Classe B: ${audience.criteriaB}
- Critérios Classe C: ${audience.criteriaC}
- Instruções extras: ${audience.aiInstructions || "Nenhuma"}
${additionalNotes ? `- Observações adicionais informadas pelo prospector: ${additionalNotes}` : ""}

DIRETRIZES ÉTICAS E DE SEGURANÇA ESTRITAS (NÃO NEGOCIÁVEIS):
- PROIBIDO inferir renda, idade, religião, orientação sexual, saúde, etnia ou qualquer atributo sensível a partir de fotos, nome ou aparência.
- A classificação deve se ater ESTRITAMENTE a sinais comerciais, qualidade aparente dos vídeos/capas, presença de links comerciais, consistência de postagens e dados visíveis de engajamento/formato.
- Se o print estiver ilegível, retorne suggestedClass: "INCONCLUSIVE" e descreva em missingInformation.

Retorne estritamente um objeto JSON com as seguintes chaves:
{
  "suggestedClass": "A" | "B" | "C" | "INCONCLUSIVE",
  "confidence": número de 0 a 100,
  "visibleFacts": {
    "username": string,
    "followerText": string,
    "bioSummary": string,
    "contentPattern": string
  },
  "strengths": string[],
  "risks": string[],
  "opportunity": string,
  "rationale": string,
  "missingInformation": string[]
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: AI_UNAVAILABLE_MESSAGE };
    }

    const parsed = JSON.parse(content);
    let sClass = parsed.suggestedClass?.toUpperCase() || "INCONCLUSIVE";
    if (!["A", "B", "C", "INCONCLUSIVE"].includes(sClass)) {
      sClass = "INCONCLUSIVE";
    }

    return {
      success: true,
      data: {
        suggestedClass: sClass as any,
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
        visibleFacts: parsed.visibleFacts || {},
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        opportunity: parsed.opportunity || "Oportunidade na melhoria de ganchos e dinamismo visual.",
        rationale: parsed.rationale || "Classificação baseada nos critérios visíveis.",
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: AI_UNAVAILABLE_MESSAGE,
    };
  }
}

/**
 * Funnel Bottleneck Analysis
 */
export async function analyzeFunnelBottlenecks(
  metrics: DashboardMetrics,
  modelName = "gpt-5.6-luna"
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const prompt = `Você é um estrategista de vendas B2B e growth especializado em funis de prospecção para agências de edição de vídeo.
Analise os seguintes dados agregados de conversão e volume do funil comercial:

MÉTRICAS DE VOLUME (Período: ${metrics.period.type}):
- Novos Leads: ${metrics.volumes.newLeads}
- Prospectados/Contatados: ${metrics.volumes.contacted}
- Respostas: ${metrics.volumes.responded}
- Testes Oferecidos: ${metrics.volumes.testsOffered}
- Testes Aceitos: ${metrics.volumes.testsAccepted}
- Negociações: ${metrics.volumes.negotiations}
- Fechados: ${metrics.volumes.closed}
- Perdidos: ${metrics.volumes.lost}

TAXAS DA COORTE DE CONTATADOS:
- Taxa de Resposta: ${(metrics.cohort.responseRate ?? 0).toFixed(1)}%
- Aceitação de Teste (Aceitos / Oferecidos): ${(metrics.cohort.testAcceptanceRate ?? 0).toFixed(1)}%
- Taxa de Fechamento Geral: ${(metrics.cohort.closeRate ?? 0).toFixed(1)}%

CONVERSÃO POR CLASSE NA COORTE:
- Classe A: ${metrics.cohort.byClass.A.closed}/${metrics.cohort.byClass.A.contacted} (${(metrics.cohort.byClass.A.rate ?? 0).toFixed(1)}%)
- Classe B: ${metrics.cohort.byClass.B.closed}/${metrics.cohort.byClass.B.contacted} (${(metrics.cohort.byClass.B.rate ?? 0).toFixed(1)}%)
- Classe C: ${metrics.cohort.byClass.C.closed}/${metrics.cohort.byClass.C.contacted} (${(metrics.cohort.byClass.C.rate ?? 0).toFixed(1)}%)

MOTIVOS DE PERDA REGISTRADOS:
${metrics.lossReasonsBreakdown.map((r) => `- ${r.reasonName}: ${r.count} (${(r.percentage ?? 0).toFixed(1)}%)`).join("\n")}

DIRETRIZES DA ANÁLISE:
1. Identifique o PRINCIPAL GARGALO do funil com evidências numéricas claras.
2. Formule 2 a 3 HIPÓTESES explicativas para esse gargalo.
3. Diferencie correlação de causalidade (não afirme certezas sem teste A/B isolado).
4. Sugira 2 EXPERIMENTOS práticos de melhoria imediata para a equipe de prospecção.
Formate a resposta em Markdown limpo, direto e profissional em português do Brasil.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "system",
          content: "Você é um consultor sênior de operações comerciais e prospecção de vendas B2B.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return {
      success: true,
      analysis: response.choices[0]?.message?.content || "Análise concluída sem retorno textual.",
    };
  } catch (err: any) {
    return { success: false, error: AI_UNAVAILABLE_MESSAGE };
  }
}

/**
 * Script Performance Comparison & Variant Suggestion
 */
export async function analyzeScriptPerformance(
  scripts: Script[],
  metrics: DashboardMetrics,
  minSample = 5,
  modelName = "gpt-5.6-luna"
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const scriptData = metrics.cohort.byScript.map((s) => {
      const fullScript = scripts.find((x) => x.id === s.scriptId);
      return {
        id: s.scriptId,
        name: `${s.scriptName} (V${s.version})`,
        audience: s.audienceName,
        sampleSize: s.sampleSize,
        responseRate: `${(s.responseRate ?? 0).toFixed(1)}%`,
        closeRate: `${(s.closeRate ?? s.conversionRate ?? 0).toFixed(1)}%`,
        content: fullScript?.content || "(conteúdo não encontrado)",
      };
    });

    const prompt = `Você é um copywriter de resposta direta especializado em Cold DMs e prospecção ativa de criadores no Instagram.
Amostra mínima configurada: ${minSample} contatos por script.

DADOS DE PERFORMANCE DOS SCRIPTS:
${JSON.stringify(scriptData, null, 2)}

INSTRUÇÃO:
1. Avalie quais scripts têm amostra estatística relevante (>= ${minSample} contatos) vs amostras preliminares.
2. Analise a taxa de resposta e também a taxa final de fechamento (não julgue script apenas pela resposta).
3. Para o script com melhor ou pior desempenho, sugira a PRÓXIMA VARIAÇÃO sugerida alterando PREFERENCIALMENTE UM ÚNICO ELEMENTO POR VEZ (ex: gancho inicial, oferta do teste, chamada para ação ou tamanho) para manter controle científico de aprendizado.
4. Escreva a nova mensagem sugerida pronta para uso.

Retorne em Markdown bem estruturado em português do Brasil.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "system",
          content: "Você é um copywriter de resposta direta sênior e especialista em prospecção via Direct.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return {
      success: true,
      analysis: response.choices[0]?.message?.content || "",
    };
  } catch (err: any) {
    return { success: false, error: AI_UNAVAILABLE_MESSAGE };
  }
}

/**
 * Monthly / Period Executive Summary
 */
export async function generateExecutiveSummary(
  metrics: DashboardMetrics,
  modelName = "gpt-5.6-luna"
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const prompt = `Você é o Diretor de Operações e Estratégia Comercial da agência.
Gere um Resumo Executivo conciso e de alto impacto para a reunião de alinhamento com a liderança (CEO e COO).

DADOS CONSOLIDADOS DO PERÍODO:
- Volume de Novos Leads: ${metrics.volumes.newLeads}
- Contatados: ${metrics.volumes.contacted}
- Taxa de Resposta: ${(metrics.cohort.responseRate ?? 0).toFixed(1)}%
- Aceitação de Testes: ${(metrics.cohort.testAcceptanceRate ?? 0).toFixed(1)}%
- Clientes Fechados: ${metrics.volumes.closed}
- Taxa de Fechamento da Coorte: ${(metrics.cohort.closeRate ?? 0).toFixed(1)}%
- Leads Perdidos: ${metrics.volumes.lost}
- Comparativo Ativo vs Pago:
  * Ativo: ${metrics.activeVsPaid.active.contacted} contatados, ${metrics.activeVsPaid.active.closed} fechados (${(metrics.activeVsPaid.active.closeRate ?? 0).toFixed(1)}%)
  * Pago: ${metrics.activeVsPaid.paid.contacted} contatados, ${metrics.activeVsPaid.paid.closed} fechados (${(metrics.activeVsPaid.paid.closeRate ?? 0).toFixed(1)}%)
- Principais Motivos de Perda:
  ${metrics.lossReasonsBreakdown.map((r) => `* ${r.reasonName}: ${r.count}`).join("\n")}

ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
1. **Destaques do Período**: 3 pontos rápidos de resultado numérico.
2. **Eficiência por Canal e Público**: Análise comparativa direta.
3. **Gargalos e Aprendizados de Perdas**: O que o padrão de perdas indica.
4. **3 Ações Recomendadas para o Próximo Ciclo**: Ações claras, com donos táticos sugeridos (CEO para tráfego/estratégia, COO para prospecção ativa/equipe).

Importante: Todos os dados numéricos devem ser estritamente fiéis aos fornecidos acima. Não invente métricas.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "system",
          content: "Você é um Diretor Comercial e COO focado em escala, controle de CAC e eficiência de funil.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return {
      success: true,
      summary: response.choices[0]?.message?.content || "",
    };
  } catch (err: any) {
    return { success: false, error: AI_UNAVAILABLE_MESSAGE };
  }
}

/**
 * Generate a complete audience/niche configuration with criteria A, B, C using OpenAI
 */
export async function generateAudienceWithAi(
  userPrompt: string,
  modelName = "gpt-5.6-luna"
): Promise<{
  success: boolean;
  audience?: {
    name: string;
    description: string;
    criteriaA: string;
    criteriaB: string;
    criteriaC: string;
    aiInstructions: string;
  };
  error?: string;
}> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const systemPrompt = `Você é um especialista em prospecção B2B e estratégia comercial para agências de edição de vídeo de alta retenção.
Com base no pedido do usuário, crie a parametrização completa de um novo Público/Nicho de Prospecção para o CRM.

Pedido do usuário: "${userPrompt}"

Você deve gerar estritamente um objeto JSON com as chaves:
1. "name": Nome claro, profissional e direto para o público (ex: "Médicos & Clínicas de Estética", "Criadores de Negócios & Finanças", "Podcasts de Tecnologia").
2. "description": Breve explicação de quem são esses perfis e por que contratam edição de vídeo.
3. "criteriaA": Critérios objetivos para classificar um perfil como Classe A (alta prioridade, alto poder aquisitivo, consistência de postagem, maior propensão a fechar contrato recorrente).
4. "criteriaB": Critérios para Classe B (perfil padrão, consistência média, potencial de crescimento).
5. "criteriaC": Critérios para Classe C (baixa prioridade, perfil inativo ou sem monetização).
6. "aiInstructions": Diretrizes visuais para o modelo analisar prints do Instagram deste público (ex: o que checar na bio, reels, capas, legendas).`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "user",
          content: systemPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: AI_UNAVAILABLE_MESSAGE };
    }

    const parsed = JSON.parse(content);
    return { success: true, audience: parsed };
  } catch (err: any) {
    return { success: false, error: AI_UNAVAILABLE_MESSAGE };
  }
}

/**
 * Generate an outreach script copy using OpenAI
 */
export async function generateScriptWithAi(
  userPrompt: string,
  audienceName?: string,
  modelName = "gpt-5.6-luna"
): Promise<{
  success: boolean;
  script?: {
    baseName: string;
    content: string;
    rationale?: string;
  };
  error?: string;
}> {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return {
        success: false,
        error: AI_UNAVAILABLE_MESSAGE,
      };
    }

    const systemPrompt = `Você é um copywriter comercial de alta conversão para prospecção ativa no Instagram Direct para agências de edição de vídeo (reels, tiktok, shorts, podcasts).
Com base nas instruções do usuário, crie um script de 1º contato altamente personalizado, persuasivo, natural e direto ao ponto.

Instruções do usuário: "${userPrompt}"
${audienceName ? `Público-alvo / Nicho: "${audienceName}"` : ""}

REGRAS ESSENCIAIS DE COPY PARA DIRECT:
1. Mensagem humana, sem parecer spam ou robô.
2. Elogio genuíno ao conteúdo e identificação rápida de uma oportunidade concreta de melhoria (retenção, ganchos nos primeiros 3 segundos, dinamismo, legendas).
3. Call To Action (CTA) de baixíssimo atrito (ex: oferta de 1 corte/vídeo teste gratuito sem compromisso para demonstrar o resultado).
4. Use variáveis entre colchetes como [Nome], [Tema], [Último Post] para o prospector preencher facilmente antes do envio.

Retorne estritamente um JSON com:
- "baseName": Nome curto e identificador para o script (ex: "Abordagem Rápida - Gancho de 3s + Teste Grátis")
- "content": O texto exato da mensagem pronta para envio.
- "rationale": Breve explicação de 1 frase do porquê dessa abordagem funcionar.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "user",
          content: systemPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: AI_UNAVAILABLE_MESSAGE };
    }

    const parsed = JSON.parse(content);
    return { success: true, script: parsed };
  } catch (err: any) {
    return { success: false, error: AI_UNAVAILABLE_MESSAGE };
  }
}

/**
 * AI Strategy Assistant for Apify Import (V2.1.1)
 */
export async function generateImportStrategyWithAi(
  params: {
    audience: Audience;
    location?: string;
    mode: "quality" | "balanced" | "volume";
  },
  modelName = "gpt-5.6-luna"
): Promise<{
  success: boolean;
  strategy?: {
    keywords: string[];
    searchLimitPerKeyword: number;
    minFollowers: number;
    maxFollowers: number | null;
    ignorePrivate: boolean;
    liveSearch: boolean;
    reasoning: {
      summary: string;
      keywordStrategy: string;
      followerStrategy: string;
    };
    assumptions: string[];
  };
  error?: string;
  code?: string;
}> {
  const { audience, location, mode } = params;

  // Fallback generator if AI is unavailable or offline
  const getFallbackStrategy = () => {
    const audName = audience.name.toLowerCase();
    const locClean = location ? location.toLowerCase().trim() : "";
    
    // Base keywords inferred from audience name & criteria
    const words = Array.from(
      new Set(
        `${audience.name} ${audience.criteriaA} ${audience.description}`
          .toLowerCase()
          .replace(/[^\w\sà-ú]/gi, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      )
    );

    const baseKeywords = [
      audName,
      `especialista ${audName}`,
      `clinica ${audName}`,
      `doutor ${audName}`,
      `mentoria ${audName}`,
      `consultoria ${audName}`,
      `criador ${audName}`,
      `palestrante ${audName}`,
    ];

    if (locClean) {
      baseKeywords.push(`${audName} ${locClean}`);
      baseKeywords.push(`clinica ${locClean}`);
    }

    const uniqueKeywords = Array.from(new Set(baseKeywords)).slice(0, 15);
    while (uniqueKeywords.length < 8) {
      const w = words.shift() || `profissional ${uniqueKeywords.length + 1}`;
      uniqueKeywords.push(w);
    }

    const searchLimit = mode === "quality" ? 20 : mode === "balanced" ? 30 : 50;
    const minFol = mode === "quality" ? 3000 : mode === "balanced" ? 1500 : 500;
    const maxFol = mode === "quality" ? 150000 : mode === "balanced" ? 300000 : null;

    return {
      keywords: uniqueKeywords,
      searchLimitPerKeyword: searchLimit,
      minFollowers: minFol,
      maxFollowers: maxFol,
      ignorePrivate: true,
      targetAudienceRationale: `Estratégia no modo ${mode.toUpperCase()} estruturada para o público ${audience.name}${location ? ` em ${location}` : ""}.`,
      source: "fallback" as const,
      // Backward compatibility fields
      suggestedKeywords: uniqueKeywords,
      suggestedSearchLimit: searchLimit,
      suggestedMinFollowers: minFol,
      suggestedMaxFollowers: maxFol,
      suggestedIgnorePrivate: true,
      rationale: `Estratégia no modo ${mode.toUpperCase()} estruturada para o público ${audience.name}${location ? ` em ${location}` : ""}.`,
      liveSearch: false,
      reasoning: {
        summary: `Estratégia no modo ${mode.toUpperCase()} estruturada para o público ${audience.name}${location ? ` em ${location}` : ""}.`,
        keywordStrategy: `Combinação de termos de autoridade, nicho e atuação direta em redes sociais.`,
        followerStrategy: `Faixa de seguidores ajustada para priorizar contas ativas com potencial comercial para serviços de vídeo.`,
      },
      assumptions: [
        "Faixa de seguidores estimada para maximizar perfis monetizados e com consistência de conteúdo.",
        "Perfis privados ignorados para garantir capacidade de visualização e avaliação prévia.",
      ],
    };
  };

  try {
    const openai = getOpenAIClient();
    if (!openai) {
      // Return structured fallback strategy with clear notification
      return {
        success: true,
        strategy: getFallbackStrategy(),
      };
    }

    const modeInstructions =
      mode === "quality"
        ? "MODO QUALIDADE: Priorize termos específicos e de alta autoridade/ticket. Sugira searchLimitPerKeyword menor (15-25), faixa de seguidores mais seletiva (ex: 3.000 a 150.000) e termos com forte intenção comercial."
        : mode === "volume"
        ? "MODO VOLUME: Priorize expansão de candidatos com termos amplos do ecossistema. Sugira searchLimitPerKeyword maior (40-75), faixa de seguidores mais aberta (ex: min 1.000, maxFol null ou alto)."
        : "MODO EQUILÍBRIO: Combine termos diretos, variações de autoridade e termos comerciais moderados. Sugira searchLimitPerKeyword em torno de 25-35 e faixa intermediária (ex: 2.000 a 250.000).";

    const prompt = `Você é o Estrategista-Chefe de Inteligência de Prospecção para agências de edição de vídeo de alta conversão.
Gere uma estratégia altamente otimizada de busca por palavras-chave e parâmetros para o robô de raspagem do Instagram (Apify Instagram Search Scraper).

DADOS DO PÚBLICO-ALVO SELECIONADO:
- Nome: ${audience.name}
- Descrição: ${audience.description}
- Critérios Classe A (Alta Prioridade): ${audience.criteriaA}
- Critérios Classe B: ${audience.criteriaB}
- Critérios Classe C: ${audience.criteriaC}
- Instruções de Análise Visual: ${audience.aiInstructions || "Nenhuma"}
${location ? `- LOCALIZAÇÃO PRIORITÁRIA INFORMADA: "${location}"` : ""}

DIRETRIZES DO MODO SELECIONADO (${mode.toUpperCase()}):
${modeInstructions}

REGRAS OBRIGATÓRIAS PARA AS PALAVRAS-CHAVE (KEYWORDS):
1. Gere entre 8 e 25 palavras-chave de busca no Instagram.
2. O conjunto deve ser DIVERSIFICADO, cobrindo:
   - Profissão / Cargo / Título direto (ex: cirurgiao plastico, dermatologista)
   - Nicho e sub-especialidades (ex: rinoplastia, harmonizacao)
   - Sinais de autoridade / conteúdo (ex: podcast medico, cursos medicos, mentoria)
   - Termos comerciais e de negócio (ex: clinica medica, consultorio)
   - Termos naturais frequentemente usados na Bio do Instagram
${location ? `3. IMPORTANTE PARA LOCALIZAÇÃO: Como foi informada "${location}", gere uma parte relevante das palavras (ex: 30-50%) combinando termos com a cidade/região (ex: "dermatologista ${location}", "clinica ${location}"), mas NÃO coloque a localização em todas as palavras para não limitar excessivamente a busca.` : "3. Como não há localização restrita, foque em alcance nacional/global em língua portuguesa."}
4. Remova repetições e variações inúteis. A lista deve ser rigorosamente deduplicada.
5. Evite termos genéricos demais sem contexto comercial e evite hashtags aleatórias.

REGRAS DE FILTRO DE SEGUIDORES E PARÂMETROS:
- searchLimitPerKeyword: número inteiro entre 1 e 100 sugerido para o modo ${mode}.
- minFollowers: número inteiro >= 0 (ex: 1000 a 5000).
- maxFollowers: número inteiro >= minFollowers ou null se não houver teto.
- ignorePrivate: boolean (true por padrão).
- liveSearch: boolean (false por padrão).
- Se o público não definir teto explícito de seguidores, inclua a suposição em "assumptions".

Retorne estritamente um objeto JSON com o formato:
{
  "keywords": ["termo 1", "termo 2", ...],
  "searchLimitPerKeyword": number,
  "minFollowers": number,
  "maxFollowers": number | null,
  "ignorePrivate": boolean,
  "liveSearch": boolean,
  "reasoning": {
    "summary": "Resumo executivo da estratégia em 1-2 frases",
    "keywordStrategy": "Explicação da escolha dos grupos de palavras",
    "followerStrategy": "Justificativa da faixa de seguidores e limites"
  },
  "assumptions": [
    "Premissa 1 adotada",
    "Premissa 2 adotada"
  ]
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || modelName || "gpt-5.6-luna",
      messages: [
        {
          role: "system",
          content: "Você é um assistente sênior de growth e estratégia de prospecção comercial via Instagram.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: true,
        strategy: getFallbackStrategy(),
      };
    }

    const parsed = JSON.parse(content);
    
    // Validate and normalize AI output
    let rawKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    let cleanKeywords = Array.from(
      new Set(
        rawKeywords
          .map((k: any) => String(k).trim().toLowerCase())
          .filter((k: string) => k.length > 0)
      )
    );

    if (cleanKeywords.length < 8) {
      const fallback = getFallbackStrategy();
      for (const kw of fallback.keywords) {
        if (!cleanKeywords.includes(kw)) {
          cleanKeywords.push(kw);
        }
        if (cleanKeywords.length >= 8) break;
      }
    }
    if (cleanKeywords.length > 25) {
      cleanKeywords = cleanKeywords.slice(0, 25);
    }

    const searchLimit = Math.max(1, Math.min(100, Number(parsed.searchLimitPerKeyword) || (mode === "quality" ? 20 : 30)));
    const minFol = Math.max(0, Number(parsed.minFollowers) || (mode === "quality" ? 2500 : 1000));
    let maxFol: number | null = null;
    if (parsed.maxFollowers !== null && parsed.maxFollowers !== undefined && Number(parsed.maxFollowers) >= minFol) {
      maxFol = Number(parsed.maxFollowers);
    }

    const summaryRationale = parsed.reasoning?.summary || `Estratégia calibrada para ${audience.name}.`;
    const strategy = {
      keywords: cleanKeywords,
      searchLimitPerKeyword: searchLimit,
      minFollowers: minFol,
      maxFollowers: maxFol,
      ignorePrivate: parsed.ignorePrivate !== false,
      targetAudienceRationale: summaryRationale,
      source: "ai" as const,
      // Backward compatibility fields
      suggestedKeywords: cleanKeywords,
      suggestedSearchLimit: searchLimit,
      suggestedMinFollowers: minFol,
      suggestedMaxFollowers: maxFol,
      suggestedIgnorePrivate: parsed.ignorePrivate !== false,
      rationale: summaryRationale,
      liveSearch: parsed.liveSearch === true,
      reasoning: {
        summary: summaryRationale,
        keywordStrategy: parsed.reasoning?.keywordStrategy || "Termos selecionados com base no perfil e nicho.",
        followerStrategy: parsed.reasoning?.followerStrategy || "Faixa de seguidores ajustada para otimização de conversão.",
      },
      assumptions: Array.isArray(parsed.assumptions) && parsed.assumptions.length > 0
        ? parsed.assumptions
        : ["Faixa de seguidores calculada para perfis com potencial ativo de geração de conteúdo."],
    };

    return {
      success: true,
      strategy,
    };
  } catch (err: any) {
    // If OpenAI fails or times out, provide the robust fallback strategy
    return {
      success: true,
      strategy: getFallbackStrategy(),
    };
  }
}

