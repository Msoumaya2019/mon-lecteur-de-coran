/**
 * Enregistre le chargeur de tests aupres de Node.
 *
 * Separe du chargeur lui-meme : `module.register()` attend un chemin de fichier,
 * et un module ne peut pas s'enregistrer en s'important.
 */

import { register } from 'node:module';

register('./chargeur-tests.mjs', import.meta.url);
