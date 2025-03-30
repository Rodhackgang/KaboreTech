import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Paiement = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { categoryName } = route.params;
    const [selectedMode, setSelectedMode] = useState(null);

    // Prix selon la catégorie
    const categoryPrices = {
        'Informatique': { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
        'Marketing': { presentiel: '30 000 🪙', ligne: '20 000 🪙' },
        'Energie': { presentiel: '45 000 🪙', ligne: '30 000 🪙' },
        'Réparation': { presentiel: '45 000 🪙', ligne: '30 000 🪙' }
    };

    const handlePayment = async () => {
        try {
            const hasAccount = await AsyncStorage.getItem('haveAccount');
            
            if (hasAccount === 'true') {
                navigation.navigate('PaiementProcessing', {
                    category: categoryName,
                    mode: selectedMode,
                    price: categoryPrices[categoryName][selectedMode]
                });
            } else {
                navigation.navigate('Register', {
                    redirectTo: 'Paiement',
                    params: {
                        categoryName: categoryName,
                        selectedMode: selectedMode
                    }
                });
            }
        } catch (error) {
            console.error('Erreur de vérification du compte:', error);
        }
    };

    if (!categoryName) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>❌ Erreur: Aucune catégorie fournie</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>💸 Paiement pour {categoryName}</Text>
            
            <View style={styles.modeContainer}>
                <TouchableOpacity 
                    style={[styles.modeButton, selectedMode === 'presentiel' && styles.selectedMode]}
                    onPress={() => setSelectedMode('presentiel')}>
                    <Text style={styles.modeTitle}>🏫 Présentiel</Text>
                    <Text style={styles.priceText}>{categoryPrices[categoryName]?.presentiel || 'N/A'}</Text>
                    <Text style={styles.durationText}>⏳ 1-3 mois</Text>
                    <Text style={styles.bonusText}>🎁 Hébergement gratuit</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.modeButton, selectedMode === 'ligne' && styles.selectedMode]}
                    onPress={() => setSelectedMode('ligne')}>
                    <Text style={styles.modeTitle}>🌐 En Ligne</Text>
                    <Text style={styles.priceText}>{categoryPrices[categoryName]?.ligne || 'N/A'}</Text>
                    <Text style={styles.durationText}>⏳ À votre rythme</Text>
                    <Text style={styles.bonusText}>🎁 Support digital</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={[styles.subscribeButton, !selectedMode && styles.disabledButton]}
                    disabled={!selectedMode}
                    onPress={handlePayment}>
                    <Text style={styles.subscribeButtonText}>
                        {selectedMode ? `💰 Payer ${categoryPrices[categoryName]?.[selectedMode]}` : 'Choisir un mode'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>🔙 Retour</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
                📍 Lieu: Houndé, secteur 04, côté Ouest de la nouvelle gare reconstruite
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FA',
        padding: 25,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#2C3E50',
        textAlign: 'center',
        marginVertical: 20,
    },
    modeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 15,
    },
    modeButton: {
        backgroundColor: '#FFFFFF',
        width: '48%',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    selectedMode: {
        borderColor: '#6C63FF',
        borderWidth: 2,
        backgroundColor: '#F0F0FF',
    },
    modeTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#34495E',
        marginBottom: 10,
    },
    priceText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#27AE60',
        marginVertical: 8,
    },
    durationText: {
        color: '#7F8C8D',
        marginVertical: 5,
    },
    bonusText: {
        color: '#2980B9',
        fontWeight: '500',
        marginTop: 10,
    },
    buttonContainer: {
        marginVertical: 25,
    },
    subscribeButton: {
        backgroundColor: '#27AE60',
        padding: 18,
        borderRadius: 25,
        alignItems: 'center',
        marginVertical: 10,
    },
    disabledButton: {
        backgroundColor: '#BDC3C7',
    },
    subscribeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        backgroundColor: '#E74C3C',
        padding: 12,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 15,
    },
    backButtonText: {
        color: 'white',
        fontSize: 16,
    },
    infoText: {
        textAlign: 'center',
        color: '#7F8C8D',
        marginTop: 20,
        fontStyle: 'italic',
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default Paiement;
