/**
 * Le bandeau qui separe deux sourates.
 *
 * Le moushaf de Medine marque le debut d'une sourate par un bandeau ornemental
 * portant son nom, encadre d'un filet dore. Ce bandeau ne vient d'aucune donnee
 * — la police de page ne contient que les glyphes des mots, verifie sur les
 * pages 1, 2, 50 et 604 : son nombre de glyphes egale exactement le nombre de
 * codes utilises par les mots. Il est donc dessine ici, et le nom de la sourate
 * est compose dans une police uthmani libre.
 */

import { StyleSheet, Text, View } from 'react-native';

import { AMIRI_QURAN, BASMALA, aUneBasmala } from '@/constants/polices';
import { couleurs, espaces } from '@/constants/theme';

interface Props {
  readonly numero: number;
  readonly nomArabe: string;
  /** Hauteur allouee au bandeau. */
  readonly hauteur: number;
  /** Afficher la basmala sous le nom — faux quand la sourate n'en a pas. */
  readonly avecBasmala?: boolean;
  /** Taille du nom, adaptee a la place disponible. */
  readonly tailleNom?: number;
}

export function EnTeteSourate({
  numero,
  nomArabe,
  hauteur,
  avecBasmala = true,
  tailleNom,
}: Props) {
  const montrerBasmala = avecBasmala && aUneBasmala(numero);
  const taille = tailleNom ?? Math.max(15, Math.min(24, hauteur * 0.30));

  return (
    <View style={[styles.bloc, { height: hauteur }]}>
      <View style={styles.bandeau}>
        <View style={styles.filet} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.nom, { fontSize: taille, lineHeight: taille * 1.5 }]}
        >
          {`سُورَةُ ${nomArabe}`}
        </Text>
        <View style={styles.filet} />
      </View>

      {montrerBasmala ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.basmala, { fontSize: taille * 0.92, lineHeight: taille * 1.6 }]}
        >
          {BASMALA}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espaces.s,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: couleurs.or,
    backgroundColor: couleurs.surfaceDouce,
    borderRadius: 3,
    paddingVertical: 1,
  },
  filet: {
    flex: 1,
    height: 1,
    backgroundColor: couleurs.orClair,
  },
  nom: {
    fontFamily: AMIRI_QURAN,
    color: couleurs.vert,
    marginHorizontal: espaces.m,
    textAlign: 'center',
  },
  basmala: {
    fontFamily: AMIRI_QURAN,
    color: couleurs.texte,
    textAlign: 'center',
    marginTop: 2,
  },
});
