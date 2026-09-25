/**
 * Une ligne du moushaf.
 *
 * C'est ici que se joue la fidelite de la page. Trois decisions, et chacune
 * repond a une mesure :
 *
 *  1. **La taille de police est calculee, pas choisie.** L'avance de la ligne en
 *     unites de dessin est connue (metriques engendrees hors de l'application),
 *     le cadratin aussi. La taille qui fait tomber la ligne exactement sur la
 *     largeur disponible est donc `largeur x upem / avance`. Chaque ligne a
 *     ainsi sa propre taille, a 2 ou 3 % pres — et c'est exactement la
 *     justification du moushaf imprime, ou le calligraphe a lui-meme amene
 *     toutes les lignes a la meme mesure.
 *  2. **Le sens de lecture est impose.** `writingDirection: 'rtl'` sur le texte
 *     parent, et les segments dans l'ordre du fichier de disposition : le
 *     premier mot se pose a droite. Composer de gauche a droite donnerait une
 *     page miroir, parfaitement lisible pour qui ne lit pas l'arabe.
 *  3. **Le surlignage est un fond de texte, pas un cadre.** Un rectangle opaque
 *     denaturerait la page ; un fond vert tres clair, applique au seul segment
 *     concerne, laisse le trace intact.
 */

import { Fragment, memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { POLICE_SYSTEME } from '@/constants/polices';
import { couleurs } from '@/constants/theme';
import type { CleVerset, Segment } from '@/types/coran';

interface Props {
  readonly segments: readonly Segment[];
  readonly famillePolice: string;
  readonly upem: number;
  /** Avance de la ligne en unites de dessin. */
  readonly avance: number;
  /** Largeur disponible pour le texte, en points. */
  readonly largeur: number;
  readonly hauteurLigne: number;
  readonly versetSurligne: CleVerset | null;
  readonly versetSelectionne: CleVerset | null;
  readonly onAppuiVerset: (cle: CleVerset) => void;
}

function LigneMoushafBrute({
  segments,
  famillePolice,
  upem,
  avance,
  largeur,
  hauteurLigne,
  versetSurligne,
  versetSelectionne,
  onAppuiVerset,
}: Props) {
  if (segments.length === 0) {
    return null;
  }

  // La ligne est mise a l'echelle pour tomber pile sur la largeur disponible.
  const taille = avance > 0 ? (largeur * upem) / avance : hauteurLigne * 0.7;

  return (
    <Text
      numberOfLines={1}
      // `allowFontScaling` est desactive : la justification est calculee pour
      // une taille exacte, et une mise a l'echelle d'accessibilite la casserait
      // en faisant deborder la ligne hors du cadre. L'accessibilite de lecture
      // passe ici par le zoom de l'ecran, pas par le reglage de police.
      allowFontScaling={false}
      style={[
        styles.ligne,
        {
          fontFamily: famillePolice,
          fontSize: taille,
          lineHeight: hauteurLigne,
        },
      ]}
    >
      {segments.map((segment, indice) => (
        <Text
          key={`${segment.verset}-${segment.position}-${indice}`}
          onPress={() => onAppuiVerset(segment.verset)}
          suppressHighlighting
          style={[
            segment.verset === versetSurligne ? styles.surligne : null,
            segment.verset === versetSelectionne ? styles.selectionne : null,
          ]}
        >
          {segment.runs.map((run, rang) => (
            <Fragment key={rang}>
              {rang > 0 ? <Text style={styles.espace}>{' '}</Text> : null}
              {run}
            </Fragment>
          ))}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  ligne: {
    writingDirection: 'rtl',
    textAlign: 'center',
    color: couleurs.texte,
    includeFontPadding: false,
  },
  surligne: {
    backgroundColor: couleurs.surlignage,
  },
  selectionne: {
    backgroundColor: 'rgba(184, 148, 77, 0.16)',
  },
  espace: {
    // La police de page n'a pas de glyphe d'espace : le rendre avec la police
    // systeme evite un caractere manquant au milieu d'un mot.
    fontFamily: POLICE_SYSTEME,
  },
});

export const LigneMoushaf = memo(LigneMoushafBrute);
