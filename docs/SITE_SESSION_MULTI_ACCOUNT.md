# Google çoklu hesap ve diğer sitelerde tek oturum

Çoklu hesap yalnızca Google ailesinde (Gemini, AI Studio, YouTube ve Drive)
etkindir. Diğer AI ve özel siteler tek kalıcı uygulama oturumu kullanır;
bu sitelerde hesap seçici gösterilmez ve backend eski sekme tercihlerindeki
ikinci/üçüncü yuva isteklerini tek oturuma yönlendirir.

## Google kullanımı

1. Aynı Chrome profilinde Google hesaplarınızı açık tutun.
2. Eklentiden Google oturumlarını bir kez aktarın. Eklentide hedef hesap yuvası
   seçimi yoktur; Google hesap kümesi tek aktarımda gelir.
3. Quizlab'de Google uygulamasını açıp sekme çubuğundaki listeden Hesap 1,
   Hesap 2 veya Hesap 3 seçin. İsterseniz aynı Google uygulamasını ayrı sekmelerde
   farklı hesaplarla kullanabilirsiniz.
4. Chrome'a üçüncü veya sonraki bir Google hesabını ekledikten sonra Google
   oturumlarını yeniden aktarın. Uygulamada ilgili hesabı seçin. Önceden
   hazırlanmış Google yuvaları daha yeni aktarım varsa yeniden açılışta güncellenir.
5. Hesap sırası Chrome Google oturumundaki giriş sırasıdır: Hesap 1 `/u/0`,
   Hesap 2 `/u/1`, Hesap 3 `/u/2` ile açılır. Eski sayfa adreslerinin hesap
   numarası da seçilen yuvaya göre düzeltilir.

Liste, Google'ın oturumdaki hesap yanıtından okunur. Seçim yaptıkça yeni
seçenek eklenmez; geçmişte kullanılan yuva numaraları hesap sayılmaz. Çıkış
yapılmış veya oturumu geçersiz hesaplar listelenmez. Okuma başarısız olduğunda
ilave hesap tahmin edilmez. Yalnızca hesap numaraları arayüze gönderilir;
hesap e-postaları ve adları kaydedilmez. Uygulama en fazla 20 Google yuvasını
kabul eder. Yeni hesap ekledikten sonra aktarımı yenileyin.
Hesapları farklı sırada yeniden açarsanız Google hesap numaraları da değişebilir.

## Diğer AI siteleri

Eklentide siteyi seçip aktarın. ChatGPT, Claude ve diğer AI siteleri tek oturum
kullanır. Eski ikincil oturum verileri bu değişiklik sırasında silinmez fakat
aktif olarak seçilmez. Oturum temizleme işlemi geçmişte kullanılan yuvaları da
kapsar. Sitenin aktarım anahtarını kapatmak uygulama oturumunu temizler;
yalnızca eşitlemeyi durdurmak için eklentide otomatik eşitlemeyi kapatın.

## Teknik sınırlar ve doğrulama

Google tek çerez kümesinde birden fazla hesabı taşır; uygulama ayrı partition
ve hesaba özgü URL kullanarak hesabı seçer. Aktarım parolaları, localStorage veya
IndexedDB'yi kopyalamaz. Google'dan çıkış yapmak sunucu oturumunu iptal edebilir.

- [Chrome cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Electron Session API](https://www.electronjs.org/docs/latest/api/session)

25 Ekim 2026: Google dışı tek oturum kuralı, üçüncü Google hesabının hazırlanması,
`/u/2` yönlendirmesi, eski tercihler, görünüm yaşam döngüsü ve eklenti dahil 622
ilgili test geçti. TypeScript ve backend derlemesi geçti. Önceki düzeltmede iki
Google hesabı Gemini ekranında canlı doğrulandı. Üçüncü gerçek Google hesabıyla
giriş doğrulanmadı; üçüncü hesap desteği otomatik testlerle kontrol edildi.

Son düzeltme: Listeyi kendiliğinden büyüten seçenek üretimi kaldırıldı.
Google ListAccounts yanıtının ayrıştırılması, önbelleğin yeni aktarımla
geçersizleşmesi ve iki hesap varken eski Hesap 5 seçiminin temizlenmesi dahil
446 ilgili test, TypeScript ve backend derlemesi geçti.
