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
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // Limite de taille des fichiers à 200MB
});

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yml');

let gridFSBucketVideo;
let gridFSBucketImage;

// Middleware
const corsOptions = {
  origin: 'https://kaboretech.cursusbf.com',  // Autoriser uniquement ce domaine
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Spécifier les méthodes HTTP autorisées
  allowedHeaders: ['Content-Type', 'Authorization'], // Autoriser les en-têtes spécifiques
  credentials: true  // Permet les cookies si nécessaires
};

app.use(cors(corsOptions));


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


app.use(bodyParser.json({ limit: '100mb' }));  // Augmenter la limite de taille pour le corps de la requête



mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ Connexion à MongoDB réussie');

    // Initialisation de GridFS après la connexion réussie
    gridFSBucketVideo = new GridFSBucket(mongoose.connection.db, { bucketName: 'videos' });
    gridFSBucketImage = new GridFSBucket(mongoose.connection.db, { bucketName: 'images' });
  })
  .catch(err => {
    console.error('❌ Connexion à MongoDB échouée:', err.message);
    console.error('Détails de l\'erreur:', err);
  });

// Écoute des erreurs de connexion MongoDB
mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion à MongoDB:', err.message);
});

bot.launch();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const compressVideo = (inputBuffer) => {
  return new Promise((resolve, reject) => {
    // Créer un fichier temporaire pour la vidéo compressée
    const outputPath = path.join(os.tmpdir(), `compressed-${Date.now()}.mp4`);

    ffmpeg()
      .input(inputBuffer)
      .inputFormat('mp4')  // Format d'entrée
      .output(outputPath)
      .videoCodec('libx264')  // Codec H.264
      .size('1280x720')  // Résolution (modifie selon tes besoins)
      .on('end', () => {
        resolve(outputPath);  // Retourne le chemin de la vidéo compressée
      })
      .on('error', (err) => {
        reject(err);  // En cas d'erreur
      })
      .run();
  });
};


app.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  try {
    // Formater le numéro de téléphone, sans contrainte sur le préfixe
    let formattedPhone = phone.trim();

    // On ne fait plus de vérification stricte sur le préfixe +226
    // Vous pouvez ajouter ici toute autre logique si nécessaire pour un autre formatage
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      phone: formattedPhone,  // Utilisation du numéro formaté
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

    // Message Telegram pour administrateur avec boutons pour chaque service
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

    // Crée un tableau de lignes de boutons, où chaque ligne contient 2 boutons (valider et annuler)
    const inlineKeyboard = formations.map((formation) => {
      return formation.parts.map((part) => {
        return [
          { 
            text: `✅ ${formation.type} - ${part}`, 
            callback_data: `validate_${formation.type}_${part}_${newUser._id}` // Validation d'une partie spécifique
          },
          { 
            text: `❌ ${formation.type} - ${part}`, 
            callback_data: `reject_${formation.type}_${part}_${newUser._id}` // Annulation d'une partie spécifique
          }
        ];
      });
    }).flat();

    // Envoi du message avec les boutons formatés correctement
    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard, // Pas de .flat() ici
      },
    });

    // Message WhatsApp avec formations et coordonnées de paiement
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

👉 UBA  415800007247
👉ID Binance: 776174244


Possibilité de payer en deux tranches   


Après payement Veillez nous signalé✍️   Avec capture d'écran

Les informations a fournir c'est nom, prénom  , date et lieu de naissance

Cordialement,
*L’équipe Kabore Tech* 💼🚀
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
bot.action(/validate_(Informatique|Marketing|Bureautique|GSM)_(Hardware|Software|Social|Content)_([0-9a-fA-F]{24})/, async (ctx) => {
  const [_, formationType, part, userId] = ctx.match; // Récupérer les valeurs pour la formation, la partie et l'ID utilisateur

  // Mapping des champs VIP
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

  const vipField = vipFieldMap[`${formationType}_${part}`]; // Récupérer le champ VIP correspondant à la formation et la partie

  try {
    // Validation de l'ID utilisateur
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return ctx.answerCbQuery('❌ ID utilisateur invalide');
    }

    const user = await User.findById(userId); // Recherche de l'utilisateur par son ID
    if (!user) {
      return ctx.answerCbQuery('❌ Utilisateur introuvable');
    }

    // Vérifier si l'utilisateur a déjà validé cette section
    if (user[vipField]) {
      return ctx.answerCbQuery(`❌ Cette section est déjà activée pour l'utilisateur : ${formationType} - ${part}`);
    }

    // Mise à jour du statut VIP pour la partie spécifique
    await User.updateOne({ _id: userId }, { $set: { [vipField]: true } });

    // Message de confirmation dans Telegram
    await ctx.answerCbQuery('✅ Section validée avec succès !');
    await ctx.editMessageText(`✅ Statut ${formationType} - ${part} activé pour ${user.name}`);

    // Mise à jour des boutons pour permettre la validation d'autres sections avec des icônes différentes
    const inlineKeyboard = [
      [
        {
          text: `✅ ${formationType} - ${part}`,
          callback_data: `validate_${formationType}_${part}_${userId}` // Validation de cette section
        }
      ],
      // Ajouter un bouton pour valider d'autres sections
      ...['Informatique', 'Bureautique', 'Marketing', 'GSM'].map((type) => 
        ['Hardware', 'Software', 'Social', 'Content'].map((subtype) => 
          ({
            text: user[`is${type}${subtype}`] ? `✅ ${type} - ${subtype}` : `❌ ${type} - ${subtype}`,
            callback_data: `validate_${type}_${subtype}_${userId}`
          })
        )
      )
    ];

    // Mise à jour du message avec les nouveaux boutons
    await ctx.editMessageText(`✅ Statut ${formationType} - ${part} activé pour ${user.name}. Vous pouvez maintenant valider d'autres sections.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard // Ajout des nouveaux boutons pour valider d'autres sections
        }
      }
    );

    // Envoi du message WhatsApp pour informer l'utilisateur
    const whatsappMessage = `
🎉 Félicitations ${user.name} !\n
Votre accès VIP ${formationType} ${part} est maintenant actif. Nous vous remercions de votre inscription et vous souhaitons un excellent parcours avec Kaboretech !

Cordialement,
*L’équipe Kabore Tech* 💼🚀
    `;
    await sendWhatsAppMessage(user.phone, whatsappMessage);

  } catch (error) {
    console.error('Erreur lors de la validation:', error);
    ctx.answerCbQuery('❌ Erreur lors de l\'activation du statut VIP');
  }
});

// Route pour oublier le mot de passe
app.post('/api/forgot-password', async (req, res) => {
  const { phone } = req.body;

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: 'Numéro de téléphone non trouvé.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // Valide pour 5 minutes

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    const message = `Votre code de réinitialisation de mot de passe est : ${otp}. Ce code est valide pendant 5 minutes.`;

    // Envoi du message WhatsApp avec le code OTP
    await sendWhatsAppMessage(phone, message);

    res.status(200).json({ message: 'Code OTP envoyé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'OTP :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Vérification du code OTP
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

// Réinitialisation du mot de passe
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

    // Envoi du message WhatsApp de confirmation après réinitialisation
    const message = `✅ Votre mot de passe a été réinitialisé avec succès.`;
    await sendWhatsAppMessage(user.phone, message);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour récupérer la liste des utilisateurs
app.get('/api/users', async (req, res) => {
  try {
    // Récupérer tous les utilisateurs avec les champs nécessaires
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
    }).sort({ createdAt: -1 }); // Tri par date de création décroissante

    // Formater les données pour la réponse
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

  // Vérification si le paramètre 'phone' existe
  if (!phone) {
    return res.status(400).json({ message: 'Le numéro de téléphone est requis' });
  }

  // Conserver le '+' si présent dans le numéro
  phone = phone.trim();  // Supprimer les espaces superflus

  // Log du numéro de téléphone reçu
  console.log(`Numéro de téléphone reçu : ${phone}`);

  // Si le numéro ne commence pas par un "+", on ajoute le "+"
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  // Log du numéro de téléphone avec le "+" ajouté si nécessaire
  console.log(`Recherche de l'utilisateur avec le numéro : ${phone}`);

  try {
    // Recherche de l'utilisateur avec le numéro tel quel
    const user = await User.findOne({ phone: phone });

    if (!user) {
      console.log(`Utilisateur non trouvé pour le numéro : ${phone}`);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log(`Utilisateur trouvé pour le numéro : ${phone}`);

    // Tableau pour les domaines VIP actifs
    const activeVipDomains = [];
    if (user.isInformatiqueHardware) activeVipDomains.push('Informatique Hardware');
    if (user.isInformatiqueSoftware) activeVipDomains.push('Informatique Software');
    if (user.isBureautiqueHardware) activeVipDomains.push('Bureautique Hardware');
    if (user.isBureautiqueSoftware) activeVipDomains.push('Bureautique Software');
    if (user.isMarketingSocial) activeVipDomains.push('Marketing Social');
    if (user.isMarketingContent) activeVipDomains.push('Marketing Content');
    if (user.isVIPGsmHardware) activeVipDomains.push('GSM Hardware');
    if (user.isVIPGsmSoftware) activeVipDomains.push('GSM Software');

    // Réponse avec les domaines VIP actifs
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

  // Vérification des domaines et parties valides
  const validDomains = ['Informatique', 'Marketing', 'Bureautique', 'GSM'];
  const validParts = ['Hardware', 'Software', 'Social', 'Content'];

  if (!validDomains.includes(domaine) || !validParts.includes(part)) {
    return res.status(400).json({ message: 'Domaine ou partie invalide. Vérifiez les options possibles.' });
  }

  const validModes = ['presentiel', 'ligne'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ message: 'Mode de paiement invalide. Les modes possibles sont : presentiel, ligne.' });
  }

  // Ajouter le "+" si nécessaire avant de procéder à la recherche
  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    // Recherche de l'utilisateur
    const user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérification du statut VIP pour le domaine et la partie
    const isVipForPart = user[`is${domaine}${part}`] || false;
    if (isVipForPart) {
      return res.status(200).json({ message: 'Accès VIP validé', isPaid: false });
    }

    // Envoi d'un message Telegram pour la validation
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


app.post('/api/add-video', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;

  try {
    // Vérifiez si les fichiers existent dans la mémoire (buffer)
    if (!req.files.videoFile || !req.files.imageFile) {
      return res.status(400).json({ message: 'Les fichiers vidéo et image sont requis.' });
    }

    // Stocker la vidéo dans GridFS
    const videoFileId = await storeFileInGridFS(req.files.videoFile[0], gridFSBucketVideo);
    
    // Stocker l'image dans GridFS
    const imageFileId = await storeFileInGridFS(req.files.imageFile[0], gridFSBucketImage);

    // Créer la vidéo dans MongoDB
    const newVideo = new Video({
      title,
      categoryId,
      part, // Partie spécifique (Hardware, Software, etc.)
      isPaid: isPaid === 'true',
      description,
      videoFileId,
      imageFileId
    });

    await newVideo.save();

    res.status(201).json({ 
      message: 'Vidéo sauvegardée dans MongoDB !',
      video: newVideo 
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/update-video/:id', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;
  const videoId = req.params.id; // Video ID from URL params

  try {
    // Find the video by ID
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Optionally update files if new files are provided
    let videoFileId = video.videoFileId;
    let imageFileId = video.imageFileId;

    if (req.files.videoFile) {
      // If a new video file is uploaded, store it in GridFS and update the videoFileId
      videoFileId = await storeFileInGridFS(req.files.videoFile[0], gridFSBucketVideo);
    }

    if (req.files.imageFile) {
      // If a new image file is uploaded, store it in GridFS and update the imageFileId
      imageFileId = await storeFileInGridFS(req.files.imageFile[0], gridFSBucketImage);
    }

    // Update video details
    video.title = title || video.title;
    video.categoryId = categoryId || video.categoryId;
    video.part = part || video.part;
    video.isPaid = isPaid === 'true' || video.isPaid;
    video.description = description || video.description;
    video.videoFileId = videoFileId;
    video.imageFileId = imageFileId;

    // Save the updated video
    await video.save();

    res.status(200).json({
      message: 'Vidéo mise à jour avec succès!',
      video
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/delete-video/:id', async (req, res) => {
  const videoId = req.params.id; // Video ID from URL params

  try {
    // Find the video by ID
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Remove the video file and image file from GridFS
    await gridFSBucketVideo.delete(video.videoFileId);
    await gridFSBucketImage.delete(video.imageFileId);

    // Delete the video from MongoDB
    await video.remove();

    res.status(200).json({
      message: 'Vidéo supprimée avec succès!'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ message: error.message });
  }
});



const storeFileInGridFS = (file, bucket) => {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: { mimetype: file.mimetype }
    });

    // Utilisez directement le buffer en mémoire pour envoyer le fichier à GridFS
    uploadStream.write(file.buffer);
    uploadStream.end();

    uploadStream.on('error', (err) => {
      reject(new Error('Erreur lors du téléchargement du fichier : ' + err.message));
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);  // Renvoie l'ID de GridFS après l'upload
    });
  });
};

app.get('/api/video/:id', (req, res) => {
  const videoId = new mongoose.Types.ObjectId(req.params.id);

  const downloadStream = gridFSBucketVideo.openDownloadStream(videoId);

  downloadStream.on('error', (err) => {
    console.error('Erreur lors du téléchargement de la vidéo:', err);
    res.status(404).json({ message: 'Vidéo introuvable' });
  });

  downloadStream.pipe(res);
});

app.get('/api/image/:id', (req, res) => {
  const imageId = new mongoose.Types.ObjectId(req.params.id);

  const downloadStream = gridFSBucketImage.openDownloadStream(imageId);

  downloadStream.on('error', (err) => {
    console.error('Erreur lors du téléchargement de l\'image:', err);
    res.status(404).json({ message: 'Image introuvable' });
  });

  downloadStream.pipe(res);
});

app.get('/api/videos', async (req, res) => {
  try {
    // Récupérer toutes les vidéos
    const videos = await Video.find();

    // Organiser les vidéos par catégorie
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

      // Générer l'URL de l'image et de la vidéo depuis GridFS
      const imageUrl = `/api/image/${video.imageFileId}`;
      const videoUrl = `/api/video/${video.videoFileId}`;

      categoriesMap[categoryId].videos.push({
        id: video._id.toString(),
        title: video.title,
        isPaid: video.isPaid,
        categoryId: categoryId,
        part: video.part,  // Ajout du champ 'part'
        image: imageUrl,
        details: {
          title: video.description?.title || 'Pas de titre',
          video: videoUrl,
          description: video.description?.description || 'Pas de description'
        }
      });
    }

    // Convertir l'objet en tableau de catégories
    const categories = Object.values(categoriesMap);

    res.status(200).json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des vidéos :', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des vidéos' });
  }
});


// Lancement du serveur
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
