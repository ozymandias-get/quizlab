/**
 * Quiz API Service
 * Frontend service layer for quiz generation via Electron IPC
 * Replaces direct SDK calls with CLI-based generation
 */

// Quiz Settings Types
export const Difficulty = {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD'
} as const

export type DifficultyType = typeof Difficulty[keyof typeof Difficulty]

export const ModelType = {
    FLASH_2_5: 'gemini-2.5-flash',
    LITE_2_5: 'gemini-2.5-flash-lite',
    FLASH_3_0: 'gemini-3-flash-preview',
    PRO_3_0: 'gemini-3-pro-preview',
    FLASH_2_0: 'gemini-2.0-flash',
    FLASH_1_5: 'gemini-1.5-flash',
    PRO_1_5: 'gemini-1.5-pro'
} as const

export type ModelTypeEnum = typeof ModelType[keyof typeof ModelType]

export const QuestionStyle = {
    CLASSIC: 'CLASSIC',
    NEGATIVE: 'NEGATIVE',
    STATEMENT: 'STATEMENT',
    ORDERING: 'ORDERING',
    FILL_BLANK: 'FILL_BLANK',
    REASONING: 'REASONING',
    MATCHING: 'MATCHING',
    MIXED: 'MIXED'
} as const

export type QuestionStyleEnum = typeof QuestionStyle[keyof typeof QuestionStyle]

export interface QuizSettings {
    questionCount: number;
    difficulty: DifficultyType;
    model: string;
    style: QuestionStyleEnum[];
    focusTopic: string;
}

// Default Settings
export const DEFAULT_SETTINGS: QuizSettings = {
    questionCount: 10,
    difficulty: Difficulty.MEDIUM,
    model: ModelType.FLASH_2_5,
    style: [QuestionStyle.MIXED],
    focusTopic: ''
}

/**
 * Check if Quiz API is available
 */
export function isQuizApiAvailable(): boolean {
    return !!(window.electronAPI?.quiz)
}

/**
 * Get quiz generation settings
 */
export async function getQuizSettings(): Promise<QuizSettings> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available')
    }
    return await window.electronAPI.quiz.getSettings()
}

/**
 * Save quiz generation settings
 */
export async function saveQuizSettings(settings: QuizSettings): Promise<boolean> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available')
    }
    return await window.electronAPI.quiz.saveSettings(settings)
}

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctAnswerIndex: number;
    explanation: string;
    sourceQuote?: string;
}

/**
 * Generate quiz questions from PDF
 */
export async function generateQuizQuestions(
    pdfPath: string,
    settings: QuizSettings = DEFAULT_SETTINGS,
    language: string = 'tr',
    failedQuestionsContext: Question[] = [],
    previousQuestions: Question[] = []
): Promise<Question[]> {
    if (!isQuizApiAvailable()) {
        throw new Error('Quiz API not available - Are you running in Electron?')
    }

    // Handle demo mode - shorter delay for better UX
    if (pdfPath === 'DEMO') {
        await new Promise(resolve => setTimeout(resolve, 800))
        const demoLang = language === 'en' ? 'en' : 'tr'
        return MOCK_DEMO_QUESTIONS[demoLang] || MOCK_DEMO_QUESTIONS['tr']
    }

    const params: Record<string, unknown> = {
        type: 'quiz',
        pdfPath, // Now sending path, Gemini handles PDF directly
        questionCount: failedQuestionsContext.length > 0
            ? failedQuestionsContext.length
            : (settings.questionCount || 5),
        difficulty: settings.difficulty || Difficulty.MEDIUM,
        style: settings.style || [QuestionStyle.MIXED],
        focusTopic: settings.focusTopic || '',
        model: settings.model || ModelType.FLASH_3_0,
        language
    }

    // Add context for remedial mode
    if (failedQuestionsContext.length > 0) {
        // Strip HTML tags to ensure clean context for AI
        params.remedialTopics = failedQuestionsContext.map(q =>
            q.text.replace(/<[^>]*>/g, '').substring(0, 100)
        )
    }

    // Add context to avoid duplicate questions
    // Use more characters and more questions for better avoidance
    if (previousQuestions.length > 0) {
        params.avoidTopics = previousQuestions
            .slice(-25) // Last 25 questions
            .map(q => {
                // Strip HTML and take first 100 chars for better identification
                const cleanText = q.text.replace(/<[^>]*>/g, '').trim()
                return cleanText.substring(0, 100)
            })
            .filter(text => text.length > 10) // Filter out empty/short entries
    }

    try {
        const result = await window.electronAPI.quiz.generate(params)

        if (!result.success) {
            throw new Error(result.error || 'Quiz generation failed')
        }

        return result.data as Question[]
    } catch (error) {
        console.error('[QuizAPI] Generation error:', error)
        throw error
    }
}


/**
 * Ask question assistant (chat about a question)
 */
export async function askQuestionAssistant(question: Question, _history: unknown[], newMessage: string, _language: string = 'tr'): Promise<string> {
    if (!window.electronAPI?.quiz?.askAssistant) {
        return 'Assistant API not available.'
    }

    try {
        // Construct context from question
        const context = `
        QUESTION TEXT: ${question.text}
        OPTIONS: ${question.options.join(', ')}
        CORRECT ANSWER INDEX: ${question.correctAnswerIndex}
        EXPLANATION: ${question.explanation}
        `

        const result = await window.electronAPI.quiz.askAssistant(newMessage, context)

        if (result.success && result.data?.answer) {
            return result.data.answer
        } else {
            return result.error || 'Failed to get answer.'
        }
    } catch (error) {
        console.error('Assistant Error:', error)
        return 'Error communicating with assistant.'
    }
}

// Demo Data
const MOCK_DEMO_QUESTIONS: Record<string, Question[]> = {
    tr: [
        {
            id: 'demo1',
            text: '<strong>Akut Koroner Sendrom</strong> ön tanısı ile acil servise başvuran 55 yaşında erkek hasta. EKG’de V1-V4 derivasyonlarında ST segment elevasyonu izleniyor. Bu hastada en olası infarkt lokalizasyonu ve sorumlu koroner arter hangisidir?',
            options: [
                'Inferior MI - Sağ Koroner Arter (RCA)',
                'Anterior MI - Sol Ön İnen Arter (LAD)',
                'Lateral MI - Sirkumfleks Arter (Cx)',
                'Posterior MI - Sirkumfleks Arter (Cx)',
                'Sağ Ventrikül MI - Sağ Koroner Arter (RCA)'
            ],
            correctAnswerIndex: 1,
            explanation: '**Doğru cevap B.** V1-V4 derivasyonlarındaki ST elevasyonu anterior duvar miyokard infarktüsünü gösterir ve bu bölgeyi besleyen damar genellikle Sol Ön İnen Arterdir (LAD).',
            sourceQuote: 'EKG Bulguları ve Lokalizasyon'
        },
        {
            id: 'demo2',
            text: 'Aşağıdaki ilaçlardan hangisi <strong>hiperkalemi</strong> tedavisinde potasyumu hücre içine sokarak etki gösterir?',
            options: [
                'Kalsiyum Glukonat',
                'Sodyum Bikarbonat',
                'Furosemid',
                'Sodyum Polistiren Sülfonat',
                'Hemodiyaliz'
            ],
            correctAnswerIndex: 1,
            explanation: '**Doğru cevap B.** İnsülin+Glikoz ve Betaat-2 agonistler gibi Sodyum Bikarbonat da potasyumu hücre içine shift ettirerek serum potasyumunu düşürür. Kalsiyum glukonat kardiyak membran stabilizasyonu yapar, potasyum seviyesini düşürmez.',
            sourceQuote: 'Elektrolit Bozuklukları Tedavisi'
        },
        {
            id: 'demo3',
            text: '30 yaşında kadın hasta, son 3 aydır halsizlik, saç dökülmesi ve kilo alma şikayetleri ile başvuruyor. Fizik muayenede cilt kuru, bradikardi mevcut. TSH yüksek, sT4 düşük saptanıyor. En olası tanı nedir?',
            options: [
                'Graves Hastalığı',
                'Subakut Tiroidit',
                'Hashimoto Tiroiditi',
                'Toksik Multinodüler Guatr',
                'Sessiz Tiroidit'
            ],
            correctAnswerIndex: 2,
            explanation: '**Doğru cevap C.** Hipotiroidi bulguları (kilo alma, bradikardi, cilt kuruluğu) ve laboratuvar sonuçları (Yüksek TSH, Düşük T4) primer hipotiroidiyi işaret eder. Genç kadınlarda en sık sebep Hashimoto tiroiditidir.',
            sourceQuote: 'Tiroid Hastalıkları'
        },
        {
            id: 'demo4',
            text: 'Hangi vitamin eksikliğinde <strong>Wernicke-Korsakoff</strong> sendromu görülür?',
            options: [
                'B1 (Tiamin)',
                'B3 (Niasin)',
                'B6 (Piridoksin)',
                'B9 (Folat)',
                'B12 (Kobalamin)'
            ],
            correctAnswerIndex: 0,
            explanation: '**Doğru cevap A.** Tiamin (B1) eksikliği Wernicke ensefalopatisi (konfüzyon, ataksi, oftalmopleji) ve Korsakoff psikozuna (hafıza kaybı, konfabulasyon) neden olur. Özellikle kronik alkolizmde görülür.',
            sourceQuote: 'Vitamin Eksiklikleri'
        },
        {
            id: 'demo5',
            text: 'Aşağıdakilerden hangisi <strong>Tip 1 Hipersensitivite</strong> reaksiyonuna örnektir?',
            options: [
                'Kontakt Dermatit',
                'Serum Hastalığı',
                'Anafilaktik Şok',
                'Goodpasture Sendromu',
                'Tüberkülin Testi'
            ],
            correctAnswerIndex: 2,
            explanation: '**Doğru cevap C.** Anafilaktik şok IgE aracılı Tip 1 hipersensitivite reaksiyonudur. Kontakt dermatit Tip 4, Serum hastalığı Tip 3, Goodpasture Tip 2 reaksiyondur.',
            sourceQuote: 'İmmünoloji - Hipersensitivite'
        }
    ],
    en: [
        {
            id: 'demo_en_1',
            text: 'Which data structure follows the <strong>LIFO</strong> (Last In, First Out) principle?',
            options: [
                'Queue',
                'Stack',
                'Linked List',
                'Binary Tree',
                'Hash Map'
            ],
            correctAnswerIndex: 1,
            explanation: '**Correct Answer B.** A Stack follows the LIFO principle, where the last element added is the first one to be removed. Think of a stack of plates.',
            sourceQuote: 'Data Structures 101'
        },
        {
            id: 'demo_en_2',
            text: 'In <strong>Object-Oriented Programming</strong>, what concept refers to the ability of a function or method to behave differently based on the object it is called on?',
            options: [
                'Encapsulation',
                'Inheritance',
                'Polymorphism',
                'Abstraction',
                'Instantiation'
            ],
            correctAnswerIndex: 2,
            explanation: '**Correct Answer C.** Polymorphism allows methods to do different things based on the object it is acting upon, typically through method overriding or overloading.',
            sourceQuote: 'OOP Principles'
        },
        {
            id: 'demo_en_3',
            text: 'Which HTTP status code represents a <strong>"Not Found"</strong> error?',
            options: [
                '200',
                '301',
                '400',
                '404',
                '500'
            ],
            correctAnswerIndex: 3,
            explanation: '**Correct Answer D.** 404 is the standard HTTP status code indicating that the server cannot find the requested resource.',
            sourceQuote: 'Web Standards'
        },
        {
            id: 'demo_en_4',
            text: 'What is the primary function of <strong>DNS</strong> (Domain Name System)?',
            options: [
                'To encrypt data transmission',
                'To translate domain names into IP addresses',
                'To manage database transactions',
                'To route network packets',
                'To assign IP addresses dynamically'
            ],
            correctAnswerIndex: 1,
            explanation: '**Correct Answer B.** DNS acts as the phonebook of the internet, translating human-readable domain names (like google.com) into machine-readable IP addresses.',
            sourceQuote: 'Networking Basics'
        },
        {
            id: 'demo_en_5',
            text: 'Which of these is <strong>NOT</strong> a relational database management system?',
            options: [
                'MySQL',
                'PostgreSQL',
                'MongoDB',
                'Oracle Database',
                'Microsoft SQL Server'
            ],
            correctAnswerIndex: 2,
            explanation: '**Correct Answer C.** MongoDB is a NoSQL database that stores data in JSON-like documents, unlike the others which are relational (SQL) databases.',
            sourceQuote: 'Database Technologies'
        }
    ]
}

export default {
    generateQuizQuestions,
    askQuestionAssistant,
    getQuizSettings,
    saveQuizSettings,
    isQuizApiAvailable,
    Difficulty,
    ModelType,
    QuestionStyle,
    DEFAULT_SETTINGS
}
