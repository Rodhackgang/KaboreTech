import React, { useState, useEffect } from "react";
import { Text, View, Image, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const fadeAnim = new Animated.Value(0); // Initialization of Animated.Value
  const navigation = useNavigation();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const onboardingComplete = await AsyncStorage.getItem('onboardingStatus');

      if (onboardingComplete) {
        navigation.navigate('Home');
      } else {
        navigation.navigate('Onboarding');
      }
    };

    // Fade-in animation effect
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Delay to check onboarding status
    setTimeout(() => {
      checkOnboardingStatus();
    }, 2000);
  }, [fadeAnim, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={styles.content}>
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <Text style={styles.text}>KaboreTech</Text>
        </Animated.View>
        <View style={styles.imageContainer}>
          <Image
            source={require("../assets/images/logo.jpeg")}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  textContainer: {
    transform: [{ translateX: -10 }],
  },
  text: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 1.2,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  image: {
    width: "100%",
    height: "100%",
  },
};
