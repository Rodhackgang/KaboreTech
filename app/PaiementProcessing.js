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
import { useNavigation } from '@react-navigation/native';

const PaiementProcessing = () => {
  const [numDepot, setNumDepot] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState('');
  const [price, setPrice] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const navigation = useNavigation();

  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem('userPhone');
      if (phone) setUserPhone(phone);
    } catch (error) {
      console.error('Erreur lors du chargement du téléphone:', error);
    }
  };

  useEffect(() => { loadUserData(); }, []);

  const handleVerification = async () => {
    if (!numDepot) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de dépôt');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post('http://192.168.1.82:3000/api/paiement', {
        phone: userPhone,
        numDepot,
        domaine: category,
        mode,
        price,
      });

      Alert.alert('Succès', response.data.message || 'Paiement vérifié !', [{
        text: 'OK',
        onPress: () => navigation.navigate('Home'),
      }]);
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la vérification du dépôt');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (selectedMode) => {
    setMode(selectedMode);
    const prices = {
      Marketing: { presentiel: '30 000 🪙', ligne: '20 000 🪙' },
      Informatique: { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
      Energie: { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
      Reparation: { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
    };
    setPrice(prices[category]?.[selectedMode] || '');
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

        <CategorySelector 
          categories={categoriesData} 
          selected={category} 
          onSelect={setCategory} 
        />

        <View style={styles.modeGrid}>
          <ModeCard
            icon="school"
            label="Présentiel"
            selected={mode === 'presentiel'}
            onPress={() => handleModeChange('presentiel')}
            price={category ? (category === 'Marketing' ? '30 000 🪙' : '45 000 🪙') : ''}
          />

          <ModeCard
            icon="web"
            label="En ligne"
            selected={mode === 'ligne'}
            onPress={() => handleModeChange('ligne')}
            price={category ? (category === 'Marketing' ? '20 000 🪙' : '30 000 🪙') : ''}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, (!category || !mode) && styles.disabledButton]}
        onPress={handleVerification}
        disabled={isLoading || !category || !mode}
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

const ModeCard = ({ icon, label, selected, onPress, price }) => (
  <TouchableOpacity
    style={[styles.modeCard, selected && styles.selectedModeCard]}
    onPress={onPress}
  >
    <Icon name={icon} size={30} color="#6C63FF" />
    <Text style={styles.modeLabel}>{label}</Text>
    {price && <Text style={styles.modePrice}>{price}</Text>}
  </TouchableOpacity>
);

const CategorySelector = ({ categories, selected, onSelect }) => (
  <View style={styles.categoryContainer}>
    {categories.map((cat) => (
      <TouchableOpacity
        key={cat.id}
        style={[
          styles.categoryButton,
          selected === cat.value && styles.selectedCategory
        ]}
        onPress={() => onSelect(cat.value)}
      >
        <Icon name={cat.icon} size={24} color={selected === cat.value ? '#fff' : '#6C63FF'} />
        <Text style={[
          styles.categoryText,
          selected === cat.value && styles.selectedCategoryText
        ]}>
          {cat.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const categoriesData = [
  { id: 1, label: 'Informatique', value: 'Informatique', icon: 'computer' },
  { id: 2, label: 'Marketing', value: 'Marketing', icon: 'trending-up' },
  { id: 3, label: 'Energie', value: 'Energie', icon: 'wb-sunny' },
  { id: 4, label: 'Réparation', value: 'Reparation', icon: 'build' },
];

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
  inputIcon: {
    marginHorizontal: 15,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2C3E50',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    marginVertical: 10,
  },
  phoneInputText: {
    fontSize: 16,
    color: '#2C3E50',
    marginLeft: 10,
    paddingVertical: 15,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2C3E50',
    paddingHorizontal: 10,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  categoryButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedCategory: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  categoryText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  modeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  modeCard: {
    width: '48%',
    alignItems: 'center',
    padding: 20,
    borderRadius: 15,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedModeCard: {
    borderColor: '#6C63FF',
    backgroundColor: '#F0EDFF',
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 10,
  },
  modePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
    marginTop: 5,
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
