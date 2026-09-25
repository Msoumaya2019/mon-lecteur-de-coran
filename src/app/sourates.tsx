/**
 * Liste des sourates, avec recherche.
 *
 * Un toucher ouvre directement la page du moushaf ou la sourate commence — pas
 * un ecran intermediaire, pas un sommaire de versets : l'utilisateur veut lire,
 * pas naviguer.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EtatVide } from '@/components/ui/Commandes';
import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { useRequete } from '@/hooks/useRequete';
import { chargerSourates, filtrerSourates } from '@/services/quran/sourates';
import type { Sourate } from '@/types/coran';

export default function EcranSourates() {
  const router = useRouter();
  const [recherche, setRecherche] = useState('');
  const { etat, recharger } = useRequete('sourates', () => chargerSourates());

  const sourates = etat.statut === 'pret' ? etat.donnees : [];
  const filtrees = useMemo(
    () => filtrerSourates(sourates, recherche),
    [sourates, recherche],
  );

  if (etat.statut === 'chargement') {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={couleurs.vert} />
      </View>
    );
  }

  if (etat.statut === 'erreur') {
    return (
      <View style={styles.centre}>
        <EtatVide icone="cloud-offline-outline" texte={etat.message} />
        <Pressable onPress={recharger} style={styles.reessayer}>
          <Text style={styles.reessayerTexte}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.ecran}>
      <View style={styles.recherche}>
        <Ionicons name="search" size={16} color={couleurs.texteTerni} />
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Numéro, nom ou traduction"
          placeholderTextColor={couleurs.texteTerni}
          style={styles.champ}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtrees}
        keyExtractor={(item) => String(item.numero)}
        contentContainerStyle={styles.liste}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EtatVide icone="search-outline" texte="Aucune sourate ne correspond." />
        }
        renderItem={({ item }) => <LigneSourate sourate={item} onPress={ouvrir(router, item)} />}
      />
    </View>
  );
}

function ouvrir(router: ReturnType<typeof useRouter>, sourate: Sourate) {
  return () => router.push(`/lire/${sourate.premierePage}`);
}

function LigneSourate({
  sourate,
  onPress,
}: {
  readonly sourate: Sourate;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, pressed ? styles.pressee : null]}
    >
      <View style={styles.numero}>
        <Text style={styles.numeroTexte}>{sourate.numero}</Text>
      </View>
      <View style={styles.textes}>
        <Text style={styles.nomTraduit}>{sourate.nomTraduit}</Text>
        <Text style={styles.nomSimple}>
          {`${sourate.nomSimple} · ${sourate.versets} versets · ${
            sourate.lieuRevelation === 'makkah' ? 'Mecquoise' : 'Médinoise'
          }`}
        </Text>
      </View>
      <Text style={styles.nomArabe} allowFontScaling={false}>
        {sourate.nomArabe}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.fond,
    padding: espaces.xl,
  },
  recherche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    margin: espaces.l,
    paddingHorizontal: espaces.m,
    height: 40,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  champ: {
    flex: 1,
    fontSize: 14,
    color: couleurs.texte,
    paddingVertical: 0,
  },
  liste: {
    paddingHorizontal: espaces.l,
    paddingBottom: espaces.xl,
    flexGrow: 1,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    paddingVertical: espaces.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.filet,
  },
  pressee: {
    opacity: 0.55,
  },
  numero: {
    width: 32,
    height: 32,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surfaceDouce,
  },
  numeroTexte: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.vert,
  },
  textes: {
    flex: 1,
  },
  nomTraduit: {
    fontSize: 15,
    color: couleurs.texte,
    fontWeight: '600',
  },
  nomSimple: {
    fontSize: 12,
    color: couleurs.texteTerni,
    marginTop: 1,
  },
  nomArabe: {
    fontFamily: AMIRI_QURAN,
    fontSize: 19,
    color: couleurs.vert,
  },
  reessayer: {
    marginTop: espaces.l,
    paddingHorizontal: espaces.l,
    paddingVertical: espaces.s,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.vert,
  },
  reessayerTexte: {
    color: couleurs.papier,
    fontSize: 14,
    fontWeight: '600',
  },
});
