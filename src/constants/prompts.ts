export interface IPrompt {
    id: string;
    text: string;
}

export const DEFAULT_PROMPTS: IPrompt[] = [
    // --- Explain Simple ---
    {
        id: 'edu_explain_simple_tr',
        text: "Bu metni ilkokul seviyesindeki bir öğrencinin merakını giderecek şekilde, günlük hayattan basit benzetmeler ve hikayeleştirme teknikleri kullanarak açıkla. Metindeki karmaşık terimleri parantez içinde basitçe tanımla. Anahtar fikirleri **kalın** yazarak vurgula."
    },
    {
        id: 'edu_explain_simple_en',
        text: "Explain this text in a way that satisfies the curiosity of a primary school student, using simple analogies from daily life and storytelling techniques. Define complex terms in the text simply within parentheses. Highlight key ideas in **bold**."
    },

    // --- Quiz Generator ---
    {
        id: 'edu_quiz_gen_tr',
        text: "Bu metni esas alarak öğrenme düzeyini ölçmek için 3 adet 'zorlayıcı' çoktan seçmeli soru oluştur. Sorular ezberden ziyade kavrama ve analiz yeteneğini ölçsün. Her sorunun ardından doğru cevabı ve neden diğer şıkların yanlış olduğunu açıklayan detaylı bir **Çözüm** bölümü ekle."
    },
    {
        id: 'edu_quiz_gen_en',
        text: "Based on this text, create 3 'challenging' multiple-choice questions to measure learning level. Questions should assess comprehension and analysis rather than rote memorization. Add a detailed **Solution** section after each question explaining the correct answer and why other options are incorrect."
    },

    // --- Summary / Cheat Sheet ---
    {
        id: 'edu_summary_study_tr',
        text: "Bu içeriği bir sınav hazırlık notu (cheat sheet) formatında düzenle. \n1. **Temel Kavramlar**: Metindeki en önemli 3 terimi tanımla.\n2. **Kritik Noktalar**: Önemli bilgileri madde madde sırala.\n3. **Neden Önemli?**: Bu bilginin gerçek dünyada veya literatürde neden önemli olduğunu 1 cümleyle özetle."
    },
    {
        id: 'edu_summary_study_en',
        text: "Organize this content into an exam preparation note (cheat sheet) format. \n1. **Key Concepts**: Define the 3 most important terms in the text.\n2. **Critical Points**: List important information in bullet points.\n3. **Why It Matters**: Summarize in 1 sentence why this information is important in the real world or literature."
    },

    // --- Socratic Tutor ---
    {
        id: 'edu_socratic_tutor_tr',
        text: "Sen sokratik bir öğretmensin. Bu metni doğrudan açıklamak yerine, öğrencinin (benim) konuyu kendi kendime keşfetmemi sağlayacak 3 adet düşündürücü soru sor. Sorular metindeki bilgileri birbiriyle ilişkilendirmemi gerektirsin."
    },
    {
        id: 'edu_socratic_tutor_en',
        text: "You are a Socratic teacher. Instead of explaining this text directly, ask 3 thought-provoking questions that will allow me (the student) to discover the topic on my own. The questions should require me to connect the information in the text."
    },

    // --- Analogy Master ---
    {
        id: 'edu_analogy_master_tr',
        text: "Bu metindeki temel mekanizmayı veya fikri, tamamen farklı bir alandan (örneğin trafik, yemek yapma veya spor) yaratıcı bir analoji (benzetme) kurarak anlat. 'X, Y gibidir çünkü...' kalıbını kullanarak benzerlikleri detaylandır."
    },
    {
        id: 'edu_analogy_master_en',
        text: "Explain the core mechanism or idea in this text by creating a creative analogy from a completely different field (e.g., traffic, cooking, or sports). Detail the similarities using the 'X is like Y because...' pattern."
    },
    // --- New Turkish Prompts ---
    {
        id: 'study_flashcards_tr',
        text: "Metindeki önemli bilgileri soru-cevap formatında, bilgi kartı (flashcard) olarak kullanılabilecek şekilde listele. Her kart için ön yüz (soru) ve arka yüz (cevap) belirt."
    },
    {
        id: 'study_true_false_tr',
        text: "Metindeki bilgilere dayanarak 5 adet Doğru/Yanlış sorusu oluştur. Her sorunun ardından cevabı ve neden doğru/yanlış olduğunu açıklayan kısa bir bilgi notu ekle."
    },
    {
        id: 'study_mnemonics_tr',
        text: "Metindeki zor terimleri veya listeleri akılda tutmak için yaratıcı hafıza teknikleri (akrostiş, kafiye, hikayeleştirme) öner."
    },
    {
        id: 'study_real_world_tr',
        text: "Bu metindeki teorik bilgilerin günlük hayatta veya profesyonel iş dünyasında nasıl karşılık bulduğuna dair 3 somut örnek ver."
    },
    {
        id: 'study_critical_analysis_tr',
        text: "Metindeki argümanları eleştirel bir gözle incele. Yazarın sunduğu kanıtların yeterliliğini, olası varsayımlarını ve mantıksal boşluklarını analiz et."
    },
    {
        id: 'study_roleplay_interview_tr',
        text: "Metnin yazarıyla sert bir röportaj yapıyormuşsun gibi davran. Metindeki eksik veya tartışmalı noktaları ortaya çıkaracak 3 zorlayıcı soru sor."
    },
    {
        id: 'study_compare_contrast_tr',
        text: "Bu metindeki ana fikirleri, yaygın olarak bilinen karşıt görüşlerle veya alternatif teorilerle kıyasla. Benzerlik ve farkları vurgula."
    },
    {
        id: 'study_study_plan_tr',
        text: "Bu konuyu sıfırdan öğrenmek isteyen biri için, metindeki bilgileri temel alan 3 günlük yoğun bir çalışma planı ve pratik önerileri hazırla."
    },
    {
        id: 'study_glossary_tr',
        text: "Metinde geçen tüm teknik terimleri ve jargonları tespit et. Her biri için birer cümlelik, anlaşılır tanımlardan oluşan bir sözlük oluştur."
    },
    {
        id: 'study_future_implications_tr',
        text: "Metindeki trendlere ve bilgilere dayanarak, bu konunun gelecekte (5-10 yıl içinde) nasıl bir yön alabileceğine dair 3 farklı senaryo üret."
    },

    // --- New English Prompts ---
    {
        id: 'study_flashcards_en',
        text: "Extract key information from the text and list it in a question-answer format suitable for flashcards. Specify 'Front' (Question) and 'Back' (Answer) for each card."
    },
    {
        id: 'study_true_false_en',
        text: "Create 5 True/False questions based on the text. For each question, provide the correct answer and a brief explanation of why it is true or false."
    },
    {
        id: 'study_mnemonics_en',
        text: "Suggest creative memory aids (mnemonics, acronyms, rhymes, or stories) to help memorize difficult terms or lists found in the text."
    },
    {
        id: 'study_real_world_en',
        text: "Provide 3 concrete examples of how the theoretical knowledge in this text applies to daily life or professional scenarios."
    },
    {
        id: 'study_critical_analysis_en',
        text: "Critically analyze the arguments in the text. Evaluate the sufficiency of the evidence provided, identify underlying assumptions, and point out any logical gaps."
    },
    {
        id: 'study_roleplay_interview_en',
        text: "Act as if you are conducting a tough interview with the author. Ask 3 challenging questions that expose gaps, contradictions, or controversial points in the text."
    },
    {
        id: 'study_compare_contrast_en',
        text: "Compare and contrast the main ideas in this text with common opposing views or alternative theories. Highlight the key similarities and differences."
    },
    {
        id: 'study_study_plan_en',
        text: "Create a 3-day intensive study plan based on this text for someone learning the topic from scratch. Include daily, actionable practice tasks."
    },
    {
        id: 'study_glossary_en',
        text: "Identify all technical terms and jargon in the text. Create a glossary with clear, one-sentence definitions for each term."
    },
    {
        id: 'study_future_implications_en',
        text: "Based on the trends and information in the text, predict 3 scenarios tailored to how this topic might evolve in the next 5-10 years."
    }
] as const
