import React, { useEffect, useState } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import * as Animatable from 'react-native-animatable';
import Styles from '../common/Styles';
import Colors from '../constants/Colors';
import MyHeader from '../components/MyHeader';
import Animated, { FadeIn, useAnimatedRef } from 'react-native-reanimated';

export default function ColorScreen({ route, navigation }) {
  const viewRef = useAnimatedRef(null);
  const [bgColor, setBgColor] = useState();

  // Définir la couleur de fond en fonction de la route actuelle
  useEffect(() => {
    switch (route.name) {
      case 'Accueil': { setBgColor(Colors.primary); break; }
      case 'RechercheJob': { setBgColor(Colors.green); break; }
      case 'FiltrageJob': { setBgColor(Colors.red); break; }
      case 'JobsPoster': { setBgColor(Colors.purple); break; }
      case 'Parametres': { setBgColor(Colors.yellow); break; }
      default: setBgColor(Colors.white);
    }
  }, [route.name]);

  return (
    <Animated.View 
      ref={viewRef} 
      entering={FadeIn.duration(800)}
      style={[Styles.container, { backgroundColor: bgColor, paddingTop: 22 }]} // Ajout du paddingTop
    >
      {/* Afficher le Header avec les propriétés passées */}
      <MyHeader
        menu
        onPressMenu={() => navigation.goBack()}
        title={route.name}
        right="more-vertical"
        onRightPress={() => console.log('right')}
      />

      {/* Contenu de l'écran */}
      <View style={[Styles.container, { backgroundColor: bgColor, paddingTop: 20 }]}>
        {/* Ajouter ici le contenu spécifique à chaque écran */}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 0, // Ajuster la distance du header par rapport au haut
    paddingBottom: 0,
  },
});
