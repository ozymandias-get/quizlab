/**
 * afterPack hook: electron-builder cikti klasorunu (appOutDir) paketlemeden once
 * Electron runtime'inda bulunan ama Quizlab Reader'in hic kullanmadigi dosyalari siler.
 *
 * Boylece hem kurulum .exe'i hem de kurulu program kuculur.
 *
 * Silinen dosyalar:
 *   LICENSES.chromium.html - Chromium lisans metni, arayuzde hic gosterilmiyor
 *   ffmpeg.dll / libffmpeg.so - video codec motoru, uygulama video oynatmıyor
 *
 * Diger Electron dosyalarina (GPU yedekleri, sandbox, chromium runtime) dokunulmaz;
 * bunlar zayif/ekran kartı olmayan makinelerde acil calismayi saglar.
 */

const fs = require('node:fs');
const path = require('node:path');

/** @type {Array<[string, string]>} [dosya adı, silme gerekçesi] */
const REMOVABLE_FILES = [['LICENSES.chromium.html', 'Chromium lisans metni']];

/**
 * @param {{ appOutDir: string }} context electron-builder afterPack context
 * @returns {Promise<void>}
 */
module.exports = async function afterPack(context) {
  const { appOutDir } = context;

  let totalFreed = 0;

  for (const [fileName, reason] of REMOVABLE_FILES) {
    const target = path.join(appOutDir, fileName);

    if (!fs.existsSync(target)) {
      continue;
    }

    const { size } = fs.statSync(target);
    fs.rmSync(target, { force: true });
    totalFreed += size;

    console.log(
      `[after-pack] silindi: ${fileName} (${(size / 1024 / 1024).toFixed(1)} MB) - ${reason}`
    );
  }

  console.log(
    `[after-pack] toplam ${(totalFreed / 1024 / 1024).toFixed(1)} MB bosaltildi (appOutDir: ${appOutDir})`
  );
};