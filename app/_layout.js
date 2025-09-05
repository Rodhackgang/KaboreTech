import { Stack } from "expo-router";
import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import Toast from 'react-native-toast-message';

export default function RootLayout() {
  useEffect(() => {
    const handleScreenCapture = async () => {
      try {
        const res = await fetch('https://kaboretech.cursusbf.com/api/screen-capture');
        const { allowScreenCapture } = await res.json();

        if (allowScreenCapture === false) {
          await ScreenCapture.preventScreenCaptureAsync();
          Toast.show({
            type: 'info',
            text1: 'Sécurité activée',
            text2: 'Les captures d’écran sont bloquées.',
          });
        } else {
          await ScreenCapture.allowScreenCaptureAsync();
          Toast.show({
            type: 'info',
            text1: 'Sécurité désactivée',
            text2: 'Les captures d’écran sont autorisées.',
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Erreur serveur',
          text2: "Impossible de récupérer l'état de sécurité",
        });
      }
    };

    handleScreenCapture();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}
