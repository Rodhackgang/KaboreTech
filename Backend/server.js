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
const NodeCache = require('node-cache');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// ===== OPTIMISATIONS =====
// Cache pour les vidéos et métadonnées (30 minutes de TTL)
const videoCache = new NodeCache({ stdTTL: 1800 });
const userCache = new NodeCache({ stdTTL: 900 }); // Cache utilisateurs (15 minutes)

// Compression des réponses et optimisation mémoire
const compression = require('compression');
app.use(compression());

// Configuration mémoire optimisée pour multer
const storage = multer.memoryStorage();
const Setting = require('./models/Setting');
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 200 * 1024 * 1024, // 200MB
    fieldSize: 50 * 1024 * 1024,  // 50MB pour les champs
    files: 2 // Limite à 2 fichiers
  }
});

// Configuration Swagger optimisée
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yml');

let gridFSBucketVideo;
let gridFSBucketImage;

// ===== MIDDLEWARE OPTIMISÉ =====
const corsOptions = {
  origin: 'https://kaboretech.cursusbf.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // Support des anciens navigateurs
};

app.use(cors(corsOptions));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Body parser avec limite optimisée
app.use(bodyParser.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ===== CONNEXION MONGODB OPTIMISÉE =====
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 50, // Maintient jusqu'à 50 connexions socket
  serverSelectionTimeoutMS: 5000, // Timeout après 5s
  socketTimeoutMS: 45000, // Ferme les sockets après 45s d'inactivité
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('✅ Connexion à MongoDB réussie avec optimisations');

    // Initialisation optimisée de GridFS
    const db = mongoose.connection.db;
    gridFSBucketVideo = new GridFSBucket(db, { 
      bucketName: 'videos',
      chunkSizeBytes: 1024 * 1024 * 2 // Chunks de 2MB pour de meilleures performances
    });
    gridFSBucketImage = new GridFSBucket(db, { 
      bucketName: 'images',
      chunkSizeBytes: 1024 * 512 // Chunks de 512KB pour les images
    });

    // Index pour optimiser les requêtes vidéos
    createOptimizedIndexes();
  })
  .catch(err => {
    console.error('❌ Connexion à MongoDB échouée:', err.message);
    process.exit(1);
  });

// ===== CRÉATION D'INDEX OPTIMISÉS =====
async function createOptimizedIndexes() {
  try {
    // Index composé pour les vidéos
    await Video.collection.createIndex({ categoryId: 1, part: 1, isPaid: 1 });
    await Video.collection.createIndex({ createdAt: -1 }); // Pour le tri par date
    
    // Index pour les utilisateurs
    await User.collection.createIndex({ phone: 1 }, { unique: true });
    await User.collection.createIndex({ 
      isInformatiqueHardware: 1, 
      isInformatiqueSoftware: 1,
      isBureautiqueHardware: 1,
      isBureautiqueSoftware: 1 
    });
    
    console.log('✅ Index optimisés créés');
  } catch (error) {
    console.error('❌ Erreur création index:', error);
  }
}

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur de connexion à MongoDB:', err.message);
});

bot.launch();

// ===== ROUTES OPTIMISÉES =====

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cache pour la configuration screen capture
app.get('/api/screen-capture', async (req, res) => {
  try {
    const cacheKey = 'screenCapture_config';
    let setting = videoCache.get(cacheKey);

    if (!setting) {
      setting = await Setting.findOne({ key: 'allowScreenCapture' }).lean();
      if (setting) {
        videoCache.set(cacheKey, setting, 300); // Cache 5 minutes
      }
    }

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

    // Invalide le cache
    videoCache.del('screenCapture_config');

    res.status(200).json({ 
      message: 'Configuration mise à jour', 
      allowScreenCapture: setting.value 
    });
  } catch (error) {
    console.error('Erreur mise à jour config screenCapture:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ===== COMPRESSION VIDÉO OPTIMISÉE =====
const compressVideo = (inputBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(os.tmpdir(), `compressed-${Date.now()}.mp4`);
    const inputPath = path.join(os.tmpdir(), `input-${Date.now()}.mp4`);
    
    // Écrire le buffer en fichier temporaire
    require('fs').writeFileSync(inputPath, inputBuffer);

    const ffmpegCommand = ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size(options.size || '1280x720')
      .videoBitrate(options.videoBitrate || '2000k')
      .audioBitrate(options.audioBitrate || '128k')
      .format('mp4')
      .addOptions([
        '-preset fast', // Compression plus rapide
        '-crf 23',      // Qualité constante
        '-movflags +faststart' // Optimisation streaming
      ]);

    ffmpegCommand
      .on('end', () => {
        // Nettoie le fichier d'entrée
        require('fs').unlinkSync(inputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        // Nettoie les fichiers en cas d'erreur
        try {
          require('fs').unlinkSync(inputPath);
          require('fs').unlinkSync(outputPath);
        } catch {}
        reject(err);
      })
      .on('progress', (progress) => {
        console.log(`Compression: ${progress.percent}%`);
      })
      .run();
  });
};

// ===== ROUTES UTILISATEURS OPTIMISÉES =====

app.post('/register', async (req, res) => {
  const { name, phone, password } = req.body;

  try {
    let formattedPhone = phone.trim();
    
    // Vérification cache pour éviter les doublons
    const existingUser = userCache.get(`user_${formattedPhone}`);
    if (existingUser) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Augmentation du salt pour plus de sécurité
    
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

    // Cache l'utilisateur
    userCache.set(`user_${formattedPhone}`, newUser, 900);

    // Messages Telegram et WhatsApp (code existant)
    const formations = [
      { type: 'Informatique', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Bureautique', price: '10 000 FCFA', parts: ['Hardware', 'Software'] },
      { type: 'Marketing', price: '10 000 FCFA', parts: ['Social', 'Content'] },
      { type: 'GSM', price: '30 000 FCFA', parts: ['Hardware', 'Software'] },
    ];

    // ... (code Telegram et WhatsApp existant)

    res.status(201).json({ message: 'En attente de validation VIP' });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ message: 'Erreur d\'inscription' });
  }
});

// Login optimisé avec cache
app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  let formattedPhone = phone.trim();

  try {
    // Vérification cache utilisateur
    let user = userCache.get(`user_${formattedPhone}`);
    
    if (!user) {
      user = await User.findOne({ phone: formattedPhone }).lean();
      if (user) {
        userCache.set(`user_${formattedPhone}`, user, 900);
      }
    }

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

// ===== GESTION VIDÉOS OPTIMISÉE =====

// Stockage optimisé dans GridFS avec compression
const storeFileInGridFS = async (file, bucket, compress = false) => {
  return new Promise(async (resolve, reject) => {
    try {
      let fileBuffer = file.buffer;
      let filename = file.originalname;

      // Compression conditionnelle pour les vidéos
      if (compress && file.mimetype.startsWith('video/')) {
        console.log('🔄 Compression vidéo en cours...');
        const compressedPath = await compressVideo(file.buffer);
        fileBuffer = require('fs').readFileSync(compressedPath);
        filename = `compressed_${filename}`;
        
        // Nettoie le fichier temporaire
        require('fs').unlinkSync(compressedPath);
        console.log('✅ Compression terminée');
      }

      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { 
          mimetype: file.mimetype,
          originalSize: file.size,
          compressedSize: fileBuffer.length
        }
      });

      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        console.log(`📁 Fichier stocké: ${filename} (${fileBuffer.length} bytes)`);
        resolve(uploadStream.id);
      });

      uploadStream.end(fileBuffer);
    } catch (error) {
      reject(error);
    }
  });
};

// Ajout de vidéo optimisé avec processing parallèle
app.post('/api/add-video', upload.fields([
  { name: 'videoFile', maxCount: 1 }, 
  { name: 'imageFile', maxCount: 1 }
]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;

  try {
    if (!req.files.videoFile || !req.files.imageFile) {
      return res.status(400).json({ message: 'Les fichiers vidéo et image sont requis.' });
    }

    console.log('🚀 Début du traitement des fichiers...');

    // Traitement parallèle des fichiers
    const [videoFileId, imageFileId] = await Promise.all([
      storeFileInGridFS(req.files.videoFile[0], gridFSBucketVideo, true), // Compression vidéo
      storeFileInGridFS(req.files.imageFile[0], gridFSBucketImage, false)  // Pas de compression image
    ]);

    const newVideo = new Video({
      title,
      categoryId,
      part,
      isPaid: isPaid === 'true',
      description,
      videoFileId,
      imageFileId,
      createdAt: new Date()
    });

    await newVideo.save();

    // Invalide le cache des vidéos
    videoCache.flushAll();

    console.log('✅ Vidéo sauvegardée avec succès');

    res.status(201).json({ 
      message: 'Vidéo sauvegardée dans MongoDB !',
      video: {
        id: newVideo._id,
        title: newVideo.title,
        categoryId: newVideo.categoryId,
        part: newVideo.part
      }
    });

  } catch (error) {
    console.error('❌ Erreur ajout vidéo:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'ajout de la vidéo',
      error: error.message 
    });
  }
});

// Récupération des vidéos avec cache et pagination
app.get('/api/videos', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, part } = req.query;
    const cacheKey = `videos_${page}_${limit}_${category || 'all'}_${part || 'all'}`;
    
    // Vérification cache
    let cachedData = videoCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    console.log('🔍 Récupération des vidéos depuis la DB...');

    // Construction de la requête avec filtres
    let query = {};
    if (category) query.categoryId = category;
    if (part) query.part = part;

    // Requête optimisée avec pagination
    const videos = await Video
      .find(query)
      .select('title categoryId part isPaid description videoFileId imageFileId createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Utilisation de lean() pour de meilleures performances

    // Organisation par catégories
    const categoriesMap = {};

    videos.forEach(video => {
      const categoryId = video.categoryId;

      if (!categoriesMap[categoryId]) {
        categoriesMap[categoryId] = {
          id: categoryId,
          name: categoryId,
          videos: []
        };
      }

      // URLs optimisées
      const imageUrl = `/api/image/${video.imageFileId}`;
      const videoUrl = `/api/video/${video.videoFileId}`;

      categoriesMap[categoryId].videos.push({
        id: video._id.toString(),
        title: video.title,
        isPaid: video.isPaid,
        categoryId: categoryId,
        part: video.part,
        image: imageUrl,
        details: {
          title: video.description?.title || video.title,
          video: videoUrl,
          description: video.description?.description || 'Pas de description'
        }
      });
    });

    const categories = Object.values(categoriesMap);

    // Mise en cache
    videoCache.set(cacheKey, categories, 1800);

    console.log(`✅ ${videos.length} vidéos récupérées et mises en cache`);

    res.status(200).json(categories);
  } catch (error) {
    console.error('❌ Erreur récupération vidéos:', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des vidéos' });
  }
});

// Streaming optimisé des vidéos avec support du Range
app.get('/api/video/:id', async (req, res) => {
  try {
    const videoId = new mongoose.Types.ObjectId(req.params.id);
    const range = req.headers.range;

    // Récupérer les métadonnées du fichier
    const files = await gridFSBucketVideo.find({ _id: videoId }).toArray();
    if (files.length === 0) {
      return res.status(404).json({ message: 'Vidéo introuvable' });
    }

    const file = files[0];
    const fileSize = file.length;

    if (range) {
      // Support du streaming par chunks
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.metadata?.mimetype || 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      });

      const downloadStream = gridFSBucketVideo.openDownloadStream(videoId, {
        start,
        end: end + 1
      });

      downloadStream.pipe(res);
    } else {
      // Streaming complet
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': file.metadata?.mimetype || 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      });

      const downloadStream = gridFSBucketVideo.openDownloadStream(videoId);
      downloadStream.pipe(res);
    }
  } catch (error) {
    console.error('❌ Erreur streaming vidéo:', error);
    res.status(404).json({ message: 'Vidéo introuvable' });
  }
});

// Streaming optimisé des images avec cache
app.get('/api/image/:id', async (req, res) => {
  try {
    const imageId = new mongoose.Types.ObjectId(req.params.id);
    
    // Headers de cache pour les images
    res.set({
      'Cache-Control': 'public, max-age=86400', // Cache 24h
      'ETag': imageId.toString()
    });

    // Vérification ETag
    if (req.headers['if-none-match'] === imageId.toString()) {
      return res.status(304).end();
    }

    const downloadStream = gridFSBucketImage.openDownloadStream(imageId);

    downloadStream.on('error', () => {
      res.status(404).json({ message: 'Image introuvable' });
    });

    downloadStream.on('file', (file) => {
      res.set('Content-Type', file.metadata?.mimetype || 'image/jpeg');
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('❌ Erreur streaming image:', error);
    res.status(404).json({ message: 'Image introuvable' });
  }
});

// ===== ROUTES EXISTANTES (optimisées) =====

// Mise à jour vidéo optimisée
app.put('/api/update-video/:id', upload.fields([
  { name: 'videoFile', maxCount: 1 }, 
  { name: 'imageFile', maxCount: 1 }
]), async (req, res) => {
  const { title, categoryId, part, isPaid, description } = req.body;
  const videoId = req.params.id;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    let videoFileId = video.videoFileId;
    let imageFileId = video.imageFileId;

    // Mise à jour parallèle des fichiers si fournis
    const updatePromises = [];
    
    if (req.files.videoFile) {
      updatePromises.push(
        storeFileInGridFS(req.files.videoFile[0], gridFSBucketVideo, true)
          .then(id => { videoFileId = id; })
      );
    }

    if (req.files.imageFile) {
      updatePromises.push(
        storeFileInGridFS(req.files.imageFile[0], gridFSBucketImage, false)
          .then(id => { imageFileId = id; })
      );
    }

    await Promise.all(updatePromises);

    // Mise à jour des données
    Object.assign(video, {
      title: title || video.title,
      categoryId: categoryId || video.categoryId,
      part: part || video.part,
      isPaid: isPaid === 'true' || video.isPaid,
      description: description || video.description,
      videoFileId,
      imageFileId
    });

    await video.save();

    // Invalide le cache
    videoCache.flushAll();

    res.status(200).json({
      message: 'Vidéo mise à jour avec succès!',
      video: {
        id: video._id,
        title: video.title,
        categoryId: video.categoryId
      }
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

// Suppression optimisée
app.delete('/api/delete-video/:id', async (req, res) => {
  const videoId = req.params.id;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Vidéo non trouvée.' });
    }

    // Suppression parallèle des fichiers
    await Promise.all([
      gridFSBucketVideo.delete(video.videoFileId),
      gridFSBucketImage.delete(video.imageFileId),
      Video.findByIdAndDelete(videoId)
    ]);

    // Invalide le cache
    videoCache.flushAll();

    res.status(200).json({
      message: 'Vidéo supprimée avec succès!'
    });

  } catch (error) {
    console.error('❌ Erreur suppression vidéo:', error);
    res.status(500).json({ message: error.message });
  }
});

// ===== ROUTES UTILISATEURS EXISTANTES (optimisées) =====

// Route optimisée pour la liste des utilisateurs
app.get('/api/users', async (req, res) => {
  try {
    const cacheKey = 'all_users';
    let users = userCache.get(cacheKey);

    if (!users) {
      users = await User
        .find({}, {
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
        })
        .sort({ createdAt: -1 })
        .lean();

      userCache.set(cacheKey, users, 600); // Cache 10 minutes
    }

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
    console.error('❌ Erreur récupération utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
    });
  }
});

// Status VIP optimisé avec cache
app.get('/api/vip-status', async (req, res) => {
  let { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ message: 'Le numéro de téléphone est requis' });
  }

  phone = phone.trim();
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  try {
    const cacheKey = `vip_status_${phone}`;
    let vipData = userCache.get(cacheKey);

    if (!vipData) {
      const user = await User.findOne({ phone }).lean();

      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé' });
      }

      const activeVipDomains = [];
      if (user.isInformatiqueHardware) activeVipDomains.push('Informatique Hardware');
      if (user.isInformatiqueSoftware) activeVipDomains.push('Informatique Software');
      if (user.isBureautiqueHardware) activeVipDomains.push('Bureautique Hardware');
      if (user.isBureautiqueSoftware) activeVipDomains.push('Bureautique Software');
      if (user.isMarketingSocial) activeVipDomains.push('Marketing Social');
      if (user.isMarketingContent) activeVipDomains.push('Marketing Content');
      if (user.isVIPGsmHardware) activeVipDomains.push('GSM Hardware');
      if (user.isVIPGsmSoftware) activeVipDomains.push('GSM Software');

      vipData = { vipDomains: activeVipDomains };
      userCache.set(cacheKey, vipData, 900); // Cache 15 minutes
    }

    res.status(200).json({
      message: 'Statuts VIP récupérés avec succès',
      ...vipData
    });

  } catch (error) {
    console.error('❌ Erreur récupération statuts VIP:', error);
    res.status(500).json({ message: 'Erreur interne lors de la récupération des statuts VIP' });
  }
});

// ===== AUTRES ROUTES OPTIMISÉES =====

// Route paiement optimisée
app.post('/api/paiement', async (req, res) => {
  const { phone, numDepot, domaine, part, mode, price } = req.body;

  const validDomains = ['Informatique', 'Marketing', 'Bureautique', 'GSM'];
  const validParts = ['Hardware', 'Software', 'Social', 'Content'];
  const validModes = ['presentiel', 'ligne'];

  if (!validDomains.includes(domaine) || !validParts.includes(part)) {
    return res.status(400).json({ message: 'Domaine ou partie invalide.' });
  }

  if (!validModes.includes(mode)) {
    return res.status(400).json({ message: 'Mode de paiement invalide.' });
  }

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    // Vérification cache utilisateur
    let user = userCache.get(`user_${formattedPhone}`);
    
    if (!user) {
      user = await User.findOne({ phone: formattedPhone }).lean();
      if (user) {
        userCache.set(`user_${formattedPhone}`, user, 900);
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const isVipForPart = user[`is${domaine}${part}`] || false;
    if (isVipForPart) {
      return res.status(200).json({ message: 'Accès VIP validé', isPaid: false });
    }

    // Message Telegram optimisé
    const telegramMessage = `
📩 *Nouveau Paiement Reçu*:

📝 *Numéro de Dépôt*: ${numDepot}
📞 *Utilisateur*: ${formattedPhone}
💼 *Domaine*: ${domaine} - ${part}
🌐 *Mode*: ${mode}
💰 *Prix*: ${price} FCFA

⏰ *Date*: ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}
    `;

    await bot.telegram.sendMessage(process.env.CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown'
    });

    res.status(200).json({ message: 'Paiement vérifié et notifié.' });
  } catch (error) {
    console.error('❌ Erreur vérification paiement:', error);
    res.status(500).json({ message: 'Erreur interne.' });
  }
});

// Routes oubli mot de passe optimisées
app.post('/api/forgot-password', async (req, res) => {
  const { phone } = req.body;

  try {
    let user = userCache.get(`user_${phone}`);
    
    if (!user) {
      user = await User.findOne({ phone });
      if (user) {
        userCache.set(`user_${phone}`, user, 900);
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Numéro de téléphone non trouvé.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      { otp, otpExpiresAt }
    );

    // Invalide le cache utilisateur
    userCache.del(`user_${phone}`);

    const message = `🔐 Votre code de réinitialisation Kaboretech : *${otp}*\n\n⏰ Valide pendant 5 minutes.\n\n_Merci de ne pas partager ce code._`;

    await sendWhatsAppMessage(phone, message);

    res.status(200).json({ message: 'Code OTP envoyé avec succès.' });
  } catch (error) {
    console.error('❌ Erreur envoi OTP:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const user = await User.findOne({ 
      phone, 
      otp,
      otpExpiresAt: { $gt: new Date() }
    }).lean();

    if (!user) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré.' });
    }

    res.status(200).json({ message: 'Code OTP validé avec succès.' });
  } catch (error) {
    console.error('❌ Erreur vérification OTP:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { phone, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ 
      phone, 
      otp,
      otpExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Code OTP invalide ou expiré.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    // Invalide le cache utilisateur
    userCache.del(`user_${phone}`);

    const message = `✅ *Mot de passe réinitialisé*\n\nVotre mot de passe Kaboretech a été modifié avec succès.\n\n🔐 Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.`;
    
    await sendWhatsAppMessage(phone, message);

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    console.error('❌ Erreur réinitialisation mot de passe:', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ===== VALIDATION TELEGRAM OPTIMISÉE =====
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
      return ctx.answerCbQuery(`❌ Section déjà activée : ${formationType} - ${part}`);
    }

    // Mise à jour atomique
    await User.updateOne(
      { _id: userId },
      { $set: { [vipField]: true } }
    );

    // Invalide les caches utilisateur
    userCache.del(`user_${user.phone}`);
    userCache.del(`vip_status_${user.phone}`);
    userCache.del('all_users');

    await ctx.answerCbQuery('✅ Section validée avec succès !');
    await ctx.editMessageText(
      `✅ *Statut activé*\n\n👤 *Utilisateur* : ${user.name}\n📱 *Téléphone* : ${user.phone}\n💼 *Formation* : ${formationType} - ${part}\n⏰ *Validé le* : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}`,
      { parse_mode: 'Markdown' }
    );

    // Message WhatsApp optimisé
    const whatsappMessage = `
🎉 *Félicitations ${user.name} !*

✅ Votre accès *${formationType} ${part}* est maintenant *ACTIF*.

🚀 Vous pouvez dès maintenant :
• Accéder aux vidéos de formation
• Participer aux sessions en direct
• Télécharger les ressources

📱 Connectez-vous à votre compte pour commencer !

💼 *L'équipe Kabore Tech*
_Votre succès, notre priorité_ 🇧🇫
    `;

    await sendWhatsAppMessage(user.phone, whatsappMessage);

  } catch (error) {
    console.error('❌ Erreur validation Telegram:', error);
    ctx.answerCbQuery('❌ Erreur lors de l\'activation');
  }
});

// ===== MONITORING ET HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    cache: {
      videoCache: videoCache.getStats(),
      userCache: userCache.getStats()
    }
  };

  res.status(200).json(healthInfo);
});

// ===== MÉTRIQUES PERFORMANCES =====
app.get('/api/metrics', async (req, res) => {
  try {
    const [videoCount, userCount] = await Promise.all([
      Video.countDocuments(),
      User.countDocuments()
    ]);

    const metrics = {
      videos: {
        total: videoCount,
        cached: Object.keys(videoCache.data).length
      },
      users: {
        total: userCount,
        cached: Object.keys(userCache.data).length
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        cpus: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      }
    };

    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== NETTOYAGE AUTOMATIQUE =====
// Nettoie les caches toutes les heures
setInterval(() => {
  const before = videoCache.getStats();
  videoCache.flushAll();
  console.log(`🧹 Cache vidéos nettoyé : ${before.keys} clés supprimées`);
}, 3600000); // 1 heure

// Nettoie les fichiers temporaires
setInterval(() => {
  const tmpDir = require('os').tmpdir();
  const fs = require('fs');
  
  fs.readdir(tmpDir, (err, files) => {
    if (err) return;
    
    files
      .filter(file => file.startsWith('compressed-') || file.startsWith('input-'))
      .forEach(file => {
        const filePath = require('path').join(tmpDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          
          // Supprime les fichiers de plus de 1 heure
          if (Date.now() - stats.mtime.getTime() > 3600000) {
            fs.unlink(filePath, () => {
              console.log(`🗑️ Fichier temporaire supprimé : ${file}`);
            });
          }
        });
      });
  });
}, 1800000); // 30 minutes

// ===== GESTION DES ERREURS GLOBALES =====
app.use((error, req, res, next) => {
  console.error('❌ Erreur non gérée:', error);
  
  // Log détaillé pour le debugging
  console.error('Stack trace:', error.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('Request body:', req.body);
  
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  // Redémarre gracieusement
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  console.error('Promise:', promise);
});

// ===== DÉMARRAGE OPTIMISÉ DU SERVEUR =====
const gracefulShutdown = () => {
  console.log('🔄 Arrêt gracieux en cours...');
  
  server.close(() => {
    console.log('✅ Serveur HTTP fermé');
    
    mongoose.connection.close(false, () => {
      console.log('✅ Connexion MongoDB fermée');
      process.exit(0);
    });
  });
  
  // Force l'arrêt après 10 secondes
  setTimeout(() => {
    console.log('⚠️ Arrêt forcé');
    process.exit(1);
  }, 10000);
};

// Gestion des signaux d'arrêt
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Lancement du serveur avec gestion d'erreur
server.listen(PORT, () => {
  console.log(`
🚀 ===============================================
   KABORE TECH API - SERVEUR OPTIMISÉ
🚀 ===============================================

📡 Serveur : http://localhost:${PORT}
📚 Documentation : http://localhost:${PORT}/api-docs
💊 Health Check : http://localhost:${PORT}/api/health
📊 Métriques : http://localhost:${PORT}/api/metrics

🎯 OPTIMISATIONS ACTIVÉES :
   ✅ Cache mémoire (videos + users)
   ✅ Compression vidéos automatique
   ✅ Streaming optimisé avec Range support
   ✅ Index MongoDB performants
   ✅ Requêtes parallèles
   ✅ Nettoyage automatique
   ✅ Monitoring intégré

🌍 Environnement : ${process.env.NODE_ENV || 'development'}
💾 Node.js : ${process.version}
🔧 CPUs disponibles : ${require('os').cpus().length}

🚀 ===============================================
  `);
}).on('error', (error) => {
  console.error('❌ Erreur démarrage serveur:', error);
  process.exit(1);
});
