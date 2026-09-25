/**
 * Petites commandes d'interface, dessinees avec des vues.
 *
 * Elles sont volontairement minuscules : l'exigence est que le moushaf reste
 * prioritaire, et une pastille de 34 points posee dans un coin ne prend pas
 * l'attention qu'une barre d'outils prendrait. La zone tactile, elle, est
 * etendue a 48 points par `hitSlop` — on garde la discretion sans sacrifier
 * l'usage.
 */

import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces, rayons } from '@/constants/theme';

type NomIcone = keyof typeof Ionicons.glyphMap;

interface BoutonFlottantProps {
  readonly icone: NomIcone;
  readonly onPress: () => void;
  readonly libelle: string;
  readonly actif?: boolean;
  readonly chargement?: boolean;
}

/** Pastille ronde, legerement translucide, posee dans un coin de la page. */
export function BoutonFlottant({
  icone,
  onPress,
  libelle,
  actif = false,
  chargement = false,
}: BoutonFlottantProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      style={({ pressed }) => [
        styles.pastille,
        actif ? styles.pastilleActive : null,
        pressed ? styles.pastillePressee : null,
      ]}
    >
      {chargement ? (
        <ActivityIndicator size="small" color={actif ? couleurs.papier : couleurs.vert} />
      ) : (
        <Ionicons
          name={icone}
          size={18}
          color={actif ? couleurs.papier : couleurs.vert}
        />
      )}
    </Pressable>
  );
}

interface BoutonIconeProps {
  readonly icone: NomIcone;
  readonly onPress: () => void;
  readonly libelle: string;
  readonly taille?: number;
  readonly couleur?: string;
  readonly desactive?: boolean;
  readonly actif?: boolean;
}

/** Bouton d'icone nu, pour les feuilles basses. */
export function BoutonIcone({
  icone,
  onPress,
  libelle,
  taille = 24,
  couleur = couleurs.vert,
  desactive = false,
  actif = false,
}: BoutonIconeProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      style={({ pressed }) => [
        styles.boutonIcone,
        actif ? styles.boutonIconeActif : null,
        pressed || desactive ? styles.pastillePressee : null,
      ]}
    >
      <Ionicons
        name={icone}
        size={taille}
        color={desactive ? couleurs.texteTerni : actif ? couleurs.papier : couleur}
      />
    </Pressable>
  );
}

/** Grand bouton de lecture, celui de la feuille audio. */
export function BoutonLecture({
  enLecture,
  chargement,
  onPress,
}: {
  readonly enLecture: boolean;
  readonly chargement: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={enLecture ? 'Mettre en pause' : 'Lire'}
      style={({ pressed }) => [styles.lecture, pressed ? styles.pastillePressee : null]}
    >
      {chargement ? (
        <ActivityIndicator size="small" color={couleurs.papier} />
      ) : (
        <Ionicons name={enLecture ? 'pause' : 'play'} size={26} color={couleurs.papier} />
      )}
    </Pressable>
  );
}

interface PuceProps {
  readonly libelle: string;
  readonly actif?: boolean;
  readonly onPress: () => void;
}

/** Petite puce de choix, pour les repetitions. */
export function Puce({ libelle, actif = false, onPress }: PuceProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={({ pressed }) => [
        styles.puce,
        actif ? styles.puceActive : null,
        pressed ? styles.pastillePressee : null,
      ]}
    >
      <Text style={[styles.puceTexte, actif ? styles.puceTexteActif : null]}>
        {libelle}
      </Text>
    </Pressable>
  );
}

/** Etat vide, sobre, avec une seule ligne d'explication. */
export function EtatVide({ texte, icone }: { texte: string; icone: NomIcone }) {
  return (
    <View style={styles.vide}>
      <Ionicons name={icone} size={30} color={couleurs.texteTerni} />
      <Text style={styles.videTexte}>{texte}</Text>
    </View>
  );
}

/** En-tete de feuille basse : titre, sous-titre, bouton de fermeture. */
export function EnTeteFeuille({
  titre,
  sousTitre,
  onFermer,
  actionDroite,
}: {
  readonly titre: string;
  readonly sousTitre?: string;
  readonly onFermer: () => void;
  readonly actionDroite?: React.ReactNode;
}) {
  return (
    <View style={styles.entete}>
      <View style={styles.enteteTextes}>
        <Text style={styles.enteteTitre} numberOfLines={1}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text style={styles.enteteSousTitre} numberOfLines={1}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      {actionDroite}
      <BoutonIcone icone="close" onPress={onFermer} libelle="Fermer" taille={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  pastille: {
    width: 38,
    height: 38,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 251, 244, 0.86)',
    borderWidth: 1,
    borderColor: couleurs.filet,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pastilleActive: {
    backgroundColor: couleurs.vert,
    borderColor: couleurs.vert,
  },
  pastillePressee: {
    opacity: 0.6,
  },
  boutonIcone: {
    width: 40,
    height: 40,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonIconeActif: {
    backgroundColor: couleurs.vert,
  },
  lecture: {
    width: 54,
    height: 54,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.vert,
  },
  puce: {
    paddingHorizontal: espaces.m,
    paddingVertical: 6,
    borderRadius: rayons.rond,
    borderWidth: 1,
    borderColor: couleurs.filet,
    backgroundColor: couleurs.surface,
  },
  puceActive: {
    backgroundColor: couleurs.vert,
    borderColor: couleurs.vert,
  },
  puceTexte: {
    fontSize: 13,
    color: couleurs.texteSecondaire,
    fontWeight: '600',
  },
  puceTexteActif: {
    color: couleurs.papier,
  },
  vide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espaces.xxl,
    gap: espaces.m,
  },
  videTexte: {
    fontSize: 14,
    color: couleurs.texteSecondaire,
    textAlign: 'center',
    paddingHorizontal: espaces.xl,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingBottom: espaces.m,
  },
  enteteTextes: {
    flex: 1,
  },
  enteteTitre: {
    fontSize: 15,
    fontWeight: '700',
    color: couleurs.texte,
  },
  enteteSousTitre: {
    fontFamily: AMIRI_QURAN,
    fontSize: 13,
    color: couleurs.texteSecondaire,
    marginTop: 1,
  },
});
