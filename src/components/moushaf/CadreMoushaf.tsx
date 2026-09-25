/**
 * Le cadre de la page : ce qui fait qu'on croit tenir un Coran papier.
 *
 * Le moushaf de Medine est encadre d'un filet dore double, avec des ornements
 * aux angles et le numero de page dans un medaillon au centre du bas. Rien de
 * tout cela ne vient des donnees : c'est du dessin, et il est fait ici avec des
 * vues plutot qu'avec des images, pour rester net a toutes les densites d'ecran
 * sans embarquer un seul octet de bitmap.
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AMIRI_QURAN } from '@/constants/polices';
import { couleurs, espaces } from '@/constants/theme';
import { enChiffresArabes } from '@/lib/verset';

interface Props {
  readonly numeroPage: number;
  readonly juz: number;
  readonly children: React.ReactNode;
  readonly style?: ViewStyle;
}

export function CadreMoushaf({ numeroPage, juz, children, style }: Props) {
  return (
    <View style={[styles.cadre, style]}>
      <View style={styles.filetExterieur}>
        <View style={styles.filetInterieur}>
          <View style={styles.contenu}>{children}</View>

          {/* Numero de page, dans un medaillon pose sur le filet du bas. */}
          <View style={styles.medaillon}>
            <View style={styles.medaillonInterieur}>
              <Text style={styles.numeroPage}>{enChiffresArabes(numeroPage)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Mention du juz, tres discrete, dans l'angle. */}
      <Text style={styles.mentionJuz}>
        {`الجزء ${enChiffresArabes(juz)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    flex: 1,
    backgroundColor: couleurs.papier,
  },
  filetExterieur: {
    flex: 1,
    margin: espaces.s,
    borderWidth: 2,
    borderColor: couleurs.or,
    borderRadius: 4,
    padding: 3,
  },
  filetInterieur: {
    flex: 1,
    borderWidth: 1,
    borderColor: couleurs.orClair,
    borderRadius: 2,
    paddingHorizontal: espaces.m,
    paddingTop: espaces.s,
    paddingBottom: espaces.xl,
  },
  contenu: {
    flex: 1,
  },
  medaillon: {
    position: 'absolute',
    bottom: -11,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  medaillonInterieur: {
    minWidth: 40,
    paddingHorizontal: espaces.s,
    paddingVertical: 1,
    backgroundColor: couleurs.papier,
    borderWidth: 1,
    borderColor: couleurs.or,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroPage: {
    fontFamily: AMIRI_QURAN,
    fontSize: 13,
    lineHeight: 18,
    color: couleurs.vert,
  },
  mentionJuz: {
    position: 'absolute',
    bottom: 2,
    left: espaces.l,
    fontFamily: AMIRI_QURAN,
    fontSize: 11,
    color: couleurs.texteTerni,
  },
});
