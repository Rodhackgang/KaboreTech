import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../app/Homescreen';
import DetailFormation from '../app/DetailFormation';
import Proposition from '../app/Proposition'
import Recherche from '../app/Recherche'


const Stack = createStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="DetailFormation" component={DetailFormation} />
      <Stack.Screen name="Proposition" component={Proposition} />
      <Stack.Screen name="Recherche" component={Recherche} />
    </Stack.Navigator>
  );
};

export default HomeStack;
