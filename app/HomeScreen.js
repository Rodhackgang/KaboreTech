import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';

const HomeScreen = ({ route, navigation }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [vipStatus, setVipStatus] = useState({
    Informatique: { hardware: false, software: false },
    Marketing: { social: false, content: false },
    GSM: { hardware: false, software: false }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);

  const loadCategoriesFromCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('categoriesData');
      if (cachedData) {
        setCategories(JSON.parse(cachedData));
      } else {
        fetchCategories();
      }
    } catch (error) {
      console.error('Error loading categories from cache:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://192.168.1.82:8000/api/videos');
      const data = await response.json();
      await AsyncStorage.setItem('categoriesData', JSON.stringify(data));
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    loadCategoriesFromCache();
  }, []);

  const loadVipStatus = async () => {
    try {
      const vipStatusFromStorage = {
        Informatique: {
          hardware: (await AsyncStorage.getItem('isVIPInformatiqueHardware')) === 'true',
          software: (await AsyncStorage.getItem('isVIPInformatiqueSoftware')) === 'true'
        },
        Marketing: {
          social: (await AsyncStorage.getItem('isVIPMarketingSocial')) === 'true',
          content: (await AsyncStorage.getItem('isVIPMarketingContent')) === 'true'
        },
        GSM: {
          hardware: (await AsyncStorage.getItem('isVIPGsmHardware')) === 'true',
          software: (await AsyncStorage.getItem('isVIPGsmSoftware')) === 'true'
        }
      };
      setVipStatus(vipStatusFromStorage);
    } catch (error) {
      console.error('Error loading VIP status:', error);
    }
  };

  useEffect(() => {
    loadVipStatus();
  }, []);

  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('http://192.168.1.82:8000/api/vip-status?phone=' + route.params?.phone);
      const data = await response.json();

      if (data.vipDomains) {
        const updatedVipStatus = {
          Informatique: { hardware: data.vipDomains.includes('Informatique Hardware'), software: data.vipDomains.includes('Informatique Software') },
          Marketing: { social: data.vipDomains.includes('Marketing Social'), content: data.vipDomains.includes('Marketing Content') },
          GSM: { hardware: data.vipDomains.includes('GSM Hardware'), software: data.vipDomains.includes('GSM Software') }
        };

        setVipStatus(updatedVipStatus);

        // Update AsyncStorage
        for (const category in updatedVipStatus) {
          for (const part in updatedVipStatus[category]) {
            await AsyncStorage.setItem(`isVIP${category}${capitalize(part)}`, updatedVipStatus[category][part].toString());
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing VIP status:', error);
    }
    setIsRefreshing(false);
  };

  const getPartVIPStatus = useCallback((categoryId, part) => {
    return vipStatus[categoryId]?.[part] || false;
  }, [vipStatus]);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getImageUrl = (imagePath) => `http://192.168.1.82:8000${imagePath}`;

  const renderCard = (video) => {
    const isVIP = getPartVIPStatus(video.categoryId, video.part) || !video.isPaid;
    const buttonText = isVIP ? 'Visionner' : 'S\'abonner';

    return (
      <View style={[styles.card, isVIP ? styles.cardFree : styles.cardPaid]} key={video.id}>
        <Image source={{ uri: getImageUrl(video.image) }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{video.title}</Text>
          <Text style={[styles.cardPrice, isVIP ? styles.cardPriceFree : styles.cardPricePaid]}>
            {isVIP ? 'Gratuit' : 'Payant'}
          </Text>
          <Text style={styles.partTag}>{video.part}</Text>
          <TouchableOpacity
            style={[styles.toggleButton, isVIP ? styles.toggleButtonFree : styles.toggleButtonPaid]}
            onPress={() => {
              navigation.navigate('Details', {
                title: video.details.title,
                videoLink: video.details.video,
                description: video.details.description,
                categoryId: video.categoryId,
                isPaid: !isVIP,
              });
            }}
          >
            <Text style={styles.toggleButtonText}>{buttonText}</Text>
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
      <MyHeader title="Toutes les formations" />
      <FlatList
        data={categories}
        renderItem={({ item }) => renderCategory(item)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await fetchCategories();
              refreshVipStatus();
            }}
          />
        }
      />
    </View>
  );
};

const capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1);

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
  partTag: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: 'bold',
    marginTop: 5,
  },
});

export default HomeScreen;
