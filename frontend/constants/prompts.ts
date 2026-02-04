export interface IPrompt {
    id: string;
    text: string;
}

export const DEFAULT_PROMPTS: IPrompt[] = [
    {
        id: 'edu_explain_simple',
        text: "Bu metni ilkokul seviyesindeki bir öğrencinin merakını giderecek şekilde, günlük hayattan basit benzetmeler ve hikayeleştirme teknikleri kullanarak açıkla. Metindeki karmaşık terimleri parantez içinde basitçe tanımla. Anahtar fikirleri **kalın** yazarak vurgula."
    },
    {
        id: 'edu_quiz_gen',
        text: "Bu metni esas alarak öğrenme düzeyini ölçmek için 3 adet 'zorlayıcı' çoktan seçmeli soru oluştur. Sorular ezberden ziyade kavrama ve analiz yeteneğini ölçsün. Her sorunun ardından doğru cevabı ve neden diğer şıkların yanlış olduğunu açıklayan detaylı bir **Çözüm** bölümü ekle."
    },
    {
        id: 'edu_summary_study',
        text: "Bu içeriği bir sınav hazırlık notu (cheat sheet) formatında düzenle. \n1. **Temel Kavramlar**: Metindeki en önemli 3 terimi tanımla.\n2. **Kritik Noktalar**: Önemli bilgileri madde madde sırala.\n3. **Neden Önemli?**: Bu bilginin gerçek dünyada veya literatürde neden önemli olduğunu 1 cümleyle özetle."
    },
    {
        id: 'edu_socratic_tutor',
        text: "Sen sokratik bir öğretmensin. Bu metni doğrudan açıklamak yerine, öğrencinin (benim) konuyu kendi kendime keşfetmemi sağlayacak 3 adet düşündürücü soru sor. Sorular metindeki bilgileri birbiriyle ilişkilendirmemi gerektirsin."
    },
    {
        id: 'edu_analogy_master',
        text: "Bu metindeki temel mekanizmayı veya fikri, tamamen farklı bir alandan (örneğin trafik, yemek yapma veya spor) yaratıcı bir analoji (benzetme) kurarak anlat. 'X, Y gibidir çünkü...' kalıbını kullanarak benzerlikleri detaylandır."
    }
] as const
