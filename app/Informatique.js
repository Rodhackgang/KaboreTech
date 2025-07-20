import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, TextInput, RefreshControl, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';

const Informatique = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [haveAccount, sethaveAccount] = useState(true);
  const [vipStatus, setVipStatus] = useState({
    Informatique: { hardware: false, software: false }
  });
  const [categories, setCategories] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getImageUrl = (imagePath) => `https://kaboretech.cursusbf.com${imagePath}`;
  const loadUserData = async () => {
    try {
      const [ accountStatus] = await Promise.all([
        AsyncStorage.getItem('haveAccount')
      ]);
      sethaveAccount(accountStatus === 'true');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await loadUserData();
    };
    initializeData();
  }, []);


  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les données depuis AsyncStorage
        const cachedData = await AsyncStorage.getItem('categoriesData');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          setCategories(parsedData);

          // Trouver la catégorie Informatique et récupérer les vidéos correspondantes
          const informatiqueCategory = parsedData.find(category => category.name === 'Informatique');
          if (informatiqueCategory) {
            setFilteredVideos(informatiqueCategory.videos);
          }
        }

        // Charger l'état VIP pour Informatique depuis AsyncStorage
        const vipStatusInformatiqueHardware = await AsyncStorage.getItem('isVIPInformatiqueHardware') === 'true';
        const vipStatusInformatiqueSoftware = await AsyncStorage.getItem('isVIPInformatiqueSoftware') === 'true';

        setVipStatus({
          Informatique: {
            hardware: vipStatusInformatiqueHardware,
            software: vipStatusInformatiqueSoftware
          }
        });
      } catch (error) {
        console.error('Erreur de chargement des données:', error);
      }
    };

    loadData();
  }, []);

  const handleSearch = (text) => {
    setSearchText(text);
    const filtered = categories
      .find(category => category.name === 'Informatique')?.videos
      .filter(video =>
        (video.title.toLowerCase().includes(text.toLowerCase())) &&
        // S'assurer que les vidéos filtrées respectent le statut VIP
        (!video.isPaid ||
          (getPartVIPStatus('hardware') && video.part === 'hardware') ||
          (getPartVIPStatus('software') && video.part === 'software') ||
          (!video.part && (getPartVIPStatus('hardware') || getPartVIPStatus('software')))
        )
      );
    setFilteredVideos(filtered);
  };


  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Rafraîchir les catégories depuis AsyncStorage (données locales)
      const cachedData = await AsyncStorage.getItem('categoriesData');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        setCategories(parsedData);

        // Filtrer la catégorie Informatique uniquement
        const informatiqueCategory = parsedData.find(category => category.name === 'Informatique');
        if (informatiqueCategory) {
          setFilteredVideos(informatiqueCategory.videos);
        }
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des données:', error);
    }
    setIsRefreshing(false);
  };

  // Vérification du statut VIP pour une partie donnée
  const getPartVIPStatus = (part) => {
    return vipStatus.Informatique?.[part] || false;
  };


  const renderCard = (video, index) => {
    // Vérification du statut VIP pour chaque partie de la catégorie Informatique
    const isHardwareVIP = getPartVIPStatus('hardware');
    const isSoftwareVIP = getPartVIPStatus('software');

    // Règles d'accès aux vidéos en fonction des parties VIP
    const isAccessible = !video.isPaid ||
      (isHardwareVIP && video.part === 'hardware') ||
      (isSoftwareVIP && video.part === 'software') ||
      (!video.part && (isHardwareVIP || isSoftwareVIP));

    return (
      <View
        style={[
          styles.card,
          isAccessible ? styles.cardFree : styles.cardPaid,
          index === filteredVideos.length - 1 ? styles.lastCard : null
        ]}
        key={video.id}
      >
        <Image source={{ uri: getImageUrl(video.image) }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{video.title}</Text>
          <Text style={[styles.cardPrice, isAccessible ? styles.cardPriceFree : styles.cardPricePaid]}>
            {isAccessible ? 'Gratuit' : 'Payant'}
          </Text>
          <TouchableOpacity
            style={[styles.toggleButton, isAccessible ? styles.toggleButtonFree : styles.toggleButtonPaid]}
            onPress={() => {
              // Check if the user is logged in or has the necessary VIP status
              if (!haveAccount) {
                Alert.alert(
                  'Accès restreint',
                  'Vous devez être connecté  pour accéder à ce contenu.',
                  [{ text: 'OK' }]
                );
                return; // Prevent further action if the user is not logged in or VIP
              }

              // Allow navigation if the user has the required access
              navigation.navigate('Details', {
                title: video.details.title,
                videoLink: video.details.video,
                description: video.details.description,
                categoryId: video.categoryId,
                isPaid: video.isPaid,
              });
            }}
          >
            <Text style={styles.toggleButtonText}>
              {isAccessible ? 'Visionner' : 'S\'abonner'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    );
  };


  return (
    <View style={styles.container}>
      <MyHeader title="Formation informatique" />
      <TextInput
        style={styles.searchInput}
        placeholder="Rechercher une vidéo..."
        value={searchText}
        onChangeText={handleSearch}
      />
      <FlatList
        data={filteredVideos}
        renderItem={({ item, index }) => renderCard(item, index)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshData} // Rafraîchissement des données locales
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  searchInput: {
    height: 45,
    borderWidth: 1,
    borderRadius: 25,
    paddingLeft: 20,
    marginTop: 10,
    margin: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 15,
    marginBottom: 15,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  cardFree: {
    borderColor: "green",
    borderWidth: 2,
  },
  cardPaid: {
    borderColor: "blue",
    borderWidth: 2,
  },
  lastCard: {
    marginBottom: 70,
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
    color: "gray",
    marginBottom: 5,
  },
  cardPrice: {
    fontSize: 14,
    marginBottom: 10,
  },
  cardPriceFree: {
    color:"green",
  },
  cardPricePaid: {
    color: "blue",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 25,
    alignItems: 'center',
  },
  toggleButtonFree: {
    backgroundColor:"green",
  },
  toggleButtonPaid: {
    backgroundColor: "blue",
  },
  toggleButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default Informatique;
