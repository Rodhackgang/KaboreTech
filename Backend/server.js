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
const Video = require('./models/Video'); 
const server = http.createServer(app);
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const os = require('os');
const { GridFSBucket } = require('mongodb');
const Setting = require('./models/Setting');
const cluster = require('cluster');
const { Worker } = require('worker_threads');
const fs = require('fs');

// Configuration optimisée du stockage avec cache en mémoire
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB pour éviter les timeouts
});

// Cache en mémoire pour les vidéos fréquemment accédées
const videoCache = new Map();
const CACHE_SIZE = 50; // Nombre max de vidéos en cache
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Queue pour traitement asynchrone des vidéos
const videoProcessingQueue = [];
let isProcessing = false;

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yml');

let gridFSBucketVideo;
let gridFSBucketImage;

// Middleware CORS optimisé
const corsOptions = {
  origin: 'https://kaboretech.cursusbf.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Configuration optimisée du body parser
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ limit: '200mb', extended: true }));

// Connexion MongoDB optimisée avec pool de connexions
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 20, // Pool de 20 connexions max
  minPoolSize: 5,  // Pool de 5 connexions min
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  bufferMaxEntries: 0,
  bufferCommands: false,
})
  .then(() => {
    console.log('✅ Connexion à MongoDB réussie');
    
    // Initialisation de GridFS avec options optimisées
    gridFSBucketVideo = new GridFSBucket(mongoose.connection.db, { 
      bucketName: 'videos',
      chunkSizeBytes: 1024 * 255 // Chunks plus petits pour streaming plus rapide
    });
    gridFSBucketImage = new GridFSBucket(mongoose.connection.db, { 
      bucketName: 'images',
      chunkSizeBytes: 1024 * 255
    });

    // Précharger les vidéos populaires en cache
    preloadPopularVideos();
  })
  .catch(err => {
    console.error('❌ Connexion à MongoDB échouée:', err.message);
    console.error('Détails de l\'erreur:', err);
  });

// Fonction pour précharger les vidéos populaires
async function preloadPopularVideos() {
  try {
    const popularVideos = await Video.find()
      .sort({ views: -1, createdAt: -1 })
      .limit(20);
    
    console.log(`📦 Préchargement de ${popularVideos.length} vidéos populaires en cache`);
  } catch (error) {
    console.error('Erreur préchargement cache:', error);
  }
}

// Fonction pour nettoyer le cache
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of videoCache) {
    if (now - value.timestamp > CACHE_TTL) {
      videoCache.delete(key);
    }
  }
  
  // Limiter la taille du cache
  if (videoCache.size > CACHE_SIZE) {
    const entries = Array.from(videoCache.entries());
    const toDelete = entries.slice(0, entries.length - CACHE_SIZE);
    toDelete.forEach([key] => videoCache.delete(key));
  }
}

// Nettoyer le cache toutes les 5 minutes
setInterval(cleanCache, 5 * 60 * 1000);

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion à MongoDB:', err.message);
});

bot.launch();

// Routes existantes conservées...
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Fonction de compression vidéo optimisée avec Worker Threads
const compressVideoOptimized = (inputBuffer, quality = 'medium') => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `compressed-${Date.now()}.mp4`);
    const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
    
    // Écrire le buffer en fichier temporaire
    fs.writeFileSync(inputPath, inputBuffer);

    let videoSettings;
    switch(quality) {
      case 'low':
        videoSettings = { size: '854x480', videoBitrate: '500k' };
        break;
      case 'high':
        videoSettings = { size: '1920x1080', videoBitrate: '2000k' };
        break;
      default: // medium
        videoSettings = { size: '1280x720', videoBitrate: '1000k' };
    }

    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(videoSettings.size)
      .videoBitrate(videoSettings.videoBitrate)
      .audioFrequency(44100)
      .audioChannels(2)
      .format('mp4')
      .outputOptions([
        '-preset fast',        // Compression plus rapide
        '-crf 23',            // Qualité constante
        '-movflags +faststart' // Optimisation pour streaming
      ])
      .on('end', () => {
        // Nettoyer le fichier d'entrée
        fs.unlinkSync(inputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        // Nettoyer les fichiers temporaires
        try {
          fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch {}
        reject(err);
      })
      .run();
  });
};

// Fonction pour traiter la queue des vidéos
async function processVideoQueue() {
  if (isProcessing || videoProcessingQueue.length === 0) return;
  
  isProcessing = true;
  console.log(`🎬 Traitement de ${videoProcessingQueue.length} vidéos en queue`);

  while (videoProcessingQueue.length > 0) {
    const videoJob = videoProcessingQueue.shift();
    try {
      await processVideoInBackground(videoJob);
    } catch (error) {
      console.error('Erreur traitement vidéo:', error);
    }
  }
  
  isProcessing = false;
}

// Fonction pour traiter une vidéo en arrière-plan
async function processVideoInBackground({ videoId, videoBuffer, quality = 'medium' }) {
  try {
    console.log(`🎬 Début compression vidéo ${videoId}`);
    
    // Compression de la vidéo
    const compressedPath = await compressVideoOptimized(videoBuffer, quality);
    const compressedBuffer = fs.readFileSync(compressedPath);
    
    // Mise à jour en base avec la version compressée
    const compressedFileId = await storeFileInGridFSOptimized(
      { buffer: compressedBuffer, originalname: `compressed_${videoId}.mp4`, mimetype: 'video/mp4' },
      gridFSBucketVideo
    );

    // Mise à jour du document vidéo
    await Video.findByIdAndUpdate(videoId, {
      compressedFileId,
      isProcessed: true,
      processedAt: new Date()
    });

    // Nettoyer le fichier temporaire
    fs.unlinkSync(compressedPath);
    
    console.log(`✅ Vidéo ${videoId} traitée avec succès`);
  } catch (error) {
    console.error(`❌ Erreur traitement vidéo ${videoId}:`, error);
    
    // Marquer comme échoué
    await Video.findByIdAndUpdate(videoId, {
      processingFailed: true,
      processedAt: new Date()
    });
  }
}

// Routes d'authentification optimisées (conservées de l'original)
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

    // Messages Telegram et WhatsApp (code existant conservé)
    const formations = [
      { type: 'Informatique', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Bureautique', price: '10 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Marketing', price: '10 000 FCFA', parts: ['Social', 'Content'] },
      { type: 'GSM', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
    ];

    let telegramMessage = `👤 *Nouvel utilisateur inscrit* :\n📛 *Nom* : ${name}\n📞 *Téléphone* : ${formattedPhone}\n\nBienvenue parmi nous ! Voici les services que vous pouvez souscrire, chacun peut être payé par partie. Veuillez valider ou annuler les formations demandées par cet utilisateur :\n`;

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

    const whatsappMessage = `🎉 *Bonjour ${name}* 👋\n\n*Bienvenue chez Kaboretech* 🇧🇫\n\nNous vous remercions de vous être inscrit. Vous êtes désormais membre de notre communauté et nous sommes ravis de vous accompagner dans votre parcours.\n\nVoici les formations disponibles pour vous, chaque formation peut être payée par "part" :\n\n${formationsMessage}\n👉 ORANGE👉 MOOV 👉 UBA     👉wave👉Western Unions\n\n👉 Nom: kabore\n👉 Prénom : Dominique\n👉 Pays : Burkina Faso\n👉 Ville : Houndé\n\n👉Orange (+226) 74391980\n👉Wave +226 74 39 19 80\n👉 Moov (+226) 02180425\n\n👉 Western Unions\nKabore Dominique\nHoundé Burkina Faso\n+226 74 39 19 80\n\n👉 UBA  415800007247\n👉ID Binance: 776174244\n\n\nPossibilité de payer en deux tranches   \n\n\nAprès payement Veillez nous signalé✍️   Avec capture d'écran\n\nLes informations a fournir c'est nom, prénom  , date et lieu de naissance\n\nCordialement,\n*L'équipe Kabore Tech* 💼🚀`;

    await sendWhatsAppMessage(formattedPhone, whatsappMessage);

    res.status(201).json({ message: 'En attente de validation VIP' });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ message: 'Erreur d\'inscription' });
  }
});

// Routes d'authentification existantes conservées...
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

// Actions bot Telegram et autres routes existantes conservées...
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

    const whatsappMessage = `🎉 Félicitations ${user.name} !\n\nVotre accès VIP ${formationType} ${part} est maintenant actif. Nous vous remercions de votre inscription et vous souhaitons un excellent parcours avec Kaboretech !\n\nCordialement,\n*L'équipe Kabore Tech* 💼🚀`;
    await sendWhatsAppMessage(user.phone, whatsappMessage);

  } catch (error) {
    console.error('Erreur lors de la validation:', error);
    ctx.answerCbQuery('❌ Erreur lors de l\'activation du statut VIP');
  }
});

// Routes mot de passe oublié, etc. (conservées de l'original)...
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

// Routes utilisateurs et statuts VIP (conservées)...
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

    const telegramMessage = `📩 *Nouveau Paiement Reçu*:\n\n📝 *Numéro de Dépôt*: ${numDepot}\n📞 *Numéro d'Utilisateur*: ${formattedPhone}\n💼 *Domaine*: ${domaine}\n🧩 *Partie*: ${part}\n🌐 *Mode de Paiement*: ${mode}\n💰 *Prix*: ${price}\n\nVeuillez procéder à la validation du paiement.`;

    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown'
    });

    res.status(200).json({ message: 'Paiement vérifié et message envoyé sur Telegram.' });
  } catch (error) {
    console.error('Erreur lors de la vérification du paiement:', error);
    res.status(500).json({ message: 'Erreur interne lors de la vérification du paiement.' });
  }
});

// NOUVELLES ROUTES VIDÉO OPTIMISÉES

// Fonction optimisée pour stocker les fichiers dans GridFS
const storeFileInGridFSOptimized = (file, bucket) => {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: { 
        mimetype: file.mimetype,
        size: file.buffer.length,
        uploadDate: new Date()
      }
    });

    uploadStream.write(file.buffer);
    uploadStream.end();

    uploadStream.on('error', (err) => {
      reject(new Error('Erreur lors du téléchargement du fichier : ' + err.message));
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });
  });
};

// Route optimisée pour ajouter une vidéo avec traitement en arrière-plan
app.post('/api/add-video', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description, quality = 'medium' } = req.body;

  try {
    // Validation rapide des fichiers
    if (!req.files.videoFile || !req.files.imageFile) {
      return res.status(400).json({ message: 'Les fichiers vidéo et image sont requis.' });
    }

    const videoFile = req.files.videoFile[0];
    const imageFile = req.files.imageFile[0];

    // Réponse immédiate au client
    res.status(202).json({ 
      message: 'Vidéo en cours de traitement. Elle sera disponible sous peu.',
      status: 'processing'
    });

    // Traitement asynchrone en arrière-plan
    setImmediate(async () => {
      try {
        // Stocker l'image immédiatement (plus petit, plus rapide)
        const imageFileId = await storeFileInGridFSOptimized(imageFile, gridFSBucketImage);

        // Stocker la vidéo originale
        const videoFileId = await storeFileInGridFSOptimized(videoFile, gridFSBucketVideo);

        // Créer l'enregistrement vidéo en base
        const newVideo = new Video({
          title,
          categoryId,
          part,
          isPaid: isPaid === 'true',
          description,
          videoFileId,
          imageFileId,
          isProcessed: false,
          processingFailed: false,
          views: 0,
          createdAt: new Date(),
          size: videoFile.buffer.length
        });

        await newVideo.save();

        // Ajouter à la queue de traitement pour compression
        videoProcessingQueue.push({
          videoId: newVideo._id,
          videoBuffer: videoFile.buffer,
          quality
        });

        // Démarrer le traitement de la queue
        processVideoQueue();

        console.log(`✅ Vidéo ${newVideo._id} ajoutée et mise en queue pour traitement`);

      } catch (error) {
        console.error('Erreur traitement arrière-plan vidéo:', error);
      }
    });

  } catch (error) {
    console.error('Erreur ajout vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

// Route optimisée pour la mise à jour vidéo
app.put('/api/update-video/:id', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description, quality = 'medium' } = req.body;
  const videoId = req.params.id;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Mise à jour des métadonnées immédiate
    video.title = title || video.title;
    video.categoryId = categoryId || video.categoryId;
    video.part = part || video.part;
    video.isPaid = isPaid === 'true' || video.isPaid;
    video.description = description || video.description;
    video.updatedAt = new Date();

    // Réponse rapide au client
    res.status(202).json({
      message: 'Vidéo en cours de mise à jour.',
      status: 'updating'
    });

    // Traitement des fichiers en arrière-plan si nécessaire
    setImmediate(async () => {
      try {
        let videoFileId = video.videoFileId;
        let imageFileId = video.imageFileId;

        if (req.files.imageFile) {
          imageFileId = await storeFileInGridFSOptimized(req.files.imageFile[0], gridFSBucketImage);
          video.imageFileId = imageFileId;
        }

        if (req.files.videoFile) {
          videoFileId = await storeFileInGridFSOptimized(req.files.videoFile[0], gridFSBucketVideo);
          video.videoFileId = videoFileId;
          video.isProcessed = false;
          video.size = req.files.videoFile[0].buffer.length;

          // Ajouter à la queue pour recompression
          videoProcessingQueue.push({
            videoId: video._id,
            videoBuffer: req.files.videoFile[0].buffer,
            quality
          });

          processVideoQueue();
        }

        await video.save();

        // Invalider le cache pour cette vidéo
        videoCache.delete(videoId);

        console.log(`✅ Vidéo ${videoId} mise à jour avec succès`);

      } catch (error) {
        console.error('Erreur mise à jour arrière-plan:', error);
      }
    });

  } catch (error) {
    console.error('Erreur mise à jour vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

// Route optimisée pour supprimer une vidéo
app.delete('/api/delete-video/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Suppression en arrière-plan
    setImmediate(async () => {
      try {
        // Supprimer les fichiers de GridFS
        if (video.videoFileId) {
          await gridFSBucketVideo.delete(video.videoFileId);
        }
        if (video.compressedFileId) {
          await gridFSBucketVideo.delete(video.compressedFileId);
        }
        if (video.imageFileId) {
          await gridFSBucketImage.delete(video.imageFileId);
        }

        // Supprimer du cache
        videoCache.delete(videoId);

        console.log(`✅ Fichiers vidéo ${videoId} supprimés de GridFS`);
      } catch (error) {
        console.error('Erreur suppression fichiers GridFS:', error);
      }
    });

    // Supprimer de MongoDB immédiatement
    await Video.findByIdAndDelete(videoId);

    res.status(200).json({
      message: 'Vidéo supprimée avec succès!'
    });

  } catch (error) {
    console.error('Erreur suppression vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

// Route optimisée pour récupérer une vidéo avec cache et streaming
app.get('/api/video/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    // Vérifier le cache en premier
    const cacheKey = `video_${videoId}`;
    if (videoCache.has(cacheKey)) {
      const cachedData = videoCache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        res.set({
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': cachedData.buffer.length
        });
        return res.send(cachedData.buffer);
      } else {
        videoCache.delete(cacheKey);
      }
    }

    const objectId = new mongoose.Types.ObjectId(videoId);
    
    // Essayer d'abord la version compressée
    let downloadStream;
    try {
      const video = await Video.findOne({
        $or: [
          { videoFileId: objectId },
          { compressedFileId: objectId }
        ]
      });

      if (video && video.compressedFileId && video.isProcessed) {
        downloadStream = gridFSBucketVideo.openDownloadStream(video.compressedFileId);
      } else {
        downloadStream = gridFSBucketVideo.openDownloadStream(objectId);
      }
    } catch {
      downloadStream = gridFSBucketVideo.openDownloadStream(objectId);
    }

    // Configuration des headers pour streaming optimisé
    res.set({
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes'
    });

    // Gestion du streaming par chunks pour les gros fichiers
    const range = req.headers.range;
    if (range) {
      // Support du streaming par ranges (pour la lecture progressive)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;
      
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end || 'end'}/total`,
        'Accept-Ranges': 'bytes'
      });
    }

    // Mettre à jour les vues de manière asynchrone
    setImmediate(async () => {
      try {
        await Video.findOneAndUpdate(
          { $or: [{ videoFileId: objectId }, { compressedFileId: objectId }] },
          { $inc: { views: 1 } }
        );
      } catch (error) {
        console.error('Erreur mise à jour vues:', error);
      }
    });

    downloadStream.on('error', (err) => {
      console.error('Erreur streaming vidéo:', err);
      if (!res.headersSent) {
        res.status(404).json({ message: 'Vidéo introuvable' });
      }
    });

    // Cache des petites vidéos en mémoire
    let bufferChunks = [];
    let totalSize = 0;
    
    downloadStream.on('data', (chunk) => {
      totalSize += chunk.length;
      // Cache seulement les vidéos < 50MB
      if (totalSize < 50 * 1024 * 1024) {
        bufferChunks.push(chunk);
      }
    });

    downloadStream.on('end', () => {
      // Mettre en cache les petites vidéos
      if (totalSize < 50 * 1024 * 1024 && bufferChunks.length > 0) {
        const fullBuffer = Buffer.concat(bufferChunks);
        videoCache.set(cacheKey, {
          buffer: fullBuffer,
          timestamp: Date.now()
        });
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('Erreur récupération vidéo:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération de la vidéo' });
    }
  }
});

// Route optimisée pour les images avec cache
app.get('/api/image/:id', async (req, res) => {
  const imageId = req.params.id;

  try {
    // Cache des images
    const cacheKey = `image_${imageId}`;
    if (videoCache.has(cacheKey)) {
      const cachedData = videoCache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        res.set({
          'Content-Type': cachedData.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400', // Cache 24h pour les images
          'Content-Length': cachedData.buffer.length
        });
        return res.send(cachedData.buffer);
      }
    }

    const objectId = new mongoose.Types.ObjectId(imageId);
    const downloadStream = gridFSBucketImage.openDownloadStream(objectId);

    // Headers pour images
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    });

    // Cache les images en mémoire
    let imageBuffer = [];
    let contentType = 'image/jpeg';

    downloadStream.on('file', (file) => {
      contentType = file.metadata?.mimetype || 'image/jpeg';
      res.set('Content-Type', contentType);
    });

    downloadStream.on('data', (chunk) => {
      imageBuffer.push(chunk);
    });

    downloadStream.on('end', () => {
      const fullBuffer = Buffer.concat(imageBuffer);
      
      // Cache les images
      videoCache.set(cacheKey, {
        buffer: fullBuffer,
        contentType,
        timestamp: Date.now()
      });
    });

    downloadStream.on('error', (err) => {
      console.error('Erreur streaming image:', err);
      if (!res.headersSent) {
        res.status(404).json({ message: 'Image introuvable' });
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('Erreur récupération image:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'image' });
    }
  }
});

// Route optimisée pour récupérer toutes les vidéos avec pagination et cache
app.get('/api/videos', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const categoryFilter = req.query.category;
    const partFilter = req.query.part;

    // Construction du filtre de recherche
    let filter = {};
    if (categoryFilter) filter.categoryId = categoryFilter;
    if (partFilter) filter.part = partFilter;

    // Cache pour les listes de vidéos
    const cacheKey = `videos_${JSON.stringify(filter)}_${page}_${limit}`;
    if (videoCache.has(cacheKey)) {
      const cachedData = videoCache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < 5 * 60 * 1000) { // Cache 5 minutes
        return res.status(200).json(cachedData.data);
      }
    }

    // Requête optimisée avec index
    const videos = await Video.find(filter)
      .sort({ views: -1, createdAt: -1 }) // Trier par popularité puis date
      .skip(skip)
      .limit(limit)
      .select('title categoryId part isPaid description imageFileId videoFileId compressedFileId isProcessed views createdAt')
      .lean(); // Utiliser lean() pour de meilleures performances

    // Compter le total pour la pagination
    const total = await Video.countDocuments(filter);

    // Organiser par catégorie
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

      // Choisir l'URL vidéo optimale
      const videoFileId = video.compressedFileId && video.isProcessed 
        ? video.compressedFileId 
        : video.videoFileId;

      const imageUrl = `/api/image/${video.imageFileId}`;
      const videoUrl = `/api/video/${videoFileId}`;

      categoriesMap[categoryId].videos.push({
        id: video._id.toString(),
        title: video.title,
        isPaid: video.isPaid,
        categoryId: categoryId,
        part: video.part,
        image: imageUrl,
        views: video.views || 0,
        isProcessed: video.isProcessed || false,
        createdAt: video.createdAt,
        details: {
          title: video.description?.title || 'Pas de titre',
          video: videoUrl,
          description: video.description?.description || 'Pas de description'
        }
      });
    }

    const categories = Object.values(categoriesMap);

    const response = {
      categories,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: videos.length,
        totalVideos: total
      }
    };

    // Mettre en cache la réponse
    videoCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('Erreur récupération vidéos:', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des vidéos' });
  }
});

// Route pour obtenir les statistiques des vidéos
app.get('/api/video-stats', async (req, res) => {
  try {
    const stats = await Video.aggregate([
      {
        $group: {
          _id: null,
          totalVideos: { $sum: 1 },
          totalViews: { $sum: '$views' },
          processedVideos: {
            $sum: { $cond: ['$isProcessed', 1, 0] }
          },
          pendingVideos: {
            $sum: { $cond: ['$isProcessed', 0, 1] }
          }
        }
      }
    ]);

    const categoryStats = await Video.aggregate([
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' }
        }
      }
    ]);

    res.status(200).json({
      global: stats[0] || { totalVideos: 0, totalViews: 0, processedVideos: 0, pendingVideos: 0 },
      categories: categoryStats,
      queueLength: videoProcessingQueue.length,
      cacheSize: videoCache.size
    });

  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
});

// Route pour vider le cache manuellement
app.post('/api/clear-cache', (req, res) => {
  videoCache.clear();
  res.status(200).json({ message: 'Cache vidé avec succès', cacheSize: videoCache.size });
});

// Middleware pour gérer les erreurs globalement
app.use((error, req, res, next) => {
  console.error('Erreur globale:', error);
  if (!res.headersSent) {
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur en cours...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    mongoose.connection.close(() => {
      console.log('✅ Connexion MongoDB fermée');
      process.exit(0);
    });
  });
});

// Lancement du serveur avec optimisations
server.listen(PORT, () => {
  console.log(`🚀 Serveur optimisé lancé sur le port ${PORT}`);
  console.log(`📊 Configuration:
  - Cache TTL: ${CACHE_TTL / 1000 / 60} minutes
  - Cache Size: ${CACHE_SIZE} vidéos max
  - Pool MongoDB: 5-20 connexions
  - Compression: Activée avec présets rapides
  - Traitement: En arrière-plan avec queue`);
});
