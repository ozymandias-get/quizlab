import path from 'path'

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
type Language = 'tr' | 'en'

export interface QuizPromptParams {
    questionCount?: number | string;
    difficulty?: Difficulty | string;
    style?: string[];
    focusTopic?: string;
    language?: Language | string;
    remedialTopics?: string[];
    avoidTopics?: string[];
    [key: string]: unknown;
}

/**
 * SECURITY: Sanitize user input to prevent prompt injection
 * @param {string} input - User input to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized input
 */
function sanitizeUserInput(input: unknown, maxLength: number = 150): string {
    if (typeof input !== 'string') {
        return ''
    }

    return input
        .replace(/[\r\n\t]/g, ' ')
        .replace(/ignore\s*(previous|all|above)/gi, '')
        .replace(/system\s*:/gi, '')
        .replace(/assistant\s*:/gi, '')
        .replace(/user\s*:/gi, '')
        .replace(/[{}[\]`]/g, '')
        .replace(/["'\\]/g, '')
        .replace(/#{2,}/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/\\u[0-9a-fA-F]{4}/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, maxLength)
        .trim()
}

/**
 * SECURITY: Sanitize array of strings
 * @param {Array} arr - Array of strings to sanitize
 * @param {number} maxItems - Maximum number of items
 * @param {number} maxLength - Maximum length per item
 * @returns {Array} - Sanitized array
 */
function sanitizeStringArray(arr: unknown, maxItems: number = 10, maxLength: number = 100): string[] {
    if (!Array.isArray(arr)) {
        return []
    }

    return arr
        .slice(0, maxItems)
        .map(item => sanitizeUserInput(String(item), maxLength))
        .filter(item => item.length > 0)
}

/**
 * Build the quiz generation prompt with PDF reference
 * @param {Object} params - Quiz parameters  
 * @param {string} pdfPath - Path to PDF file
 * @param {string} outputFilePath - Path where the JSON output should be written
 * @returns {string} - Formatted prompt
 */
export function buildQuizPrompt(params: QuizPromptParams, pdfPath: string, outputFilePath: string): string {
    const {
        questionCount = 5,
        difficulty = 'MEDIUM',
        style = ['MIXED'],
        focusTopic = '',
        language = 'tr',
        remedialTopics = [], // For remedial mode
        avoidTopics = [] // For diversity
    } = params

    // SECURITY: Validate and constrain numeric inputs
    const safeQuestionCount = Math.min(Math.max(Number.parseInt(String(questionCount), 10) || 5, 1), 30)

    // SECURITY: Validate difficulty against allowed values
    const allowedDifficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']
    const safeDifficulty = allowedDifficulties.includes(difficulty as Difficulty) ? (difficulty as Difficulty) : 'MEDIUM'

    // SECURITY: Validate language
    const allowedLanguages: Language[] = ['tr', 'en']
    const safeLanguage = allowedLanguages.includes(language as Language) ? (language as Language) : 'tr'

    // SECURITY: Sanitize all user inputs to prevent prompt injection
    const cleanFocusTopic = sanitizeUserInput(focusTopic, 150)
    const cleanRemedialTopics = sanitizeStringArray(remedialTopics, 10, 100)
    const cleanAvoidTopics = sanitizeStringArray(avoidTopics, 15, 50)

    // Determine Language Context
    const isTr = safeLanguage === 'tr'

    // --- TEMPLATES ---
    const CONTENT = {
        tr: {
            persona: `### PERSONA: SENIOR MEDICAL BOARD EXAMINER
    Sen Tıp Fakültesi komisyon başkanısın. Görevin, eleyici, düşündürücü ve klinikle bağlantılı sorular hazırlamak. Basit bilgi sorularından (Rote memorization) KAÇIN.`,
            criteria: `### GELİŞMİŞ SINAV KRİTERLERİ (ADVANCED CRITERIA)
    1. **KLİNİK VİNYET ZORUNLULUĞU:** Soruların en az %70'i bir hasta senaryosu ile başlamalıdır.
    2. **NEDEN-SONUÇ İLİŞKİSİ:** "Nedir?" yerine "Neden?" ve "Nasıl?" sorularına odaklan.
    3. **ÇELDİRİCİ KALİTESİ:** Yanlış şıklar mantıklı olmalı (yaygın hatalar, benzer tanılar).`,
            monologue: `### DÜŞÜNME SÜRECİ (INTERNAL MONOLOGUE)
    - "Bu soru öğrencinin sadece ezberini mi ölçüyor yoksa klinik muhakemesini mi?"
    - "Cevabı bilmeyen bir öğrenci, şıklardan eleyerek doğruyu bulabilir mi? (Bunu engelle)"`,
            titles: {
                params: "PARAMETRELER",
                lang: "Dil",
                diff: "Zorluk",
                dist: "SORU DAĞILIMI",
                format: "ÇIKTI FORMATI (JSON)"
            },
            explanation: `"explanation": "**Doğru Olan:** Neden bu yaklaşım doğru?\\n\\n**Yanlış Olanlar:** Diğer şıklar neden uygun değil (kontrendikasyon, yanlış tanı vb.)?"`,
            academic: {
                EASY: `ZORLUK: KOLAY (PREKLİNİK / DÖNEM 3). Bloom: Bilgi/Kavrama. Odak: Temel bilimler, klasik semptomlar.`,
                MEDIUM: `ZORLUK: ORTA (STAJYER / DÖNEM 5). Bloom: Uygulama. Odak: Sık görülen hastalıklar, acil yaklaşım.`,
                HARD: `ZORLUK: ZOR (UZMANLIK). Bloom: Analiz/Sentez. Odak: Atipik vakalar, komplikasyonlar, gri alanlar.`
            },
            context: {
                remedial: `🚨 MOD: EKSİK KAPATMA (REMEDIAL). Zayıf konular: {topics}. Basitleştirerek sor, ipuçları ver, mini ders gibi açıkla.`,
                spiral: `♻️ MOD: SPİRAL ÖĞRENME. Öncekiler: {topics}. Aynılarını sorma. Detaylara, dipnotlara odaklan.`
            },
            focus: (topic: string) => topic ? `ODAK KONUSU: "${topic}"` : "GENEL KAPSAM",
            styles: {
                MIXED: `MOD: TAM TEŞEKKÜLLÜ SINAV SİMÜLASYONU.\n    1. %50 VAKA (Reasoning/Ordering)\n    2. %30 MEKANİZMA (Statement/Classic)\n    3. %20 DİKKAT (Negative)`,
                FOCUS: `ODAK MODU AKTİF: Aşağıdaki yetkinlikleri ölçen sorular hazırla:\n    {styles}`
            },
            medicalStyles: {
                CLASSIC: `TİP: HIGH-YIELD BİLGİ. Spot bilgi sorusu ama klinik bağlam içinde.`,
                NEGATIVE: `TİP: AYIRICI TANI (EXCLUSION). "Hangi ilaç KONTRENDİKEDİR?" gibi sorular.`,
                STATEMENT: `TİP: MEKANİZMA ANALİZİ (I, II, III). Mantıksal çıkarım gerektirsin.`,
                ORDERING: `TİP: KLİNİK YÖNETİM ADIMLARI. "SIRADAKİ en uygun adım nedir?"`,
                FILL_BLANK: `TİP: KİLİT TANI KRİTERİ. Eksik bırakılan kritik bulguyu sor.`,
                REASONING: `TİP: KOMPLEKS KLİNİK VAKA. Multidisipliner yaklaşım.`,
                MATCHING: `TİP: KLİNİK SENDORMLAR. Sendrom-Belirti eşleştirmesi.`,
                // Explicitly added type for TypeScript compatibility
                MIXED: ''
            }
        },
        en: {
            persona: `### PERSONA: SENIOR MEDICAL BOARD EXAMINER
    You are the Head of the Medical Faculty Board. Prepare elimination-style, clinical questions. AVOID rote memorization.`,
            criteria: `### ADVANCED CRITERIA
    1. **CLINICAL VIGNETTE MANDATE:** At least 70% of questions must start with a patient scenario.
    2. **CAUSE-EFFECT:** Focus on "Why?" and "How?", not just "What?".
    3. **DISTRACTOR QUALITY:** Wrong options must be plausible (common mistakes, similar diseases).`,
            monologue: `### INTERNAL MONOLOGUE
    - "Does this question measure rote memory or reasoning?"
    - "Can a student guess the answer by elimination? (Prevent this)"`,
            titles: {
                params: "PARAMETERS",
                lang: "Language",
                diff: "Difficulty",
                dist: "QUESTION DISTRIBUTION",
                format: "OUTPUT FORMAT (JSON)"
            },
            explanation: `"explanation": "**Correct:** Why is this appropriate?\\n\\n**Incorrect:** Why are others not suitable?"`,
            academic: {
                EASY: `DIFFICULTY: EASY (PRECLINICAL / YEAR 3). Bloom: Recall/Understand. Focus: Basic sciences, classic symptoms.`,
                MEDIUM: `DIFFICULTY: MEDIUM (CLERKSHIP / YEAR 5). Bloom: Apply. Focus: Common diseases, emergency approach.`,
                HARD: `DIFFICULTY: HARD (SPECIALIST). Bloom: Analyze/Evaluate. Focus: Atypical cases, complications, grey areas.`
            },
            context: {
                remedial: `🚨 MODE: REMEDIAL TEACHING. Weak in: {topics}. Simplify first, give clues, explain like a mini-lesson.`,
                spiral: `♻️ MODE: SPIRAL LEARNING. Previous: {topics}. Do not repeat. Focus on fine print and details.`
            },
            focus: (topic: string) => topic ? `FOCUS TOPIC: "${topic}"` : "GENERAL SCOPE",
            styles: {
                MIXED: `MODE: FULL EXAM SIMULATION.\n    1. 50% CASE (Reasoning/Ordering)\n    2. 30% MECHANISM (Statement/Classic)\n    3. 20% ATTENTION (Negative)`,
                FOCUS: `FOCUS MODE ACTIVE: Prepare questions for:\n    {styles}`
            },
            medicalStyles: {
                CLASSIC: `TYPE: HIGH-YIELD KNOWLEDGE. Spot knowledge in clinical context.`,
                NEGATIVE: `TYPE: DIFFERENTIAL DIAGNOSIS. "Which drug is CONTRAINDICATED?"`,
                STATEMENT: `TYPE: MECHANISM ANALYSIS. Logical deduction required.`,
                ORDERING: `TYPE: CLINICAL MANAGEMENT STEPS. "What is the NEXT step?"`,
                FILL_BLANK: `TYPE: KEY DIAGNOSTIC CRITERIA. Ask for critical missing finding.`,
                REASONING: `TYPE: COMPLEX CLINICAL CASE. Multidisipliner approach.`,
                MATCHING: `TYPE: CLINICAL SYNDROMES. Syndrome-Symptom matching.`,
                // Explicitly added type for TypeScript compatibility
                MIXED: ''
            }
        }
    }

    const t = isTr ? CONTENT.tr : CONTENT.en
    const targetLang = isTr ? 'Türkçe' : 'English'

    // 1. Difficulty Instruction
    const academicLevelInstruction = t.academic[safeDifficulty] || t.academic.MEDIUM

    // 2. Style Instruction
    let activeStyleInstruction = ""
    if (style.includes('MIXED')) {
        activeStyleInstruction = t.styles.MIXED
    } else {
        const medicalStyleMapping = t.medicalStyles
        const validStyles = style
            .filter(s => s !== 'MIXED')
            .filter(s => medicalStyleMapping.hasOwnProperty(s))
            .map(s => `- ${medicalStyleMapping[s as keyof typeof medicalStyleMapping]}`)
            .join('\n')

        activeStyleInstruction = validStyles
            ? t.styles.FOCUS.replace('{styles}', validStyles)
            : t.styles.MIXED // Fallback
    }

    // 3. Context Instruction
    let contextInstruction = ""
    if (cleanRemedialTopics.length > 0) {
        contextInstruction = t.context.remedial.replace('{topics}', cleanRemedialTopics.join(', '))
    } else if (cleanAvoidTopics.length > 0) {
        contextInstruction = t.context.spiral.replace('{topics}', cleanAvoidTopics.join(', '))
    }

    const outputFileName = path.basename(outputFilePath)

    return `
    COMMAND: Analyze the file @${path.basename(pdfPath)} and generate a ${safeQuestionCount}-question quiz.
    
    🚨 CRITICAL - FILE OUTPUT REQUIRED:
    You MUST write the JSON result to file: ${outputFileName}
    Use your write_file tool to create this file with ONLY the JSON array content.
    DO NOT output the JSON to console. WRITE IT TO THE FILE.
    
    INSTRUCTIONS:
    1. DO NOT greet me. DO NOT say "I am ready".
    2. Write ONLY the JSON ARRAY to the file. NO MARKDOWN, NO EXTRA TEXT.
    3. If file is empty => write [{"error": "Empty file"}]

    ${t.persona}
    
    ${t.criteria}

    ### ${t.titles.params}
    - **${t.titles.lang}:** ${targetLang} (Medical terminology must be correct)
    - **${t.titles.diff}:** ${academicLevelInstruction}
    - **Topic:** ${t.focus(cleanFocusTopic)}
    ${contextInstruction}
    
    ### ${t.titles.dist}
    ${activeStyleInstruction}

    ${t.monologue}

    ### ${t.titles.format}
    [
      {
        "id": "q1",
        "text": "Long and detailed clinical vignette...",
        "options": ["A (Strong Distractor)", "B (Correct Answer)", "C (Strong Distractor)", "D", "E"],
        "correctAnswerIndex": 1, 
        ${t.explanation},
        "sourceQuote": "Ref..."
      }
    ]`
}
