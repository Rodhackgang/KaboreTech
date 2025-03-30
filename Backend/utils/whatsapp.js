const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const generateQRPDF = require('./generateQRPDF');
const sendPDFToTelegram = require('./sendPDFToTelegram');
let sock;
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, './auth'));
    sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }) 
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async(update) => {
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
            const pdfFilePath = await generateQRPDF(qr);
            await sendPDFToTelegram(pdfFilePath);
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Déconnecté de WhatsApp. Veuillez vous reconnecter.');
            }
        } else if (connection === 'open') {
            console.log('Connecté à WhatsApp avec succès !');
        }
    });
    return sock;
}
connectToWhatsApp();

async function sendWhatsAppMessage(number, message) {
    try {
        if (sock && sock.ev) {
            const formattedNumber = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            await sock.sendMessage(formattedNumber, { text: message });
        } else {
            console.log('Connexion WhatsApp non prête, réessayez plus tard.');
        }
    } catch (err) {
        console.error(`Erreur lors de l'envoi du message à ${number}: `, err);
    }
}

module.exports = { sendWhatsAppMessage };
