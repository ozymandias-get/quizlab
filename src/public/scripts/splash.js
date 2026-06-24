;(function () {
  const userLanguage = navigator.language || navigator.userLanguage
  document.documentElement.lang = userLanguage.startsWith('tr') ? 'tr' : 'en'
  const statusElement = document.getElementById('status-text')
  const subtitleElement = document.getElementById('subtitle-text')
  const buildTextElement = document.getElementById('build-text')

  const copy = userLanguage.startsWith('tr')
    ? {
        status: 'Öğrenme Ortamı Başlatılıyor',
        subtitle: 'Yapay Zeka Destekli Çalışma Alanı'
      }
    : {
        status: 'Bootstrapping Learning Workspace',
        subtitle: 'AI-Powered Study Environment'
      }

  if (statusElement) {
    statusElement.textContent = copy.status
  }
  if (subtitleElement) {
    subtitleElement.textContent = copy.subtitle
  }
  if (buildTextElement) {
    const params = new URLSearchParams(window.location.search)
    const appVersion = params.get('version')
    buildTextElement.textContent = appVersion ? `v${appVersion}` : 'v0.0.0'
  }

  const quitBtn = document.getElementById('quit-btn')
  if (quitBtn) {
    if (userLanguage.startsWith('tr')) {
      quitBtn.textContent = 'Çıkış Yap'
    }
    setTimeout(() => {
      quitBtn.classList.add('visible')
    }, 5600)
    quitBtn.addEventListener('click', () => {
      window.close()
    })
  }
})()
