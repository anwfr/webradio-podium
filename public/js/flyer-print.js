const FLYERS_PER_PAGE = 8;
const FLYERS_COLUMNS = 2;
const FLYERS_ROWS = 4;
const FLYER_FUN_EMOJIS = ['🎉', '🎙️', '🫶', '🎧', '⭐', '🔥', '🏆', '💜'];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateText(text, max = 52) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function buildFlyerTeaser(title) {
  const podcastTitle = truncateText(title, 30);
  return `Vote et partage notre podcast « ${podcastTitle} » au concours webradio 2026 ! Ton vote compte !`;
}

async function loadQRCode() {
  const module = await import('https://esm.sh/qrcode@1.5.4');
  return module.default;
}

function flyerCursorSvg() {
  return `<svg class="flyer-cursor-svg" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path fill="#12182e" stroke="#ffffff" stroke-width="1.25" stroke-linejoin="round" d="M4 3l14 9.2-6 .45 3.8 7.6-3.2 1.6-3.9-8.2L4 20.8z"/>
  </svg>`;
}

function flyerShareIconSvg() {
  return `<svg class="flyer-btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/></svg>`;
}

function flyerActionButtonsMarkup() {
  return `
    <div class="flyer-actions" aria-hidden="true">
      <div class="flyer-btn flyer-btn--vote">
        <span class="flyer-btn-cursor">${flyerCursorSvg()}</span>
        <span class="flyer-btn-label">Voter</span>
      </div>
      <div class="flyer-btn flyer-btn--share">
        ${flyerShareIconSvg()}
        <span class="flyer-btn-label">Partager</span>
      </div>
    </div>`;
}

function buildFlyerHtml({ title, establishment, qrDataUrl, emoji }) {
  return `
    <article class="flyer">
      <span class="flyer-fun-emoji" aria-hidden="true">${emoji}</span>
      <div class="flyer-head">
        <p class="flyer-badge">TON VOTE COMPTE !</p>
        <p class="flyer-kicker">Concours webradio 2026</p>
        <h1 class="flyer-title">${escapeHtml(truncateText(title, 34))}</h1>
        ${establishment ? `<p class="flyer-establishment">🏫 ${escapeHtml(truncateText(establishment, 32))}</p>` : ''}
      </div>
      <div class="flyer-qr-row">
        <div class="flyer-qr-wrap">
          <img class="flyer-qr" src="${qrDataUrl}" width="148" height="148" alt="QR code pour voter" />
        </div>
        ${flyerActionButtonsMarkup()}
      </div>
      <p class="flyer-action">Scanne · Vote · Partage !</p>
    </article>`;
}

function buildPrintDocument({ flyersHtml, title }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Tract — ${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 portrait;
      margin: 7mm;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Nunito, system-ui, sans-serif;
      color: #14182b;
      background: #fff;
    }

    .flyer-sheet {
      display: grid;
      grid-template-columns: repeat(${FLYERS_COLUMNS}, 1fr);
      grid-template-rows: repeat(${FLYERS_ROWS}, 1fr);
      width: 196mm;
      height: 283mm;
      margin: 0 auto;
      gap: 0;
    }

    .flyer {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 1.8mm;
      height: 100%;
      padding: 4mm 2.5mm 3.5mm;
      text-align: center;
      overflow: hidden;
      border: 1.5px dashed #8b7cf8;
      background: linear-gradient(145deg, #fff4c4 0%, #c9f7f3 42%, #e8ddff 100%);
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .flyer-fun-emoji {
      position: absolute;
      top: 4mm;
      left: 4mm;
      font-size: 29.4pt;
      line-height: 1;
      transform: rotate(-10deg);
      pointer-events: none;
    }

    .flyer-head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.2mm;
      width: 100%;
    }

    .flyer-badge {
      margin: 0;
      padding: 1mm 2.5mm;
      border-radius: 999px;
      background: linear-gradient(90deg, #ff6b8a, #ff9f43);
      color: #fff;
      font-size: 8.5pt;
      font-weight: 900;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .flyer-kicker {
      margin: 0;
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0d7f78;
    }

    .flyer-title {
      margin: 0;
      font-size: 16pt;
      line-height: 1.1;
      font-weight: 900;
      color: #2b235f;
      max-width: 84mm;
    }

    .flyer-establishment {
      margin: 0;
      font-size: 9pt;
      line-height: 1.2;
      font-weight: 700;
      color: #3d4a6b;
      max-width: 84mm;
    }

    .flyer-qr-row {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 2mm;
      width: 100%;
      max-width: 84mm;
      min-height: 0;
    }

    .flyer-qr-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 1.5mm;
      border-radius: 4mm;
      background: #fff;
      border: 2px solid #4ecdc4;
      box-shadow: 0 2px 0 rgba(78, 205, 196, 0.35);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .flyer-qr {
      display: block;
      width: 21mm;
      height: 21mm;
    }

    .flyer-actions {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: center;
      gap: 1.5mm;
      min-width: 0;
    }

    .flyer-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 1mm;
      width: 100%;
      flex: 1;
      min-height: 9.5mm;
      padding: 1.4mm 1.5mm;
      border-radius: 2.8mm;
      font-size: 9.5pt;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .flyer-btn--vote {
      color: #fff;
      background: linear-gradient(135deg, #4ecdc4 0%, #5a8cff 52%, #7c5cff 100%);
      box-shadow: 0 1.5px 0 rgba(18, 24, 46, 0.22);
    }

    .flyer-btn--share {
      color: #2b235f;
      background: #fff;
      border: 1.5px solid #8b7cf8;
      box-shadow: 0 1.5px 0 rgba(124, 92, 255, 0.2);
    }

    .flyer-btn-cursor {
      position: absolute;
      top: 0.8mm;
      right: 1.5mm;
      width: 6mm;
      height: 6mm;
      transform: rotate(-6deg);
      filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.85));
      pointer-events: none;
    }

    .flyer-cursor-svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .flyer-btn-icon-svg {
      width: 3.2mm;
      height: 3.2mm;
      flex-shrink: 0;
    }

    .flyer-btn-label {
      white-space: nowrap;
    }

    .flyer-action {
      margin: 0;
      font-size: 12.5pt;
      font-weight: 900;
      color: #7c5cff;
      letter-spacing: 0.05em;
    }

    @media screen {
      body {
        padding: 10mm 0;
        background: #eceff8;
      }

      .flyer-sheet {
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.14);
      }
    }

    @media print {
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="flyer-sheet">${flyersHtml}</div>
</body>
</html>`;
}

export async function printPodcastFlyers({
  title,
  establishment = '',
  shareUrl,
} = {}) {
  if (!shareUrl) return false;

  let QRCode;
  try {
    QRCode = await loadQRCode();
  } catch (err) {
    console.error(err);
    window.alert('Impossible de préparer le tract (générateur QR indisponible).');
    return false;
  }

  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 200,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#2b235f',
      light: '#ffffff',
    },
  });

  const flyersHtml = Array.from({ length: FLYERS_PER_PAGE }, (_, index) =>
    buildFlyerHtml({
      title,
      establishment,
      qrDataUrl,
      emoji: FLYER_FUN_EMOJIS[index % FLYER_FUN_EMOJIS.length],
    })
  ).join('');
  const html = buildPrintDocument({ flyersHtml, title });

  return printHtmlInHiddenFrame(html);
}

function waitForFrameImages(frameWindow) {
  const images = [...frameWindow.document.images];
  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
    )
  );
}

function printHtmlInHiddenFrame(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Impression du tract');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';

    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => iframe.remove(), 500);
      resolve(ok);
    };

    const runPrint = async () => {
      try {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) {
          window.alert('Impossible d\'ouvrir l\'aperçu d\'impression.');
          finish(false);
          return;
        }

        await waitForFrameImages(frameWindow);
        frameWindow.focus();
        frameWindow.print();
        finish(true);
      } catch (err) {
        console.error(err);
        window.alert('Impossible de lancer l\'impression du tract.');
        finish(false);
      }
    };

    iframe.onload = () => runPrint();

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      window.alert('Impossible de préparer le tract à imprimer.');
      finish(false);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    if (doc.readyState === 'complete') {
      runPrint();
    }
  });
}
