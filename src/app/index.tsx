/**
 * Accueil.
 *
 * Volontairement pauvre : un titre, la reprise de lecture, trois acces. Le
 * cahier des charges est explicite — « ne surcharge pas cet ecran ». Tout ce qui
 * n'aide pas a ouvrir le Coran en un geste est ailleurs.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { chargerPage } from '@/services/quran/pages';
import { chargerSourates } from '@/services/quran/sourates';
import { chargerDerniereLecture } from '@/services/storage/preferences';
import type { PositionLecture } from '@/types/coran';

type NomIcone = keyof typeof Ionicons.glyphMap;

interface Acces {
  readonly icone: NomIcone;
  readonly titre: string;
  readonly detail: string;
  readonly chemin: '/sourates' | '/juz' | '/favoris';
}

const ACCES: readonly Acces[] = [
  { icone: 'list-outline', titre: 'Sourates', detail: 'Les 114 sourates', chemin: '/sourates' },
  { icone: 'albums-outline', titre: 'Juz', detail: 'Les 30 parties', chemin: '/juz' },
  { icone: 'star-outline', titre: 'Favoris', detail: 'Vos repères', chemin: '/favoris' },
];

export default function Accueil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [derniere, setDerniere] = useState<PositionLecture | null>(null);
  const [libelle, setLibelle] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void (async () => {
        const position = await chargerDerniereLecture();
        if (!vivant) {
          return;
        }
        setDerniere(position);
        if (!position) {
          setLibelle('');
          return;
        }
        try {
          const [page, sourates] = await Promise.all([
            chargerPage(position.page),
            chargerSourates(),
          ]);
          if (!vivant) {
            return;
          }
          const numeros = [...new Set(page.versets.map((v) => v.sourate))];
          const noms = numeros
            .map((numero) => sourates.find((s) => s.numero === numero)?.nomSimple ?? '')
            .filter(Boolean)
            .join(' · ');
          setLibelle(noms);
        } catch {
          if (vivant) {
            setLibelle('');
          }
        }
      })();
      return () => {
        vivant = false;
      };
    }, []),
  );

  return (
    <ScrollView
      style={styles.ecran}
      contentContainerStyle={[
        styles.contenu,
        { paddingTop: insets.top + espaces.xl, paddingBottom: espaces.xxl },
      ]}
    >
      <View style={styles.entete}>
        <View style={styles.enteteTextes}>
          <Text style={styles.titre}>Mon lecteur de Coran</Text>
          <Text style={styles.sousTitre} allowFontScaling={false}>
            المُصحَف الشَّريف
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/reglages')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Réglages"
          style={styles.boutonReglages}
        >
          <Ionicons name="options-outline" size={20} color={couleurs.vert} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push(`/lire/${derniere?.page ?? 1}`)}
        style={({ pressed }) => [styles.reprise, pressed ? styles.presse : null]}
      >
        <View style={styles.repriseIcone}>
          <Ionicons name="book-outline" size={22} color={couleurs.papier} />
        </View>
        <View style={styles.repriseTextes}>
          <Text style={styles.repriseTitre}>Continuer ma lecture</Text>
          <Text style={styles.repriseDetail}>
            {derniere
              ? `Page ${derniere.page}${libelle ? ` · ${libelle}` : ''}`
              : 'Commencer par la première page'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={couleurs.texteTerni} />
      </Pressable>

      <View style={styles.acces}>
        {ACCES.map((acces) => (
          <Pressable
            key={acces.chemin}
            onPress={() => router.push(acces.chemin)}
            style={({ pressed }) => [styles.carte, pressed ? styles.presse : null]}
          >
            <Ionicons name={acces.icone} size={20} color={couleurs.vert} />
            <Text style={styles.carteTitre}>{acces.titre}</Text>
            <Text style={styles.carteDetail}>{acces.detail}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        Lecture du Mushaf de Médine, page pour page, verset par verset.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  contenu: {
    paddingHorizontal: espaces.l,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: espaces.xl,
  },
  enteteTextes: {
    flex: 1,
  },
  titre: {
    fontSize: 24,
    fontWeight: '700',
    color: couleurs.texte,
    letterSpacing: -0.3,
  },
  sousTitre: {
    fontFamily: AMIRI_QURAN,
    fontSize: 20,
    color: couleurs.vert,
    marginTop: espaces.xs,
  },
  boutonReglages: {
    width: 38,
    height: 38,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  reprise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    backgroundColor: couleurs.surface,
    borderRadius: rayons.l,
    padding: espaces.l,
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  repriseIcone: {
    width: 44,
    height: 44,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.vert,
  },
  repriseTextes: {
    flex: 1,
  },
  repriseTitre: {
    fontSize: 16,
    fontWeight: '700',
    color: couleurs.texte,
  },
  repriseDetail: {
    fontSize: 13,
    color: couleurs.texteSecondaire,
    marginTop: 2,
  },
  acces: {
    flexDirection: 'row',
    gap: espaces.m,
    marginTop: espaces.l,
  },
  carte: {
    flex: 1,
    backgroundColor: couleurs.surface,
    borderRadius: rayons.m,
    padding: espaces.m,
    borderWidth: 1,
    borderColor: couleurs.filet,
    gap: espaces.s,
  },
  carteTitre: {
    fontSize: 14,
    fontWeight: '700',
    color: couleurs.texte,
  },
  carteDetail: {
    fontSize: 11,
    color: couleurs.texteTerni,
  },
  presse: {
    opacity: 0.6,
  },
  note: {
    marginTop: espaces.xl,
    fontSize: 12,
    color: couleurs.texteTerni,
    textAlign: 'center',
  },
});
