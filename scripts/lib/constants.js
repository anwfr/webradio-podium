/** Fenêtre de comparaison pour deltas, sauts de rang et vélocité (heures). */
export const COMPARISON_WINDOW_HOURS = 24;

/** Fenêtre secondaire pour les deltas affichés en tableau / popin. */
export const COMPARISON_WINDOW_48H = 48;

/** Nombre minimum de snapshots avant calcul des alertes et scores de suspicion. */
export const MIN_SNAPSHOTS_FOR_ALERTS = 3;

/** Rétention du journal d'exécution public (execution-journal.log). */
export const JOURNAL_RETENTION_DAYS = 5;

/** Rétention des backups JSON horodatés dans data/backups/. */
export const BACKUP_RETENTION_DAYS = 7;

/** Rétention des backups de sync-report. */
export const SYNC_REPORT_BACKUP_DAYS = 30;

/** Longueur max d'une chaîne dans le journal (évite dumps volumineux). */
export const JOURNAL_MAX_STRING_LENGTH = 500;

/** Nombre max d'entrées d'erreur détaillées dans un événement de journal. */
export const JOURNAL_MAX_ERRORS_PER_EVENT = 20;

// ——— Scraping : délais aléatoires (ms) ———

/** Entre deux fiches podcast (GET). */
export const DELAY_BETWEEN_FICHES_MS = { min: 1000, max: 3000 };

/** Entre deux pages de la liste paginée. */
export const DELAY_BETWEEN_LIST_PAGES_MS = { min: 2500, max: 6000 };

/** Après la première page liste (crawl initial). */
export const DELAY_AFTER_LIST_FIRST_MS = { min: 250, max: 1000 };

/** Pause additionnelle après une erreur 429 / rate-limit sur une fiche. */
export const RATE_LIMIT_COOLDOWN_MS = { min: 22500, max: 45000 };

/** Backoff de base pour retry HTTP (429, 503, timeout) — multiplié par 2^attempt. */
export const HTTP_RETRY_BACKOFF_BASE_MS = 15000;

/** Jitter max ajouté au backoff HTTP (ms). */
export const HTTP_RETRY_BACKOFF_JITTER_MS = 2500;

// ——— Progression des pipelines ———

/** Mise à jour meta.json / sync-report.json toutes les N fiches (hors crawl liste). */
export const RUN_PROGRESS_PUBLISH_EVERY = 3;

/** @deprecated utiliser RUN_PROGRESS_PUBLISH_EVERY */
export const DISCOVER_PROGRESS_PUBLISH_EVERY = RUN_PROGRESS_PUBLISH_EVERY;
