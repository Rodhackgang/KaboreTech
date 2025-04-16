import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';

const PaiementProcessing = () => {
  const [numDepot, setNumDepot] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [selectedPart, setSelectedPart] = useState('');  // State to store selected part
  const navigation = useNavigation();
  const route = useRoute();

  // Récupérer les paramètres passés
  const { category, mode, price } = route.params;  // part is removed as we will select it

  // Charger les données utilisateur (ex : téléphone)
  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) setUserPhone(phone); // Récupérer le téléphone et l'ajouter à l'état
    } catch (error) {
      console.error('Erreur lors du chargement du téléphone:', error);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // Handle the submission of the form and make the API request
  const handleVerification = async () => {
    if (!numDepot) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de dépôt');
      return;
    }

    if (!selectedPart) {
      Alert.alert('Erreur', 'Veuillez sélectionner une partie');
      return;
    }

    // Envoie la requête POST avec les données nécessaires
    setIsLoading(true);

    try {
      const response = await axios.post('http://192.168.1.82:8000/api/paiement', {
        phone: userPhone,         // Le numéro de téléphone récupéré
        numDepot,                 // Le numéro de dépôt
        domaine: category,        // Catégorie (Informatique, Marketing, etc.)
        part: selectedPart,       // La partie sélectionnée
        mode,                     // Mode (présentiel ou ligne)
        price,                    // Prix
      });

      // Affiche la réponse du serveur en cas de succès
      Alert.alert('Succès', response.data.message || 'Paiement vérifié !', [{
        text: 'OK',
        onPress: () => navigation.navigate('Home'),
      }]);
    } catch (error) {
      // Gère l'erreur si quelque chose ne va pas
      Alert.alert('Erreur', 'Échec de la vérification du dépôt');
      console.error(error);
    } finally {
      setIsLoading(false); // Réinitialise l'état de chargement
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#6C63FF', '#8E85FF']} style={styles.header}>
        <Text style={styles.title}>Méthodes de Paiement</Text>
        <Icon name="payment" size={40} color="#fff" />
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations Bancaires</Text>
        <View style={styles.infoRow}>
          <Icon name="smartphone" size={20} color="#6C63FF" />
          <Text style={styles.infoText}>Wave/Orange/Moov : +226 74 39 19 80</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vérification de Paiement</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Numéro de dépôt"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={numDepot}
            onChangeText={setNumDepot}
          />
        </View>

        {/* Afficher les informations de la catégorie, du mode, et du prix */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Catégorie : {category}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Mode : {mode}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Prix : {price}</Text>
        </View>

        {/* Sélectionner la partie */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Sélectionnez la partie :</Text>
          <TouchableOpacity
            style={styles.partButton}
            onPress={() => setSelectedPart('Hardware')}
          >
            <Text style={styles.partText}>Hardware</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.partButton}
            onPress={() => setSelectedPart('Software')}
          >
            <Text style={styles.partText}>Software</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.partButton}
            onPress={() => setSelectedPart('Social')}
          >
            <Text style={styles.partText}>Social</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.partButton}
            onPress={() => setSelectedPart('Content')}
          >
            <Text style={styles.partText}>Content</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, !numDepot && styles.disabledButton]}
        onPress={handleVerification}
        disabled={isLoading || !numDepot || !selectedPart}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Vérifier le dépôt <Icon name="arrow-forward" size={20} color="#fff" />
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    padding: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
    paddingLeft: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    marginVertical: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2C3E50',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 5,
  },
  partButton: {
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginVertical: 5,
    alignItems: 'center',
  },
  partText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  infoRow: {
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  button: {
    backgroundColor: '#6C63FF',
    padding: 20,
    borderRadius: 15,
    marginHorizontal: 15,
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10,
  },
});

export default PaiementProcessing;
