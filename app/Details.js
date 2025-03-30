import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video } from 'expo-av';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system'; // Pour la gestion des fichiers

const BASE_URL = "https://kabore.pinetpi.fr";  // Remplacez par l'URL de votre API

const Details = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { title, videoLink, description, categoryId, isPaid } = route.params;

  // États pour les VIP
  const [isVIPInformatique, setIsVIPInformatique] = useState(false);
  const [isVIPMarketing, setIsVIPMarketing] = useState(false);
  const [isVIPEnergie, setIsVIPEnergie] = useState(false);
  const [isVIPReparation, setIsVIPReparation] = useState(false);
  const [categories, setCategories] = useState([]);
  const [videoUri, setVideoUri] = useState(''); // URI pour la vidéo téléchargée
  const [isDownloading, setIsDownloading] = useState(false); // Indicateur de téléchargement

  // Charger les statuts VIP
  useEffect(() => {
    const loadVIPStatus = async () => {
      const vipInformatique = await AsyncStorage.getItem('isVIPInformatique');
      const vipMarketing = await AsyncStorage.getItem('isVIPMarketing');
      const vipEnergie = await AsyncStorage.getItem('isVIPEnergie');
      const vipReparation = await AsyncStorage.getItem('isVIPReparation');

      setIsVIPInformatique(vipInformatique === 'true');
      setIsVIPMarketing(vipMarketing === 'true');
      setIsVIPEnergie(vipEnergie === 'true');
      setIsVIPReparation(vipReparation === 'true');
    };

    loadVIPStatus();
    downloadVideoIfNeeded(); // Appeler la fonction pour télécharger la vidéo si nécessaire
  }, []);

  // Charger les données de catégories depuis AsyncStorage
  useEffect(() => {
    const loadData = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('categoriesData');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);

          // Vérification de la présence de la propriété 'categories'
          if (parsedData) {
            setCategories(parsedData); // Les données sont directement l'array des catégories
          } else {
            console.error("La propriété 'categories' est manquante dans les données.");
          }
        } else {
          console.log('Aucune donnée trouvée en cache.');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    loadData();
  }, []);

  // Télécharger la vidéo si l'utilisateur est connecté
  const downloadVideoIfNeeded = async () => {
    try {
      const videoPath = FileSystem.documentDirectory + 'video.mp4'; // Spécifiez un nom de fichier pour la vidéo
      const videoExists = await FileSystem.getInfoAsync(videoPath);

      if (!videoExists.exists) {
        console.log('Téléchargement de la vidéo...');
        setIsDownloading(true); // Démarrer l'indicateur de téléchargement
        const downloadResult = await FileSystem.downloadAsync(
          `${BASE_URL}${videoLink}`,  // Utilisation de l'URL complète pour télécharger
          videoPath   // Chemin de destination
        );
        console.log('Vidéo téléchargée :', downloadResult.uri);
        setVideoUri(downloadResult.uri); // Mettre à jour le URI de la vidéo téléchargée
        setIsDownloading(false); // Arrêter l'indicateur de téléchargement
      } else {
        console.log('Vidéo déjà téléchargée.');
        setVideoUri(videoPath); // Utiliser le fichier déjà téléchargé
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement de la vidéo:', error);
      setIsDownloading(false); // Arrêter l'indicateur de téléchargement en cas d'erreur
    }
  };

  // Trouver la catégorie en fonction de l'ID
  const category = categories.find(cat => cat.id === categoryId);

  // Filtrer les vidéos similaires dans la même catégorie
  const suggestedVideos = category ? category.videos.filter(video => video.details.video !== videoLink) : [];
  const getCategoryVIPStatus = (categoryId) => {
    switch (categoryId) {
      case 'Informatique': return isVIPInformatique;
      case 'Marketing': return isVIPMarketing;
      case 'Energie': return isVIPEnergie;
      case 'Réparation': return isVIPReparation;
      default: return false;
    }
  };
  const handleVideoPress = (videoDetails) => {
    const isVIP = getCategoryVIPStatus(videoDetails.categoryId);
    console.log('Naviguer vers la vidéo:', {
      title: videoDetails.details.title,
      videoLink: `${BASE_URL}${videoDetails.details.video}`,  // Ajouter BASE_URL ici
      description: videoDetails.details.description,
      categoryId: videoDetails.categoryId,
      isPaid: isVIP ? false : videoDetails.isPaid,
    });
    navigation.replace('Details', {
      title: videoDetails.details.title,
      videoLink: `${BASE_URL}${videoDetails.details.video}`,  // Ajouter BASE_URL ici
      description: videoDetails.details.description,
      categoryId: videoDetails.categoryId,
      isPaid: isVIP ? false : videoDetails.isPaid,
    });    
  };

  const handleSubscribe = () => {
    console.log(category.name)
    navigation.navigate('Paiement', { categoryName: category.name });
  };

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={30} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎥 {title}</Text>
      </View>

      {/* Lecteur vidéo avec overlay */}
      <View style={styles.videoContainer}>
        <Video
         source={{ uri: videoUri || `${BASE_URL}${videoLink}` }} // Lire la vidéo depuis l'URL complète
          style={styles.videoPlayer}
          useNativeControls
          resizeMode="cover"
          shouldPlay={getCategoryVIPStatus(categoryId) || !isPaid}  // Si VIP ou vidéo gratuite, lire la vidéo
          paused={isPaid && !getCategoryVIPStatus(categoryId)}  // Si payante et VIP non activé, mettre en pause
          isLooping={false}
        />

        {isPaid && !getCategoryVIPStatus(categoryId) && (
          <BlurView intensity={15} style={styles.blurOverlay}>
            <View style={styles.subscribeOverlay}>
              <Text style={styles.subscribeText}>
                🔒 Abonnez-vous pour débloquer cette formation
              </Text>
              <TouchableOpacity
                style={styles.subscribeButton}
                onPress={handleSubscribe}>
                <Text style={styles.buttonText}>S'abonner maintenant</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </View>

      {/* Section description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Description</Text>
        <Text style={styles.description}>✨ {description}</Text>

        <Text style={styles.sectionTitle}>📚 Formations similaires</Text>
        <ScrollView>
          <FlatList
            data={suggestedVideos}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleVideoPress(item)}
                style={styles.card}>

                <Image source={{ uri: `${BASE_URL}${item.image}` }} style={styles.cardImage} />

                {item.isPaid && (
                  <View style={styles.premiumTag}>
                    <Text style={styles.premiumText}>🔒 Premium</Text>
                  </View>
                )}

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>📌 {item.title}</Text>
                  <Text style={styles.cardCategory}># {category.name}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 20,
    paddingHorizontal: 15,
    elevation: 8,
  },
  backButton: {
    padding: 5,
    marginTop: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    display: 'inline-flex',
    marginTop: 10,
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: 15,
    margin: 15,
    overflow: 'hidden',
    elevation: 6,
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black'
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
  videoOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  premiumBadge: {
    backgroundColor: 'rgba(255,215,0,0.9)',
    color: '#000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
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
    resizeMode: 'cover',
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
  cardCategory: {
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '500',
  },
  premiumTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
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
