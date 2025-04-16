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

  // Function to load VIP statuses dynamically
  const loadVipStatus = async () => {
    const categories = ['Informatique', 'Marketing', 'GSM', 'Energie', 'Reparation'];
    const vipStatusFromStorage = {};

    try {
      // Iterate over categories and load hardware/software parts dynamically
      for (const category of categories) {
        const categoryParts = ['hardware', 'software'];
        vipStatusFromStorage[category] = {};

        for (const part of categoryParts) {
          const key = `isVIP${category}${capitalize(part)}`;
          vipStatusFromStorage[category][part] = (await AsyncStorage.getItem(key)) === 'true';
        }
      }

      setVipStatus(vipStatusFromStorage);
    } catch (error) {
      console.error('Error loading VIP status:', error);
    }
  };

  // Helper function to capitalize first letter of a string
  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const sections = [
    { route: 'Informatique', label: 'Informatique', icon: 'laptop', vipKey: 'Informatique' },
    { route: 'Marketing Digital', label: 'Marketing', icon: 'globe', vipKey: 'Marketing' },
    { route: 'Energie Solaire', label: 'Energie Solaire', icon: 'sun', vipKey: 'Energie' },
    { route: 'Réparation Téléphones', label: 'Réparation', icon: 'mobile-alt', vipKey: 'Reparation' },
  ];

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'haveAccount', 'firstName', 'lastName', 'phoneNumber',
        'isVIPInformatique', 'isVIPMarketing', 'isVIPEnergie', 'isVIPReparation'
      ]);

      setHaveAccount(false);
      setUserInfo({ firstName: '', lastName: '', phoneNumber: '' });
      setVipStatus({});

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

        {/* Display active VIP parts */}
        <Text style={[styles.vipStatus, isVIPHardware ? styles.vipActive : styles.vipInactive]}>
          {isVIPHardware ? 'Hardware Actif' : 'Hardware Inactif'}
        </Text>
        <Text style={[styles.vipStatus, isVIPSoftware ? styles.vipActive : styles.vipInactive]}>
          {isVIPSoftware ? 'Software Actif' : 'Software Inactif'}
        </Text>
      </TouchableOpacity>
    );
  };

  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('http://192.168.1.82:8000/api/vip-status?phone=' + userInfo.phoneNumber);
      const data = await response.json();

      if (data.vipDomains) {
        const updatedVipStatus = { ...vipStatus };

        Object.keys(updatedVipStatus).forEach((category) => {
          updatedVipStatus[category].hardware = data.vipDomains.includes(`${category} Hardware`);
          updatedVipStatus[category].software = data.vipDomains.includes(`${category} Software`);
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
