/**
 * Une page complete du moushaf.
 *
 * La geometrie suit celle de l'imprime : **quinze lignes**, toujours, meme
 * lorsqu'une sourate commence en haut de page — les emplacements liberes par le
 * bandeau et la basmala restent des emplacements, et les lignes de texte gardent
 * leur rang. C'est ce qui fait qu'une page tourne sans que le texte ne saute.
 *
 * Les lignes sont posees en absolu, a partir de la hauteur reellement mesuree.
 * Un `justifyContent` repartirait la place restante et ferait deriver les rangs.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { EnTeteSourate } from '@/components/moushaf/EnTeteSourate';
import { LigneMoushaf } from '@/components/moushaf/LigneMoushaf';
import { AMIRI_QURAN } from '@/constants/polices';
import { LIGNES_PAR_PAGE, couleurs, espaces } from '@/constants/theme';
import { taillePolicePage } from '@/lib/composition';
import type { CleVerset, PageMoushaf as TypePage } from '@/types/coran';

interface Props {
  readonly page: TypePage;
  /** Nom de famille de la police de page, ou `null` tant qu'elle n'est pas prete. */
  readonly famillePolice: string | null;
  readonly nomSourate: (numeroSourate: number) => string;
  readonly versetSurligne: CleVerset | null;
  readonly versetSelectionne: CleVerset | null;
  readonly onAppuiVerset: (cle: CleVerset) => void;
  readonly onAppuiFond: () => void;
}

export function PageMoushaf({
  page,
  famillePolice,
  nomSourate,
  versetSurligne,
  versetSelectionne,
  onAppuiVerset,
  onAppuiFond,
}: Props) {
  const [taille, setTaille] = useState({ largeur: 0, hauteur: 0 });

  const surMesure = (evenement: LayoutChangeEvent) => {
    const { width, height } = evenement.nativeEvent.layout;
    setTaille((actuelle) =>
      actuelle.largeur === width && actuelle.hauteur === height
        ? actuelle
        : { largeur: width, hauteur: height },
    );
  };

  const hauteurLigne = taille.hauteur > 0 ? taille.hauteur / LIGNES_PAR_PAGE : 0;
  const largeurLigne = Math.max(0, taille.largeur - espaces.s);

  // Une seule taille de police pour la page entiere — c'est celle que le
  // calligraphe a donnee a ses quinze lignes (mesure : 2,2 % d'ecart sur la page
  // 3). La calculer ligne par ligne, comme on le faisait, grossissait les lignes
  // courtes jusqu'a les faire deborder : 63 pt sur la page 2 pour une hauteur de
  // ligne de 47 pt.
  const taillePolice = useMemo(
    () => taillePolicePage(Object.values(page.avances), page.upem, largeurLigne),
    [page.avances, page.upem, largeurLigne],
  );

  // Ou commence une sourate sur cette page ?
  //
  // Le verset d'ouverture et sa ligne sont tenus dans un seul objet nullable,
  // volontairement : deux valeurs separees obligeraient le rendu a supposer que
  // l'une accompagne l'autre, et une page sans ouverture de sourate produirait
  // alors une lecture sur `null`.
  const ouverture = (() => {
    const verset = page.versets.find((v) => v.numero === 1);
    const ligne = verset?.lignes[0];
    return verset && ligne !== undefined ? { verset, ligne } : null;
  })();

  const sourateEnHautDePage = ouverture !== null && ouverture.ligne > 1;
  const sourateAuMilieu =
    ouverture !== null && ouverture.ligne > 3 && ouverture.verset !== page.versets[0];

  return (
    <Pressable style={styles.page} onLayout={surMesure} onPress={onAppuiFond}>
      {taille.hauteur > 0 && famillePolice
        ? page.lignes.map((ligne) => (
            <View
              key={ligne.numero}
              style={[
                styles.emplacement,
                {
                  top: (ligne.numero - 1) * hauteurLigne,
                  height: hauteurLigne,
                },
              ]}
            >
              <LigneMoushaf
                segments={ligne.segments}
                famillePolice={famillePolice}
                upem={page.upem}
                avance={page.avances[ligne.numero] ?? 0}
                largeur={largeurLigne}
                taillePolice={taillePolice}
                hauteurLigne={hauteurLigne * 0.92}
                versetSurligne={versetSurligne}
                versetSelectionne={versetSelectionne}
                onAppuiVerset={onAppuiVerset}
              />
            </View>
          ))
        : null}

      {/* Sourate qui commence en haut de page : le bandeau occupe les
          emplacements laisses libres avant la premiere ligne de texte. */}
      {sourateEnHautDePage && ouverture !== null && famillePolice ? (
        <View
          style={[
            styles.bandeauHaut,
            { height: (ouverture.ligne - 1) * hauteurLigne, top: 0 },
          ]}
          pointerEvents="none"
        >
          <EnTeteSourate
            numero={ouverture.verset.sourate}
            nomArabe={nomSourate(ouverture.verset.sourate)}
            hauteur={(ouverture.ligne - 1) * hauteurLigne}
            tailleNom={Math.min(26, hauteurLigne * 0.85)}
          />
        </View>
      ) : null}

      {/* Sourate qui commence au milieu de la page : le bandeau se pose sur la
          jointure entre la ligne precedente et la premiere ligne du nouveau
          texte, comme sur le papier. */}
      {sourateAuMilieu && ouverture !== null && famillePolice ? (
        <View
          style={[
            styles.bandeauMilieu,
            {
              top: (ouverture.ligne - 1.35) * hauteurLigne,
              height: hauteurLigne * 0.95,
            },
          ]}
          pointerEvents="none"
        >
          <EnTeteSourate
            numero={ouverture.verset.sourate}
            nomArabe={nomSourate(ouverture.verset.sourate)}
            hauteur={hauteurLigne * 0.95}
            tailleNom={Math.min(22, hauteurLigne * 0.72)}
          />
        </View>
      ) : null}

      {/* Tant que la police de la page n'est pas prete, on le dit sans crier. */}
      {!famillePolice ? (
        <View style={styles.attente} pointerEvents="none">
          <Text style={styles.attenteTexte}>Préparation de la page…</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    position: 'relative',
    backgroundColor: couleurs.papier,
  },
  emplacement: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  bandeauHaut: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  bandeauMilieu: {
    position: 'absolute',
    left: espaces.m,
    right: espaces.m,
    justifyContent: 'center',
    backgroundColor: couleurs.papier,
  },
  attente: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attenteTexte: {
    fontFamily: AMIRI_QURAN,
    fontSize: 14,
    color: couleurs.texteTerni,
  },
});
