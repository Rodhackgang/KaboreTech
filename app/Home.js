import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Icon, { Icons } from '../components/Icons';
import Colors from '../constants/Colors';
import * as Animatable from 'react-native-animatable';
import HomeScreen from './HomeScreen';
import Informatique from './Informatique';
import Marketing from './Marketing';
import Repair from './Repair';
import Seeting from './Seeting';
import Bureautique from './Bureautique';

const { width } = Dimensions.get('window');

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
    route: 'Bureautique',
    label: 'Bureautique',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'folder-account',
    inActiveIcon: 'folder-account-outline',
    component: Bureautique,
  },
  {
    route: 'Marketing Digital',
    label: 'Marketing',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'bullhorn',
    inActiveIcon: 'bullhorn-outline',
    component: Marketing,
  },
  {
    route: 'Formation GSM',
    label: 'Réparation',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'cellphone',
    inActiveIcon: 'cellphone-off',
    component: Repair,
  },
  {
    route: 'Services',
    label: 'Services',
    type: Icons.MaterialCommunityIcons,
    activeIcon: 'wrench',
    inActiveIcon: 'wrench-outline',
    component: Seeting,
  }
];

const Tab = createBottomTabNavigator();

const pulseAnimation = {
  0: { scale: 1 },
  0.5: { scale: 1.1 },
  1: { scale: 1 },
};

const TabButton = React.memo(({ item, onPress, accessibilityState }) => {
  const focused = accessibilityState?.selected ?? false;
  const viewRef = useRef(null);
  const textRef = useRef(null);
  const backgroundRef = useRef(null);

  useEffect(() => {
    if (focused) {
      // Animation pour l'icône active
      viewRef.current?.animate({
        0: { scale: 1, translateY: 0, rotate: '0deg' },
        0.3: { scale: 1.3, translateY: -8, rotate: '180deg' },
        0.6: { scale: 1.1, translateY: -6, rotate: '360deg' },
        1: { scale: 1.2, translateY: -5, rotate: '360deg' }
      });

      // Animation pour le texte
      textRef.current?.animate({
        0: { opacity: 0.6, scale: 0.9 },
        1: { opacity: 1, scale: 1 }
      });

      // Animation pour le background
      backgroundRef.current?.animate({
        0: { scale: 0, opacity: 0 },
        0.3: { scale: 1.2, opacity: 0.15 },
        1: { scale: 1, opacity: 0.15 }
      });
    } else {
      viewRef.current?.animate({
        0: { scale: 1.2, translateY: -5 },
        1: { scale: 1, translateY: 0 }
      });

      textRef.current?.animate({
        0: { opacity: 1, scale: 1 },
        1: { opacity: 0.7, scale: 0.95 }
      });

      backgroundRef.current?.animate({
        0: { scale: 1, opacity: 0.15 },
        1: { scale: 0, opacity: 0 }
      });
    }
  }, [focused]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabButton}
    >
      <View style={styles.tabContainer}>
        {/* Background animé pour l'onglet actif */}
        <Animatable.View
          ref={backgroundRef}
          duration={600}
          style={[
            styles.activeBackground,
            {
              backgroundColor: focused ? "#007BFF" : 'transparent',
              opacity: focused ? 0.15 : 0,
              borderWidth: focused ? 2 : 0,
              borderColor: focused ? "#007BFF" + '40' : 'transparent'
            }
          ]}
        />

        <Animatable.View ref={viewRef} duration={800} style={styles.iconContainer}>
          <Icon
            type={item.type}
            name={focused ? item.activeIcon : item.inActiveIcon}
            color={focused ? "#007BFF" : "#007BAF"}
            size={focused ? 26 : 22}
          />
        </Animatable.View>

        <Animatable.Text
          ref={textRef}
          duration={500}
          style={[
            styles.tabLabel,
            {
              color: focused ? "#007BFF" : "#007BAF",
              fontWeight: focused ? '700' : '500',
              fontSize: focused ? 11 : 10,
            }
          ]}
        >
          {item.label}
        </Animatable.Text>

        {/* Indicateur de point actif */}
        {focused && (
          <Animatable.View
            animation={pulseAnimation}
            iterationCount="infinite"
            duration={2000}
            style={[styles.activeIndicator, { backgroundColor: "#007BFF" }]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

const Home = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 75,
          position: 'absolute',
          bottom: 50, // Remonté plus haut
          left: 20,
          right: 20,
          backgroundColor: '#FFFFFF',
          borderRadius: 25,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 15,
          borderTopWidth: 0,
          paddingBottom: 10,
          paddingTop: 10,
          borderWidth: 1,
          borderColor: '#E5E5E5',
        },
        tabBarItemStyle: {
          height: 55,
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
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 55,
    position: 'relative',
  },
  activeBackground: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    top: -10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    zIndex: 2,
  },
  tabLabel: {
    textAlign: 'center',
    marginTop: 2,
    zIndex: 2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 1,
  },
});

export default Home;