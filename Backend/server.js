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
const upload = multer({ storage: storage });
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

let gridFSBucketVideo;
let gridFSBucketImage;

// Middleware
app.use(cors());
app.use(bodyParser.json());

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
      isVIPInformatique: false,
      isVIPMarketing: false,
      isVIPEnergie: false,
      isVIPReparation: false,
    });
    await newUser.save();

    // Message Telegram pour administrateur avec boutons pour chaque service
    const formations = [
      { type: 'Informatique', price: '30 000 FCFA' },
      { type: 'Marketing', price: '20 000 FCFA' },
      { type: 'Energie', price: '30 000 FCFA' },
      { type: 'Réparation', price: '30 000 FCFA' },
    ];

    let telegramMessage = `👤 *Nouvel utilisateur inscrit* :
📛 *Nom* : ${name}
📞 *Téléphone* : ${formattedPhone}

Veuillez valider ou annuler les formations demandées par cet utilisateur :\n`;

    formations.forEach((formation, index) => {
      telegramMessage += `\n💼 *${formation.type}* : ${formation.price}`;
    });

    // Crée un tableau de lignes de boutons, où chaque ligne contient 2 boutons (valider et annuler)
    const inlineKeyboard = formations.map((formation) => {
      return [
        { 
          text: `✅ ${formation.type}`, 
          callback_data: `validate_${formation.type}_${newUser._id}` // Ordre inversé ici
        },
        { 
          text: `❌ ${formation.type}`, 
          callback_data: `reject_${formation.type}_${newUser._id}` 
        }
      ];
    });
    
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
🎉 *Bienvenue chez Kaboretech*

Votre compte est en attente de validation.

${formationsMessage}

Nos coordonnées de paiement :
➡ Orange Money : +226 74 39 19 80
➡ Moov Money : +226 02 18 04 25

Cordialement,
*Kabore Tech*
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


// Modifier le handler des actions Telegram :
bot.action(/validate_(Informatique|Marketing|Energie|Réparation)_([0-9a-fA-F]{24})/, async (ctx) => {
  const [_, formationType, userId] = ctx.match; // Ordre corrigé
  const vipFieldMap = {
    'Informatique': 'isVIPInformatique',
    'Marketing': 'isVIPMarketing',
    'Energie': 'isVIPEnergie',
    'Réparation': 'isVIPReparation'
  };

  const requiredPrice = formationType === 'Marketing' ? 20000 : 30000;
  const vipField = vipFieldMap[formationType];

  try {
    // Validation stricte de l'ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return ctx.answerCbQuery('❌ ID utilisateur invalide');
    }

    const user = await User.findById(userId);
    if (!user) return ctx.answerCbQuery('❌ Utilisateur introuvable');

    // Vérification du prix
    if (user.price !== requiredPrice) {
      return ctx.answerCbQuery(`❌ Erreur: ${user.price}F au lieu de ${requiredPrice}F !`);
    }

    // Mise à jour du statut VIP
    await User.updateOne({ _id: userId }, { $set: { [vipField]: true } });
    
    // Message de confirmation
    await ctx.answerCbQuery('✅ VIP validé avec succès !');
    await ctx.editMessageText(`✅ Statut ${formationType} activé pour ${user.name}`);

    // Notification WhatsApp
    await sendWhatsAppMessage(
      user.phone,
      `🎉 Félicitations ${user.name} !\nVotre accès VIP ${formationType} est maintenant actif.`
    );

  } catch (error) {
    console.error('Erreur validation:', error);
    ctx.answerCbQuery('❌ Erreur lors de la validation');
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

app.get('/api/vip-status', async (req, res) => {
  let { phone } = req.query;
  
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

    const activeVipDomains = [];
    if (user.isVIPInformatique) activeVipDomains.push('Informatique');
    if (user.isVIPMarketing) activeVipDomains.push('Marketing');
    if (user.isVIPEnergie) activeVipDomains.push('Energie');
    if (user.isVIPReparation) activeVipDomains.push('Réparation');

    res.status(200).json({
      message: 'Statuts VIP récupérés avec succès',
      vipDomains: activeVipDomains
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statuts VIP:', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des statuts VIP' });
  }
});

// Nouvelle route pour vérifier le paiement et envoyer sur Telegram
app.post('/api/paiement', async (req, res) => {
  const { phone, numDepot, domaine, mode, price } = req.body;

  // Log du numéro de téléphone reçu
  console.log(`Numéro de téléphone reçu pour le paiement : ${phone.trim()}`);

  // Vérification du domaine
  const validDomains = ['Informatique', 'Marketing', 'Energie', 'Reparation'];
  if (!validDomains.includes(domaine)) {
    return res.status(400).json({ message: 'Domaine invalide. Les domaines possibles sont : Informatique, Marketing, Energie, Reparation.' });
  }

  // Vérification du mode de paiement
  const validModes = ['presentiel', 'ligne'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ message: 'Mode de paiement invalide. Les modes possibles sont : presentiel, ligne.' });
  }

  // Vérification du prix (en fonction du domaine et du mode)
  const categoryPrices = {
    'Informatique': { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
    'Marketing': { presentiel: '30 000 🪙', ligne: '20 000 🪙' },
    'Energie': { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
    'Reparation': { presentiel: '45 000 🪙', ligne: '30 000 🪙' }
  };

  if (categoryPrices[domaine][mode] !== price) {
    return res.status(400).json({ message: 'Erreur de prix. Le prix ne correspond pas au mode de paiement sélectionné.' });
  }

  // Aucune modification du numéro n'est effectuée ici, on l'accepte tel quel
  let formattedPhone = phone.trim();
  console.log(`Recherche du paiement pour le numéro de téléphone : ${formattedPhone}`);

  // Ajouter le "+" si nécessaire avant de procéder à la recherche
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    // Recherche de l'utilisateur avec le numéro tel quel
    console.log(`Recherche de l'utilisateur avec le numéro : ${formattedPhone}`);
    const user = await User.findOne({ phone: formattedPhone });

    if (!user) {
      console.log(`Utilisateur non trouvé pour le numéro : ${formattedPhone}`);
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log(`Utilisateur trouvé pour le numéro : ${formattedPhone}`);

    // Envoi d'un message sur Telegram avec les informations
    const telegramMessage = `
    📩 *Nouveau Paiement Reçu*:

    📝 *Numéro de Dépôt*: ${numDepot}
    📞 *Numéro d'Utilisateur*: ${formattedPhone}
    💼 *Domaine*: ${domaine}
    🌐 *Mode de Paiement*: ${mode}
    💰 *Prix*: ${price}

    Veuillez procéder à la validation du paiement et du statut VIP de l'utilisateur.
    `;

    // Envoi du message sur Telegram
    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown'
    });

    res.status(200).json({ message: 'Paiement vérifié et message envoyé sur Telegram.' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message Telegram:', error);
    res.status(500).json({ message: 'Erreur interne lors de la vérification du paiement.' });
  }
});

app.post('/api/add-video', upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
  const { title, categoryId, isPaid, description } = req.body;

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
  
  downloadStream.on('error', () => {
    res.status(404).json({ message: 'Vidéo introuvable' });
  });

  downloadStream.pipe(res);
});
app.get('/api/image/:id', (req, res) => {
  const imageId = new mongoose.Types.ObjectId(req.params.id);
  
  const downloadStream = gridFSBucketImage.openDownloadStream(imageId);
  
  downloadStream.on('error', () => {
    res.status(404).json({ message: 'Image introuvable' });
  });

  downloadStream.pipe(res);
});
app.get('/api/videos', async (req, res) => {
  try {
    // Récupérer toutes les vidéos
    const videos = await Video.find();

    // Organiser les vidéos par catégorie
    const categories = [];

    const categoriesMap = {};

    for (let video of videos) {
      // Vérification de la catégorie de la vidéo
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
        image: imageUrl, // Utiliser l'URL générée pour l'image
        details: {
          title: video.details?.title || 'Pas de titre',
          video: videoUrl, // Utiliser l'URL générée pour la vidéo
          description: video.details?.description || 'Pas de description'
        }
      });
    }

    // Convertir l'objet en tableau de catégories
    for (const categoryId in categoriesMap) {
      categories.push(categoriesMap[categoryId]);
    }

    res.status(200).json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des vidéos :', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// Lancement du serveur
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
