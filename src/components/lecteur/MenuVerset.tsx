/**
 * Menu d'un verset.
 *
 * Le cahier des charges est explicite : « eviter les menus lourds ». D'ou une
 * feuille courte, ou chaque action tient sur une ligne avec son icone, et ou
 * rien n'est grise ni cache derriere un sous-menu. Six actions, pas une de plus.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EnTeteFeuille } from '@/components/ui/Commandes';
import { FeuilleBasse } from '@/components/ui/FeuilleBasse';
import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { CleVerset } from '@/types/coran';

type NomIcone = keyof typeof Ionicons.glyphMap;

interface Action {
  readonly icone: NomIcone;
  readonly libelle: string;
  readonly detail?: string;
  readonly onPress: () => void;
  readonly actif?: boolean;
}

interface Props {
  readonly visible: boolean;
  readonly onFermer: () => void;
  readonly verset: CleVerset | null;
  readonly libelleSourate: string;
  readonly estFavori: boolean;
  readonly estDerniereLecture: boolean;
  readonly onEcouter: () => void;
  readonly onTraduire: () => void;
  readonly onRepeterCeVerset: () => void;
  readonly onRepeterJusquIci: () => void;
  readonly onBasculerFavori: () => void;
  readonly onMarquerDerniereLecture: () => void;
}

export function MenuVerset({
  visible,
  onFermer,
  verset,
  libelleSourate,
  estFavori,
  estDerniereLecture,
  onEcouter,
  onTraduire,
  onRepeterCeVerset,
  onRepeterJusquIci,
  onBasculerFavori,
  onMarquerDerniereLecture,
}: Props) {
  const actions: readonly Action[] = [
    { icone: 'headset', libelle: 'Écouter ce verset', onPress: onEcouter },
    { icone: 'language', libelle: 'Afficher la traduction', onPress: onTraduire },
    {
      icone: 'repeat',
      libelle: 'Répéter ce verset',
      detail: 'selon le nombre choisi dans la feuille audio',
      onPress: onRepeterCeVerset,
    },
    {
      icone: 'git-compare-outline',
      libelle: 'Répéter depuis le début de la page',
      detail: 'le passage sera répété en entier',
      onPress: onRepeterJusquIci,
    },
    {
      icone: estFavori ? 'star' : 'star-outline',
      libelle: estFavori ? 'Retirer des favoris' : 'Ajouter aux favoris',
      onPress: onBasculerFavori,
      actif: estFavori,
    },
    {
      icone: 'bookmark-outline',
      libelle: estDerniereLecture
        ? 'C’est votre dernière lecture'
        : 'Marquer comme dernière lecture',
      onPress: onMarquerDerniereLecture,
      actif: estDerniereLecture,
    },
  ];

  return (
    <FeuilleBasse visible={visible} onFermer={onFermer} hauteurMax={0.5}>
      <EnTeteFeuille
        titre={verset ?? 'Verset'}
        sousTitre={libelleSourate}
        onFermer={onFermer}
      />
      <View>
        {actions.map((action) => (
          <Pressable
            key={action.libelle}
            onPress={action.onPress}
            style={({ pressed }) => [styles.ligne, pressed ? styles.lignePressee : null]}
          >
            <View style={[styles.icone, action.actif ? styles.iconeActive : null]}>
              <Ionicons
                name={action.icone}
                size={18}
                color={action.actif ? couleurs.papier : couleurs.vert}
              />
            </View>
            <View style={styles.textes}>
              <Text style={styles.libelle}>{action.libelle}</Text>
              {action.detail ? <Text style={styles.detail}>{action.detail}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </FeuilleBasse>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    paddingVertical: espaces.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.filet,
  },
  lignePressee: {
    opacity: 0.55,
  },
  icone: {
    width: 34,
    height: 34,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.surfaceDouce,
  },
  iconeActive: {
    backgroundColor: couleurs.vert,
  },
  textes: {
    flex: 1,
  },
  libelle: {
    fontSize: 15,
    color: couleurs.texte,
  },
  detail: {
    fontSize: 12,
    color: couleurs.texteTerni,
    marginTop: 1,
  },
});
