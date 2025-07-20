import React, { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, TextInput, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import CountryPicker from 'react-native-country-picker-modal';
import eyes from '../assets/animations/eyes.json';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Register = () => {
    const navigation = useNavigation();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [error, setError] = useState('');
    const [showError, setShowError] = useState(false);
    const [loading, setLoading] = useState(false);

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

    useEffect(() => {
        if (animation.current) {
            animation.current.pause();
        }
    }, []);

    const onSelectCountry = (country) => {
        setCountry(country);
        setShowCountryPicker(false);
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

        const fullPhoneNumber = `+${country.callingCode[0]}${phone}`;
        const userData = {
            name,
            phone: fullPhoneNumber,
            password,
            country: country.name,
            countryCode: country.cca2
        };

        setLoading(true);

        try {
            const response = await axios.post('https://kaboretech.cursusbf.com/register', userData, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 201) {
                setLoading(false);

                await AsyncStorage.setItem('haveAccount', 'true');
                await AsyncStorage.setItem('userName', name);
                await AsyncStorage.setItem('userPhone', fullPhoneNumber);
                await AsyncStorage.setItem('userPassword', password);
                await AsyncStorage.setItem('userCountry', country.name);
                await AsyncStorage.setItem('userCountryCode', country.cca2);

                setName('');
                setPhone('');
                setPassword('');
                setConfirmPassword('');

                navigation.navigate('Login');
            } else {
                setLoading(false);
                showErrorMessage(response.data.message || 'Erreur d\'inscription');
            }
        } catch (error) {
            setLoading(false);
            showErrorMessage(error.response?.data?.message || 'Une erreur s\'est produite lors de l\'inscription');
            console.error(error);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                            onChangeText={(text) => setName(text)}
                        />

                        {/* Sélecteur de pays amélioré */}
                        <TouchableOpacity
                            style={styles.countrySelector}
                            onPress={() => setShowCountryPicker(true)}
                        >
                            <Text style={styles.countrySelectorText}>
                                {getFlagEmoji(country.cca2)} {country.name} (+{country.callingCode[0]})
                            </Text>
                            <FontAwesome name="chevron-down" size={16} color="#888" />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Numéro de téléphone"
                            placeholderTextColor="#888"
                            keyboardType="phone-pad"
                            value={phone}
                            onChangeText={(text) => setPhone(text)}
                        />

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Entrez votre mot de passe"
                                placeholderTextColor="#888"
                                secureTextEntry={!passwordVisible}
                                value={password}
                                onChangeText={(text) => setPassword(text)}
                            />
                            <TouchableOpacity
                                onPress={() => setPasswordVisible(!passwordVisible)}
                                style={styles.eyeIcon}
                            >
                                <FontAwesome name={passwordVisible ? "eye" : "eye-slash"} size={24} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Confirmez votre mot de passe"
                            placeholderTextColor="#888"
                            secureTextEntry={!passwordVisible}
                            value={confirmPassword}
                            onChangeText={(text) => setConfirmPassword(text)}
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Inscription en cours...' : "S'inscrire"}
                            </Text>
                        </TouchableOpacity>

                        <Text onPress={() => navigation.navigate('Login')} style={styles.connectText}>
                            Vous avez déjà un compte ? Se connecter
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
            </SafeAreaView>
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
