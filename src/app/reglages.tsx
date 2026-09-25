/**
 * Reglages.
 *
 * Un seul principe gouverne cet ecran : rien n'y est indispensable a la lecture.
 * On y vient pour choisir une voix ou une traduction, on en repart, et le
 * moushaf reprend tout l'ecran. Les sections sont donc plates, sans
 * sous-ecrans, et l'apercu de taille evite d'avoir a revenir au moushaf pour
 * juger du resultat.
 *
 * Le bloc « Stockage » n'est pas un reglage : il dit ce que l'application
 * occupe sur l'appareil, et permet de le reprendre. C'est la contrepartie
 * visible du fonctionnement hors ligne.
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { AMIRI_QURAN, BASMALA } from '@/constants/polices';
import {
  RECITATEURS,
  TRADUCTIONS,
  nomComplet,
} from '@/constants/recitateurs';
import { couleurs, espaces, rayons } from '@/constants/theme';
import { nombreDePagesCouvertes, pagesEnEditionDeSecours } from '@/services/mushaf/metriques';
import { etatPolicesTelechargees, viderPolices } from '@/services/mushaf/polices';
import { compterPagesEnCache, viderCacheMoushaf } from '@/services/storage/cache';
import {
  CHOIX_REPETITIONS,
  REGLAGES_PAR_DEFAUT,
  libelleRepetition,
  type ModeTraduction,
} from '@/services/storage/preferences';
import { useReglages } from '@/store/PreferencesProvider';

/** Tailles proposees pour la traduction, en multiplicateur de la taille de base. */
const TAILLES: readonly { readonly valeur: number; readonly libelle: string }[] = [
  { valeur: 0.85, libelle: 'Petit' },
  { valeur: 1, libelle: 'Normal' },
  { valeur: 1.2, libelle: 'Grand' },
  { valeur: 1.45, libelle: 'Tres grand' },
];

const MODES: readonly { readonly valeur: ModeTraduction; readonly libelle: string }[] = [
  { valeur: 'demande', libelle: 'A la demande' },
  { valeur: 'continu', libelle: 'Continue' },
];

function poids(octets: number): string {
  if (octets < 1024) {
    return `${octets} o`;
  }
  if (octets < 1024 * 1024) {
    return `${Math.round(octets / 1024)} Ko`;
  }
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function EcranReglages() {
  const { reglages, modifier } = useReglages();

  const [polices, setPolices] = useState(() => etatPolicesTelechargees());
  const [pagesEnCache, setPagesEnCache] = useState<number | null>(null);
  const [avis, setAvis] = useState<string | null>(null);

  const rafraichirStockage = useCallback(async () => {
    setPolices(etatPolicesTelechargees());
    setPagesEnCache(await compterPagesEnCache());
  }, []);

  useEffect(() => {
    void rafraichirStockage();
  }, [rafraichirStockage]);

  const viderLesPolices = useCallback(() => {
    const effacees = viderPolices();
    setPolices(etatPolicesTelechargees());
    setAvis(
      effacees > 0
        ? `${effacees} police${effacees > 1 ? 's' : ''} effacee${effacees > 1 ? 's' : ''}.`
        : 'Aucune police a effacer.',
    );
  }, []);

  const viderLeCache = useCallback(async () => {
    await viderCacheMoushaf();
    await rafraichirStockage();
    setAvis('Cache du moushaf vide.');
  }, [rafraichirStockage]);

  const couvertes = nombreDePagesCouvertes();
  const secours = pagesEnEditionDeSecours();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}>
      <Section titre="Recitation">
        {RECITATEURS.map((recitateur) => (
          <LigneChoix
            key={`${recitateur.id}-${recitateur.style ?? ''}`}
            libelle={nomComplet(recitateur)}
            selectionne={reglages.idRecitateur === recitateur.id}
            onPress={() => modifier({ idRecitateur: recitateur.id })}
          />
        ))}
      </Section>

      <Section titre="Traduction">
        <LigneBascule
          libelle="Afficher la traduction"
          sousTitre="Interrupteur general. Coupe tout affichage, y compris le bouton."
          valeur={reglages.traductionActivee}
          onChange={(valeur) => modifier({ traductionActivee: valeur })}
        />

        {reglages.traductionActivee ? (
          <>
            {TRADUCTIONS.map((traduction) => (
              <LigneChoix
                key={traduction.id}
                libelle={traduction.nom}
                sousTitre={traduction.auteur}
                selectionne={reglages.idTraduction === traduction.id}
                onPress={() => modifier({ idTraduction: traduction.id })}
              />
            ))}

            <Bloc libelle="Quand l'afficher">
              <RangeePuces>
                {MODES.map((mode) => (
                  <PuceReglage
                    key={mode.valeur}
                    libelle={mode.libelle}
                    actif={reglages.modeTraduction === mode.valeur}
                    onPress={() => modifier({ modeTraduction: mode.valeur })}
                  />
                ))}
              </RangeePuces>
              <Text style={styles.note}>
                {reglages.modeTraduction === 'demande'
                  ? "Le moushaf reste seul a l'ecran ; la traduction s'ouvre quand vous la demandez."
                  : "Un bandeau discret suit la recitation, sous le moushaf. Le texte du Coran reste au-dessus."}
              </Text>
            </Bloc>

            <Bloc libelle="Taille du texte">
              <RangeePuces>
                {TAILLES.map((taille) => (
                  <PuceReglage
                    key={taille.valeur}
                    libelle={taille.libelle}
                    actif={Math.abs(reglages.tailleTraduction - taille.valeur) < 0.01}
                    onPress={() => modifier({ tailleTraduction: taille.valeur })}
                  />
                ))}
              </RangeePuces>
              <View style={styles.apercu}>
                <Text style={styles.apercuArabe} allowFontScaling={false}>
                  {BASMALA}
                </Text>
                <Text style={[styles.apercuTexte, { fontSize: 16 * reglages.tailleTraduction }]}>
                  Apercu : voici la taille du texte de traduction.
                </Text>
              </View>
            </Bloc>
          </>
        ) : null}
      </Section>

      <Section titre="Lecture audio">
        <Bloc libelle="Repetitions par verset">
          <RangeePuces>
            {CHOIX_REPETITIONS.map((valeur) => (
              <PuceReglage
                key={valeur}
                libelle={libelleRepetition(valeur)}
                actif={reglages.repetitions === valeur}
                onPress={() => modifier({ repetitions: valeur })}
              />
            ))}
          </RangeePuces>
          <Text style={styles.note}>
            {reglages.repetitions === 0
              ? "Le verset se repete sans fin, jusqu'a ce que vous l'arretiez."
              : "Le nombre choisi s'applique a chaque verset lu, et a chaque verset d'un passage."}
          </Text>
        </Bloc>

        <LigneBascule
          libelle="Enchainer sur le verset suivant"
          sousTitre="Une fois les repetitions terminees, la lecture continue."
          valeur={reglages.enchainer}
          onChange={(valeur) => modifier({ enchainer: valeur })}
        />
      </Section>

      <Section titre="Stockage">
        <LigneInfo
          icone="document-text-outline"
          libelle="Pages du moushaf en cache"
          valeur={pagesEnCache === null ? '...' : `${pagesEnCache} page${pagesEnCache > 1 ? 's' : ''}`}
        />
        <LigneInfo
          icone="text-outline"
          libelle="Polices de page telechargees"
          valeur={`${polices.nombre} · ${poids(polices.octets)}`}
        />

        <View style={styles.actions}>
          <BoutonTexte libelle="Vider les polices" onPress={viderLesPolices} />
          <BoutonTexte libelle="Vider le cache" onPress={() => void viderLeCache()} />
        </View>

        <Text style={styles.note}>
          Les pages deja ouvertes se relisent hors connexion. Vider ces donnees ne
          touche ni vos favoris, ni vos reglages, ni votre derniere position.
        </Text>
      </Section>

      <Section titre="A propos">
        <LigneInfo
          icone="book-outline"
          libelle="Moushaf de Medine"
          valeur={`${couvertes} pages`}
        />
        {secours.length > 0 ? (
          <Text style={styles.note}>
            {`${secours.length} pages sont servies par une edition de police de secours (${secours.join(', ')}), l'editeur ne fournissant pas tous les glyphes dans l'edition courante.`}
          </Text>
        ) : null}
        <Text style={styles.note}>
          {`Mon lecteur de Coran · version ${version}`}
        </Text>
        <Text style={styles.note}>
          Texte, traductions et recitations : Quran Foundation. Police Amiri Quran
          (SIL Open Font License).
        </Text>

        <View style={styles.actions}>
          <BoutonTexte
            libelle="Retablir les reglages par defaut"
            onPress={() => {
              modifier(REGLAGES_PAR_DEFAUT);
              setAvis('Reglages retablis.');
            }}
          />
        </View>
      </Section>

      {avis ? (
        <View style={styles.avis}>
          <Ionicons name="checkmark-circle-outline" size={15} color={couleurs.vertDoux} />
          <Text style={styles.avisTexte}>{avis}</Text>
        </View>
      ) : null}

      <View style={styles.pied} />
    </ScrollView>
  );
}

function Section({ titre, children }: { readonly titre: string; readonly children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>{titre}</Text>
      <View style={styles.carte}>{children}</View>
    </View>
  );
}

function Bloc({ libelle, children }: { readonly libelle: string; readonly children: ReactNode }) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocTitre}>{libelle}</Text>
      {children}
    </View>
  );
}

function LigneChoix({
  libelle,
  sousTitre,
  selectionne,
  onPress,
}: {
  readonly libelle: string;
  readonly sousTitre?: string;
  readonly selectionne: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: selectionne }}
      accessibilityLabel={libelle}
      style={({ pressed }) => [styles.ligne, pressed ? styles.pressee : null]}
    >
      <View style={styles.textes}>
        <Text style={styles.libelle}>{libelle}</Text>
        {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
      </View>
      <Ionicons
        name={selectionne ? 'radio-button-on' : 'radio-button-off'}
        size={19}
        color={selectionne ? couleurs.vert : couleurs.texteTerni}
      />
    </Pressable>
  );
}

function LigneBascule({
  libelle,
  sousTitre,
  valeur,
  onChange,
}: {
  readonly libelle: string;
  readonly sousTitre?: string;
  readonly valeur: boolean;
  readonly onChange: (valeur: boolean) => void;
}) {
  return (
    <View style={styles.ligne}>
      <View style={styles.textes}>
        <Text style={styles.libelle}>{libelle}</Text>
        {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
      </View>
      <Switch
        value={valeur}
        onValueChange={onChange}
        trackColor={{ false: couleurs.surfaceDouce, true: couleurs.vertDoux }}
        thumbColor={couleurs.surface}
      />
    </View>
  );
}

function LigneInfo({
  icone,
  libelle,
  valeur,
}: {
  readonly icone: keyof typeof Ionicons.glyphMap;
  readonly libelle: string;
  readonly valeur: string;
}) {
  return (
    <View style={styles.ligne}>
      <Ionicons name={icone} size={17} color={couleurs.texteTerni} />
      <Text style={[styles.libelle, styles.libelleInfo]}>{libelle}</Text>
      <Text style={styles.valeur}>{valeur}</Text>
    </View>
  );
}

function RangeePuces({ children }: { readonly children: ReactNode }) {
  return <View style={styles.rangeePuces}>{children}</View>;
}

function PuceReglage({
  libelle,
  actif,
  onPress,
}: {
  readonly libelle: string;
  readonly actif: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={({ pressed }) => [
        styles.puce,
        actif ? styles.puceActive : null,
        pressed ? styles.pressee : null,
      ]}
    >
      <Text style={[styles.puceTexte, actif ? styles.puceTexteActif : null]}>{libelle}</Text>
    </Pressable>
  );
}

function BoutonTexte({ libelle, onPress }: { readonly libelle: string; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      style={({ pressed }) => [styles.boutonTexte, pressed ? styles.pressee : null]}
    >
      <Text style={styles.boutonTexteTexte}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  contenu: {
    padding: espaces.l,
  },
  section: {
    marginBottom: espaces.xl,
  },
  sectionTitre: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: couleurs.texteTerni,
    marginBottom: espaces.s,
    marginLeft: espaces.xs,
  },
  carte: {
    borderRadius: rayons.m,
    backgroundColor: couleurs.surface,
    borderWidth: 1,
    borderColor: couleurs.filet,
    overflow: 'hidden',
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.m,
    paddingHorizontal: espaces.l,
    paddingVertical: espaces.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.filet,
  },
  libelleInfo: {
    flex: 1,
  },
  pressee: {
    opacity: 0.55,
  },
  textes: {
    flex: 1,
  },
  libelle: {
    fontSize: 15,
    color: couleurs.texte,
    fontWeight: '500',
  },
  sousTitre: {
    marginTop: 1,
    fontSize: 12,
    color: couleurs.texteTerni,
  },
  valeur: {
    fontSize: 13,
    color: couleurs.texteSecondaire,
    fontWeight: '600',
  },
  bloc: {
    paddingHorizontal: espaces.l,
    paddingVertical: espaces.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: couleurs.filet,
    gap: espaces.s,
  },
  blocTitre: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteSecondaire,
  },
  rangeePuces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaces.s,
  },
  puce: {
    paddingHorizontal: espaces.m,
    paddingVertical: 7,
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
    fontWeight: '600',
    color: couleurs.texteSecondaire,
  },
  puceTexteActif: {
    color: couleurs.papier,
  },
  apercu: {
    marginTop: espaces.xs,
    padding: espaces.m,
    borderRadius: rayons.s,
    backgroundColor: couleurs.papier,
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  apercuArabe: {
    fontFamily: AMIRI_QURAN,
    fontSize: 20,
    color: couleurs.vert,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  apercuTexte: {
    marginTop: espaces.s,
    color: couleurs.texteSecondaire,
    lineHeight: 22,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: couleurs.texteTerni,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espaces.s,
    paddingHorizontal: espaces.l,
    paddingVertical: espaces.m,
  },
  boutonTexte: {
    paddingHorizontal: espaces.m,
    paddingVertical: 8,
    borderRadius: rayons.s,
    borderWidth: 1,
    borderColor: couleurs.filet,
    backgroundColor: couleurs.surfaceDouce,
  },
  boutonTexteTexte: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.vert,
  },
  avis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    borderRadius: rayons.s,
    backgroundColor: couleurs.surfaceDouce,
  },
  avisTexte: {
    flex: 1,
    fontSize: 12,
    color: couleurs.texteSecondaire,
  },
  pied: {
    height: espaces.xxl,
  },
});
