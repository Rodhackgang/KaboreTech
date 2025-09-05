import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, TextInput, RefreshControl, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';

const Bureautique = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [haveAccount, sethaveAccount] = useState(true);
  const [vipStatus, setVipStatus] = useState({
    Bureautique: { hardware: false, software: false }
  });
  const [categories, setCategories] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getImageUrl = (imagePath) => `${imagePath}`;

  const loadUserData = async () => {
    try {
      const accountStatus = await AsyncStorage.getItem('haveAccount');
      sethaveAccount(accountStatus === 'true');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem('categoriesData');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        setCategories(parsedData);

        const bureautiqueCategory = parsedData.find(cat => cat.name === 'Bureautique');
        if (bureautiqueCategory) {
          setFilteredVideos(bureautiqueCategory.videos.filter(v => v.isPaid));
        }
      }

      const vipHardware = await AsyncStorage.getItem('isVIPBureautiqueHardware') === 'true';
      const vipSoftware = await AsyncStorage.getItem('isVIPBureautiqueSoftware') === 'true';

      setVipStatus({
        Bureautique: {
          hardware: vipHardware,
          software: vipSoftware,
        }
      });
    } catch (error) {
      console.error('Erreur de chargement des données:', error);
    }
  };

  useEffect(() => {
    loadUserData();
    loadData();
  }, []);

  const handleSearch = (text) => {
    setSearchText(text);
    const category = categories.find(cat => cat.name === 'Bureautique');
    if (category) {
      const filtered = category.videos.filter(
        video => video.isPaid && video.title.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredVideos(filtered);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const getPartVIPStatus = (part) => vipStatus.Bureautique?.[part] || false;

  const renderCard = (video, index) => {
    const isHardwareVIP = getPartVIPStatus('hardware');
    const isSoftwareVIP = getPartVIPStatus('software');
    const isAccessible = (isHardwareVIP && video.part === 'hardware') ||
                         (isSoftwareVIP && video.part === 'software') ||
                         (!video.part && (isHardwareVIP || isSoftwareVIP));

    return (
      <TouchableOpacity
        key={video.id}
        style={[
          styles.card,
          isAccessible ? styles.cardAccessible : styles.cardRestricted,
          index === filteredVideos.length - 1 ? styles.lastCard : null,
        ]}
        activeOpacity={0.8}
        onPress={() => {
          if (!haveAccount) {
            Alert.alert('🔐 Accès restreint', 'Veuillez vous connecter pour accéder à ce contenu.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Connexion', onPress: () => navigation.navigate('Login') }
            ]);
            return;
          }

          if (isAccessible) {
            navigation.navigate('Details', {
              title: video.details.title,
              videoLink: video.details.video,
              description: video.details.description,
              categoryId: video.categoryId,
              isPaid: video.isPaid,
            });
          } else {
            Alert.alert('💎 Contenu VIP', 'Veuillez vous abonner pour accéder à cette vidéo.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'S’abonner', onPress: () => navigation.navigate('Subscription') }
            ]);
          }
        }}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: getImageUrl(video.image) }} style={styles.cardImage} />
          {!isAccessible && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>
          )}
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, isAccessible ? styles.accessibleBadge : styles.restrictedBadge]}>
              <Text style={[styles.statusText, isAccessible ? styles.accessibleText : styles.restrictedText]}>
                {isAccessible ? '✓ Accessible' : '🔒 VIP Requis'}
              </Text>
            </View>
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, isAccessible ? styles.watchButton : styles.subscribeButton]}
              onPress={() => {
                if (!haveAccount) {
                  Alert.alert('🔐 Accès restreint', 'Connectez-vous pour accéder.', [{ text: 'OK' }]);
                  return;
                }

                if (isAccessible) {
                  navigation.navigate('Details', {
                    title: video.details.title,
                    videoLink: video.details.video,
                    description: video.details.description,
                    categoryId: video.categoryId,
                    isPaid: video.isPaid,
                  });
                } else {
                  navigation.navigate('Subscription');
                }
              }}
            >
              <Text style={styles.actionButtonText}>
                {isAccessible ? '▶ Visionner' : '💎 S’abonner'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📂</Text>
      <Text style={styles.emptyStateTitle}>Aucune vidéo trouvée</Text>
      <Text style={styles.emptyStateText}>
        {searchText ? 'Aucun résultat pour votre recherche.' : 'Aucun contenu premium disponible.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <MyHeader title="Formation Sécretariat Informatique" />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Rechercher une formation..."
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={handleSearch}
        />
      </View>
      <FlatList
        data={filteredVideos}
        renderItem={({ item, index }) => renderCard(item, index)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          filteredVideos.length === 0 && styles.contentCentered
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshData}
            colors={['#667eea', '#764ba2']}
            tintColor="#667eea"
            title="Actualisation..."
            titleColor="#667eea"
            progressBackgroundColor="#f8f9fa"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  contentCentered: { flexGrow: 1, justifyContent: 'center' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: 'white',
    elevation: 3,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  cardAccessible: { borderWidth: 2, borderColor: '#4ade80' },
  cardRestricted: { borderWidth: 2, borderColor: '#8b5cf6' },
  lastCard: { marginBottom: 80 },
  imageContainer: { position: 'relative' },
  cardImage: { width: '100%', height: 180, resizeMode: 'cover' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: { fontSize: 40, color: 'white' },
  premiumBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  cardContent: { padding: 16 },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    lineHeight: 22,
  },
  statusContainer: { marginBottom: 16 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  accessibleBadge: { backgroundColor: '#dcfce7' },
  restrictedBadge: { backgroundColor: '#e9d5ff' },
  statusText: { fontSize: 12, fontWeight: '600' },
  accessibleText: { color: '#15803d' },
  restrictedText: { color: '#8b5cf6' },
  actionContainer: { alignItems: 'center' },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
  },
  watchButton: { backgroundColor: '#4ade80' },
  subscribeButton: { backgroundColor: '#8b5cf6' },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default Bureautique;
