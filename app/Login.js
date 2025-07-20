import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import CountryPicker from 'react-native-country-picker-modal';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eyes from '../assets/animations/eyes.json';

const Login = () => {
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);

  // États pour la sélection de pays
  const [country, setCountry] = useState({
    cca2: 'BF',
    callingCode: ['226'],
    name: 'Burkina Faso'
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const animation = useRef(null);
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  const getFlagEmoji = (countryCode) => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  const showErrorMessage = (message) => {
    setError(message);
    setShowError(true);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(progressBarWidth, {
          toValue: 300,
          duration: 3000,
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(progressBarWidth, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      setShowError(false);
      setError('');
    });
  };

  const onSelectCountry = (country) => {
    setCountry(country);
    setShowCountryPicker(false);
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
    if (!passwordVisible) {
      animation.current?.play();
      setTimeout(() => {
        animation.current?.pause();
      }, 3000);
    } else {
      animation.current?.reset();
      animation.current?.pause();
    }
  };

  const handleLogin = async () => {
    if (phone.trim() === '' || password.trim() === '') {
      showErrorMessage('Veuillez remplir tous les champs.');
      return;
    }

    const fullPhoneNumber = `+${country.callingCode[0]}${phone}`;
    const loginData = { phone: fullPhoneNumber, password };
    setLoading(true);

    try {
      const response = await axios.post('https://kaboretech.cursusbf.com/api/login', loginData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        const user = response.data.user;

        // Safely handle undefined values
        const vipInformatique = user.vipStatus?.informatique?.toString() || 'false';
        const vipMarketing = user.vipStatus?.marketing?.toString() || 'false';
        const vipEnergie = user.vipStatus?.energie?.toString() || 'false';
        const vipReparation = user.vipStatus?.reparation?.toString() || 'false';

        // Store data
        await AsyncStorage.setItem('haveAccount', 'true');
        await AsyncStorage.setItem('userName', user.name);
        await AsyncStorage.setItem('userPhone', user.phone);
        await AsyncStorage.setItem('userPassword', password);
        await AsyncStorage.setItem('userCountry', country.name);
        await AsyncStorage.setItem('userCountryCode', country.cca2);

        // VIP statuses
        await AsyncStorage.setItem('isVIPInformatique', vipInformatique);
        await AsyncStorage.setItem('isVIPMarketing', vipMarketing);
        await AsyncStorage.setItem('isVIPEnergie', vipEnergie);
        await AsyncStorage.setItem('isVIPReparation', vipReparation);

        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        setLoading(false);
        showErrorMessage(response.data.message || 'Erreur de connexion');
      }
    } catch (error) {
      setLoading(false);
      showErrorMessage(error.response?.data?.message || 'Une erreur s\'est produite lors de la connexion');
      console.error(error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.safeArea}>
        {showError && (
          <Animated.View style={[styles.errorContainer, { opacity: errorOpacity }]}>
            <Text style={styles.errorText}>{error}</Text>
            <Animated.View style={[styles.progressBar, { width: progressBarWidth }]} />
          </Animated.View>
        )}
        <View style={styles.container}>
          <View style={styles.greenBackground}>
            <LottieView
              ref={animation}
              source={eyes}
              loop={false}
              style={styles.lottieAnimation}
            />
          </View>
          <View style={styles.whiteBackground}>
            <Text style={styles.title}>Se connecter</Text>

            {/* Sélecteur de pays */}
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.countrySelectorText}>
                {getFlagEmoji(country.cca2)} {country.name} (+{country.callingCode[0]})
              </Text>
              <FontAwesome name="chevron-down" size={16} color="#888" />
            </TouchableOpacity>

            {/* Champ téléphone */}
            <TextInput
              style={styles.input}
              placeholder="Numéro de téléphone"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            {/* Champ mot de passe */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor="#888"
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                <FontAwesome name={passwordVisible ? "eye" : "eye-slash"} size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Connexion...' : "Se connecter"}
              </Text>
            </TouchableOpacity>

            <Text
              onPress={() => navigation.navigate('Register')}
              style={styles.registerText}
            >
              Vous n'avez pas de compte ? S'inscrire
            </Text>
          </View>
        </View>

        {/* Country Picker Modal */}
        <CountryPicker
          {...{
            countryCode: country.cca2,
            withFilter: true,
            withFlag: true,
            withCountryNameButton: true,
            withAlphaFilter: true,
            withCallingCode: true,
            withEmoji: true,
            visible: showCountryPicker,
            onSelect: onSelectCountry,
            onClose: () => setShowCountryPicker(false),
            preferredCountries: ['BF', 'CI', 'ML', 'NE', 'SN', 'GN', 'TG'],
            theme: {
              primaryColor: '#1E90FF',
              primaryColorVariant: '#1A7ACC',
              backgroundColor: '#FFFFFF',
              onBackgroundTextColor: '#333333',
              fontSize: 16,
            }
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E90FF',
  },
  container: {
    flex: 1,
  },
  greenBackground: {
    flex: 1,
    backgroundColor: '#1E90FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteBackground: {
    flex: 2,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottieAnimation: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
  },
  countrySelector: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countrySelectorText: {
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 12,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#1E90FF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerText: {
    marginBottom: 20,
    color: '#1E90FF',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorText: {
    color: 'black',
    fontSize: 20,
    marginBottom: 10,
    marginTop: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'red',
    alignSelf: 'flex-start',
  },
  inputContainer: {
    width: '100%',
  },
});

export default Login;
