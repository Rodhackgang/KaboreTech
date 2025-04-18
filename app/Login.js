import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Login = () => {
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);
  const errorOpacity = useState(new Animated.Value(0))[0];
  const progressBarWidth = useState(new Animated.Value(0))[0];

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
  const handleLogin = async () => {
    if (phone.trim() === '' || password.trim() === '') {
      showErrorMessage('Veuillez remplir tous les champs.');
      return;
    }
  
    const loginData = { phone, password };
    console.log("Login Data Sent:", loginData);  // Log the login data
    setLoading(true);
  
    try {
      const response = await axios.post('http://192.168.1.82:8000/api/login', loginData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
  
      console.log("Response from Server:", response.data);  // Log the server response
  
      if (response.status === 200) {
        // Connexion réussie, sauvegarde des informations de l'utilisateur
        const user = response.data.user;
        
        // Safely handle undefined values by checking before calling .toString()
        const vipInformatique = user.vipStatus?.informatique ? user.vipStatus.informatique.toString() : 'false';
        const vipMarketing = user.vipStatus?.marketing ? user.vipStatus.marketing.toString() : 'false';
        const vipEnergie = user.vipStatus?.energie ? user.vipStatus.energie.toString() : 'false';
        const vipReparation = user.vipStatus?.reparation ? user.vipStatus.reparation.toString() : 'false';
  
        // Store data in AsyncStorage
        await AsyncStorage.setItem('haveAccount', 'true');
        await AsyncStorage.setItem('userName', user.name);
        await AsyncStorage.setItem('userPhone', user.phone);
        await AsyncStorage.setItem('userPassword', password);
  
        // Update VIP statuses in AsyncStorage
        await AsyncStorage.setItem('isVIPInformatique', vipInformatique);
        await AsyncStorage.setItem('isVIPMarketing', vipMarketing);
        await AsyncStorage.setItem('isVIPEnergie', vipEnergie);
        await AsyncStorage.setItem('isVIPReparation', vipReparation);
  
        // Reset navigation to the Home screen after successful login
        navigation.reset({
          index: 0, // Reset navigation stack
          routes: [{ name: 'Home' }], // Navigate to the Home screen
        });
      } else {
        // Handle login failure
        setLoading(false);
        showErrorMessage(response.data.message || 'Erreur de connexion');
      }
    } catch (error) {
      setLoading(false);
      showErrorMessage('Une erreur s\'est produite lors de la connexion');
      console.error(error);
    }
  };
  
  
  return (
    <View style={styles.container}>
      {showError && (
        <Animated.View style={[styles.errorContainer, { opacity: errorOpacity }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Animated.View style={[styles.progressBar, { width: progressBarWidth }]} />
        </Animated.View>
      )}
      <Text style={styles.title}>Se connecter</Text>
      <TextInput
        style={styles.input}
        placeholder="Entrez votre numéro de téléphone"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Entrez votre mot de passe"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>{loading ? 'Chargement...' : "Se connecter"}</Text>
      </TouchableOpacity>
      <Text onPress={() => navigation.navigate('Register')} style={styles.registerText}>
        Vous n'avez pas encore un compte ? Créez un compte
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
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
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#1E90FF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
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
  },
  progressBar: {
    height: 4,
    backgroundColor: 'red',
    alignSelf: 'flex-start',
  },
});

export default Login;
