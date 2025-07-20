import { StyleSheet, View, FlatList, BackHandler } from 'react-native';  // Import BackHandler directly
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import data from '../data/data';
import Pagination from '../components/Pagination';
import CustomButton from '../components/CustomButton';
import RenderItem from '../components/RenderItem';

const OnboardingScreen = () => {
  const flatListRef = useAnimatedRef();
  const x = useSharedValue(0);
  const flatListIndex = useSharedValue(0);
  const navigation = useNavigation();

  // Fonction pour mettre à jour l'état de "dépassé" dans AsyncStorage
  const markOnboardingAsCompleted = async () => {
    try {
      await AsyncStorage.setItem('onboardingStatus', 'completed');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'onboarding', error);
    }
  };

  const onViewableItemsChanged = ({ viewableItems }) => {
    if (viewableItems[0].index !== null) {
      flatListIndex.value = viewableItems[0].index;
      // Vérifier si on est à la dernière page et marquer l'onboarding comme terminé
      if (viewableItems[0].index === data.length - 1) {
        markOnboardingAsCompleted(); // Appeler la fonction pour marquer comme terminé
      }
    }
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      x.value = event.contentOffset.x;
    },
  });

  // Gérer la navigation avec le bouton retour en utilisant BackHandler directement
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.navigate('Home');
      return true; // Prevent default back action
    });

    // Cleanup the event listener when component unmounts
    return () => {
      backHandler.remove();
    };
  }, [navigation]);

  useEffect(() => {
    // Initialiser l'état dans AsyncStorage si nécessaire (si vous voulez vérifier dès l'arrivée dans OnboardingScreen)
    const initializeOnboardingStatus = async () => {
      const status = await AsyncStorage.getItem('onboardingStatus');
      if (status === 'completed') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    };

    initializeOnboardingStatus();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        onScroll={onScroll}
        data={data}
        renderItem={({ item, index }) => {
          return <RenderItem item={item} index={index} x={x} />;
        }}
        keyExtractor={item => item.id.toString()}
        scrollEventThrottle={16}
        horizontal={true}
        bounces={false}
        pagingEnabled={true}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{
          minimumViewTime: 300,
          viewAreaCoveragePercentThreshold: 10,
        }}
      />
      <View style={styles.bottomContainer}>
        <Pagination data={data} x={x} />
        <CustomButton
          flatListRef={flatListRef}
          flatListIndex={flatListIndex}
          dataLength={data.length}
          x={x}
          onComplete={markOnboardingAsCompleted} // Utilisation de la fonction pour marquer comme complété
        />
      </View>
    </View>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 30,
    paddingVertical: 30,
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
});
