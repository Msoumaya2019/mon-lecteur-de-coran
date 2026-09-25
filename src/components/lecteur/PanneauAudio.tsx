/**
 * Feuille audio.
 *
 * Elle ne prend jamais plus de la moitie de l'ecran, et sa fermeture
 * **n'interrompt pas la recitation** : c'est le point de l'exigence. L'utilisateur
 * lance la recitation, referme la feuille, et retrouve la page du moushaf
 * pendant que la voix continue.
 */

import { StyleSheet, Text, View } from 'react-native';

import {
  BoutonIcone,
  BoutonLecture,
  EnTeteFeuille,
  Puce,
} from '@/components/ui/Commandes';
import { FeuilleBasse } from '@/components/ui/FeuilleBasse';
import { CHOIX_REPETITIONS, libelleRepetition } from '@/services/storage/preferences';
import { RECITATEURS, nomComplet } from '@/constants/recitateurs';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { duree } from '@/lib/texte';
import { useReglages } from '@/store/PreferencesProvider';
import type { EtatAudio } from '@/services/audio/lecteurAudio';
import type { CleVerset } from '@/types/coran';

interface Props {
  readonly visible: boolean;
  readonly onFermer: () => void;
  readonly etat: EtatAudio;
  readonly libelleVerset: string;
  readonly libelleSourate: string;
  readonly onBasculer: () => void;
  readonly onSuivant: () => void;
  readonly onPrecedent: () => void;
}

export function PanneauAudio({
  visible,
  onFermer,
  etat,
  libelleVerset,
  libelleSourate,
  onBasculer,
  onSuivant,
  onPrecedent,
}: Props) {
  const { reglages, modifier } = useReglages();
  const recitateur = RECITATEURS.find((r) => r.id === reglages.idRecitateur);
  const progression = etat.duree > 0 ? Math.min(1, etat.position / etat.duree) : 0;

  return (
    <FeuilleBasse visible={visible} onFermer={onFermer} hauteurMax={0.5}>
      <EnTeteFeuille
        titre={libelleVerset}
        sousTitre={libelleSourate}
        onFermer={onFermer}
      />

      {etat.erreur ? (
        <Text style={styles.erreur} numberOfLines={2}>
          {etat.erreur}
        </Text>
      ) : null}

      <View style={styles.progressionFond}>
        <View style={[styles.progression, { width: `${progression * 100}%` }]} />
      </View>
      <View style={styles.temps}>
        <Text style={styles.tempsTexte}>{duree(etat.position)}</Text>
        <Text style={styles.tempsTexte}>{duree(etat.duree)}</Text>
      </View>

      <View style={styles.commandes}>
        <BoutonIcone icone="play-skip-back" onPress={onPrecedent} libelle="Verset précédent" />
        <BoutonLecture
          enLecture={etat.enLecture}
          chargement={etat.chargement}
          onPress={onBasculer}
        />
        <BoutonIcone icone="play-skip-forward" onPress={onSuivant} libelle="Verset suivant" />
      </View>

      <Text style={styles.section}>Répétition</Text>
      <View style={styles.puces}>
        {CHOIX_REPETITIONS.map((valeur) => (
          <Puce
            key={valeur}
            libelle={libelleRepetition(valeur)}
            actif={reglages.repetitions === valeur}
            onPress={() => modifier({ repetitions: valeur })}
          />
        ))}
      </View>
      <Text style={styles.note}>
        {etat.surPassage
          ? 'La répétition porte sur le passage sélectionné.'
          : 'La répétition porte sur chaque verset de la page.'}
      </Text>

      <Text style={styles.section}>Récitateur</Text>
      <View style={styles.recitateurs}>
        {RECITATEURS.map((r) => (
          <Puce
            key={r.id}
            libelle={r.nom.split(' ').slice(-1)[0]}
            actif={reglages.idRecitateur === r.id}
            onPress={() => modifier({ idRecitateur: r.id })}
          />
        ))}
      </View>
      <Text style={styles.note}>{recitateur ? nomComplet(recitateur) : ''}</Text>
    </FeuilleBasse>
  );
}

const styles = StyleSheet.create({
  erreur: {
    fontSize: 13,
    color: '#A33',
    marginBottom: espaces.s,
  },
  progressionFond: {
    height: 3,
    borderRadius: 2,
    backgroundColor: couleurs.surfaceDouce,
    overflow: 'hidden',
  },
  progression: {
    height: 3,
    backgroundColor: couleurs.vert,
  },
  temps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tempsTexte: {
    fontSize: 11,
    color: couleurs.texteTerni,
    fontVariant: ['tabular-nums'],
  },
  commandes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaces.xl,
    marginTop: espaces.m,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.texteSecondaire,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: espaces.l,
    marginBottom: espaces.s,
  },
  puces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaces.s,
  },
  recitateurs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaces.s,
  },
  note: {
    fontSize: 12,
    color: couleurs.texteTerni,
    marginTop: espaces.s,
    borderRadius: rayons.s,
  },
});
