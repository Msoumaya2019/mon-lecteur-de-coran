/**
 * Feuille de traduction.
 *
 * Elle apparait depuis le bas, laisse le moushaf visible derriere, et se ferme
 * d'un glissement. Le verset arabe y est rappele au-dessus de sa traduction :
 * sans lui, on ne saurait plus de quel verset on lit le sens.
 *
 * En mode continu, elle suit la recitation — c'est l'appelant qui lui donne le
 * verset a montrer, et cette feuille ne fait que l'afficher.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EnTeteFeuille, Puce } from '@/components/ui/Commandes';
import { FeuilleBasse } from '@/components/ui/FeuilleBasse';
import { AMIRI_QURAN } from '@/constants/polices';
import { TRADUCTIONS } from '@/constants/recitateurs';
import { couleurs, espaces } from '@/constants/theme';
import { chargerTraductionVerset } from '@/services/quran/pages';
import { useReglages } from '@/store/PreferencesProvider';
import type { CleVerset } from '@/types/coran';

interface Props {
  readonly visible: boolean;
  readonly onFermer: () => void;
  readonly verset: CleVerset | null;
  readonly texteArabe: string;
  readonly libelleSourate: string;
  /** Page du verset, si connue : evite une requete quand la table est en cache. */
  readonly page?: number;
  readonly suitLaRecitation?: boolean;
}

export function PanneauTraduction({
  visible,
  onFermer,
  verset,
  texteArabe,
  libelleSourate,
  page,
  suitLaRecitation = false,
}: Props) {
  const { reglages, modifier } = useReglages();
  const [texte, setTexte] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !verset) {
      return;
    }
    let vivant = true;
    setChargement(true);
    setErreur(null);
    void (async () => {
      try {
        const resultat = await chargerTraductionVerset(verset, reglages.idTraduction, page);
        if (vivant) {
          setTexte(resultat);
          setChargement(false);
        }
      } catch (probleme) {
        if (vivant) {
          setErreur(
            probleme instanceof Error
              ? probleme.message
              : 'La traduction n’a pas pu être chargée.',
          );
          setChargement(false);
        }
      }
    })();
    return () => {
      vivant = false;
    };
  }, [visible, verset, reglages.idTraduction, page]);

  return (
    <FeuilleBasse visible={visible} onFermer={onFermer} hauteurMax={0.52}>
      <EnTeteFeuille
        titre={verset ?? 'Traduction'}
        sousTitre={suitLaRecitation ? `${libelleSourate} — suit la récitation` : libelleSourate}
        onFermer={onFermer}
      />

      <View style={styles.versetArabe}>
        <Text allowFontScaling={false} style={styles.texteArabe} numberOfLines={3}>
          {texteArabe}
        </Text>
      </View>

      {chargement ? (
        <View style={styles.centre}>
          <ActivityIndicator size="small" color={couleurs.vert} />
        </View>
      ) : erreur ? (
        <Text style={styles.erreur}>{erreur}</Text>
      ) : (
        <Text
          style={[styles.traduction, { fontSize: 16 * reglages.tailleTraduction }]}
        >
          {texte ?? 'Traduction indisponible pour ce verset.'}
        </Text>
      )}

      <View style={styles.puces}>
        {TRADUCTIONS.map((t) => (
          <Puce
            key={t.id}
            libelle={t.auteur}
            actif={reglages.idTraduction === t.id}
            onPress={() => modifier({ idTraduction: t.id })}
          />
        ))}
      </View>
    </FeuilleBasse>
  );
}

const styles = StyleSheet.create({
  versetArabe: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: couleurs.filet,
    paddingVertical: espaces.m,
    marginBottom: espaces.m,
  },
  texteArabe: {
    fontFamily: AMIRI_QURAN,
    fontSize: 19,
    lineHeight: 34,
    textAlign: 'center',
    writingDirection: 'rtl',
    color: couleurs.texte,
  },
  traduction: {
    lineHeight: 26,
    color: couleurs.texte,
  },
  erreur: {
    fontSize: 13,
    color: '#A33',
    paddingVertical: espaces.m,
  },
  centre: {
    paddingVertical: espaces.xl,
    alignItems: 'center',
  },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaces.s,
    marginTop: espaces.l,
  },
});
