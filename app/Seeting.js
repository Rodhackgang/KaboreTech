import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

const Seeting = ({ navigation }) => {
  const [haveAccount, setHaveAccount] = useState(false);
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', phoneNumber: '' });
  const [vipStatus, setVipStatus] = useState({});
  const [categories, setCategories] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const accountStatus = await AsyncStorage.getItem('haveAccount');
        setHaveAccount(accountStatus === 'true');

        if (accountStatus === 'true') {
          const firstName = await AsyncStorage.getItem('userName') || '';
          const phoneNumber = await AsyncStorage.getItem('userPhone') || '';
          setUserInfo({ firstName, phoneNumber });
        }

        await loadVipStatus();
      } catch (error) {
        console.error('Error loading storage data:', error);
      }
    };

    loadStorageData();
  }, []);

  // Load VIP status based on the AsyncStorage keys
  const loadVipStatus = async () => {
    const vipStatusFromStorage = {};

    try {
      // Retrieve VIP status for each category and part (hardware/software)
      vipStatusFromStorage['Informatique'] = {
        hardware: (await AsyncStorage.getItem('isVIPInformatiqueHardware')) === 'true',
        software: (await AsyncStorage.getItem('isVIPInformatiqueSoftware')) === 'true',
      };

      vipStatusFromStorage['Marketing'] = {
        social: (await AsyncStorage.getItem('isVIPMarketingSocial')) === 'true',
        content: (await AsyncStorage.getItem('isVIPMarketingContent')) === 'true',
      };

      vipStatusFromStorage['GSM'] = {
        hardware: (await AsyncStorage.getItem('isVIPGsmHardware')) === 'true',
        software: (await AsyncStorage.getItem('isVIPGsmSoftware')) === 'true',
      };

      vipStatusFromStorage['Bureautique'] = {
        hardware: (await AsyncStorage.getItem('isVIPBureautiqueHardware')) === 'true',
        software: (await AsyncStorage.getItem('isVIPBureautiqueSoftware')) === 'true',
      };

      console.log('Avant mise à jour des statuts VIP:', vipStatusFromStorage);
      setVipStatus(vipStatusFromStorage);
    } catch (error) {
      console.error('Error loading VIP status:', error);
    }
  };

  // Helper function to capitalize the first letter of a string
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const sections = [
    { route: 'Informatique', label: 'Informatique', icon: 'laptop', vipKey: 'Informatique' },
    { route: 'Marketing Digital', label: 'Marketing', icon: 'globe', vipKey: 'Marketing' },
    { route: 'Réparation Téléphones', label: 'Réparation', icon: 'mobile-alt', vipKey: 'GSM' },
    { route: 'Bureautique', label: 'Bureautique', icon: 'keyboard', vipKey: 'Bureautique' }
  ];

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'haveAccount', 'firstName', 'lastName', 'phoneNumber',
        'isVIPInformatiqueHardware', 'isVIPInformatiqueSoftware',
        'isVIPMarketingSocial', 'isVIPMarketingContent',
        'isVIPGsmHardware', 'isVIPGsmSoftware',
        'isVIPBureautiqueHardware', 'isVIPBureautiqueSoftware',
        'categoriesData'
      ]);

      setHaveAccount(false);
      setUserInfo({ firstName: '', lastName: '', phoneNumber: '' });
      setVipStatus({});
      setCategories([]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const renderSection = (section) => {
    const isVIPHardware = vipStatus[section.vipKey]?.hardware;
    const isVIPSoftware = vipStatus[section.vipKey]?.software;

    return (
      <TouchableOpacity
        key={section.route}
        style={[styles.card, isVIPHardware || isVIPSoftware ? styles.cardVIPActive : styles.cardVIPInactive]}
        onPress={() => navigation.navigate(section.route, {
          isVIPHardware: isVIPHardware,
          isVIPSoftware: isVIPSoftware
        })}
      >
        <FontAwesome5
          name={section.icon}
          size={30}
          color={isVIPHardware || isVIPSoftware ? Colors.green : Colors.red}
        />
        <Text style={styles.cardLabel}>{section.label}</Text>

        <Text style={[styles.vipStatus, isVIPHardware ? styles.vipActive : styles.vipInactive]}>
          {isVIPHardware ? 'Hardware Actif' : 'Hardware Inactif'}
        </Text>
        <Text style={[styles.vipStatus, isVIPSoftware ? styles.vipActive : styles.vipInactive]}>
          {isVIPSoftware ? 'Software Actif' : 'Software Inactif'}
        </Text>
      </TouchableOpacity>
    );
  };

  // Function to refresh the VIP status based on the API response
  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('http://192.168.1.82:8000/api/vip-status?phone=' + userInfo.phoneNumber);
      const data = await response.json();

      if (data.vipDomains) {
        const updatedVipStatus = { ...vipStatus };

        const vipCategoryMap = {
          'GSM Hardware': 'GSM',
          'GSM Software': 'GSM',
          'Marketing Social': 'Marketing',
          'Marketing Content': 'Marketing',
          'Informatique Hardware': 'Informatique',
          'Informatique Software': 'Informatique',
          'Bureautique Hardware': 'Bureautique',
          'Bureautique Software': 'Bureautique'
        };

        data.vipDomains.forEach(domain => {
          const category = vipCategoryMap[domain];
          if (category) {
            const part = domain.includes('Hardware') ? 'hardware' : 'software';
            updatedVipStatus[category][part] = true;
          }
        });

        setVipStatus(updatedVipStatus);

        // Save updated VIP status in AsyncStorage
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

  return (
    <View style={styles.container}>
      <MyHeader title="Paramètres" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshVipStatus} />}>
        <Text style={styles.sectionTitle}>Informations Personnelles</Text>

        <View style={styles.infoContainer}>
          <View style={styles.row}>
            <Text style={styles.label}>Nom :</Text>
            <Text style={styles.infoText}>{haveAccount ? userInfo.firstName : 'Non connecté'}</Text>
          </View>
        </View>

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
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 20, paddingBottom: 50 },
  sectionTitle: { fontSize: 24, fontWeight: '700', marginBottom: 20, color: Colors.primary, textAlign: 'center' },
  infoContainer: {
    marginBottom: 20,
    padding: 18,
    backgroundColor: Colors.lightGray,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 18, color: Colors.darkGray, marginBottom: 8, fontWeight: '600' },
  infoText: { fontSize: 16, color: Colors.black, fontWeight: '500' },
  cardContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
  card: {
    width: '48%',
    marginBottom: 15,
    padding: 20,
    backgroundColor: Colors.lightGray,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardVIPActive: { backgroundColor: Colors.greenLight },
  cardVIPInactive: { backgroundColor: Colors.redLight },
  cardLabel: { fontSize: 16, fontWeight: '600', marginTop: 12, color: Colors.darkGray, textAlign: 'center' },
  vipStatus: { fontSize: 14, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
  vipActive: { color: Colors.green },
  vipInactive: { color: Colors.red },
  button: {
    marginTop: 35,
    paddingVertical: 15,
    paddingHorizontal: 35,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center', 
  },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: Colors.white },
  marginBottom: { marginBottom: 20 },
});

export default Seeting;
