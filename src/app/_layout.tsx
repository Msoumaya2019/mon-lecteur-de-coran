/**
 * Pile racine de l'application.
 *
 * Les ecrans de lecture et de navigation sont declares ici : sans entree
 * explicite, une route herite d'un en-tete masque et l'utilisateur se retrouve
 * sans moyen de revenir. Les polices embarquees sont chargees avant le premier
 * rendu, et l'ecran de demarrage reste visible jusque-la — sinon on voit la page
 * se composer deux fois, une fois sans sa police.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs } from '@/constants/theme';
import { PreferencesProvider } from '@/store/PreferencesProvider';

void SplashScreen.preventAutoHideAsync();

const EN_TETE = {
  headerStyle: { backgroundColor: couleurs.fond },
  headerTintColor: couleurs.vert,
  headerTitleStyle: { color: couleurs.texte, fontWeight: '600' as const },
  headerShadowVisible: false,
};

export default function DispositionRacine() {
  const [policesPretes, setPolicesPretes] = useState(false);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const { loadAsync } = await import('expo-font');
        await loadAsync({
          [AMIRI_QURAN]: require('../../assets/polices/AmiriQuran-Regular.ttf'),
        });
      } catch {
        // Sans elle, l'arabe d'interface et la basmala s'affichent dans la
        // police systeme : degrade, mais lisible.
      }
      if (vivant) {
        setPolicesPretes(true);
        void SplashScreen.hideAsync();
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  if (!policesPretes) {
    return <View style={{ flex: 1, backgroundColor: couleurs.papier }} />;
  }

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <Stack
          screenOptions={{
            ...EN_TETE,
            contentStyle: { backgroundColor: couleurs.fond },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sourates" options={{ title: 'Sourates' }} />
          <Stack.Screen name="juz" options={{ title: 'Juz' }} />
          <Stack.Screen name="favoris" options={{ title: 'Favoris' }} />
          <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
          {/* Le lecteur occupe l'ecran : aucun en-tete, aucune barre. */}
          <Stack.Screen
            name="lire/[page]"
            options={{ headerShown: false, animation: 'fade' }}
          />
        </Stack>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
