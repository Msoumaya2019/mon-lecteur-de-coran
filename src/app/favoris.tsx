/**
 * Favoris et marque-pages.
 *
 * Trois sortes d'entrees dans une seule liste — une page, un verset, une
 * sourate — parce que l'intention est une seule : « garder ceci pour y
 * revenir ». Trois ecrans pour trois formats de stockage auraient complique
 * l'usage sans rien apporter.
 *
 * Le verset est le seul cas qui demande le reseau : il faut connaitre sa page
 * pour ouvrir le moushaf. Une requete d'un verset, au toucher, seulement.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EtatVide } from '@/components/ui/Commandes';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { messageErreur } from '@/services/http';
import { versetParCle } from '@/services/quran/api';
import { chargerSourates } from '@/services/quran/sourates';
import { chargerFavoris, retirerFavori } from '@/services/storage/favoris';
import type { Favori, TypeFavori } from '@/types/coran';

type NomIcone = keyof typeof Ionicons.glyphMap;

const ICONE: Readonly<Record<TypeFavori, NomIcone>> = {
  page: 'document-text-outline',
  verset: 'bookmark-outline',
  sourate: 'library-outline',
};

const NOM_TYPE: Readonly<Record<TypeFavori, string>> = {
  page: 'Page',
  verset: 'Verset',
  sourate: 'Sourate',
};

export default function EcranFavoris() {
  const router = useRouter();
  const [favoris, setFavoris] = useState<readonly Favori[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  // Rechargement au retour sur l'ecran : un favori ajoute depuis le lecteur doit
  // apparaitre sans que l'utilisateur ait a relancer quoi que ce soit.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void (async () => {
        const lus = await chargerFavoris();
        if (vivant) {
          setFavoris(lus);
        }
      })();
      return () => {
        vivant = false;
      };
    }, []),
  );

  const retirer = useCallback(async (favori: Favori) => {
    const restants = await retirerFavori(favori.type, favori.valeur);
    setFavoris(restants);
  }, []);

  const ouvrir = useCallback(
    async (favori: Favori) => {
      setSouci(null);

      if (favori.type === 'page') {
        router.push(`/lire/${favori.valeur}`);
        return;
      }

      if (favori.type === 'sourate') {
        try {
          const sourates = await chargerSourates();
          const sourate = sourates.find((s) => String(s.numero) === favori.valeur);
          if (sourate) {
            router.push(`/lire/${sourate.premierePage}`);
          }
        } catch (erreur) {
          setSouci(messageErreur(erreur));
        }
        return;
      }

      // Un verset : sa page n'est pas connue hors ligne, on la demande.
      setEnCours(favori.valeur);
      try {
        const verset = await versetParCle(favori.valeur);
        if (verset?.page_number) {
          router.push(`/lire/${verset.page_number}`);
        } else {
          setSouci(`Page introuvable pour le verset ${favori.valeur}.`);
        }
      } catch (erreur) {
        setSouci(messageErreur(erreur));
      } finally {
        setEnCours(null);
      }
    },
    [router],
  );

  if (favoris === null) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={couleurs.vert} />
      </View>
    );
  }

  return (
    <View style={styles.ecran}>
      {souci ? (
        <View style={styles.bandeau}>
          <Ionicons name="cloud-offline-outline" size={15} color={couleurs.texteSecondaire} />
          <Text style={styles.bandeauTexte}>{souci}</Text>
        </View>
      ) : null}

      <FlatList
        data={favoris}
        keyExtractor={(item) => `${item.type}:${item.valeur}`}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          <EtatVide
            icone="bookmark-outline"
            texte="Aucun favori pour l'instant. Depuis une page, touchez un verset pour l'enregistrer."
          />
        }
        renderItem={({ item }) => (
          <LigneFavori
            favori={item}
            enCours={enCours === item.valeur}
            onOuvrir={() => void ouvrir(item)}
            onRetirer={() => void retirer(item)}
          />
        )}
      />
    </View>
  );
}

function LigneFavori({
  favori,
  enCours,
  onOuvrir,
  onRetirer,
}: {
  readonly favori: Favori;
  readonly enCours: boolean;
  readonly onOuvrir: () => void;
  readonly onRetirer: () => void;
}) {
  return (
    <View style={styles.ligne}>
      <Pressable
        onPress={onOuvrir}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir ${NOM_TYPE[favori.type]} ${favori.libelle}`}
        style={({ pressed }) => [styles.ouvrir, pressed ? styles.pressee : null]}
      >
        <View style={styles.pastille}>
          {enCours ? (
            <ActivityIndicator size="small" color={couleurs.vert} />
          ) : (
            <Ionicons name={ICONE[favori.type]} size={17} color={couleurs.vert} />
          )}
        </View>
        <View style={styles.textes}>
          <Text style={styles.libelle} numberOfLines={1}>
            {favori.libelle}
          </Text>
          <Text style={styles.type}>{NOM_TYPE[favori.type]}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onRetirer}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Retirer ${favori.libelle} des favoris`}
        style={({ pressed }) => [styles.retirer, pressed ? styles.pressee : null]}
      >
        <Ionicons name="trash-outline" size={17} color={couleurs.texteTerni} />
      </Pressable>
    </View>
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
  },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    marginHorizontal: espaces.l,
    marginTop: espaces.m,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    borderRadius: rayons.s,
    backgroundColor: couleurs.surfaceDouce,
  },
  bandeauTexte: {
    flex: 1,
    fontSize: 12,
    color: couleurs.texteSecondaire,
  },
  liste: {
    padding: espaces.l,
    paddingBottom: espaces.xl,
    flexGrow: 1,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.filet,
  },
  ouvrir: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    paddingVertical: espaces.m,
  },
  pressee: {
    opacity: 0.55,
  },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: rayons.s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surfaceDouce,
  },
  textes: {
    flex: 1,
  },
  libelle: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
  },
  type: {
    marginTop: 1,
    fontSize: 12,
    color: couleurs.texteTerni,
  },
  retirer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
