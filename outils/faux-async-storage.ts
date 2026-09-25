/**
 * Faux AsyncStorage, en memoire.
 *
 * Le vrai module est natif : il n'existe pas dans un processus Node. Ce faux
 * couvre ce que le code de l'application utilise reellement, et rien de plus.
 *
 * Il sert deux fois : comme remplacement transparent pendant les tests, et comme
 * moyen d'observer ce qui a ete ecrit. `poserBrut()` permet notamment de
 * fabriquer un cache corrompu, ce qu'aucune API publique ne laisse faire — or
 * c'est precisement le cas que le code de stockage promet de tolerer.
 *
 * Ecrit en TypeScript, et non en JavaScript : il est ainsi verifie par `tsc` au
 * meme titre que le reste.
 */

const magasin = new Map<string, string>();

/** Ecrit une valeur brute, sans passer par la serialisation JSON. */
export function poserBrut(cle: string, valeur: string): void {
  magasin.set(cle, valeur);
}

/** Copie du contenu, pour inspection. */
export function contenu(): ReadonlyMap<string, string> {
  return new Map(magasin);
}

/** Vide le magasin. */
export function vider(): void {
  magasin.clear();
}

const AsyncStorage = {
  async getItem(cle: string): Promise<string | null> {
    return magasin.get(cle) ?? null;
  },
  async setItem(cle: string, valeur: string): Promise<void> {
    magasin.set(cle, String(valeur));
  },
  async removeItem(cle: string): Promise<void> {
    magasin.delete(cle);
  },
  async getAllKeys(): Promise<string[]> {
    return [...magasin.keys()];
  },
  async multiRemove(cles: readonly string[]): Promise<void> {
    for (const cle of cles) {
      magasin.delete(cle);
    }
  },
  async multiGet(cles: readonly string[]): Promise<[string, string | null][]> {
    return cles.map((cle) => [cle, magasin.get(cle) ?? null]);
  },
  async clear(): Promise<void> {
    magasin.clear();
  },
};

export default AsyncStorage;
