/**
 * api-chat hazırlama telafisi.
 *
 * Yazma ile istek arasındaki hata, kullanıcının içeriğini hedefte iki kez
 * göstermemelidir. Bu modül tam olarak bunu yapar ve — en azından bu kadar
 * önemli — kullanıcının **kendi verisine** dokunmaz.
 */
import {
  createApiChatStaging,
  rollbackApiChatStaging,
  stageApiChatAttachments,
  stageApiChatInput
} from '@app/providers/ai/lib/apiChatStaging'

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeTab {
  input: string
  attachments: string[]
}

/**
 * Gerçek `chatUiStore` gibi davranan depo: her eklenti listesi mutasyonu
 * `revision` sayacini ilerletir. Telafi "bizim ekledigimiz kopyalar hala
 * bizim mi?" sorusunu bu sayaci sorar.
 */
function makeStore(initial: Record<string, FakeTab> = {}, withRevision = true) {
  const state = {
    revision: 0,
    tabs: structuredClone(initial),
    read(tabId: string) {
      if (!state.tabs[tabId]) state.tabs[tabId] = { input: '', attachments: [] }
      return state.tabs[tabId]
    },
    inputOf: (tabId: string) => state.read(tabId).input,
    attachmentsOf: (tabId: string) => state.read(tabId).attachments
  }
  const read = () => ({
    inputValueByTab: Object.fromEntries(Object.entries(state.tabs).map(([k, v]) => [k, v.input])),
    attachmentsByTab: Object.fromEntries(
      Object.entries(state.tabs).map(([k, v]) => [k, v.attachments])
    ),
    ...(withRevision
      ? { attachmentsRevisionByTab: { [TAB]: state.revision } }
      : { attachmentsRevisionByTab: undefined }),
    updateInput: vi.fn((tabId: string, value: string) => {
      state.read(tabId).input = value
    }),
    addAttachment: vi.fn((tabId: string, data: string) => {
      state.read(tabId).attachments.push(data)
      state.revision += 1
    }),
    removeAttachment: vi.fn((tabId: string, index: number) => {
      const tab = state.read(tabId)
      tab.attachments = tab.attachments.filter((_, i) => i !== index)
      state.revision += 1
    })
  })
  return { state, read }
}

const TAB = 'tab-1'

describe('apiChatStaging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('staging', () => {
    it('appends the prompt without overwriting text the user already wrote', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Existing', attachments: [] } })
      const staging = createApiChatStaging()

      stageApiChatInput(staging, read, TAB, 'Explain this')

      expect(state.inputOf(TAB)).toBe('Existing\nExplain this')
    })

    it('seeds a minimal instruction only when the composer is empty', () => {
      const { state, read } = makeStore()
      const staging = createApiChatStaging()

      stageApiChatInput(staging, read, TAB, undefined, 'Describe this.')

      expect(state.inputOf(TAB)).toBe('Describe this.')
    })

    it('does not seed over text the user already wrote', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Already typing', attachments: [] } })
      const staging = createApiChatStaging()

      stageApiChatInput(staging, read, TAB, undefined, 'Describe this.')

      expect(state.inputOf(TAB)).toBe('Already typing')
    })

    it('records every attachment it adds, in order', () => {
      const { state, read } = makeStore()
      const staging = createApiChatStaging()

      stageApiChatAttachments(staging, read, TAB, [
        'data:image/png;base64,A',
        'data:image/png;base64,B'
      ])

      expect(state.attachmentsOf(TAB)).toEqual([
        'data:image/png;base64,A',
        'data:image/png;base64,B'
      ])
      expect(staging.addedAttachments).toHaveLength(2)
    })
  })

  describe('rollback after a definite failure', () => {
    it('does not claim a full revert when the send already consumed the text', () => {
      // `sendApiChatMessage` kullanıcı mesajını transcript'e yazar, ardından
      // kutuyu `updateInput(tabId, '')` ile temizler ve istek başarısız olur.
      // Telafi bu noktada metni **bulamaz** — ama bulamamak "başarıyla geri
      // aldık" demek değildir: metin tüketilmiştir ve transcript'te duruyor.
      //
      // Bu ayrım yanlış yapılırsa `withRollback` `not_started` üretir, üst katman
      // "güvenle tekrar gönderilebilir" der ve kullanıcı transcript'e ikinci
      // bir kopya yazar.
      const { state, read } = makeStore({ [TAB]: { input: '', attachments: [] } })
      const staging = createApiChatStaging()
      stageApiChatInput(staging, read, TAB, undefined, 'Describe this.')
      // Gönderim kutuyu tüketti: artık aranacak metin yok.
      state.read(TAB).input = ''

      const result = rollbackApiChatStaging(read, TAB, staging)

      expect(result).not.toBe('fully_reverted')
    })

    it('still reports a full revert when the text was genuinely removed', () => {
      // Karşıt durum: metin hâlâ bizim yazdığımız gibi duruyor, telafi onu
      // gerçekten siliyor. `not_started` güvenle verilebilir.
      const { read } = makeStore({ [TAB]: { input: '', attachments: [] } })
      const staging = createApiChatStaging()
      stageApiChatInput(staging, read, TAB, undefined, 'Describe this.')

      expect(rollbackApiChatStaging(read, TAB, staging)).toBe('fully_reverted')
    })

    it('removes only the attachments this layer added', () => {
      const { state, read } = makeStore({
        [TAB]: { input: '', attachments: ['data:image/png;base64,USER'] }
      })
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, [
        'data:image/png;base64,A',
        'data:image/png;base64,B'
      ])

      rollbackApiChatStaging(read, TAB, staging)

      // Kullanıcının kendi eki korunur, eklediklerimiz düşer.
      expect(state.attachmentsOf(TAB)).toEqual(['data:image/png;base64,USER'])
    })

    it('restores the previous composer text exactly', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Existing', attachments: [] } })
      const staging = createApiChatStaging()
      stageApiChatInput(staging, read, TAB, 'Explain this')

      rollbackApiChatStaging(read, TAB, staging)

      expect(state.inputOf(TAB)).toBe('Existing')
    })

    it('clears the seed it wrote into an initially empty composer', () => {
      const { state, read } = makeStore()
      const staging = createApiChatStaging()
      stageApiChatInput(staging, read, TAB, undefined, 'Describe this.')

      rollbackApiChatStaging(read, TAB, staging)

      expect(state.inputOf(TAB)).toBe('')
    })

    it('removes prompt and attachments together, leaving the tab as it was', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Existing', attachments: [] } })
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, ['data:image/png;base64,A'])
      stageApiChatInput(staging, read, TAB, 'Explain')

      rollbackApiChatStaging(read, TAB, staging)

      expect(state.attachmentsOf(TAB)).toEqual([])
      expect(state.inputOf(TAB)).toBe('Existing')
    })
  })

  describe('rollback never destroys newer user data', () => {
    it('leaves composer text alone when the user edited after staging', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Existing', attachments: [] } })
      const staging = createApiChatStaging()
      stageApiChatInput(staging, read, TAB, 'Explain this')

      // Kullanıcı araya yazdı: telafi onun verisini silmemeli.
      state.read(TAB).input = 'Existing\nExplain this\nve ayrıca şunu da'
      rollbackApiChatStaging(read, TAB, staging)

      expect(state.inputOf(TAB)).toBe('Existing\nExplain this\nve ayrıca şunu da')
    })

    it('leaves attachments alone when the user added one after staging', () => {
      const { state, read } = makeStore()
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, ['data:image/png;base64,A'])

      state.read(TAB).attachments.push('data:image/png;base64,NEWER')
      rollbackApiChatStaging(read, TAB, staging)

      // Bizim ekimiz artık sonda olmasa da (kullanıcı araya bir ek daha ekledi)
      // geri alınır: mükerrer mesajın önü alınır, kullanıcının eki korunur.
      expect(state.attachmentsOf(TAB)).toEqual(['data:image/png;base64,NEWER'])
    })

    it('removes each staged attachment even when the user reordered them', () => {
      const { state, read } = makeStore()
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, [
        'data:image/png;base64,A',
        'data:image/png;base64,B'
      ])
      state.read(TAB).attachments.unshift('data:image/png;base64,USER')

      rollbackApiChatStaging(read, TAB, staging)

      expect(state.attachmentsOf(TAB)).toEqual(['data:image/png;base64,USER'])
    })

    it('is a no-op when nothing was staged', () => {
      const { state, read } = makeStore({ [TAB]: { input: 'Existing', attachments: ['x'] } })
      const staging = createApiChatStaging()

      rollbackApiChatStaging(read, TAB, staging)

      expect(state.inputOf(TAB)).toBe('Existing')
      expect(state.attachmentsOf(TAB)).toEqual(['x'])
    })
  })

  /**
   * Ayni degerin kacinci kopyasi oldugu, **sahiplik kaniti degildir**.
   *
   * Zincir: kullanici A'yi ekler → otomasyon ayni A'yi ekler → kullanici
   * onceki A'yi siler → kullanici A'yi yeniden ekler. Liste iki kez "iki A"
   * olur ve konum sayimi "1. kopya" der. Artik listedeki ikinci A'nin
   * hangisinin bizimki oldugu **gozlenemez**.
   *
   * Yanlis bir kullanici ekini silmek, hedefte bir kopya birakmaktan daha
   kotudur: bu yuzden sahiplik kanitlanamazsa **silinmez** ve sonuc kismi
   telafi olarak tasinir (otomatik tekrar oradan kapanir).
   */
  describe('ownership of an image the user already has', () => {
    const A = 'data:image/png;base64,A'

    it('does not delete the user copy when the list was re-arranged meanwhile', () => {
      // 1) Kullanicinin A'si var.
      const { state, read } = makeStore({ [TAB]: { input: '', attachments: [A] } })
      const staging = createApiChatStaging()

      // 2) Otomasyon ayni A'yi ekler.
      stageApiChatAttachments(staging, read, TAB, [A])
      expect(state.attachmentsOf(TAB)).toEqual([A, A])

      // 3) Kullanici onceki A'sini siler, 4) A'yi yeniden ekler.
      state.read(TAB).attachments.splice(0, 1)
      state.read(TAB).attachments.push(A)
      state.revision += 2
      expect(state.attachmentsOf(TAB)).toEqual([A, A])

      const result = rollbackApiChatStaging(read, TAB, staging)

      // Kullanicinin ekleme eylemi iptal edilmez. Bedeli: hedefte bir kopya
      // kalir — bu, "tahmin edip yanlis kullanici ekini silmek"ten bilincli
      // olarak tercih edilen taraftir.
      expect(state.attachmentsOf(TAB)).toEqual([A, A])
      // Sonuc "tam telafi" **degildir**: bir kopya kaldi ve nedeni belirsizdir.
      expect(result).toBe('partially_reverted')
    })

    it('still removes our own copy when the user never touched the list', () => {
      const { state, read } = makeStore({ [TAB]: { input: '', attachments: [A] } })
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, [A])

      const result = rollbackApiChatStaging(read, TAB, staging)

      // Sayim kanitlari yerinde: kullaniciya ait kopya kalir, bizimki duser.
      expect(state.attachmentsOf(TAB)).toEqual([A])
      expect(result).toBe('fully_reverted')
    })

    it('does not delete anything when the store cannot prove ownership', () => {
      // Sayaç bildirmeyen bir depo: "değişmedi" **kanıtlanamaz**.
      const { state, read } = makeStore({ [TAB]: { input: '', attachments: [A] } }, false)
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, [A])

      const result = rollbackApiChatStaging(read, TAB, staging)

      expect(state.attachmentsOf(TAB)).toEqual([A, A])
      expect(result).toBe('partially_reverted')
    })

    it('treats two identical staged copies as ours, not as a shared value', () => {
      // Bos listede ayni goruntuyu iki kez hazirlamak "paylasimli" degildir:
      // onceki kopya bizim kendi ekimizdir ve konum sayimi kesindir.
      const { state, read } = makeStore()
      const staging = createApiChatStaging()

      stageApiChatAttachments(staging, read, TAB, [A, A])
      const result = rollbackApiChatStaging(read, TAB, staging)

      expect(state.attachmentsOf(TAB)).toEqual([])
      expect(result).toBe('fully_reverted')
    })

    it('keeps a unique staged copy removable even when the user adds another one', () => {
      // Tekil bir degerde konum sayimi kesindir: kullanicinin ekledigi baska
      // bir ek, bizim kopyamizi kaydirmaz. Bu davranis korunur.
      const { state, read } = makeStore()
      const staging = createApiChatStaging()
      stageApiChatAttachments(staging, read, TAB, [A])

      state.read(TAB).attachments.push('data:image/png;base64,NEWER')
      state.revision += 1

      const result = rollbackApiChatStaging(read, TAB, staging)

      expect(state.attachmentsOf(TAB)).toEqual(['data:image/png;base64,NEWER'])
      expect(result).toBe('fully_reverted')
    })
  })
})
