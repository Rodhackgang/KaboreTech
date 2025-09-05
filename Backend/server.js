require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const User = require('./models/User');
const Expiration = require('./models/Expiration');
const { bot } = require('./utils/telegram');
const crypto = require('crypto');
const http = require('http');
const { sendWhatsAppMessage } = require('./utils/whatsapp');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 8000;
const server = http.createServer(app);
const path = require('path');
const { google } = require('googleapis');
const stream = require('stream');
const storage = multer.memoryStorage();
const Setting = require('./models/Setting');
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // Limite de taille des fichiers à 200MB
});

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
/*const swaggerDocument = YAML.load('./swagger.yml'); */

// ====== MODÈLE VIDEO ======
const Video = mongoose.model('Video', new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  categoryId: {
    type: String,
    required: true
  },
  part: {
    type: String,
    required: true,
    enum: ['Hardware', 'Software', 'Partie1', 'Partie2','Social','Contenue']
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    default: ''
  },
  videoFileId: {
    type: String,
    required: true
  },
  imageFileId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}));

// Configuration Google Drive avec OAuth2
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
});

oauth2Client.on('tokens', (tokens) => {
  console.log('🔄 Nouveaux tokens reçus');
  
  if (tokens.refresh_token) {
    // Si un nouveau refresh token est fourni, vous pourriez le sauvegarder
    // Attention : cela n'arrive que la première fois ou si explicitement demandé
    console.log('🆕 Nouveau refresh token reçu');
  }
  
  if (tokens.access_token) {
    console.log('✅ Nouveau access token généré');
    console.log('⏰ Expiration prévue dans:', tokens.expiry_date ? new Date(tokens.expiry_date) : 'Non spécifiée');
  }
});

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
});

const ensureValidToken = async () => {
  try {
    // Obtenir les informations actuelles du token
    const tokenInfo = await oauth2Client.getAccessToken();
    
    if (!tokenInfo.token) {
      throw new Error('Aucun access token disponible');
    }
    
    console.log('✅ Token d\'accès valide obtenu');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification/rafraîchissement du token:', error);
    throw error;
  }
};
const driveApiCall = async (apiFunction) => {
  try {
    // S'assurer que le token est valide avant l'appel
    await ensureValidToken();
    
    // Exécuter la fonction API
    return await apiFunction();
  } catch (error) {
    // Si l'erreur est liée à l'authentification, essayer de rafraîchir une fois
    if (error.code === 401 || error.message?.includes('invalid_token')) {
      console.log('🔄 Token invalide détecté, tentative de rafraîchissement...');
      
      try {
        await oauth2Client.getAccessToken(); // Force le rafraîchissement
        return await apiFunction(); // Retry l'appel
      } catch (refreshError) {
        console.error('❌ Échec du rafraîchissement du token:', refreshError);
        throw refreshError;
      }
    }
    
    throw error;
  }
};

// Initialisation de Google Drive API
const initializeGoogleDrive = async () => {
  try {
    // Test de connexion avec gestion automatique des tokens
    await driveApiCall(async () => {
      const response = await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)'
      });
      return response;
    });
    
    console.log('✅ Google Drive API initialisé avec succès');
    
    // Programmer une vérification périodique des tokens (optionnel)
    setInterval(async () => {
      try {
        await ensureValidToken();
      } catch (error) {
        console.error('❌ Erreur lors de la vérification périodique des tokens:', error);
      }
    }, 30 * 60 * 1000); // Vérifier toutes les 30 minutes
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Google Drive API:', error);
  }
};

// Middleware
const corsOptions = {
   origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
//app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(bodyParser.json({ limit: '100mb' }));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connexion à MongoDB réussie');
  initializeGoogleDrive();
})
.catch(err => {
  console.error('❌ Connexion à MongoDB échouée:', err.message);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion à MongoDB:', err.message);
});

bot.launch();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== FONCTIONS GOOGLE DRIVE ======

// Fonction pour uploader un fichier vers Google Drive avec dossiers spécifiques
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType, folderName = 'KaboreTech') => {
  return await driveApiCall(async () => {
    let folderId = await getOrCreateFolder(folderName);
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: bufferStream
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    // Rendre le fichier public
    await drive.permissions.create({
      fileId: response.data.id,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return response.data.id;
  });
};

// Fonction pour créer ou récupérer un dossier
const getOrCreateFolder = async (folderName) => {
  return await driveApiCall(async () => {
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });

    return folder.data.id;
  });
};


const deleteFromGoogleDrive = async (fileId) => {
  return await driveApiCall(async () => {
    await drive.files.delete({
      fileId: fileId
    });
  });
};
// Fonction améliorée pour obtenir les informations du token
const getTokenInfo = async () => {
  try {
    const tokenInfo = await oauth2Client.getAccessToken();
    const credentials = oauth2Client.credentials;
    
    return {
      hasAccessToken: !!tokenInfo.token,
      hasRefreshToken: !!credentials.refresh_token,
      expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      isExpired: credentials.expiry_date ? credentials.expiry_date <= Date.now() : false,
      tokenInfo: tokenInfo
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des infos du token:', error);
    return {
      hasAccessToken: false,
      hasRefreshToken: false,
      expiryDate: null,
      isExpired: true,
      error: error.message
    };
  }
};
app.get('/api/token-info', async (req, res) => {
  try {
    const tokenInfo = await getTokenInfo();
    res.json({
      success: true,
      tokenInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Fonction pour obtenir l'URL de téléchargement d'un fichier
const getGoogleDriveFileUrl = (fileId) => {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

// Fonction pour obtenir l'URL de streaming d'une vidéo
const getGoogleDriveVideoUrl = (fileId) => {
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

// ====== ROUTES DE L'APPLICATION ======

app.get('/api/screen-capture', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'allowScreenCapture' });
    if (!setting) {
      return res.json({ allowScreenCapture: false });
    }
    res.json({ allowScreenCapture: setting.value });
  } catch (error) {
    console.error('Erreur récupération config screenCapture:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.post('/api/screen-capture', async (req, res) => {
  const { allowScreenCapture } = req.body;

  if (typeof allowScreenCapture !== 'boolean') {
    return res.status(400).json({ message: 'Le champ allowScreenCapture doit être un booléen' });
  }

  try {
    const setting = await Setting.findOneAndUpdate(
      { key: 'allowScreenCapture' },
      { value: allowScreenCapture },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: 'Configuration mise à jour', allowScreenCapture: setting.value });
  } catch (error) {
    console.error('Erreur mise à jour config screenCapture:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  try {
    let formattedPhone = phone.trim();
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      phone: formattedPhone,
      password: hashedPassword,
      isInformatiqueHardware: false,
      isInformatiqueSoftware: false,
      isBureautiqueHardware: false,
      isBureautiqueSoftware: false,
      isMarketingSocial: false,
      isMarketingContent: false,
      isVIPGsmHardware: false,
      isVIPGsmSoftware: false,
    });
    await newUser.save();

    const formations = [
      { type: 'Informatique', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Bureautique', price: '10 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Marketing', price: '10 000 FCFA', parts: ['Social', 'Content'] },
      { type: 'GSM', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
    ];

    let telegramMessage = `👤 *Nouvel utilisateur inscrit* :
📛 *Nom* : ${name}
📞 *Téléphone* : ${formattedPhone}

Bienvenue parmi nous ! Voici les services que vous pouvez souscrire, chacun peut être payé par partie. Veuillez valider ou annuler les formations demandées par cet utilisateur :\n`;

    formations.forEach((formation, index) => {
      telegramMessage += `\n💼 *${formation.type}* : ${formation.price}`;
    });

    const inlineKeyboard = formations.map((formation) => {
      return formation.parts.map((part) => {
        return [
          { 
            text: `✅ ${formation.type} - ${part}`, 
            callback_data: `validate_${formation.type}_${part}_${newUser._id}`
          },
          { 
            text: `❌ ${formation.type} - ${part}`, 
            callback_data: `reject_${formation.type}_${part}_${newUser._id}`
          }
        ];
      });
    }).flat();

    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });

let formationsMessage = 'Voici nos différentes formations et leurs prix :\n\n';
formations.forEach(formation => {
  formationsMessage += `💼 *${formation.type}* : ${formation.price}\n`;
});

const whatsappMessage = `
🎉 *Bonjour ${name}* 👋

*Bienvenue chez Kaboretech* 🇧🇫

Nous vous remercions de vous être inscrit. Vous êtes désormais membre de notre communauté et nous sommes ravis de vous accompagner dans votre parcours.

Voici les formations disponibles pour vous, chaque formation peut être payée par "part" :

${formationsMessage}

👉 ORANGE👉 MOOV 👉 UBA     👉wave👉Western Unions

👉 Nom: kabore
👉 Prénom : Dominique
👉 Pays : Burkina Faso
👉 Ville : Houndé

👉Orange (+226) 74391980
👉Wave +226 74 39 19 80
👉 Moov (+226) 02180425

👉 Western Unions
Kabore Dominique
Houndé Burkina Faso
+226 74 39 19 80

👉 UBA  415800007247
👉ID Binance: 776174244

Possibilité de payer en deux tranches   

Après payement Veillez nous signalé✍️   Avec capture d'écran

Les informations a fournir c'est nom, prénom  , date et lieu de naissance

Cordialement,
*L'équipe Kabore Tech* 💼🚀
`;

await sendWhatsAppMessage(formattedPhone, whatsappMessage);

    res.status(201).json({ message: 'En attente de validation VIP' });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ message: 'Erreur d\'inscription' });
  }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  let formattedPhone = phone.trim();

  try {
    const user = await User.findOne({ phone: formattedPhone });

    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ message: 'Mot de passe incorrect' });

    res.status(200).json({
      message: 'Connexion réussie',
      user: {
        name: user.name,
        phone: user.phone,
        price: user.price,
        vipStatus: {
          informatique: user.isVIPInformatique,
          marketing: user.isVIPMarketing,
          energie: user.isVIPEnergie,
          reparation: user.isVIPReparation,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur de connexion' });
  }
});

// Bot Telegram actions
bot.action(/validate_(Informatique|Marketing|Bureautique|GSM)_(Hardware|Software|Social|Content)_([0-9a-fA-F]{24})/, async (ctx) => {
  const [_, formationType, part, userId] = ctx.match;

  const vipFieldMap = {
    'Informatique_Hardware': 'isInformatiqueHardware',
    'Informatique_Software': 'isInformatiqueSoftware',
    'Bureautique_Hardware': 'isBureautiqueHardware',
    'Bureautique_Software': 'isBureautiqueSoftware',
    'Marketing_Social': 'isMarketingSocial',
    'Marketing_Content': 'isMarketingContent',
    'GSM_Hardware': 'isVIPGsmHardware',
    'GSM_Software': 'isVIPGsmSoftware'
  };

  const vipField = vipFieldMap[`${formationType}_${part}`];

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return ctx.answerCbQuery('❌ ID utilisateur invalide');
    }

    const user = await User.findById(userId);
    if (!user) {
      return ctx.answerCbQuery('❌ Utilisateur introuvable');
    }

    if (user[vipField]) {
      return ctx.answerCbQuery(`❌ Cette section est déjà activée pour l'utilisateur : ${formationType} - ${part}`);
    }

    await User.updateOne({ _id: userId }, { $set: { [vipField]: true } });

    await ctx.answerCbQuery('✅ Section validée avec succès !');
    await ctx.editMessageText(`✅ Statut ${formationType} - ${part} activé pour ${user.name}`);

    const whatsappMessage = `
🎉 Félicitations ${user.name} !\n
Votre accès VIP ${formationType} ${part} est maintenant actif. Nous vous remercions de votre inscription et vous souhaitons un excellent parcours avec Kaboretech !

Cordialement,
*L'équipe Kabore Tech* 💼🚀
    `;
    await sendWhatsAppMessage(user.phone, whatsappMessage);

  } catch (error) {
    console.error('Erreur lors de la validation:', error);
    ctx.answerCbQuery('❌ Erreur lors de l\'activation du statut VIP');
  }
});

// Routes pour la gestion des mots de passe
app.post('/api/forgot-password', async (req, res) => {
  const { phone } = req.body;

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'Numéro de téléphone non trouvé.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    const message = `Votre code de réinitialisation de mot de passe est : ${otp}. Ce code est valide pendant 5 minutes.`;
    await sendWhatsAppMessage(phone, message);

    res.status(200).json({ message: 'Code OTP envoyé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'OTP :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const user = await User.findOne({ phone, otp });
    const validUser = user && user.otpExpiresAt > new Date();

    if (!validUser) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré.' });
    }

    res.status(200).json({ message: 'Code OTP validé avec succès. Vous pouvez maintenant réinitialiser votre mot de passe.' });
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'OTP :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { phone, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ phone, otp });
    const validUser = user && user.otpExpiresAt > new Date();

    if (!validUser) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });

    const message = `✅ Votre mot de passe a été réinitialisé avec succès.`;
    await sendWhatsAppMessage(user.phone, message);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Routes pour la gestion des utilisateurs
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, {
      name: 1,
      phone: 1,
      isInformatiqueHardware: 1,
      isInformatiqueSoftware: 1,
      isBureautiqueHardware: 1,
      isBureautiqueSoftware: 1,
      isMarketingSocial: 1,
      isMarketingContent: 1,
      isVIPGsmHardware: 1,
      isVIPGsmSoftware: 1,
      createdAt: 1
    }).sort({ createdAt: -1 });

    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      phone: user.phone,
      status: {
        informatiqueHardware: user.isInformatiqueHardware,
        informatiqueSoftware: user.isInformatiqueSoftware,
        bureautiqueHardware: user.isBureautiqueHardware,
        bureautiqueSoftware: user.isBureautiqueSoftware,
        marketingSocial: user.isMarketingSocial,
        marketingContent: user.isMarketingContent,
        gsmHardware: user.isVIPGsmHardware,
        gsmSoftware: user.isVIPGsmSoftware
      },
      createdAt: user.createdAt
    }));

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
    });
  }
});

app.get('/api/vip-status', async (req, res) => {
  let { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ message: 'Le numéro de téléphone est requis' });
  }

  phone = phone.trim();
  console.log(`Numéro de téléphone reçu : ${phone}`);

  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  console.log(`Recherche de l'utilisateur avec le numéro : ${phone}`);

  try {
    const user = await User.findOne({ phone: phone });

    if (!user) {
      console.log(`Utilisateur non trouvé pour le numéro : ${phone}`);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log(`Utilisateur trouvé pour le numéro : ${phone}`);

    const activeVipDomains = [];
    if (user.isInformatiqueHardware) activeVipDomains.push('Informatique Hardware');
    if (user.isInformatiqueSoftware) activeVipDomains.push('Informatique Software');
    if (user.isBureautiqueHardware) activeVipDomains.push('Bureautique Hardware');
    if (user.isBureautiqueSoftware) activeVipDomains.push('Bureautique Software');
    if (user.isMarketingSocial) activeVipDomains.push('Marketing Social');
    if (user.isMarketingContent) activeVipDomains.push('Marketing Content');
    if (user.isVIPGsmHardware) activeVipDomains.push('GSM Hardware');
    if (user.isVIPGsmSoftware) activeVipDomains.push('GSM Software');

    res.status(200).json({
      message: 'Statuts VIP récupérés avec succès',
      vipDomains: activeVipDomains
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statuts VIP:', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des statuts VIP' });
  }
});

app.post('/api/paiement', async (req, res) => {
  const { phone, numDepot, domaine, part, mode, price } = req.body;

  const validDomains = ['Informatique', 'Marketing', 'Bureautique', 'GSM'];
  const validParts = ['Hardware', 'Software', 'Social', 'Content'];

  if (!validDomains.includes(domaine) || !validParts.includes(part)) {
    return res.status(400).json({ message: 'Domaine ou partie invalide. Vérifiez les options possibles.' });
  }

  const validModes = ['presentiel', 'ligne'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ message: 'Mode de paiement invalide. Les modes possibles sont : presentiel, ligne.' });
  }

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    const user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const isVipForPart = user[`is${domaine}${part}`] || false;
    if (isVipForPart) {
      return res.status(200).json({ message: 'Accès VIP validé', isPaid: false });
    }

    const telegramMessage = `
    📩 *Nouveau Paiement Reçu*:

    📝 *Numéro de Dépôt*: ${numDepot}
    📞 *Numéro d'Utilisateur*: ${formattedPhone}
    💼 *Domaine*: ${domaine}
    🧩 *Partie*: ${part}
    🌐 *Mode de Paiement*: ${mode}
    💰 *Prix*: ${price}

    Veuillez procéder à la validation du paiement.
    `;

    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown'
    });

    res.status(200).json({ message: 'Paiement vérifié et message envoyé sur Telegram.' });
  } catch (error) {
    console.error('Erreur lors de la vérification du paiement:', error);
    res.status(500).json({ message: 'Erreur interne lors de la vérification du paiement.' });
  }
});

// ====== ROUTES POUR LA GESTION DES VIDÉOS ======

app.post('/api/add-video', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;

  try {
    if (!req.files.videoFile || !req.files.imageFile) {
      return res.status(400).json({ message: 'Les fichiers vidéo et image sont requis.' });
    }

    const videoFile = req.files.videoFile[0];
    const imageFile = req.files.imageFile[0];

    // Upload de la vidéo vers Google Drive dans le dossier Videos
    const videoFileName = `video_${Date.now()}_${videoFile.originalname}`;
    const videoFileId = await uploadToGoogleDrive(
      videoFile.buffer, 
      videoFileName, 
      videoFile.mimetype, 
      'KaboreTech_Videos'
    );
    
    // Upload de l'image vers Google Drive dans le dossier Images
    const imageFileName = `image_${Date.now()}_${imageFile.originalname}`;
    const imageFileId = await uploadToGoogleDrive(
      imageFile.buffer, 
      imageFileName, 
      imageFile.mimetype, 
      'KaboreTech_Images'
    );

    // Créer la vidéo dans MongoDB avec les IDs Google Drive
    const newVideo = new Video({
      title,
      categoryId,
      part,
      isPaid: isPaid === 'true',
      description,
      videoFileId,
      imageFileId
    });

    await newVideo.save();

    res.status(201).json({ 
      message: 'Vidéo sauvegardée avec succès !',
      video: newVideo 
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de la vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/update-video/:id', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;
  const videoId = req.params.id;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    let videoFileId = video.videoFileId;
    let imageFileId = video.imageFileId;

    // Si un nouveau fichier vidéo est fourni
    if (req.files && req.files.videoFile) {
      const videoFile = req.files.videoFile[0];
      
      // Supprimer l'ancienne vidéo de Google Drive
      try {
        await deleteFromGoogleDrive(video.videoFileId);
      } catch (error) {
        console.warn('Erreur lors de la suppression de l\'ancienne vidéo:', error);
      }
      
      // Upload de la nouvelle vidéo
      const videoFileName = `video_${Date.now()}_${videoFile.originalname}`;
      videoFileId = await uploadToGoogleDrive(
        videoFile.buffer, 
        videoFileName, 
        videoFile.mimetype, 
        'KaboreTech_Videos'
      );
    }

    // Si un nouveau fichier image est fourni
    if (req.files && req.files.imageFile) {
      const imageFile = req.files.imageFile[0];
      
      // Supprimer l'ancienne image de Google Drive
      try {
        await deleteFromGoogleDrive(video.imageFileId);
      } catch (error) {
        console.warn('Erreur lors de la suppression de l\'ancienne image:', error);
      }
      
      // Upload de la nouvelle image
      const imageFileName = `image_${Date.now()}_${imageFile.originalname}`;
      imageFileId = await uploadToGoogleDrive(
        imageFile.buffer, 
        imageFileName, 
        imageFile.mimetype, 
        'KaboreTech_Images'
      );
    }

    // Mettre à jour les détails de la vidéo
    video.title = title || video.title;
    video.categoryId = categoryId || video.categoryId;
    video.part = part || video.part;
    video.isPaid = isPaid === 'true' || video.isPaid;
    video.description = description || video.description;
    video.videoFileId = videoFileId;
    video.imageFileId = imageFileId;

    await video.save();

    res.status(200).json({
      message: 'Vidéo mise à jour avec succès!',
      video
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/delete-video/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    // Trouver la vidéo dans la base de données
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Supprimer les fichiers associés (vidéo et image) de Google Drive
    try {
      await deleteFromGoogleDrive(video.videoFileId);
      await deleteFromGoogleDrive(video.imageFileId);
    } catch (error) {
      console.warn('Erreur lors de la suppression des fichiers:', error);
    }

    // Supprimer la vidéo de MongoDB
    await Video.findByIdAndDelete(videoId);

    res.status(200).json({
      message: 'Vidéo supprimée avec succès!'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ message: error.message });
  }
});


// Route pour récupérer une vidéo (redirection vers Google Drive)
app.get('/api/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    
    const video = await Video.findOne({ videoFileId: videoId });
    
    if (!video) {
      return res.status(404).json({ message: 'Vidéo introuvable' });
    }

    const videoUrl = getGoogleDriveVideoUrl(videoId);
    res.redirect(videoUrl);

  } catch (error) {
    console.error('Erreur lors de la récupération de la vidéo:', error);
    res.status(404).json({ message: 'Vidéo introuvable' });
  }
});

// Route pour récupérer une image (redirection vers Google Drive)
app.get('/api/image/:id', async (req, res) => {
  try {
    const imageId = req.params.id;
    
    const video = await Video.findOne({ imageFileId: imageId });
    
    if (!video) {
      return res.status(404).json({ message: 'Image introuvable' });
    }

    const imageUrl = getGoogleDriveFileUrl(imageId);
    res.redirect(imageUrl);

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'image:', error);
    res.status(404).json({ message: 'Image introuvable' });
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find();

    const categoriesMap = {};

    for (let video of videos) {
      const categoryId = video.categoryId;

      if (!categoriesMap[categoryId]) {
        categoriesMap[categoryId] = {
          id: categoryId,
          name: categoryId,
          videos: []
        };
      }

      const imageUrl = getGoogleDriveFileUrl(video.imageFileId);
      const videoUrl = getGoogleDriveVideoUrl(video.videoFileId);

      categoriesMap[categoryId].videos.push({
        id: video._id.toString(),
        title: video.title,
        isPaid: video.isPaid,
        categoryId: categoryId,
        part: video.part,
        image: imageUrl,
        details: {
          title: video.description?.title || 'Pas de titre',
          video: videoUrl,
          description: video.description?.description || 'Pas de description'
        }
      });
    }

    const categories = Object.values(categoriesMap);

    res.status(200).json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des vidéos :', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des vidéos' });
  }
});

// ====== ROUTES POUR LA GESTION DES FICHIERS GOOGLE DRIVE ======

// Route pour lister tous les fichiers
app.get('/api/drive/files', async (req, res) => {
  try {
    const response = await drive.files.list({
      pageSize: 50,
      fields: 'nextPageToken, files(id, name, size, mimeType, createdTime, parents)'
    });
    
    const files = response.data.files;
    if (files.length) {
      res.status(200).json({
        success: true,
        count: files.length,
        files: files
      });
    } else {
      res.status(200).json({
        success: true,
        count: 0,
        files: [],
        message: 'Aucun fichier trouvé.'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers'
    });
  }
});

// Route pour supprimer un fichier spécifique
app.delete('/api/drive/files/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    await deleteFromGoogleDrive(fileId);
    
    res.status(200).json({
      success: true,
      message: `Fichier avec l'ID ${fileId} supprimé avec succès.`
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fichier'
    });
  }
});

// Route pour créer un dossier
app.post('/api/drive/folders', async (req, res) => {
  const { folderName } = req.body;
  
  if (!folderName) {
    return res.status(400).json({
      success: false,
      message: 'Le nom du dossier est requis'
    });
  }
  
  try {
    const folderId = await getOrCreateFolder(folderName);
    
    res.status(201).json({
      success: true,
      message: 'Dossier créé avec succès',
      folderId: folderId
    });
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du dossier'
    });
  }
});

// Route pour upload manuel de fichiers
app.post('/api/drive/upload', upload.single('file'), async (req, res) => {
  const { folderName } = req.body;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    const fileName = `upload_${Date.now()}_${req.file.originalname}`;
    const fileId = await uploadToGoogleDrive(
      req.file.buffer,
      fileName,
      req.file.mimetype,
      folderName || 'KaboreTech_Uploads'
    );
    
    res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      fileId: fileId,
      fileName: fileName,
      downloadUrl: getGoogleDriveFileUrl(fileId)
    });
    
  } catch (error) {
    console.error('Erreur lors de l\'upload:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du fichier'
    });
  }
});

// ====== FONCTIONS UTILITAIRES GOOGLE DRIVE ======

// Fonction pour lister les fichiers dans un dossier spécifique
const listFilesInFolder = async (folderId) => {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, size, createdTime)'
    });
    return response.data.files;
  } catch (error) {
    console.error('Erreur lors de la liste des fichiers du dossier:', error);
    throw error;
  }
};

// Route pour lister les fichiers d'un dossier spécifique
app.get('/api/drive/folders/:folderId/files', async (req, res) => {
  const { folderId } = req.params;
  
  try {
    const files = await listFilesInFolder(folderId);
    
    res.status(200).json({
      success: true,
      count: files.length,
      files: files
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers du dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers du dossier'
    });
  }
});

// Route pour obtenir les métadonnées d'un fichier
app.get('/api/drive/files/:fileId/info', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink'
    });
    
    res.status(200).json({
      success: true,
      file: response.data
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des infos du fichier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations du fichier'
    });
  }
});

// Lancement du serveur
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
  console.log(`📚 Documentation API disponible sur http://localhost:${PORT}/api-docs`);
});