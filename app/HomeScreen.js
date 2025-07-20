import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Alert,
  ToastAndroid,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';

const HomeScreen = ({ route, navigation }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [userInfo, setUserInfo] = useState({ phoneNumber: '' });
  const [vipStatus, setVipStatus] = useState({
    Informatique: { hardware: false, software: false },
    Marketing: { social: false, content: false },
    GSM: { hardware: false, software: false }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [haveAccount, sethaveAccount] = useState(true); // Default to true to avoid flash

  // Fonction pour afficher le toast
  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert('Information', message);
    }
  };

  // Load user data and categories
  const loadUserData = async () => {
    try {
      const [phoneNumber, accountStatus] = await Promise.all([
        AsyncStorage.getItem('userPhone'),
        AsyncStorage.getItem('haveAccount')
      ]);

      setUserInfo({ phoneNumber: phoneNumber || '' });
      sethaveAccount(accountStatus === 'true');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadCategoriesFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('categoriesData');
      if (cachedData) {
        setCategories(JSON.parse(cachedData));
      }
      await fetchCategories();
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://kaboretech.cursusbf.com/api/videos');
      const data = await response.json();
      await AsyncStorage.setItem('categoriesData', JSON.stringify(data));
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Erreur', 'Impossible de charger les formations');
    }
  };

  const loadVipStatus = async () => {
    try {
      const status = {
        Informatique: {
          hardware: await AsyncStorage.getItem('isVIPInformatiqueHardware') === 'true',
          software: await AsyncStorage.getItem('isVIPInformatiqueSoftware') === 'true'
        },
        Marketing: {
          social: await AsyncStorage.getItem('isVIPMarketingSocial') === 'true',
          content: await AsyncStorage.getItem('isVIPMarketingContent') === 'true'
        },
        GSM: {
          hardware: await AsyncStorage.getItem('isVIPGsmHardware') === 'true',
          software: await AsyncStorage.getItem('isVIPGsmSoftware') === 'true'
        }
      };
      setVipStatus(status);
    } catch (error) {
      console.error('Error loading VIP status:', error);
    }
  };

  const refreshVipStatus = async () => {
    if (!userInfo.phoneNumber) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(`https://kaboretech.cursusbf.com/api/vip-status?phone=${userInfo.phoneNumber}`);
      const data = await response.json();

      if (data.vipDomains) {
        const updatedStatus = {
          Informatique: {
            hardware: data.vipDomains.includes('Informatique Hardware'),
            software: data.vipDomains.includes('Informatique Software')
          },
          Marketing: {
            social: data.vipDomains.includes('Marketing Social'),
            content: data.vipDomains.includes('Marketing Content')
          },
          GSM: {
            hardware: data.vipDomains.includes('GSM Hardware'),
            software: data.vipDomains.includes('GSM Software')
          }
        };

        setVipStatus(updatedStatus);
        await saveVipStatus(updatedStatus);
      }
    } catch (error) {
      console.error('Error refreshing VIP status:', error);
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
        AsyncStorage.setItem('isVIPGsmSoftware', status.GSM.software.toString())
      ]);
    } catch (error) {
      console.error('Error saving VIP status:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await loadUserData();
      await loadCategoriesFromCache();
      await loadVipStatus();
    };
    initializeData();
  }, []);

  const handleLoginPress = () => {
    navigation.navigate('Login', {
      onSuccess: () => {
        sethaveAccount(true);
        loadUserData();
        refreshVipStatus();
      }
    });
  };

  // Fonction pour gérer le clic sur une card
  const handleCardPress = (video) => {
    // Vérifier si l'utilisateur est connecté
    if (!haveAccount) {
      showToast('Veuillez vous inscrire ou vous connecter pour bénéficier de ce service');
      return;
    }

    // Si l'utilisateur est connecté, naviguer vers les détails
    const isVIP = checkVipStatus(video);
    const isPaid = isVIP ? false : video.isPaid;

    navigation.navigate('Details', {
      title: video.title,
      videoLink: video.video,
      description: video.description,
      categoryId: video.categoryId,
      videoData: video,
      image: video.image,
      isPaid: isPaid
    });
  };

  const renderLoginPrompt = () => (
    <View style={styles.loginPrompt}>
      <Text style={styles.loginText}>
        Veuillez vous connecter pour bénéficier de toutes les formations de KaboreTech
      </Text>
      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLoginPress}
      >
        <Text style={styles.loginButtonText}>Se connecter</Text>
      </TouchableOpacity>
    </View>
  );

  const renderVideoCard = (video, index) => {
    const isVIP = checkVipStatus(video);
    const buttonText = isVIP ? 'Visionner' : 'S\'abonner';
    const isLastCard = index === categories[categories.length - 1].videos.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isVIP ? styles.freeCard : styles.paidCard,
          isLastCard && { marginBottom: 500 }
        ]}
        onPress={() => handleCardPress(video)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: `https://kaboretech.cursusbf.com${video.image}` }}
          style={styles.cardImage}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{video.title}</Text>
          <Text style={[
            styles.cardStatus,
            isVIP ? styles.freeStatus : styles.paidStatus
          ]}>
            {isVIP ? 'Gratuit' : 'Payant'}
          </Text>
          {video.part && (
            <Text style={styles.partTag}>{video.part}</Text>
          )}
          <View
            style={[
              styles.actionButton,
              isVIP ? styles.freeButton : styles.paidButton
            ]}
          >
            <Text style={styles.actionButtonText}>{buttonText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  const checkVipStatus = (video) => {
    if (!video.categoryId) return false;

    const category = vipStatus[video.categoryId];
    if (!category) return false;

    if (!video.part) {
      return Object.values(category).some(status => status);
    }

    return category[video.part.toLowerCase()] || false;
  };

  const renderCategory = ({ item: category }) => (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>{category.name}</Text>
      <FlatList
        horizontal
        data={category.videos.slice(0, expandedCategory === category.id ? undefined : 3)}
        renderItem={({ item }) => renderVideoCard(item)}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.videosContainer}
      />
      {category.videos.length > 3 && (
        <TouchableOpacity
          style={styles.viewMoreButton}
          onPress={() => setExpandedCategory(
            expandedCategory === category.id ? null : category.id
          )}
        >
          <Text style={styles.viewMoreText}>
            {expandedCategory === category.id ? 'Voir moins' : 'Voir plus'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <MyHeader title="Toutes les formations" />

      {!haveAccount && renderLoginPrompt()}

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await Promise.all([
                fetchCategories(),
                refreshVipStatus()
              ]);
            }}
            colors={['#9Bd35A', '#689F38']}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  loginPrompt: {
    padding: 5,
    margin: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginText: {
    color: "black",
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  loginButtonText: {
    color:"white",
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  categoryContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#007BFF",
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  videosContainer: {
    paddingHorizontal: 8,
  },
  card: {
    width: 180,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: "white",
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  freeCard: {
    borderWidth: 2,
    borderColor: "red",
  },
  paidCard: {
    borderWidth: 2,
    borderColor: "yellow",
  },
  cardImage: {
    width: '100%',
    height: 100,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: "black",
    marginBottom: 4,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  freeStatus: {
    color: "red",
  },
  paidStatus: {
    color: "yellow",
  },
  partTag: {
    fontSize: 11,
    color: "#007BFF",
    marginBottom: 8,
    fontStyle: 'italic',
  },
  actionButton: {
    paddingVertical: 6,
    borderRadius: 15,
    alignItems: 'center',
  },
  freeButton: {
    backgroundColor: "red",
  },
  paidButton: {
    backgroundColor: "yellow",
  },
  actionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewMoreButton: {
    alignSelf: 'center',
    marginTop: 10,
  },
  viewMoreText: {
    color:"#007BFF",
    fontWeight: 'bold',
  },
});

export default HomeScreen;