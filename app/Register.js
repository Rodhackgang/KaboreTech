import React, { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import eyes from '../assets/animations/eyes.json';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';  // Importation d'Axios
import AsyncStorage from '@react-native-async-storage/async-storage'; // Importation d'AsyncStorage

const Register = () => {
    const navigation = useNavigation();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState('');
    const [showError, setShowError] = useState(false);
    const [loading, setLoading] = useState(false);  // Ajouté pour le contrôle de chargement
    const animation = useRef(null);

    const errorOpacity = useRef(new Animated.Value(0)).current;
    const progressBarWidth = useRef(new Animated.Value(0)).current;

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

    useEffect(() => {
        if (animation.current) {
            animation.current.pause();
        }
    }, []);

    const handleInputChange = (setter) => (text) => {
        setter(text);
    };

    const handleRegister = async () => {
        if (name.trim() === '' || phone.trim() === '' || password.trim() === '' || confirmPassword.trim() === '') {
            showErrorMessage('Veuillez remplir tous les champs.');
            return;
        }

        if (password !== confirmPassword) {
            showErrorMessage('Les mots de passe ne correspondent pas.');
            return;
        }

        const userData = { name, phone, password };
        setLoading(true);  // Commence le chargement

        try {
            const response = await axios.post('http://192.168.1.82:3000/register', userData, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 201) {
                // Inscription réussie
                setLoading(false);  // Arrête le chargement
                
                // Mise à jour de AsyncStorage
                await AsyncStorage.setItem('haveAccount', 'true'); // Marque l'utilisateur comme ayant un compte
                await AsyncStorage.setItem('userName', name); // Enregistre le nom de l'utilisateur
                await AsyncStorage.setItem('userPhone', phone); // Enregistre le numéro de téléphone
                await AsyncStorage.setItem('userPassword', password); // Enregistre le mot de passe

                // Efface les champs
                setName('');
                setPhone('');
                setPassword('');
                setConfirmPassword('');

                // Naviguer vers la page de connexion
                navigation.navigate('Login');
            } else {
                // Erreur d'inscription
                setLoading(false);  // Arrête le chargement
                showErrorMessage(response.data.message || 'Erreur d\'inscription');
            }
        } catch (error) {
            setLoading(false);  // Arrête le chargement
            showErrorMessage('Une erreur s\'est produite lors de l\'inscription');
            console.error(error);
        }
    };

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
        if (!passwordVisible) {
            playAnimation();
        } else {
            resetAndPauseAnimation();
        }
    };

    const playAnimation = () => {
        if (animation.current) {
            animation.current.play();
            setTimeout(() => {
                animation.current.pause();
            }, 3000);
        }
    };

    const resetAndPauseAnimation = () => {
        if (animation.current) {
            animation.current.reset();
            animation.current.pause();
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
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
                    <Text style={styles.title}>Créer un compte</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Entrez votre nom"
                        placeholderTextColor="#888"
                        value={name}
                        onChangeText={handleInputChange(setName)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Entrez votre numéro de téléphone"
                        placeholderTextColor="#888"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={handleInputChange(setPhone)}
                    />
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre mot de passe"
                            placeholderTextColor="#888"
                            secureTextEntry={!passwordVisible}
                            value={password}
                            onChangeText={handleInputChange(setPassword)}
                        />
                        <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                            <FontAwesome name={passwordVisible ? "eye" : "eye-slash"} size={24} color="#888" />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirmez votre mot de passe"
                        placeholderTextColor="#888"
                        secureTextEntry={!passwordVisible}
                        value={confirmPassword}
                        onChangeText={handleInputChange(setConfirmPassword)}
                    />
                    <TouchableOpacity style={styles.button} onPress={handleRegister}>
                        <Text style={styles.buttonText}>{loading ? 'Chargement...' : "S'inscrire"}</Text>
                    </TouchableOpacity>
                    <Text onPress={() => navigation.navigate('Login')} style={styles.connectText}>
                        Vous avez déjà un compte ? Se connecter
                    </Text>
                </View>
            </View>
        </SafeAreaView>
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
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    connectText: {
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

export default Register;
