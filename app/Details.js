import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const Details = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // 🔹 Extraire les données directes (pas videoData)
  const { title, videoLink, description, categoryId, isPaid } = route.params || {};

  // 🔹 Nettoyer les données critiques
  const cleanVideoLink = videoLink?.trim(); // ✅ Supprime les espaces
  const displayTitle = title || 'Vidéo sans titre';
  const displayDescription = description || 'Aucune description disponible.';

  // 🔹 États
  const [isVIPInformatique, setIsVIPInformatique] = useState(false);
  const [isVIPMarketing, setIsVIPMarketing] = useState(false);
  const [isVIPEnergie, setIsVIPEnergie] = useState(false);
  const [isVIPReparation, setIsVIPReparation] = useState(false);
  const [categories, setCategories] = useState([]);
  const [videoUri, setVideoUri] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // 🔹 Convertir URL Google Drive pour streaming
  const convertGoogleDriveUrl = (url) => {
    if (!url) return '';

    const cleanUrl = url.trim().split('&')[0]; // Nettoyer
    const fileIdMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`; // ✅ URL optimisée
    }
    return url;
  };

  // 🔹 Validation de l'URL (éviter HEAD sur Drive)
  const validateVideoUrl = async (url) => {
    if (!url || !url.trim()) return false;

    // ✅ On fait confiance aux liens Google Drive bien formatés
    if (url.includes('drive.google.com')) {
      return true;
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return (
        response.ok &&
        (contentType?.includes('video/') ||
          contentType?.includes('application/octet-stream') ||
          url.includes('.mp4'))
      );
    } catch (error) {
      console.log('❌ Échec validation URL:', error.message);
      return false;
    }
  };

  // 🔹 Charger les statuts VIP
  useEffect(() => {
    const loadVIPStatus = async () => {
      try {
        const vipInformatique = await AsyncStorage.getItem('isVIPInformatique');
        const vipMarketing = await AsyncStorage.getItem('isVIPMarketing');
        const vipEnergie = await AsyncStorage.getItem('isVIPEnergie');
        const vipReparation = await AsyncStorage.getItem('isVIPReparation');

        setIsVIPInformatique(vipInformatique === 'true');
        setIsVIPMarketing(vipMarketing === 'true');
        setIsVIPEnergie(vipEnergie === 'true');
        setIsVIPReparation(vipReparation === 'true');
      } catch (error) {
        console.error('Erreur chargement VIP status:', error);
      }
    };
    loadVIPStatus();
  }, []);

  // 🔹 Charger les catégories
  useEffect(() => {
    const loadData = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('categoriesData');
        if (cachedData) {
          setCategories(JSON.parse(cachedData));
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      }
    };
    loadData();
  }, []);

  // 🔹 Générer un nom de fichier unique
  const generateVideoFileName = async (videoUrl) => {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.MD5,
        videoUrl,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      return `video_${hash}.mp4`;
    } catch (error) {
      return `video_${Date.now()}.mp4`;
    }
  };

  // 🔹 Initialiser la vidéo
  useEffect(() => {
    if (!cleanVideoLink) {
      Alert.alert('Erreur', 'Lien vidéo manquant.');
      setIsVideoLoading(false);
      return;
    }

    const initializeVideo = async () => {
      try {
        setIsVideoLoading(true);
        setVideoError(false);

        const directUrl = convertGoogleDriveUrl(cleanVideoLink);
        const isValid = await validateVideoUrl(directUrl);

        const finalUrl = isValid ? directUrl : cleanVideoLink;
        const fileName = await generateVideoFileName(finalUrl);
        const videoPath = FileSystem.cacheDirectory + fileName;

        // Vérifier le cache
        const fileExists = await FileSystem.getInfoAsync(videoPath);
        if (fileExists.exists && fileExists.size > 1024) {
          setVideoUri(videoPath);
        } else {
          setVideoUri(finalUrl);
          // Télécharger en arrière-plan si c'est une URL externe valide
          if (isValid && !finalUrl.includes('drive.google.com')) {
            downloadVideoInBackground(finalUrl, videoPath);
          }
        }
      } catch (error) {
        console.error('❌ Erreur init vidéo:', error);
        setVideoError(true);
      } finally {
        setIsVideoLoading(false);
      }
    };

    initializeVideo();
  }, [cleanVideoLink]);

  // 🔹 Téléchargement en arrière-plan
  const downloadVideoInBackground = async (videoUrl, destinationPath) => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      const downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        destinationPath,
        {},
        (progress) => {
          const percent = (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100;
          setDownloadProgress(Math.round(percent));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        setVideoUri(result.uri);
      }
    } catch (error) {
      console.error('❌ Échec téléchargement:', error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // 🔹 Vérifier le statut VIP
  const getCategoryVIPStatus = (id) => {
    switch (id) {
      case 'Informatique': return isVIPInformatique;
      case 'Marketing': return isVIPMarketing;
      case 'Energie': return isVIPEnergie;
      case 'Réparation': return isVIPReparation;
      case 'GSM': return true; // Gratuit
      default: return false;
    }
  };

  const canUserPlay = !isPaid || getCategoryVIPStatus(categoryId);

  // 🔹 Vidéos suggérées
  const getSuggestedVideos = () => {
    if (!categories.length) return [];

    if (isPaid) {
      const cat = categories.find(c => c.id === categoryId);
      return cat?.videos
        .filter(v => v.details?.video !== cleanVideoLink && v.isPaid)
        || [];
    } else {
      const allFree = [];
      categories.forEach(cat => {
        cat.videos.forEach(video => {
          if (!video.isPaid && video.details?.video !== cleanVideoLink) {
            allFree.push({ ...video });
          }
        });
      });
      return allFree.sort(() => Math.random() - 0.5).slice(0, 10);
    }
  };

  const suggestedVideos = getSuggestedVideos();

  // 🔹 Ouvrir une autre vidéo
  const handleVideoPress = (video) => {
    const isFree = !video.isPaid || getCategoryVIPStatus(video.categoryId);
    navigation.replace('Details', {
      title: video.title,
      description: video.description || video.details?.description,
      videoLink: video.details?.video,
      categoryId: video.categoryId,
      isPaid: !isFree,
    });
  };

  // 🔹 Gérer l'abonnement
  const handleSubscribe = () => {
    const category = categories.find(c => c.id === categoryId);
    if (category?.name) {
      navigation.navigate('Paiement', {
        categoryName: category.name,
        videoData: {
          title: displayTitle,
          videoLink: cleanVideoLink,
          description: displayDescription,
          categoryId,
          isPaid,
        },
      });
    } else {
      Alert.alert('Erreur', 'Impossible de charger les détails de la formation.');
    }
  };

  // 🔹 Player vidéo
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;

    player.addListener('statusChange', (status) => {
      if (status.status === 'error') {
        console.error('❌ Erreur player:', status.error);
        setVideoError(true);
      }
    });

    if (canUserPlay && videoUri && !videoError) {
      setTimeout(() => {
        try {
          player.play();
        } catch (e) {
          console.error('❌ Impossible de lire:', e);
          setVideoError(true);
        }
      }, 500);
    }
  });

  // 🔹 Afficher erreur
  if (videoError) {
    return (
      <View style={styles.container}>
        <View style={styles.statusBar} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={30} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Erreur</Text>
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Vidéo non disponible</Text>
          <Text style={styles.errorMessage}>
            Vérifiez que le lien est valide et que le fichier est partagé publiquement.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setVideoError(false);
              setIsVideoLoading(true);
            }}
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barre d'état */}
      <View style={styles.statusBar} />

      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={30} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          🎥 {displayTitle}
        </Text>
      </View>


      <View style={styles.videoContainer}>
        {isVideoLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingText}>Chargement de la vidéo...</Text>
          </View>
        ) : (
          <VideoView
            style={styles.videoPlayer}
            player={player}
            allowsFullscreen
            contentFit="contain"
            nativeControls={canUserPlay}
          />
        )}

        {/* Indicateur de téléchargement */}
        {isDownloading && (
          <View style={styles.downloadIndicator}>
            <View style={styles.downloadProgress}>
              <View style={[styles.downloadProgressBar, { width: `${downloadProgress}%` }]} />
            </View>
            <Text style={styles.downloadText}>Mise en cache : {downloadProgress}%</Text>
          </View>
        )}

        {/* Overlay VIP si vidéo payante */}
        {!canUserPlay && (
          <BlurView intensity={15} style={styles.blurOverlay}>
            <View style={styles.subscribeOverlay}>
              <Text style={styles.subscribeText}>🔒 Abonnez-vous pour débloquer</Text>
              <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
                <Text style={styles.buttonText}>S'abonner maintenant</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </View>
      <Text style={styles.descriptionText}>{displayDescription}</Text>
      {/* Suggestions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isPaid ? '📚 Autres formations premium' : '🎉 D’autres vidéos gratuites'}
        </Text>

        {suggestedVideos.length > 0 ? (
          <FlatList
            horizontal
            data={suggestedVideos}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => handleVideoPress(item)}>
                <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
                {item.isPaid && (
                  <View style={styles.premiumTag}>
                    <Text style={styles.premiumText}>🔒 Premium</Text>
                  </View>
                )}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>📌 {item.title}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.noSuggestions}>Aucune vidéo disponible pour le moment.</Text>
        )}
      </View>
    </View>
  );
};

// 🔹 STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  statusBar: { height: 40, backgroundColor: '#6C63FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  backButton: { marginRight: 10 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: '#555',
    marginHorizontal: 15,
    marginBottom: 10,
    lineHeight: 20,
  },
  videoContainer: {
    backgroundColor: '#000',
    margin: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 6,
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  downloadIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadProgress: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
    width: '100%',
  },
  downloadProgressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  downloadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  subscribeOverlay: {
    padding: 20,
    alignItems: 'center',
  },
  subscribeText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  subscribeButton: {
    backgroundColor: '#6C63FF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  noSuggestions: {
    color: '#888',
    fontStyle: 'italic',
    marginLeft: 10,
    fontSize: 14,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    width: 260,
    marginRight: 15,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 150,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 5,
  },
  premiumTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
});

export default Details;