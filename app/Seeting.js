import { View, Text, StyleSheet } from 'react-native';
import React from 'react';
import MyHeader from '../components/MyHeader'; // Ensure that the path is correct
import Colors from '../constants/Colors'; // Assuming Colors is available

const Seeting = ({ navigation }) => {
  return (
    <View style={styles.container}>
      {/* Add the Header */}
      <MyHeader
        menu
        onPressMenu={() => navigation.goBack()}
        title="Paramètre"
        right="more-vertical"
        onRightPress={() => console.log('right')}
      />

      {/* Content of the screen */}
      <View style={styles.content}>
        <Text>Seeting</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Seeting;
