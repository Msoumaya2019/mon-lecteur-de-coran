/**
 * L'ecran de lecture : une page du moushaf, et presque rien d'autre.
 *
 * Tout ce fichier est gouverne par une seule question, posee a chaque element
 * d'interface : « est-ce que cela gene la lecture ? ». D'ou :
 *
 *  - aucune barre de navigation, aucun en-tete permanent, aucune carte autour du
 *    texte. La page occupe l'ecran, les bords surs sont respectes et rien de
 *    plus ;
 *  - les commandes n'existent qu'au toucher, et s'effacent seules au bout de
 *    quelques secondes ;
 *  - deux pastilles minuscules, dans un coin bas, pour l'audio et la traduction.
 *    Leur zone tactile est etendue sans que leur taille le soit.
 *
 * Le feuilletage est un `FlatList` horizontal pagine : le geste est celui d'un
 * livre, et seules trois pages sont rendues a la fois — celle qu'on lit et ses
 * deux voisines — pour que la memoire ne suive pas les 604 pages.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuVerset } from '@/components/lecteur/MenuVerset';
import { PanneauAudio } from '@/components/lecteur/PanneauAudio';
import { PanneauTraduction } from '@/components/lecteur/PanneauTraduction';
import { CadreMoushaf } from '@/components/moushaf/CadreMoushaf';
import { PageMoushaf } from '@/components/moushaf/PageMoushaf';
import { BoutonFlottant } from '@/components/ui/Commandes';
import { AMIRI_QURAN } from '@/constants/polices';
import {
  DELAI_EFFACEMENT_COMMANDES,
  PAGES_DU_MOUSHAF,
  couleurs,
  espaces,
  rayons,
} from '@/constants/theme';
import { useAudio } from '@/hooks/useAudio';
import { usePagesMoushaf } from '@/hooks/usePagesMoushaf';
import { useTraductionsPage } from '@/hooks/useTraductionsPage';
import { useRequete } from '@/hooks/useRequete';
import { assurerPolicePage } from '@/services/mushaf/polices';
import { chargerSourates } from '@/services/quran/sourates';
import { basculerFavori, chargerFavoris, estFavori } from '@/services/storage/favoris';
import { enregistrerDerniereLecture } from '@/services/storage/preferences';
import { useReglages } from '@/store/PreferencesProvider';
import type { CleVerset, Favori } from '@/types/coran';

type Feuille = 'aucune' | 'audio' | 'traduction' | 'verset';

const PAGES = Array.from({ length: PAGES_DU_MOUSHAF }, (_, indice) => indice + 1);

export default function EcranLecture() {
  const parametres = useLocalSearchParams<{ page?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reglages } = useReglages();
  const audio = useAudio();

  const pageInitiale = useMemo(() => {
    const valeur = Number(parametres.page);
    if (!Number.isInteger(valeur) || valeur < 1 || valeur > PAGES_DU_MOUSHAF) {
      return 1;
    }
    return valeur;
  }, [parametres.page]);

  const [pageCourante, setPageCourante] = useState(pageInitiale);
  const [commandesVisibles, setCommandesVisibles] = useState(false);
  const [feuille, setFeuille] = useState<Feuille>('aucune');
  const [versetChoisi, setVersetChoisi] = useState<CleVerset | null>(null);
  const [favoris, setFavoris] = useState<readonly Favori[]>([]);
  const [police, setPolice] = useState<{
    readonly page: number;
    readonly famille: string | null;
    readonly erreur: string | null;
  } | null>(null);

  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liste = useRef<FlatList<number>>(null);

  const { page: donneesPage, erreur: erreurPage, chargement } =
    usePagesMoushaf(pageCourante);

  const { etat: etatSourates } = useRequete('sourates', () => chargerSourates());
  const sourates = etatSourates.statut === 'pret' ? etatSourates.donnees : [];

  const traductionActivee =
    reglages.traductionActivee &&
    (reglages.modeTraduction === 'continu' || feuille === 'traduction');
  const traductions = useTraductionsPage(
    pageCourante,
    reglages.idTraduction,
    traductionActivee,
  );

  const nomSourate = useCallback(
    (numero: number) => sourates.find((s) => s.numero === numero)?.nomArabe ?? '',
    [sourates],
  );

  const sourateDuVerset = useCallback(
    (cle: CleVerset | null) => {
      if (!cle) {
        return '';
      }
      const numero = Number(cle.split(':')[0]);
      const sourate = sourates.find((s) => s.numero === numero);
      return sourate ? `${sourate.nomSimple} ${cle}` : cle;
    },
    [sourates],
  );

  // ---------------------------------------------------------------- police
  useEffect(() => {
    if (!donneesPage) {
      return;
    }
    let vivant = true;
    const { numero, edition } = donneesPage;
    void (async () => {
      try {
        const famille = await assurerPolicePage(numero, edition);
        if (vivant) {
          setPolice({ page: numero, famille, erreur: null });
        }
        // La page suivante se prepare en fond : le geste suivant n'attend rien.
        if (numero < PAGES_DU_MOUSHAF) {
          void assurerPolicePage(numero + 1).catch(() => undefined);
        }
      } catch (probleme) {
        if (vivant) {
          setPolice({
            page: numero,
            famille: null,
            erreur:
              probleme instanceof Error
                ? probleme.message
                : 'La police de cette page n’a pas pu être téléchargée.',
          });
        }
      }
    })();
    return () => {
      vivant = false;
    };
  }, [donneesPage]);

  const famillePolice =
    police && police.page === pageCourante ? police.famille : null;
  const erreurPolice = police && police.page === pageCourante ? police.erreur : null;

  // ---------------------------------------------------------------- favoris
  useEffect(() => {
    void (async () => {
      setFavoris(await chargerFavoris());
    })();
  }, []);

  // -------------------------------------------------------- derniere lecture
  useEffect(() => {
    void enregistrerDerniereLecture({
      page: pageCourante,
      verset: audio.versetCourant,
      majLe: Date.now(),
    });
  }, [pageCourante, audio.versetCourant]);

  // ---------------------------------------------------------------- commandes
  const armerEffacement = useCallback(() => {
    if (minuteur.current) {
      clearTimeout(minuteur.current);
    }
    minuteur.current = setTimeout(() => {
      setCommandesVisibles(false);
    }, DELAI_EFFACEMENT_COMMANDES);
  }, []);

  const basculerCommandes = useCallback(() => {
    if (commandesVisibles) {
      if (minuteur.current) {
        clearTimeout(minuteur.current);
      }
      setCommandesVisibles(false);
      return;
    }
    setCommandesVisibles(true);
    armerEffacement();
  }, [commandesVisibles, armerEffacement]);

  useEffect(
    () => () => {
      if (minuteur.current) {
        clearTimeout(minuteur.current);
      }
    },
    [],
  );

  const ouvrirFeuille = useCallback(
    (quelle: Feuille) => {
      setFeuille(quelle);
      armerEffacement();
    },
    [armerEffacement],
  );

  const fermerFeuille = useCallback(() => {
    setFeuille('aucune');
    armerEffacement();
  }, [armerEffacement]);

  // ---------------------------------------------------------------- feuilletage
  const { width } = useWindowDimensions();

  const surFinDefilement = useCallback(
    (evenement: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(evenement.nativeEvent.contentOffset.x / width);
      const page = Math.min(PAGES_DU_MOUSHAF, Math.max(1, index + 1));
      setPageCourante((actuelle) => (actuelle === page ? actuelle : page));
    },
    [width],
  );

  const obtenirDisposition = useCallback(
    (_donnees: ArrayLike<number> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  // ---------------------------------------------------------------- versets
  const versetsDeLaPage = useMemo(
    () => (donneesPage?.versets ?? []).map((v) => v.cle),
    [donneesPage],
  );

  const versetRecite =
    audio.etat.enLecture || audio.etat.chargement ? audio.versetCourant : null;
  const versetSurligne =
    versetRecite && versetsDeLaPage.includes(versetRecite) ? versetRecite : null;

  const versetTraduitContinu =
    reglages.modeTraduction === 'continu' && reglages.traductionActivee
      ? versetRecite
      : null;

  const texteArabeDuVerset = useCallback(
    (cle: CleVerset | null) =>
      donneesPage?.versets.find((v) => v.cle === cle)?.texteUthmani ?? '',
    [donneesPage],
  );

  const surAppuiVerset = useCallback(
    (cle: CleVerset) => {
      setVersetChoisi(cle);
      setCommandesVisibles(false);
      if (minuteur.current) {
        clearTimeout(minuteur.current);
      }
      ouvrirFeuille('verset');
    },
    [ouvrirFeuille],
  );

  const libelleSourateDeLaPage = useMemo(() => {
    if (!donneesPage || donneesPage.versets.length === 0) {
      return '';
    }
    const numeros = [...new Set(donneesPage.versets.map((v) => v.sourate))];
    return numeros
      .map((numero) => sourates.find((s) => s.numero === numero)?.nomSimple ?? '')
      .filter(Boolean)
      .join(' · ');
  }, [donneesPage, sourates]);

  const rendrePage = useCallback(
    ({ item }: { readonly item: number }) => {
      const voisine = Math.abs(item - pageCourante) <= 1;
      if (!voisine) {
        return <View style={{ width, backgroundColor: couleurs.papier }} />;
      }
      const donnees = item === pageCourante ? donneesPage : null;
      if (!donnees) {
        return (
          <View style={[styles.attente, { width }]}>
            <ActivityIndicator size="small" color={couleurs.texteTerni} />
          </View>
        );
      }
      return (
        <View style={{ width, flex: 1 }}>
          <CadreMoushaf numeroPage={donnees.numero} juz={donnees.juz}>
            <PageMoushaf
              page={donnees}
              famillePolice={item === pageCourante ? famillePolice : null}
              nomSourate={nomSourate}
              versetSurligne={versetSurligne}
              versetSelectionne={feuille === 'verset' ? versetChoisi : null}
              onAppuiVerset={surAppuiVerset}
              onAppuiFond={basculerCommandes}
            />
          </CadreMoushaf>
        </View>
      );
    },
    [
      pageCourante,
      donneesPage,
      famillePolice,
      nomSourate,
      versetSurligne,
      versetChoisi,
      feuille,
      surAppuiVerset,
      basculerCommandes,
      width,
    ],
  );

  const favoriActuel = versetChoisi
    ? estFavori(favoris, 'verset', versetChoisi)
    : false;

  return (
    <View style={styles.ecran}>
      <FlatList
        ref={liste}
        data={PAGES}
        keyExtractor={(item) => String(item)}
        renderItem={rendrePage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={pageInitiale - 1}
        getItemLayout={obtenirDisposition}
        onMomentumScrollEnd={surFinDefilement}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        style={styles.liste}
      />

      {/* Bandeau de traduction continue : discret, en bas, jamais par-dessus le
          texte du Coran. */}
      {versetTraduitContinu && traductions[versetTraduitContinu] ? (
        <View
          style={[styles.bandeauContinu, { paddingBottom: insets.bottom + espaces.s }]}
          pointerEvents="none"
        >
          <Text style={styles.bandeauCle}>{versetTraduitContinu}</Text>
          <Text
            style={[
              styles.bandeauTexte,
              { fontSize: 13 * reglages.tailleTraduction },
            ]}
            numberOfLines={3}
          >
            {traductions[versetTraduitContinu]}
          </Text>
        </View>
      ) : null}

      {/* Pastilles flottantes : audio et traduction. */}
      <View
        style={[
          styles.pastilles,
          { bottom: insets.bottom + espaces.l,
          opacity: commandesVisibles ? 1 : 0.42 },
        ]}
        pointerEvents="box-none"
      >
        <BoutonFlottant
          icone={audio.etat.enLecture ? 'pause' : 'headset'}
          libelle={audio.etat.enLecture ? 'Mettre la récitation en pause' : 'Écouter la page'}
          actif={audio.etat.enLecture}
          chargement={audio.etat.chargement}
          onPress={() => {
            armerEffacement();
            if (audio.etat.file.length === 0 && versetsDeLaPage.length > 0) {
              audio.lireFile(versetsDeLaPage, versetsDeLaPage[0]);
            } else {
              audio.basculer();
            }
          }}
        />
        <BoutonFlottant
          icone="language"
          libelle="Afficher la traduction"
          actif={feuille === 'traduction'}
          onPress={() => {
            setVersetChoisi((actuel) => actuel ?? versetsDeLaPage[0] ?? null);
            ouvrirFeuille(feuille === 'traduction' ? 'aucune' : 'traduction');
          }}
        />
      </View>

      {/* Commandes : un simple toucher les fait apparaitre, elles s'effacent seules. */}
      {commandesVisibles ? (
        <>
          <View style={[styles.entete, { paddingTop: insets.top + espaces.s }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Revenir à l’accueil"
              style={styles.retour}
            >
              <Ionicons name="chevron-back" size={18} color={couleurs.vert} />
            </Pressable>
            <View style={styles.pastilleInfo}>
              <Text style={styles.pastilleInfoTexte}>
                {`Page ${pageCourante} · Juz ${donneesPage?.juz ?? 1}${
                  libelleSourateDeLaPage ? ` · ${libelleSourateDeLaPage}` : ''
                }`}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {/* Messages discrets : ils ne prennent jamais l'ecran. */}
      {erreurPolice ? (
        <View style={[styles.message, { top: insets.top + 56 }]} pointerEvents="none">
          <Text style={styles.messageTexte}>
            Police indisponible : cette page s’affichera après reconnexion.
          </Text>
        </View>
      ) : null}
      {erreurPage && !donneesPage ? (
        <View style={[styles.message, { top: insets.top + 56 }]} pointerEvents="none">
          <Text style={styles.messageTexte}>{erreurPage}</Text>
        </View>
      ) : null}
      {chargement && !donneesPage && !erreurPage ? (
        <View style={styles.centre} pointerEvents="none">
          <ActivityIndicator size="small" color={couleurs.texteTerni} />
        </View>
      ) : null}

      {/* ------------------------------------------------------------ feuilles */}
      <PanneauAudio
        visible={feuille === 'audio'}
        onFermer={fermerFeuille}
        etat={audio.etat}
        libelleVerset={audio.versetCourant ?? `${pageCourante}`}
        libelleSourate={libelleSourateDeLaPage}
        onBasculer={audio.basculer}
        onSuivant={audio.suivant}
        onPrecedent={audio.precedent}
      />

      <PanneauTraduction
        visible={feuille === 'traduction'}
        onFermer={fermerFeuille}
        verset={versetChoisi}
        texteArabe={texteArabeDuVerset(versetChoisi)}
        libelleSourate={sourateDuVerset(versetChoisi)}
        page={pageCourante}
      />

      <MenuVerset
        visible={feuille === 'verset'}
        onFermer={fermerFeuille}
        verset={versetChoisi}
        libelleSourate={sourateDuVerset(versetChoisi)}
        estFavori={favoriActuel}
        estDerniereLecture={false}
        onEcouter={() => {
          if (versetChoisi) {
            audio.lireVerset(versetChoisi);
          }
          ouvrirFeuille('audio');
        }}
        onTraduire={() => ouvrirFeuille('traduction')}
        onRepeterCeVerset={() => {
          if (versetChoisi) {
            audio.lireFile([versetChoisi], versetChoisi, false);
          }
          ouvrirFeuille('audio');
        }}
        onRepeterJusquIci={() => {
          if (versetChoisi) {
            const depart = versetsDeLaPage[0] ?? versetChoisi;
            const fin = versetsDeLaPage.indexOf(versetChoisi);
            const passage = fin >= 0 ? versetsDeLaPage.slice(0, fin + 1) : [versetChoisi];
            audio.lireFile(passage, depart, true);
          }
          ouvrirFeuille('audio');
        }}
        onBasculerFavori={() => {
          if (!versetChoisi) {
            return;
          }
          void (async () => {
            const liste = await basculerFavori(
              'verset',
              versetChoisi,
              sourateDuVerset(versetChoisi),
            );
            setFavoris(liste);
          })();
        }}
        onMarquerDerniereLecture={() => {
          if (versetChoisi) {
            void enregistrerDerniereLecture({
              page: pageCourante,
              verset: versetChoisi,
              majLe: Date.now(),
            });
          }
          fermerFeuille();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.papier,
  },
  liste: {
    flex: 1,
  },
  attente: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.papier,
  },
  pastilles: {
    position: 'absolute',
    right: espaces.m,
    flexDirection: 'row',
    gap: espaces.s,
  },
  entete: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaces.s,
    paddingHorizontal: espaces.m,
    paddingBottom: espaces.s,
  },
  retour: {
    width: 34,
    height: 34,
    borderRadius: rayons.rond,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 251, 244, 0.9)',
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  pastilleInfo: {
    flex: 1,
    paddingHorizontal: espaces.m,
    paddingVertical: 6,
    borderRadius: rayons.rond,
    backgroundColor: 'rgba(253, 251, 244, 0.9)',
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  pastilleInfoTexte: {
    fontSize: 12,
    color: couleurs.texteSecondaire,
    textAlign: 'center',
  },
  message: {
    position: 'absolute',
    left: espaces.xl,
    right: espaces.xl,
    paddingHorizontal: espaces.m,
    paddingVertical: espaces.s,
    borderRadius: rayons.m,
    backgroundColor: 'rgba(253, 251, 244, 0.94)',
    borderWidth: 1,
    borderColor: couleurs.filet,
  },
  messageTexte: {
    fontSize: 12,
    color: couleurs.texteSecondaire,
    textAlign: 'center',
  },
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandeauContinu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: espaces.l,
    paddingTop: espaces.m,
    backgroundColor: 'rgba(253, 251, 244, 0.94)',
    borderTopWidth: 1,
    borderTopColor: couleurs.filet,
  },
  bandeauCle: {
    fontFamily: AMIRI_QURAN,
    fontSize: 12,
    color: couleurs.vert,
    marginBottom: 2,
  },
  bandeauTexte: {
    color: couleurs.texte,
    lineHeight: 20,
  },
});
