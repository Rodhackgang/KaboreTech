import {AnimationObject} from 'lottie-react-native';

export interface OnboardingData {
  id: number;
  animation: AnimationObject;
  text: string;
  textColor: string;
  backgroundColor: string;
}

const data: OnboardingData[] = [
  {
    id: 1,
    animation: require('../assets/animations/Lottie1.json'),
    text: 'Rejoignez KaboreTech pour des formations pratiques en informatique, marketing digital et maintenance des systèmes, accessibles en ligne et en présentiel.',
    textColor: '#005b4f',
    backgroundColor: '#ffa3ce',
  },
  {
    id: 2,
    animation: require('../assets/animations/Lottie2.json'),
    text: 'Apprenez des compétences en maintenance informatique et réparation de téléphones, avec des formations certifiées et un accompagnement personnalisé.',
    textColor: '#1e2169',
    backgroundColor: '#bae4fd',
  },
  {
    id: 3,
    animation: require('../assets/animations/Lottie3.json'),
    text: 'Découvrez nos formations en électricité, bâtiment et énergie solaire pour contribuer à un avenir plus durable.',
    textColor: '#F15937',
    backgroundColor: '#faeb8a',
  },
];

export default data;
