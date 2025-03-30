import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

const Seeting = ({ navigation }) => {
  const [haveAccount, setHaveAccount] = useState(false);
  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: ''
  });
  const [vipStatus, setVipStatus] = useState({
    Informatique: false,
    Marketing: false,
    Energie: false,
    Reparation: false
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const accountStatus = await AsyncStorage.getItem('haveAccount');
        const isVIPInformatique = await AsyncStorage.getItem('isVIPInformatique');
        const isVIPMarketing = await AsyncStorage.getItem('isVIPMarketing');
        const isVIPEnergie = await AsyncStorage.getItem('isVIPEnergie');
        const isVIPReparation = await AsyncStorage.getItem('isVIPReparation');

        setHaveAccount(accountStatus === 'true');
        setVipStatus({
          Informatique: isVIPInformatique === 'true',
          Marketing: isVIPMarketing === 'true',
          Energie: isVIPEnergie === 'true',
          Reparation: isVIPReparation === 'true'
        });

        if (accountStatus === 'true') {
          const firstName = await AsyncStorage.getItem('userName') || '';
          const phoneNumber = await AsyncStorage.getItem('userPhone') || '';
        
          setUserInfo({
            firstName,
            phoneNumber
          });
        }
      } catch (error) {
        console.error('Error loading storage data:', error);
      }
    };

    loadStorageData();
  }, []);

  const sections = [
    {
      route: 'Informatique',
      label: 'Informatique',
      icon: 'laptop',
      vipKey: 'Informatique'
    },
    {
      route: 'Marketing Digital',
      label: 'Marketing',
      icon: 'globe',
      vipKey: 'Marketing'
    },
    {
      route: 'Energie Solaire',
      label: 'Energie Solaire',
      icon: 'sun',
      vipKey: 'Energie'
    },
    {
      route: 'Réparation Téléphones',
      label: 'Réparation',
      icon: 'mobile-alt',
      vipKey: 'Reparation'
    },
  ];

  const handleLogout = async () => {
    try {
      // Supprimer toutes les données pertinentes dans AsyncStorage
      await AsyncStorage.multiRemove([
        'haveAccount',
        'firstName',
        'lastName',
        'phoneNumber',
        'isVIPInformatique',
        'isVIPMarketing',
        'isVIPEnergie',
        'isVIPReparation'
      ]);
  
      // Réinitialiser l'état local
      setHaveAccount(false);
      setUserInfo({ firstName: '', lastName: '', phoneNumber: '' });
      setVipStatus({
        Informatique: false,
        Marketing: false,
        Energie: false,
        Reparation: false
      });
  
      // Réinitialiser la navigation et rediriger l'utilisateur vers l'écran de connexion ou d'accueil
      navigation.reset({
        index: 0,  // Remettre la pile de navigation à zéro
        routes: [{ name: 'Login' }],  // Naviguer vers l'écran de connexion après la déconnexion
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };
  
  const renderSection = (section) => {
    const isVIP = vipStatus[section.vipKey];
    return (
      <TouchableOpacity
        key={section.route}
        style={[
          styles.card,
          isVIP ? styles.cardVIPActive : styles.cardVIPInactive,
        ]}
        onPress={() => navigation.navigate(section.route)}
      >
        <FontAwesome5
          name={section.icon}
          size={30}
          color={isVIP ? Colors.green : Colors.red}
        />
        <Text style={styles.cardLabel}>{section.label}</Text>
        <Text style={[styles.vipStatus, isVIP ? styles.vipActive : styles.vipInactive]}>
          {isVIP ? 'Accès VIP activé' : 'Accès VIP désactivé'}
        </Text>
      </TouchableOpacity>
    );
  };

  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
        const response = await fetch('http://192.168.1.82:3000/api/vip-status?phone=' + userInfo.phoneNumber);
        const data = await response.json();
        console.log('VIP status data:', data); // Ajoutez cette ligne pour vérifier les données
        if (data.vipDomains) {
            const updatedVipStatus = {
                Informatique: data.vipDomains.includes('Informatique'),
                Marketing: data.vipDomains.includes('Marketing'),
                Energie: data.vipDomains.includes('Energie'),
                Reparation: data.vipDomains.includes('Réparation')
            };
            await AsyncStorage.setItem('isVIPInformatique', updatedVipStatus.Informatique.toString());
            await AsyncStorage.setItem('isVIPMarketing', updatedVipStatus.Marketing.toString());
            await AsyncStorage.setItem('isVIPEnergie', updatedVipStatus.Energie.toString());
            await AsyncStorage.setItem('isVIPReparation', updatedVipStatus.Reparation.toString());
            setVipStatus(updatedVipStatus);
        }
    } catch (error) {
        console.error('Error refreshing VIP status:', error);
    }
    setIsRefreshing(false);
};


  return (
    <View style={styles.container}>
      <MyHeader
        title="Paramètres"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshVipStatus} />
        }
      >
        <Text style={styles.sectionTitle}>Informations Personnelles</Text>
        
        {/* Prénom */}
        <View style={styles.infoContainer}>
          <View style={styles.row}>
            <Text style={styles.label}>Nom :</Text>
            <Text style={styles.infoText}>{haveAccount ? userInfo.firstName : 'Non connecté'}</Text>
          </View>
        </View>

        {/* Numéro */}
        <View style={styles.infoContainer}>
          <View style={styles.row}>
            <Text style={styles.label}>Numéro :</Text>
            <Text style={styles.infoText}>{haveAccount ? userInfo.phoneNumber : 'Non connecté'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sections Disponibles</Text>
        <View style={styles.cardContainer}>
          {sections.map(renderSection)}
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.marginBottom]} 
          onPress={haveAccount ? handleLogout : () => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>
            {haveAccount ? 'Se déconnecter' : 'S\'inscrire'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: Colors.primary,
    textAlign: 'center',
  },
  infoContainer: {
    marginBottom: 20,
    padding: 18,
    backgroundColor: Colors.lightGray,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray, // Contours ajoutés
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    color: Colors.darkGray,
    marginBottom: 8,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    color: Colors.black,
    fontWeight: '500',
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  card: {
    width: '48%',
    marginBottom: 15,
    padding: 20,
    backgroundColor: Colors.lightGray,
    borderRadius: 20,
    borderWidth: 1, // Contours ajoutés
    borderColor: Colors.gray, // Contours ajoutés
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardVIPActive: {
    backgroundColor: Colors.greenLight,
  },
  cardVIPInactive: {
    backgroundColor: Colors.redLight,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  vipStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  vipActive: {
    color: Colors.green,
  },
  vipInactive: {
    color: Colors.red,
  },
  button: {
    marginTop: 35,
    paddingVertical: 15,
    paddingHorizontal: 35,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  marginBottom: {
    marginBottom: 20,
  },
});

export default Seeting;
