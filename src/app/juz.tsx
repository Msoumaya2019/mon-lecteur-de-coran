/**
 * Les 30 juz, en grille.
 *
 * Aucune requete reseau : le juz de chaque page est porte par les metriques
 * locales (`metriques.ts`), et la premiere page ou un juz apparait est son
 * debut. L'ecran s'ouvre donc instantanement, meme hors ligne — et il n'y a
 * aucune table a tenir a jour quand l'API evolue.
 *
 * Un toucher ouvre la page du moushaf ou le juz commence. Pas d'ecran
 * intermediaire : c'est le moushaf qu'on vient lire.
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { enChiffresArabes } from '@/lib/verset';
import { chargerJuz } from '@/services/mushaf/juz';
import type { Juz } from '@/types/coran';

export default function EcranJuz() {
  const router = useRouter();
  const juz = useMemo(() => chargerJuz(), []);

  return (
    <View style={styles.ecran}>
      <FlatList
        data={juz}
        keyExtractor={(item) => String(item.numero)}
        numColumns={3}
        columnWrapperStyle={styles.rangee}
        contentContainerStyle={styles.liste}
        renderItem={({ item }) => (
          <CaseJuz juz={item} onPress={() => router.push(`/lire/${item.page}`)} />
        )}
      />
    </View>
  );
}

function CaseJuz({ juz, onPress }: { readonly juz: Juz; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Juz ${juz.numero}, a partir du verset ${juz.premierVerset}, page ${juz.page}`}
      style={({ pressed }) => [styles.case, pressed ? styles.pressee : null]}
    >
      <Text style={styles.medaillon} allowFontScaling={false}>
        {enChiffresArabes(juz.numero)}
      </Text>
      <Text style={styles.titre}>Juz {juz.numero}</Text>
      <Text style={styles.page}>{`Page ${juz.page}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  liste: {
    padding: espaces.l,
    gap: espaces.m,
  },
  rangee: {
    gap: espaces.m,
  },
  case: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espaces.l,
    borderRadius: rayons.m,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  pressee: {
    opacity: 0.55,
  },
  medaillon: {
    fontFamily: AMIRI_QURAN,
    fontSize: 26,
    color: couleurs.or,
  },
  titre: {
    marginTop: espaces.xs,
    fontSize: 13,
    fontWeight: '700',
    color: couleurs.texte,
  },
  page: {
    marginTop: 1,
    fontSize: 11,
    color: couleurs.texteTerni,
  },
});
