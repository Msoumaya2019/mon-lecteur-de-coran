/**
 * Feuille basse, ouverte depuis le bas de l'ecran.
 *
 * Exigence de depart : elle ne doit jamais occuper tout l'ecran, et le moushaf
 * doit rester visible derriere. Elle se ferme en glissant vers le bas **ou** en
 * touchant la zone restee libre — deux gestes, parce que l'un est naturel au
 * pouce et l'autre a l'oeil.
 *
 * Elle reste montee une fois ouverte : demonter une vue animee supprimerait
 * l'animation de fermeture, et la feuille disparaitrait d'un coup.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { couleurs, espaces, rayons } from '@/constants/theme';

interface Props {
  readonly visible: boolean;
  readonly onFermer: () => void;
  readonly children: React.ReactNode;
  /** Hauteur maximale, en fraction de la hauteur d'ecran. */
  readonly hauteurMax?: number;
  readonly style?: ViewStyle;
}

const SEUIL_FERMETURE = 90;

export function FeuilleBasse({
  visible,
  onFermer,
  children,
  hauteurMax = 0.46,
  style,
}: Props) {
  const { height } = useWindowDimensions();
  const hauteur = Math.round(height * hauteurMax);
  const translation = useRef(new Animated.Value(hauteur)).current;

  useEffect(() => {
    Animated.spring(translation, {
      toValue: visible ? 0 : hauteur,
      useNativeDriver: true,
      damping: 22,
      stiffness: 210,
      mass: 0.9,
    }).start();
  }, [visible, hauteur, translation]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evenement, geste) =>
          geste.dy > 4 && Math.abs(geste.dy) > Math.abs(geste.dx),
        onPanResponderMove: (_evenement, geste) => {
          translation.setValue(Math.max(0, geste.dy));
        },
        onPanResponderRelease: (_evenement, geste) => {
          if (geste.dy > SEUIL_FERMETURE || geste.vy > 0.6) {
            onFermer();
            return;
          }
          Animated.spring(translation, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 210,
          }).start();
        },
      }),
    [onFermer, translation],
  );

  return (
    <View style={styles.conteneur} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.voile, { opacity: visible ? 1 : 0 }]}>
        <Pressable style={styles.voileTactile} onPress={onFermer} />
      </Animated.View>

      <Animated.View
        style={[
          styles.feuille,
          { maxHeight: hauteur, transform: [{ translateY: translation }] },
          style,
        ]}
      >
        <View style={styles.poignee} {...pan.panHandlers}>
          <View style={styles.poigneeTrait} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  voile: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 26, 23, 0.22)',
  },
  voileTactile: {
    flex: 1,
  },
  feuille: {
    backgroundColor: couleurs.surface,
    borderTopLeftRadius: rayons.l,
    borderTopRightRadius: rayons.l,
    paddingHorizontal: espaces.l,
    paddingBottom: espaces.xl,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
  },
  poignee: {
    alignItems: 'center',
    paddingVertical: espaces.s,
  },
  poigneeTrait: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: couleurs.filet,
  },
});
