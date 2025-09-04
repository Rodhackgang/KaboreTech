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

    // Centrer QR code dans la page
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
    console.log('PDF avec QR code généré:', pdfFilePath);
    return pdfFilePath;

  } catch (error) {
    console.error('Erreur génération PDF:', error);
    throw error;
  }
}

// Connexion à WhatsApp avec venom-bot
async function connectToWhatsApp() {
  try {
    client = await venom.create(
      'cursus-session',
      async (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log('QR code à encoder (urlCode):', urlCode);
        try {
          const pdfPath = await generateQRPDF(urlCode);
          await sendPDFToTelegram(pdfPath);
        } catch (err) {
          console.error('Erreur lors de la génération/envoi du PDF:', err);
        }
        // Afficher QR en ASCII dans la console
        console.log(asciiQR);
      },
      (statusSession) => {
        console.log('Status session:', statusSession);
        if (statusSession === 'isLogged' || statusSession === 'qrReadSuccess') {
          console.log('Connecté à WhatsApp avec succès !');
        }
      },
      {
        headless: true,
        useChrome: false,
        multidevice: true,
        puppeteerOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
          ],
        },
      }
    );

    client.onStateChange((state) => {
      console.log('État client changé:', state);
      if (
        state === 'CONFLICT' ||
        state === 'UNLAUNCHED' ||
        state === 'DISCONNECTED'
      ) {
        console.log('Conflit ou déconnexion détectée, tentative de reconnexion...');
        client.kill(); // Termine proprement la session actuelle
        setTimeout(() => {
          connectToWhatsApp(); // Relance la connexion après 5 secondes
        }, 5000);
      }
    });

    client.onMessage((message) => {
      console.log('Message reçu:', message);
      // Ici tu peux gérer les messages reçus si besoin
    });

    console.log('WhatsApp client prêt');

  } catch (error) {
    console.error('Erreur connexion WhatsApp:', error);
    // Relance la connexion après délai pour éviter crash permanent
    setTimeout(connectToWhatsApp, 10000);
  }
}

// Démarrer la connexion automatiquement
connectToWhatsApp();

// Fonction d’envoi message WhatsApp
async function sendWhatsAppMessage(number, message) {
  if (!client) {
    console.log('Client WhatsApp non prêt.');
    return;
  }
  const formattedNumber = number.replace(/[^0-9]/g, '') + '@c.us';

  try {
    await client.sendText(formattedNumber, message);
    console.log(`Message envoyé avec succès à ${number}`);
  } catch (error) {
    console.error(`Erreur lors de l’envoi du message à ${number}:`, error);
  }
}

module.exports = { sendWhatsAppMessage };