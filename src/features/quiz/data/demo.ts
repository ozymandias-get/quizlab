import { Question } from '../types'

export const MOCK_DEMO_QUESTIONS: Record<string, Question[]> = {
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
