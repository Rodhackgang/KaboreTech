import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList } from 'react-native';
import React, { useState } from 'react';
import MyHeader from '../components/MyHeader'; // Assurez-vous que le chemin est correct
import Colors from '../constants/Colors'; // Supposons que Colors est disponible

const categories = [
  {
    id: '1',
    name: 'Développement Web',
    videos: [
      { id: '1', title: 'Introduction à React', isPaid: false, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      { id: '2', title: 'Apprendre Node.js', isPaid: true, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      { id: '3', title: 'Apprendre Node.js', isPaid: true, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      { id: '4', title: 'Apprendre Node.js', isPaid: true, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      { id: '5', title: 'Apprendre Node.js', isPaid: true, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      // Ajoute d'autres vidéos ici
    ],
  },
  {
    id: '2',
    name: 'Design Graphique',
    videos: [
      { id: '3', title: 'Photoshop pour débutants', isPaid: true, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      { id: '4', title: 'Illustrator : bases essentielles', isPaid: false, image: 'https://www.cursusbf.com/assets/img/logo.jpg' },
      // Ajoute d'autres vidéos ici
    ],
  },
  // Ajoute d'autres catégories ici
];

const HomeScreen = ({ navigation }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const renderCard = (video) => (
    <View style={styles.card} key={video.id}>
      <Image source={{ uri: video.image }} style={styles.cardImage} />
      <Text style={styles.cardTitle}>{video.title}</Text>
      <Text style={styles.cardPrice}>{video.isPaid ? 'Payant' : 'Gratuit'}</Text>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => console.log('toggle pressed')}>
        <Text style={styles.toggleButtonText}>{video.isPaid ? 'Voir plus' : 'Détails'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategory = (category) => (
    <View key={category.id} style={styles.category}>
      <Text style={styles.categoryTitle}>{category.name}</Text>
      <FlatList
        data={category.videos.slice(0, expandedCategory === category.id ? category.videos.length : 3)} // Affiche plus si la catégorie est développée
        renderItem={({ item }) => renderCard(item)}
        keyExtractor={(item) => item.id}
        horizontal
      />
      <TouchableOpacity onPress={() => toggleCategory(category.id)}>
        <Text style={styles.viewMore}>{expandedCategory === category.id ? 'Voir moins' : 'Voir plus'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <MyHeader
        menu
        onPressMenu={() => navigation.openDrawer()}
        title="Toutes les formations"
        right="more-vertical"
        onRightPress={() => console.log('right pressed')}
      />
      <View style={styles.content}>
        {categories.map(renderCategory)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
  },
  category: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  card: {
    marginRight: 10,
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
    padding: 10,
    width: 200,
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  cardPrice: {
    fontSize: 12,
    color: Colors.primary,
  },
  toggleButton: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  toggleButtonText: {
    color: Colors.white,
    fontSize: 14,
  },
  viewMore: {
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default HomeScreen;
