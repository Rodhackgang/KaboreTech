import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, StatusBar, Linking } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MyHeader from '../components/MyHeader';
import Colors from '../constants/Colors';
import { FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons';
import { Link, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const Settings = () => {
  const navigation = useNavigation();
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

  const loadVipStatus = async () => {
    const vipStatusFromStorage = {};
    try {
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
      setVipStatus(vipStatusFromStorage);
    } catch (error) {
      console.error('Error loading VIP status:', error);
    }
  };

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const sections = [
    { 
      route: 'Informatique', 
      label: 'Maintenance Informatique', 
      icon: 'laptop', 
      vipKey: 'Informatique',
      color: '#4F46E5',
      gradientColors: ['#4F46E5', '#7C3AED'],
      description: 'Formation en développement et IT'
    },
    { 
      route: 'Marketing', 
      label: 'Marketing     Digital', 
      icon: 'chart-line', 
      vipKey: 'Marketing',
      color: '#059669',
      gradientColors: ['#059669', '#0D9488'],
      description: 'Stratégies marketing digitales'
    },
    { 
      route: 'Repair', 
      label: 'Réparation Téléphones', 
      icon: 'mobile-alt', 
      vipKey: 'GSM',
      color: '#DC2626',
      gradientColors: ['#DC2626', '#EA580C'],
      description: 'Réparation de smartphones'
    },
    { 
      route: 'Bureautique', 
      label: 'Sécretariat Informatique', 
      icon: 'file-alt', 
      vipKey: 'Bureautique',
      color: '#7C2D12',
      gradientColors: ['#7C2D12', '#A16207'],
      description: 'Outils et formations bureau'
    }
  ];

  const freeResources = [
    {
      title: 'Tutoriels Gratuits',
      icon: 'play-circle',
      description: 'Accès aux cours de base',
      onPress: () => Linking.openURL('https://youtube.com/@kaboreofficiel2995?si=puzY3XRwFlDNoU8B')
    },
    {
      title: 'Support',
      icon: 'message-circle',
      description: 'Aide et assistance',
      onPress: () => Linking.openURL('https://wa.me/+22674391980')
    }
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

  const refreshVipStatus = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('https://kaboretech.cursusbf.com/api/vip-status?phone=' + userInfo.phoneNumber);
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

        data.vipDomaines.forEach(domain => {
          const category = vipCategoryMap[domain];
          if (category) {
            const part = domain.includes('Hardware') ? 'hardware' : 'software';
            updatedVipStatus[category][part] = true;
          }
        });

        setVipStatus(updatedVipStatus);
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

  const renderUserProfile = () => (
    <View style={styles.profileContainer}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        style={styles.profileGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.profileAvatar}>
          <FontAwesome5 name="user" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {haveAccount ? userInfo.firstName : 'Utilisateur Invité'}
          </Text>
          <Text style={styles.profilePhone}>
            {haveAccount ? userInfo.phoneNumber : 'Non connecté'}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {haveAccount ? 'Connecté' : 'Hors ligne'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editButton}>
          <Feather name="edit-2" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );

  const renderSection = (section) => {
    const isVIPHardware = vipStatus[section.vipKey]?.hardware;
    const isVIPSoftware = vipStatus[section.vipKey]?.software;
    const hasAnyVIP = isVIPHardware || isVIPSoftware;

    return (
      <TouchableOpacity
        key={section.route}
        style={styles.sectionCard}
        onPress={() => navigation.navigate(section.route, {
          isVIPHardware: isVIPHardware,
          isVIPSoftware: isVIPSoftware
        })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={hasAnyVIP ? section.gradientColors : ['#F3F4F6', '#E5E7EB']}
          style={styles.sectionGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: hasAnyVIP ? 'rgba(255,255,255,0.2)' : '#FFFFFF' }]}>
              <FontAwesome5
                name={section.icon}
                size={24}
                color={hasAnyVIP ? "#FFFFFF" : section.color}
              />
            </View>
            {hasAnyVIP && (
              <View style={styles.vipBadge}>
                <MaterialIcons name="verified" size={16} color="#FFD700" />
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>
            )}
          </View>
          <Text style={[styles.sectionTitle, { color: hasAnyVIP ? '#FFFFFF' : '#1F2937' }]}>
            {section.label}
          </Text>
          <Text style={[styles.sectionDescription, { color: hasAnyVIP ? 'rgba(255,255,255,0.8)' : '#6B7280' }]}>
            {section.description}
          </Text>
          <View style={styles.statusContainer}>
            {/* Affichage conditionnel pour Bureautique */}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isVIPHardware ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusLabel, { color: hasAnyVIP ? 'rgba(255,255,255,0.9)' : '#374151' }]}>
                {section.vipKey === 'Bureautique'
                  ? `Pratique ${isVIPHardware ? 'Actif' : 'Inactif'}`
                  : `Hardware ${isVIPHardware ? 'Actif' : 'Inactif'}`
                }
              </Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isVIPSoftware ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusLabel, { color: hasAnyVIP ? 'rgba(255,255,255,0.9)' : '#374151' }]}>
                {section.vipKey === 'Bureautique'
                  ? `Théorique ${isVIPSoftware ? 'Actif' : 'Inactif'}`
                  : `Software ${isVIPSoftware ? 'Actif' : 'Inactif'}`
                }
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderFreeResource = (resource, index) => (
    <TouchableOpacity
      key={index}
      style={styles.freeResourceCard}
      onPress={resource.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.freeResourceIcon}>
        <Feather name={resource.icon} size={24} color="#059669" />
      </View>
      <View style={styles.freeResourceContent}>
        <Text style={styles.freeResourceTitle}>{resource.title}</Text>
        <Text style={styles.freeResourceDescription}>{resource.description}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <MyHeader title="Paramètres" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshVipStatus}
            colors={['#4F46E5']}
            tintColor="#4F46E5"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderUserProfile()}
        
        {/* Formations Premium */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderTitle}>Formations Premium</Text>
            <MaterialIcons name="stars" size={24} color="#4F46E5" />
          </View>
          <View style={styles.sectionsGrid}>
            {sections.map(renderSection)}
          </View>
        </View>

        {/* Ressources Gratuites */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderTitle}>Ressources Gratuites</Text>
            <Feather name="gift" size={24} color="#059669" />
          </View>
          <View style={styles.freeResourcesContainer}>
            {freeResources.map(renderFreeResource)}
          </View>
        </View>

        {/* Bouton d'action */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={haveAccount ? handleLogout : () => navigation.navigate('Register')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={haveAccount ? ['#EF4444', '#DC2626'] : ['#4F46E5', '#7C3AED']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialIcons 
                name={haveAccount ? "logout" : "person-add"} 
                size={20} 
                color="#FFFFFF" 
              />
              <Text style={styles.actionButtonText}>
                {haveAccount ? 'Se déconnecter' : 'S\'inscrire'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  // Profile Section
  profileContainer: {
    marginBottom: 30,
  },
  profileGradient: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Section Headers
  section: {
    marginBottom: 30,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  // Premium Sections
  sectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sectionCard: {
    width: (width - 50) / 2,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionGradient: {
    padding: 16,
    minHeight: 180,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  statusContainer: {
    marginTop: 'auto',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Free Resources
  freeResourcesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
  },
  freeResourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  freeResourceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  freeResourceContent: {
    flex: 1,
  },
  freeResourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  freeResourceDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Action Buttons
  actionButtons: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 30,
  },
  primaryButton: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});

export default Settings;