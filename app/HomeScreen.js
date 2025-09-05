import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ToastAndroid,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [userInfo, setUserInfo] = useState({ phoneNumber: '' });
  const [vipStatus, setVipStatus] = useState({
    Informatique: { hardware: false, software: false },
    Marketing: { social: false, content: false },
    GSM: { hardware: false, software: false },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [haveAccount, setHaveAccount] = useState(true);

  // Afficher un toast
  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert('Information', message);
    }
  };

  // Charger les données utilisateur
  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      const hasAccount = await AsyncStorage.getItem('haveAccount');
      setUserInfo({ phoneNumber: phone || '' });
      setHaveAccount(hasAccount === 'true');
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
    }
  };

  // Charger les catégories (cache + API)
  const loadCategoriesFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem('categoriesData');
      if (cached) setCategories(JSON.parse(cached));
      await fetchCategories();
    } catch (error) {
      console.error('Erreur cache:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://kaboretech.cursusbf.com/api/videos');
      const data = await response.json();
      
      await AsyncStorage.setItem('categoriesData', JSON.stringify(data));
      setCategories(data);
    } catch (error) {
      console.error('Erreur chargement vidéos:', error);
      Alert.alert('Erreur', 'Impossible de charger les formations');
    }
  };

  // Charger le statut VIP
  const loadVipStatus = async () => {
    try {
      const status = {
        Informatique: {
          hardware: (await AsyncStorage.getItem('isVIPInformatiqueHardware')) === 'true',
          software: (await AsyncStorage.getItem('isVIPInformatiqueSoftware')) === 'true',
        },
        Marketing: {
          social: (await AsyncStorage.getItem('isVIPMarketingSocial')) === 'true',
          content: (await AsyncStorage.getItem('isVIPMarketingContent')) === 'true',
        },
        GSM: {
          hardware: (await AsyncStorage.getItem('isVIPGsmHardware')) === 'true',
          software: (await AsyncStorage.getItem('isVIPGsmSoftware')) === 'true',
        },
      };
      setVipStatus(status);
    } catch (error) {
      console.error('Erreur chargement VIP:', error);
    }
  };

  // Rafraîchir le statut VIP
  const refreshVipStatus = async () => {
    if (!userInfo.phoneNumber) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`https://kaboretech.cursusbf.com/api/vip-status?phone=${userInfo.phoneNumber}`);
      const data = await res.json();
      if (data.vipDomains) {
        const newStatus = {
          Informatique: {
            hardware: data.vipDomains.includes('Informatique Hardware'),
            software: data.vipDomains.includes('Informatique Software'),
          },
          Marketing: {
            social: data.vipDomains.includes('Marketing Social'),
            content: data.vipDomains.includes('Marketing Content'),
          },
          GSM: {
            hardware: data.vipDomains.includes('GSM Hardware'),
            software: data.vipDomains.includes('GSM Software'),
          },
        };
        setVipStatus(newStatus);
        await saveVipStatus(newStatus);
      }
    } catch (error) {
      console.error('Erreur mise à jour VIP:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const saveVipStatus = async (status) => {
    try {
      await Promise.all([
        AsyncStorage.setItem('isVIPInformatiqueHardware', status.Informatique.hardware.toString()),
        AsyncStorage.setItem('isVIPInformatiqueSoftware', status.Informatique.software.toString()),
        AsyncStorage.setItem('isVIPMarketingSocial', status.Marketing.social.toString()),
        AsyncStorage.setItem('isVIPMarketingContent', status.Marketing.content.toString()),
        AsyncStorage.setItem('isVIPGsmHardware', status.GSM.hardware.toString()),
        AsyncStorage.setItem('isVIPGsmSoftware', status.GSM.software.toString()),
      ]);
    } catch (error) {
      console.error('Erreur sauvegarde VIP:', error);
    }
  };

  // Vérifie si une vidéo est gratuite (VIP ou non payante)
  const isVideoFree = useCallback((video) => {
    if (!video.categoryId) return false;
    const category = vipStatus[video.categoryId];
    if (!category) return false;

    const isVIP = video.part
      ? category[video.part.toLowerCase()]
      : Object.values(category).some(Boolean);

    return isVIP || !video.isPaid;
  }, [vipStatus]);

  // Récupérer toutes les vidéos gratuites
  const getFreeVideos = useCallback(() => {
    const freeVideos = [];
    categories.forEach((cat) =>
      cat.videos.forEach((video) => {
        if (isVideoFree(video)) {
          freeVideos.push({ ...video });
        }
      })
    );
    return freeVideos;
  }, [categories, isVideoFree]);

  // Gérer le clic sur une vidéo
  const handleCardPress = (video) => {
    if (!haveAccount) {
      showToast('Veuillez vous connecter pour accéder à cette vidéo');
      return;
    }

    const isVIP = isVideoFree(video) && video.isPaid;
    const isPaid = !isVIP && video.isPaid;
     const videoUrl = video.details?.video;

    navigation.navigate('Details', {
      title: video.title,
      videoLink: videoUrl,
      description: video.details?.description || 'Aucune description',
      categoryId: video.categoryId,
      videoData: video,
      image: video.image,
      isPaid,
    },
    console.log({
      title: video.title,
      videoLink: videoUrl,
      description: video.details?.description || 'Aucune description',
      categoryId: video.categoryId,
      videoData: video,
      image: video.image,
      isPaid,
    })
  );
  };

  // Bouton de connexion modernisé
  const renderLoginPrompt = () => (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.loginPrompt}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.loginContent}>
        <Text style={styles.loginEmoji}>🚀</Text>
        <Text style={styles.loginTitle}>Bienvenue sur KaboreTech!</Text>
        <Text style={styles.loginText}>
          Débloquez l'accès à toutes nos formations premium
        </Text>
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>Commencer maintenant</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // Carte vidéo modernisée
  const renderVideoCard = (video, isFreeSection = false) => {
    const isVIP = isVideoFree(video) && video.isPaid;
    const buttonText = isFreeSection ? 'Regarder' : isVIP ? 'Regarder' : 'Premium';
    const imageUrl = `${video.image}`;

    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => handleCardPress(video)} 
        activeOpacity={0.9}
      >
        <View style={styles.cardImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            cachePolicy="memory-disk"
            recyclingKey={video.id.toString()}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageOverlay}
          />
          {!isFreeSection && video.isPaid && !isVIP && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          )}
          {isVIP && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
            {video.title}
          </Text>
          
          {!isFreeSection && video.part && (
            <View style={styles.partContainer}>
              <Text style={styles.partTag}>{video.part}</Text>
            </View>
          )}
          
          <TouchableOpacity 
          onPress={() => handleCardPress(video)} 
          style={[
            styles.actionButton,
            isVIP || isFreeSection ? styles.playButton : styles.subscribeButton
            
          ]}>
            <Text style={styles.actionButtonText}>
              {buttonText} {isVIP || isFreeSection ? '▶️' : '⭐'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Section vidéos gratuites
  const renderFreeSection = () => {
    const freeVideos = getFreeVideos();
    if (freeVideos.length === 0) return null;

    return (
      <View style={styles.categoryContainer}>
        <View style={styles.categoryHeader}>
          <Text style={styles.freeSectionTitle}>🎁 Vidéos Gratuites</Text>
          <Text style={styles.categorySubtitle}>Commencez votre apprentissage</Text>
        </View>
        <FlatList
          horizontal
          data={freeVideos}
          renderItem={({ item }) => renderVideoCard(item, true)}
          keyExtractor={(item) => `free-${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.videosContainer}
        />
      </View>
    );
  };

  // Rendu des catégories modernisé
  const renderCategory = ({ item: category }) => {
    const paidVideos = category.videos.filter((video) => !isVideoFree(video));
    if (paidVideos.length === 0) return null;

    const categoryIcons = {
      'Informatique': '💻',
      'Marketing': '📈',
      'GSM': '📱'
    };

    return (
      <View style={styles.categoryContainer} key={category.id}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>
            {categoryIcons[category.name] || '📚'} {category.name}
          </Text>
          <Text style={styles.categorySubtitle}>
            {paidVideos.length} formation{paidVideos.length > 1 ? 's' : ''}
          </Text>
        </View>
        
        <FlatList
          horizontal
          data={paidVideos.slice(0, expandedCategory === category.id ? undefined : 4)}
          renderItem={({ item }) => renderVideoCard(item, false)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.videosContainer}
        />
        
        {paidVideos.length > 4 && (
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() =>
              setExpandedCategory(expandedCategory === category.id ? null : category.id)
            }
          >
            <Text style={styles.viewMoreText}>
              {expandedCategory === category.id ? '↑ Voir moins' : '↓ Voir plus'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Initialisation
  useEffect(() => {
    const init = async () => {
      await loadUserData();
      await loadCategoriesFromCache();
      await loadVipStatus();
    };
    init();
  }, []);

  return (
    <View style={styles.container}>
      <MyHeader title="Formations KaboreTech" />
      {!haveAccount && renderLoginPrompt()}
      <FlatList
        data={[{ id: 'free', type: 'free' }, ...categories]}
        renderItem={({ item }) =>
          item.type === 'free' ? renderFreeSection() : renderCategory({ item })
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await Promise.all([fetchCategories(), refreshVipStatus()]);
            }}
            colors={['#667eea', '#764ba2']}
            tintColor="#667eea"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// Styles modernisés
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  // Login Prompt
  loginPrompt: {
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  loginContent: {
    padding: 24,
    alignItems: 'center',
  },
  loginEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  loginTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Liste et contenu
  listContent: {
    paddingBottom: 30,
  },
  
  // Catégories
  categoryContainer: {
    marginBottom: 32,
  },
  categoryHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  freeSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  
  // Vidéos
  videosContainer: {
    paddingHorizontal: 16,
  },
  
  // Cartes
  card: {
    width: width * 0.42,
    height: 280,
    marginRight: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardImageContainer: {
    position: 'relative',
    height: 140,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  
  // Badges
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  vipBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Contenu carte
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 20,
    marginBottom: 8,
  },
  
  // Part tag
  partContainer: {
    marginBottom: 12,
  },
  partTag: {
    fontSize: 12,
    color: '#6366f1',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  
  // Boutons d'action
  actionButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  playButton: {
    backgroundColor: '#10b981',
  },
  subscribeButton: {
    backgroundColor: '#6366f1',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  
  // Voir plus
  viewMoreButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  viewMoreText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default HomeScreen;