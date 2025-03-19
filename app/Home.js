import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef } from 'react';
import { View, Text, Alert, BackHandler, StyleSheet, TouchableOpacity } from 'react-native';
import Icon, { Icons } from '../components/Icons';
import Colors from '../constants/Colors';
import * as Animatable from 'react-native-animatable';
import HomeScreen from './HomeScreen';
import Informatique from './Informatique';
import Marketing from './Marketing';
import Energie from './Energie';
import Repair from './Repair';
import Seeting from './Seeting';

const TabArr = [
  {
    route: 'Accueil',
    label: 'Accueil',
    type: Icons.Ionicons,
    activeIcon: 'home',
    inActiveIcon: 'home-outline',
    component: HomeScreen,
  },
  {
    route: 'Informatique',
    label: 'Informatique',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'laptop',
    inActiveIcon: 'laptop-off',
    component: Informatique,
  },
  {
    route: 'Marketing Digital',
    label: 'Marketing',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'web',
    inActiveIcon: 'web',
    component: Marketing,
  },
  {
    route: 'Energie Solaire',
    label: 'Energie Solaire',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'solar-panel',
    inActiveIcon: 'solar-panel',
    component: Energie,
  },
  {
    route: 'Réparation Téléphones',
    label: 'Réparation',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'cellphone',
    inActiveIcon: 'cellphone',
    component: Repair,
  },
  {
    route: 'Services',
    label: 'Services',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'wrench',
    inActiveIcon: 'wrench-outline',
    component: Seeting, // Remplacer par le composant de service spécifique
  }
];


const Tab = createBottomTabNavigator();

const TabButton = (props) => {
  const { item, onPress, accessibilityState } = props;
  const focused = accessibilityState.selected;
  const viewRef = useRef(null);

  useEffect(() => {
    if (focused) {
      viewRef.current.animate({ 0: { scale: 0.5, rotate: '0deg' }, 1: { scale: 1.5, rotate: '360deg' } });
    } else {
      viewRef.current.animate({ 0: { scale: 1.5, rotate: '360deg' }, 1: { scale: 1, rotate: '0deg' } });
    }
  }, [focused]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={1} style={[styles.container, { top: 0 }]}>
      <Animatable.View ref={viewRef} duration={1000}>
        <Icon
          type={item.type}
          name={focused ? item.activeIcon : item.inActiveIcon}
          color={focused ? Colors.primary : Colors.primaryLite}
        />
      </Animatable.View>
    </TouchableOpacity>
  );
};

const Home = () => {
  useEffect(() => {
    const handleBackPress = () => {
      Alert.alert(
        'Confirmation',
        'Voulez-vous vraiment quitter l\'application ?',
        [
          {
            text: 'Annuler',
            onPress: () => null,
            style: 'cancel',
          },
          {
            text: 'Oui',
            onPress: () => BackHandler.exitApp(), // Fermer l'application
          },
        ],
        { cancelable: false }
      );
      return true; // Empêche la fermeture immédiate de l'application
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 60,
          position: 'absolute',
          margin: 16,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      {TabArr.map((item, index) => (
        <Tab.Screen
          key={index}
          name={item.route}
          component={item.component}
          options={{
            tabBarShowLabel: false,
            tabBarButton: (props) => <TabButton {...props} item={item} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
  },
});

export default Home;
