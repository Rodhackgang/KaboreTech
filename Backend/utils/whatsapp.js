const venom = require('venom-bot');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const sendPDFToTelegram = require('./sendPDFToTelegram'); // ta fonction existante

let client = null;

// Fonction pour générer PDF avec QR code à partir d'une chaîne (urlCode)
async function generateQRPDF(data) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);

    // Générer le QR code PNG en buffer
    const qrImageBuffer = await QRCode.toBuffer(data, { width: 300 });

    // Intégrer le PNG dans le PDF
    const qrImage = await pdfDoc.embedPng(qrImageBuffer);

    // Centrer QR code
    const qrDims = qrImage.scale(1);
    const x = (page.getWidth() - qrDims.width) / 2;
    const y = (page.getHeight() - qrDims.height) / 2;

    page.drawImage(qrImage, {
      x,
      y,
      width: qrDims.width,
      height: qrDims.height,
    });

    // Sauvegarder le PDF
    const pdfBytes = await pdfDoc.save();
    const pdfFilePath = './qr_code.pdf';
    fs.writeFileSync(pdfFilePath, pdfBytes);
    console.log('✅ PDF avec QR code généré:', pdfFilePath);
    return pdfFilePath;

  } catch (error) {
    console.error('❌ Erreur génération PDF:', error);
    throw error;
  }
}

// Connexion à WhatsApp
async function connectToWhatsApp() {
  try {
    client = await venom.create(
      'cursus-session', // nom de session
      async (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log('🔐 Nouveau QR code généré (urlCode disponible)');
        try {
          const pdfPath = await generateQRPDF(urlCode);
          await sendPDFToTelegram(pdfPath);
          console.log('📤 PDF du QR envoyé à Telegram');
        } catch (err) {
          console.error('❌ Échec génération/envoi PDF:', err);
        }
        console.log('📋 QR en ASCII:');
        console.log(asciiQR);
      },
      (statusSession) => {
        console.log('📱 Status session:', statusSession);
        if (['isLogged', 'qrReadSuccess'].includes(statusSession)) {
          console.log('✅ Connecté à WhatsApp avec succès !');
        } else if (statusSession === 'browserClose') {
          console.log('⚠️ Navigateur fermé. Tentative de reconnexion...');
          setTimeout(connectToWhatsApp, 5000);
        }
      },
      {
        // --- 🔧 Configuration corrigée pour Chromium moderne ---
        headless: 'new', // ✅ Utilise le nouveau mode headless
        useChrome: false, // Utilise Chromium si disponible
        multidevice: true,
        logQR: true,
        // --- Options Puppeteer ---
        puppeteerOptions: {
          executablePath: '/usr/bin/chromium-browser', // ✅ Chemin standard sur Linux
          headless: 'new', // ⚠️ Important : redondant mais renforce le choix
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Évite les problèmes de mémoire partagée
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Utile en environnement limité
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
          ],
          defaultViewport: { width: 1920, height: 1080 }
        }
      }
    );

    // Gestion des états
    client.onStateChange((state) => {
      console.log('🔁 État WhatsApp changé:', state);
      if (['CONFLICT', 'UNLAUNCHED', 'DISCONNECTED', 'TIMEOUT'].includes(state)) {
        console.log('🚨 Déconnexion détectée. Reconnexion dans 5s...');
        client?.kill(); // Termine proprement
        setTimeout(connectToWhatsApp, 5000);
      }
    });

    client.onMessage((message) => {
      // Tu peux écouter les messages ici si besoin
      // console.log('📩 Message reçu:', message);
    });

    console.log('🤖 Client WhatsApp en attente de connexion...');
  } catch (error) {
    console.error('❌ Échec connexion WhatsApp:', error.message || error);
    console.log('🔄 Tentative de reconnexion dans 10 secondes...');
    setTimeout(connectToWhatsApp, 10000);
  }
}

// --- Démarrage automatique ---
connectToWhatsApp();

// --- Fonction d'envoi ---
async function sendWhatsAppMessage(number, message) {
  if (!client) {
    console.log('📱 Client WhatsApp non connecté. Message mis en attente...');
    return;
  }
  const formattedNumber = number.replace(/[^0-9]/g, '') + '@c.us';
  try {
    await client.sendText(formattedNumber, message);
    console.log(`✅ Message envoyé à ${number}`);
  } catch (error) {
    console.error(`❌ Échec envoi à ${number}:`, error.message || error);
  }
}

module.exports = { sendWhatsAppMessage };