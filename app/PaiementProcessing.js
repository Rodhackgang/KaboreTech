import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  Animated
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import CountryPicker from 'react-native-country-picker-modal';
import { FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const PaiementProcessing = () => {
  const [numDepot, setNumDepot] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const navigation = useNavigation();
  const route = useRoute();

  // États pour la sélection de pays
  const [country, setCountry] = useState({
    cca2: 'BF',
    callingCode: ['226'],
    name: 'Burkina Faso'
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const { category, mode, price } = route.params;

  const partOptions = [
    { id: 'Hardware', name: 'Hardware', icon: 'computer', color: '#FF6B6B' },
    { id: 'Software', name: 'Software', icon: 'code', color: '#4ECDC4' },
    { id: 'Social', name: 'Social', icon: 'people', color: '#45B7D1' },
    { id: 'Content', name: 'Content', icon: 'article', color: '#96CEB4' }
  ];

  const getFlagEmoji = (countryCode) => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) setUserPhone(phone);
    } catch (error) {
      console.error('Erreur lors du chargement du téléphone:', error);
    }
  };

  useEffect(() => {
    loadUserData();

    // Animations d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const onSelectCountry = (country) => {
    setCountry(country);
    setShowCountryPicker(false);
  };

  const handleVerification = async () => {
    if (!numDepot) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de dépôt');
      return;
    }

    if (!selectedPart) {
      Alert.alert('Erreur', 'Veuillez sélectionner une partie');
      return;
    }

    // Formatage de `price` (enlever espaces et symboles indésirables)
    const formattedPrice = price.replace(/[^0-9]/g, '');  // Supprime tout sauf les chiffres

    // Vérification des données avant envoi
    const requestData = {
      phone: userPhone,        // Le téléphone de l'utilisateur
      numDepot: numDepot,      // Le numéro de dépôt
      domaine: category,       // Le domaine sélectionné
      part: selectedPart,      // La partie sélectionnée
      mode: mode,              // Le mode de paiement
      price: parseInt(formattedPrice, 10)  // Prix formaté en entier
    };

    // Affichez les données envoyées dans la console
    console.log("Données envoyées à l'API:", requestData);

    setIsLoading(true);

    try {
      const response = await axios.post('https://kaboretech.cursusbf.com/api/paiement', requestData);

      Alert.alert('Succès', response.data.message || 'Paiement vérifié !', [{
        text: 'OK',
        onPress: () => navigation.navigate('Home'),
      }]);
    } catch (error) {
      console.error("Erreur lors de l'envoi de la requête:", error.response ? error.response.data : error.message);
      Alert.alert('Erreur', 'Échec de la vérification du dépôt');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header avec effet glassmorphism */}
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <BlurView intensity={20} style={styles.headerBlur}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Paiement</Text>
            <View style={styles.headerIcon}>
              <Icon name="payment" size={28} color="#fff" />
            </View>
          </View>
        </BlurView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Carte d'informations bancaires */}
          <View style={styles.bankCard}>
            <LinearGradient
              colors={['#1e3c72', '#2a5298']}
              style={styles.bankCardGradient}
            >
              <View style={styles.bankCardHeader}>
                <Text style={styles.bankCardTitle}>Informations Bancaires</Text>
                <Icon name="account-balance-wallet" size={24} color="#fff" />
              </View>
              <View style={styles.bankInfo}>
                <View style={styles.bankRow}>
                  <View style={styles.providerIcon}>
                    <Icon name="smartphone" size={20} color="#4ECDC4" />
                  </View>
                  <View style={styles.bankDetails}>
                    <Text style={styles.bankLabel}>Mobile Money</Text>
                    <Text style={styles.bankNumber}>+226 74 39 19 80</Text>
                    <Text style={styles.bankProviders}>Wave • Orange • Moov</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Informations de commande */}
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>Détails de la commande</Text>
            <View style={styles.orderDetails}>
              <View style={styles.orderRow}>
                <Icon name="category" size={20} color="#667eea" />
                <Text style={styles.orderLabel}>Catégorie</Text>
                <Text style={styles.orderValue}>{category}</Text>
              </View>
              <View style={styles.orderRow}>
                <Icon name="school" size={20} color="#667eea" />
                <Text style={styles.orderLabel}>Mode</Text>
                <Text style={styles.orderValue}>{mode}</Text>
              </View>
              <View style={styles.orderRow}>
                <Icon name="attach-money" size={20} color="#667eea" />
                <Text style={styles.orderLabel}>Prix</Text>
                <Text style={styles.orderPrice}>{price}</Text>
              </View>
            </View>
          </View>

          {/* Sélection de partie */}
          <View style={styles.partCard}>
            <Text style={styles.partTitle}>Sélectionnez votre spécialité</Text>
            <View style={styles.partGrid}>
              {partOptions.map((part) => (
                <TouchableOpacity
                  key={part.id}
                  style={[
                    styles.partOption,
                    selectedPart === part.id && styles.partOptionSelected
                  ]}
                  onPress={() => setSelectedPart(part.id)}
                >
                  <View style={[styles.partIconContainer, { backgroundColor: part.color }]}>
                    <Icon name={part.icon} size={24} color="#fff" />
                  </View>
                  <Text style={[
                    styles.partOptionText,
                    selectedPart === part.id && styles.partOptionTextSelected
                  ]}>
                    {part.name}
                  </Text>
                  {selectedPart === part.id && (
                    <View style={styles.selectedIndicator}>
                      <Icon name="check-circle" size={20} color="#667eea" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Champ de saisie du numéro de dépôt avec sélecteur de pays */}
          <View style={styles.inputCard}>
            <Text style={styles.inputTitle}>Numéro de dépôt</Text>

            {/* Sélecteur de pays */}
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.countrySelectorText}>
                {getFlagEmoji(country.cca2)} +{country.callingCode[0]}
              </Text>
              <FontAwesome name="chevron-down" size={16} color="#888" />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Icon name="receipt" size={20} color="#667eea" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Entrez votre numéro de dépôt"
                placeholderTextColor="#A0A0A0"
                keyboardType="phone-pad"
                value={numDepot}
                onChangeText={setNumDepot}
              />
            </View>
          </View>

          {/* Bouton de vérification */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!numDepot || !selectedPart) && styles.verifyButtonDisabled
            ]}
            onPress={handleVerification}
            disabled={isLoading || !numDepot || !selectedPart}
          >
            <LinearGradient
              colors={(!numDepot || !selectedPart) ? ['#E0E0E0', '#BDBDBD'] : ['#667eea', '#764ba2']}
              style={styles.verifyButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.verifyButtonContent}>
                  <Text style={styles.verifyButtonText}>Vérifier le dépôt</Text>
                  <Icon name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Country Picker Modal */}
      <CountryPicker
        {...{
          countryCode: country.cca2,
          withFilter: true,
          withFlag: true,
          withCountryNameButton: true,
          withAlphaFilter: true,
          withCallingCode: true,
          withEmoji: true,
          visible: showCountryPicker,
          onSelect: onSelectCountry,
          onClose: () => setShowCountryPicker(false),
          preferredCountries: ['BF', 'CI', 'ML', 'NE', 'SN', 'GN', 'TG'],
          theme: {
            primaryColor: '#667eea',
            primaryColorVariant: '#764ba2',
            backgroundColor: '#FFFFFF',
            onBackgroundTextColor: '#333333',
            fontSize: 16,
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight,
  },
  headerBlur: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  contentContainer: {
    padding: 20,
  },
  bankCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  bankCardGradient: {
    padding: 25,
  },
  bankCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bankCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  bankInfo: {
    marginTop: 10,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  bankDetails: {
    flex: 1,
  },
  bankLabel: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 2,
  },
  bankNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  bankProviders: {
    fontSize: 12,
    color: '#4ECDC4',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 15,
  },
  orderDetails: {
    gap: 12,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderLabel: {
    fontSize: 14,
    color: '#718096',
    flex: 1,
    marginLeft: 10,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  partCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  partTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 20,
  },
  partGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  partOption: {
    width: (width - 64) / 2,
    backgroundColor: '#F7FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  partOptionSelected: {
    backgroundColor: '#EDF2F7',
    borderColor: '#667eea',
  },
  partIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  partOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  partOptionTextSelected: {
    color: '#667eea',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  countrySelector: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7FAFC',
  },
  countrySelectorText: {
    fontSize: 16,
    color: '#2D3748',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2D3748',
  },
  verifyButton: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  verifyButtonDisabled: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  verifyButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  verifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default PaiementProcessing;