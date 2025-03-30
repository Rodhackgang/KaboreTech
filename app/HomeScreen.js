import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';

const HomeScreen = ({ navigation }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [isVIPInformatique, setIsVIPInformatique] = useState(false);
  const [isVIPMarketing, setIsVIPMarketing] = useState(false);
  const [isVIPEnergie, setIsVIPEnergie] = useState(false);
  const [isVIPReparation, setIsVIPReparation] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState({
    phoneNumber: ''
  });
  const [categories, setCategories] = useState([]);

  // Fonction pour récupérer les catégories depuis l'API et les stocker dans AsyncStorage
  const fetchCategories = async () => {
    try {
      const response = await fetch('http://192.168.1.82:3000/api/videos');
      const data = await response.json();

      // Sauvegarder les données dans AsyncStorage
      await AsyncStorage.setItem('categoriesData', JSON.stringify(data));

      // Mettre à jour l'état avec les catégories récupérées
      setCategories(data);
    } catch (error) {
      console.error('Erreur lors de la récupération des catégories:', error);
    }
  };

  // Charger les catégories depuis le cache (AsyncStorage)
  const loadCategoriesFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('categoriesData');
      if (cachedData) {
        setCategories(JSON.parse(cachedData)); // Charger les données du cache
      } else {
        fetchCategories(); // Si pas de cache, charger depuis l'API
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du cache:', error);
    }
  };

  useEffect(() => {
    // Vérifier si les données sont déjà stockées dans le cache
    loadCategoriesFromCache();
  }, []);

  const getVIPStatus = async (key) => {
    const value = await AsyncStorage.getItem(key);
    return value === 'true';
  };

  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('http://192.168.1.82:3000/api/vip-status?phone=' + userInfo.phoneNumber);
      const data = await response.json();
      if (data.vipDomains) {
        const updatedVipStatus = {
          Informatique: data.vipDomains.includes('Informatique'),
          Marketing: data.vipDomains.includes('Marketing'),
          Energie: data.vipDomains.includes('Energie'),
          Reparation: data.vipDomains.includes('Réparation')
        };

        // Mise à jour des statuts VIP dans AsyncStorage
        await AsyncStorage.setItem('isVIPInformatique', updatedVipStatus.Informatique.toString());
        await AsyncStorage.setItem('isVIPMarketing', updatedVipStatus.Marketing.toString());
        await AsyncStorage.setItem('isVIPEnergie', updatedVipStatus.Energie.toString());
        await AsyncStorage.setItem('isVIPReparation', updatedVipStatus.Reparation.toString());

        // Mettre à jour l'état local
        setIsVIPInformatique(updatedVipStatus.Informatique);
        setIsVIPMarketing(updatedVipStatus.Marketing);
        setIsVIPEnergie(updatedVipStatus.Energie);
        setIsVIPReparation(updatedVipStatus.Reparation);
      }
    } catch (error) {
      console.error('Error refreshing VIP status:', error);
    }
    setIsRefreshing(false);
  };

  const getCategoryVIPStatus = useCallback((categoryId) => {
    switch (categoryId) {
      case 'Informatique': return isVIPInformatique;
      case 'Marketing': return isVIPMarketing;
      case 'Energie': return isVIPEnergie;
      case 'Réparation': return isVIPReparation;
      default: return false;
    }
  }, [isVIPInformatique, isVIPMarketing, isVIPEnergie, isVIPReparation]);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  // Fonction pour construire l'URL des images à partir de l'ID
  const getImageUrl = (imagePath) => {
    return `http://192.168.1.82:3000${imagePath}`; // L'URL de l'image commence par "/api/image/", donc vous devez concaténer l'URL de base.
  };
  const loadVipStatus = async () => {
    const vipInformatique = await AsyncStorage.getItem('isVIPInformatique') === 'true';
    const vipMarketing = await AsyncStorage.getItem('isVIPMarketing') === 'true';
    const vipEnergie = await AsyncStorage.getItem('isVIPEnergie') === 'true';
    const vipReparation = await AsyncStorage.getItem('isVIPReparation') === 'true';
  
    setIsVIPInformatique(vipInformatique);
    setIsVIPMarketing(vipMarketing);
    setIsVIPEnergie(vipEnergie);
    setIsVIPReparation(vipReparation);
  };
  useEffect(() => {
    loadCategoriesFromCache();
    loadVipStatus();  // Ajouté pour charger les statuts VIP
  }, []);
    
  const renderCard = (video) => {
    const isVIP = video.categoryId === 'Informatique' ? isVIPInformatique :
    video.categoryId === 'Marketing' ? isVIPMarketing :
    video.categoryId === 'Energie' ? isVIPEnergie :
    video.categoryId === 'Réparation' ? isVIPReparation : false;

const effectiveIsFree = isVIP || !video.isPaid;
const buttonText = effectiveIsFree ? 'Visionner' : 'S\'abonner'; // "Visionner" si VIP ou gratuit, sinon "S'abonner"


    return (
      <View style={[styles.card, effectiveIsFree ? styles.cardFree : styles.cardPaid]} key={video.id}>
        <Image source={{ uri: getImageUrl(video.image) }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{video.title}</Text>
          <Text style={[styles.cardPrice, effectiveIsFree ? styles.cardPriceFree : styles.cardPricePaid]}>
            {effectiveIsFree ? 'Gratuit' : 'Payant'}
          </Text>
          <TouchableOpacity
            style={[styles.toggleButton, effectiveIsFree ? styles.toggleButtonFree : styles.toggleButtonPaid]}
            onPress={() => {
              console.log({
                title: video.details.title,
                videoLink: video.details.video,
                description: video.details.description,
                categoryId: video.categoryId,
                isPaid: !effectiveIsFree,
              });
              navigation.navigate('Details', {
                title: video.details.title,
                videoLink: video.details.video,
                description: video.details.description,
                categoryId: video.categoryId,
                isPaid: !effectiveIsFree,
              });
            }}
          >
            <Text style={styles.toggleButtonText}>
            {buttonText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCategory = (category) => (
    <View key={category.id} style={styles.category}>
      <Text style={styles.categoryTitle}>{category.name}</Text>
      <FlatList
        data={category.videos.slice(0, expandedCategory === category.id ? category.videos.length : 3)}
        renderItem={({ item }) => renderCard(item)}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
      <TouchableOpacity onPress={() => toggleCategory(category.id)}>
        <Text style={styles.viewMore}>
          {expandedCategory === category.id ? 'Voir moins' : 'Voir plus'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <MyHeader
        title="Toutes les formations"
      />
      <FlatList
        data={categories}
        renderItem={({ item }) => renderCategory(item)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await fetchCategories(); // Rafraîchissement de l'API
              refreshVipStatus(); // Rafraîchissement des statuts VIP
            }}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    paddingHorizontal: 5,
    paddingBottom: 30,
  },
  category: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: Colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    textTransform: 'uppercase',
    marginBottom: 15,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 15,
    marginRight: 15,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  cardFree: {
    borderColor: Colors.green,
    borderWidth: 2,
  },
  cardPaid: {
    borderColor: Colors.blue,
    borderWidth: 2,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 15,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkGray,
    marginBottom: 5,
  },
  cardPrice: {
    fontSize: 14,
    marginBottom: 10,
  },
  cardPriceFree: {
    color: Colors.green,
  },
  cardPricePaid: {
    color: Colors.blue,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignItems: 'center',
  },
  toggleButtonFree: {
    backgroundColor: Colors.green,
  },
  toggleButtonPaid: {
    backgroundColor: Colors.blue,
  },
  toggleButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  horizontalList: {
    paddingHorizontal: 5,
  },
  viewMore: {
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 15,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export default HomeScreen;
