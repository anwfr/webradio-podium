/**
 * Supprime complètement data/ et public/data/ (pas de JSON vides conservés).
 * Paire de npm run seed-demo — pour repartir de zéro en dev.
 */
import { resetAllData } from './lib/storage.js';
import { writeSiteConfig } from './publish-data.js';

resetAllData();
writeSiteConfig();

console.log(
  'Données supprimées — dossiers data/ et public/data/ effacés. Lancez npm run seed-demo pour des données de démo.'
);
