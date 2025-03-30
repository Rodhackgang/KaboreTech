import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, TextInput, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import MyHeader from '../components/MyHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../constants/Colors';

const Marketing = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [isVIP, setIsVIP] = useState(false);
  const [categories, setCategories] = useState([]);
  const getImageUrl = (imagePath) => {
    return `https://kabore.pinetpi.fr${imagePath}`;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les catégories et les vidéos depuis AsyncStorage
        const cachedData = await AsyncStorage.getItem('categoriesData');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          setCategories(parsedData);

          // Trouver la catégorie Marketing et récupérer les vidéos correspondantes
          const marketingCategory = parsedData.find(category => category.name === 'Marketing');
          if (marketingCategory) {
            setFilteredVideos(marketingCategory.videos);
          }
        } else {
          console.log('Aucune donnée trouvée en cache.');
        }

        // Charger l'état VIP depuis AsyncStorage
        const vipStatus = await AsyncStorage.getItem('isVIPMarketing');
        setIsVIP(vipStatus === 'true');
      } catch (error) {
        console.error('Erreur de chargement des données:', error);
      }
    };

    loadData();
  }, []);

  const handleSearch = (text) => {
    setSearchText(text);
    if (text) {
      const filtered = categories
        .find(category => category.name === 'Marketing')?.videos
        .filter(video =>
          video.title.toLowerCase().includes(text.toLowerCase())
        );
      setFilteredVideos(filtered);
    } else {
      const marketingCategory = categories.find(category => category.name === 'Marketing');
      setFilteredVideos(marketingCategory?.videos || []);
    }
  };

  const renderCard = (video, index) => {
    const isAccessible = !video.isPaid || isVIP;

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
      <MyHeader
        title="Formation Marketing"
      />
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
    backgroundColor: Colors.white,
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
    borderColor: Colors.green,
    borderWidth: 2,
  },
  cardPaid: {
    borderColor: Colors.blue,
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
});

export default Marketing;
