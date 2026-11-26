/**
 * Site başına "arayüz durumu" çerezleri.
 *
 * Bu çerezler oturum kimliği taşımaz; sayfanın kendi düzen tercihini tutar
 * (ör. ChatGPT'nin kenar çubuğunun açık/kapalı hâli ve genişliği). Uygulama
 * sayfayı kendi kalıcı bölümünde (partition) barındırdığı için bu tercih
 * uygulamaya aittir.
 *
 * Tarayıcıdan çerez aktarımı bu adları **ne yazmalı ne de silmeli**. İkisi de
 * aynı hatayı üretir: tarayıcıdaki değer yazılırsa kullanıcının uygulamada
 * kapattığı panel her aktarımda yeniden açılır; tarayıcı çerezi göndermiyor
 * diye silinirse uygulamada kurulan tercih yine kaybolur. Kimlik çerezleri
 * (oturum, CSRF, cihaz) bu listede yer almaz ve aktarım onları eskisi gibi
 * eşitler.
 *
 * Yeni bir sağlayıcı aynı davranışı gösterirse adı buraya eklenir; tahmine
 * dayalı bir desen (ör. adında "sidebar" geçen her çerez) kullanılmaz, çünkü
 * yanlış eşleşme oturumu taşımamak demektir.
 */
export const SITE_UI_STATE_COOKIES = {
  chatgpt: ['codex_sidebar_state', 'codex_sidebar_width']
} as const satisfies Record<string, readonly string[]>

/**
 * Bir sitenin arayüz durumu çerezleri; tanımsız site için boş liste.
 *
 * `Object.hasOwn` prototip zincirinden gelen bir üyeyi çerez adı sanmayı
 * engeller: tablo düz bir nesne olduğu için çıplak bir bakış `constructor`
 * gibi bir kimliğe `Object.prototype` üyesini döndürürdü.
 */
export function getSiteUiStateCookieNames(siteId: string): readonly string[] {
  if (!Object.hasOwn(SITE_UI_STATE_COOKIES, siteId)) {
    return []
  }
  const names = (SITE_UI_STATE_COOKIES as Record<string, readonly string[] | undefined>)[siteId]
  return names ?? []
}
