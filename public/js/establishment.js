const TRAILING_LOCATION_RE =
  /\s*(?:,|\.)?\s*(?:de la ville de|de la ville d'|dans le|dans la|en France|FRANCE|\([^)]*\))\s*.*$/i;
const TRAILING_CITY_RE = /\s+à\s+[^,(\n]+$/i;

const TYPE_PREFIXES = new Set([
  'collège',
  'college',
  'lycée',
  'lycee',
  'lpo',
  'campus',
  'institut',
  'cours',
  'école',
  'ecole',
]);

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function stripTrailingLocation(name) {
  let cleaned = normalizeWhitespace(name);
  for (let i = 0; i < 4; i++) {
    const next = cleaned.replace(TRAILING_LOCATION_RE, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  cleaned = cleaned.replace(TRAILING_CITY_RE, '').trim();
  return cleaned.replace(/[,.)\s]+$/, '').trim();
}

function titleCaseWord(word) {
  if (!word) return word;
  if (word.length <= 2 && !/^\d/.test(word)) return word.toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatEstablishmentName(rawName, prefix) {
  const cleaned = stripTrailingLocation(rawName);
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  const hasType = [...TYPE_PREFIXES].some((type) => lower.startsWith(`${type} `));

  let display;
  if (hasType) {
    display = cleaned
      .split(/\s+/)
      .map((word, index) => (index === 0 ? titleCaseWord(word) : word))
      .join(' ');
  } else if (prefix) {
    display = `${prefix} ${cleaned}`;
  } else {
    display = cleaned;
  }

  return normalizeWhitespace(display);
}

function establishmentKey(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const EXTRACTION_RULES = [
  {
    re: /(?:du|de|d'|au)\s+LPO\s+([^,(\n]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'LPO'),
  },
  {
    re: /(?:du|de|d'|au)\s+(lycée|collège|lycee|college)(?:\s+(?:professionnel(?:\s+privé)?|polyvalent|général(?:\s+et\s+technologique)?|moderne|français|agricole))?\s+([^,(\n]+)/i,
    format: (match) =>
      formatEstablishmentName(match[2], titleCaseWord(match[1].replace('college', 'collège').replace('lycee', 'lycée'))),
  },
  {
    re: /\bau\s+(lycée|collège|lycee|college)\s+([^,(\n]+)/i,
    format: (match) =>
      formatEstablishmentName(match[2], titleCaseWord(match[1].replace('college', 'collège').replace('lycee', 'lycée'))),
  },
  {
    re: /(?:du|de|d'|au)\s+Campus\s+(?:de\s+)?([^,(\n]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'Campus'),
  },
  {
    re: /(?:de\s+l'|du\s+|d')Institut\s+([^,(\n]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'Institut'),
  },
  {
    re: /(?:du|de|d'|au)\s+cours\s+([^,(\n]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'Cours'),
  },
  {
    re: /(?:de\s+l'|du\s+|d'|de\s+)[Éé]cole\s+([^,(\n]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'École'),
  },
  {
    re: /Ly\s*cee\s+([^,(\n-]+)/i,
    format: (match) => formatEstablishmentName(match[1], 'Lycée'),
  },
  {
    re: /(?:^|[.\s])(collège|lycée|lycee|college)\s+([^,(\n]+)/i,
    format: (match) =>
      formatEstablishmentName(match[2], titleCaseWord(match[1].replace('college', 'collège').replace('lycee', 'lycée'))),
  },
  {
    re: /^(collège|lycée|lycee|college|lpo|campus|institut|école|ecole|cours)\s+(.+)$/i,
    format: (match) =>
      formatEstablishmentName(match[2], titleCaseWord(match[1].replace('college', 'collège').replace('lycee', 'lycée').replace('ecole', 'école'))),
  },
];

export function extractEstablishment(school) {
  if (!school) {
    return { establishment: null, establishmentKey: null };
  }

  const text = normalizeWhitespace(school);

  for (const rule of EXTRACTION_RULES) {
    const match = text.match(rule.re);
    if (!match) continue;
    const establishment = rule.format(match);
    if (establishment) {
      return {
        establishment,
        establishmentKey: establishmentKey(establishment),
      };
    }
  }

  const fallback = stripTrailingLocation(text);
  if (fallback.length > 0 && fallback.length <= 120) {
    return {
      establishment: fallback,
      establishmentKey: establishmentKey(fallback),
    };
  }

  return { establishment: null, establishmentKey: null };
}

export function resolveEstablishment(participant) {
  if (participant.establishment && participant.establishmentKey) {
    return {
      establishment: participant.establishment,
      establishmentKey: participant.establishmentKey,
    };
  }
  return extractEstablishment(participant.school);
}

const ESTABLISHMENT_TYPE_RULES = [
  ['Lycée professionnel privé', 'Lyc. pro'],
  ['Lycée professionnel', 'Lyc. pro'],
  ['Lycée polyvalent', 'Lyc.'],
  ['Lycée général', 'Lyc.'],
  ['Lycée international', 'Lyc. int.'],
  ['Lycée', 'Lyc.'],
  ['Collège', 'Coll.'],
  ['LPO', 'LPO'],
  ['Campus', 'Campus'],
  ['Institut', 'Inst.'],
  ['École', 'École'],
  ['Ecole', 'École'],
  ['Cours', 'Cours'],
];

export function parseEstablishmentDisplay(name) {
  if (!name) {
    return { type: null, shortName: '', fullName: '' };
  }

  for (const [prefix, badge] of ESTABLISHMENT_TYPE_RULES) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      const shortName = name.slice(prefix.length).trim();
      return {
        type: badge,
        shortName: shortName || name,
        fullName: name,
      };
    }
  }

  return { type: null, shortName: name, fullName: name };
}

export function truncateText(text, max = 36) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function formatAcademyShort(academy) {
  if (!academy) return null;
  const match = academy.match(/^Académie de\s+(.+)$/i);
  return match ? match[1].trim() : academy;
}

const APOSTROPHE = "[''\\u2019\\u02BC]";

const ESTABLISHMENT_CITY_PATTERNS = [
  new RegExp(`\\s+d${APOSTROPHE}(.+)$`, 'i'),
  /\s+à\s+(.+)$/i,
  /\s+de\s+la\s+(.+)$/i,
  /\s+de\s+(.+)$/i,
];

function isPlausibleCity(city) {
  return city.length >= 2 && city.length <= 48;
}

function extractCityFromEstablishmentName(fullName) {
  if (!fullName) return null;
  for (const re of ESTABLISHMENT_CITY_PATTERNS) {
    const match = fullName.match(re);
    if (!match) continue;
    const city = normalizeWhitespace(match[1]);
    if (isPlausibleCity(city)) {
      return titleCaseWord(city);
    }
  }
  return null;
}

function extractCityFromEstablishmentKey(key) {
  if (!key) return null;
  const dMatch = key.match(/-d-([a-z0-9]+(?:-[a-z0-9]+)*)$/i);
  if (dMatch) {
    const city = normalizeWhitespace(dMatch[1].replace(/-/g, ' '));
    if (isPlausibleCity(city)) return titleCaseWord(city);
  }
  return null;
}

export function resolveEstablishmentCity({ label, key = null, school = null }) {
  const fromLabel = extractCityFromEstablishmentName(label);
  if (fromLabel) return fromLabel;
  if (school) {
    const fromSchool = extractCityFromEstablishmentName(school);
    if (fromSchool) return fromSchool;
  }
  return extractCityFromEstablishmentKey(key);
}

function establishmentNameWithoutCity(fullName, city) {
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripPatterns = [
    new RegExp(`\\s+d${APOSTROPHE}${escaped}$`, 'i'),
    new RegExp(`\\s+à\\s+${escaped}$`, 'i'),
    new RegExp(`\\s+de\\s+la\\s+${escaped}$`, 'i'),
    new RegExp(`\\s+de\\s+${escaped}$`, 'i'),
  ];
  for (const re of stripPatterns) {
    const next = fullName.replace(re, '').trim();
    if (next !== fullName && next.length > 0) return next;
  }
  return fullName;
}

export function parsePodiumEstablishmentDisplay(
  fullName,
  { key = null, school = null } = {}
) {
  const parsed = parseEstablishmentDisplay(fullName);
  const cityFromName = extractCityFromEstablishmentName(parsed.fullName);
  const city = resolveEstablishmentCity({ label: parsed.fullName, key, school });
  const establishmentName = cityFromName
    ? establishmentNameWithoutCity(parsed.fullName, cityFromName)
    : parsed.fullName;

  return {
    city,
    establishmentName,
    fullName: parsed.fullName,
  };
}

function escapeMarkup(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function establishmentChipMarkup({
  label,
  key,
  academy = null,
  showAcademy = true,
  maxNameLength = 36,
}) {
  if (!label || label === '—') {
    return '';
  }

  if (!key) {
    return `<span class="establishment-plain">${escapeMarkup(label)}</span>`;
  }

  const parsed = parseEstablishmentDisplay(label);
  const displayName = truncateText(parsed.shortName, maxNameLength);
  const title = parsed.fullName;
  const typeMarkup = parsed.type
    ? `<span class="establishment-chip-type">${escapeMarkup(parsed.type)}</span>`
    : '';

  const city = resolveEstablishmentCity({ label, key });
  const locationShort = city || (showAcademy ? formatAcademyShort(academy) : null);
  const locationTitle = city ? city : academy;
  const locationMarkup = locationShort
    ? `<span class="academy-short" title="${escapeMarkup(locationTitle || '')}">${escapeMarkup(locationShort)}</span>`
    : '';

  const chipInner = `${typeMarkup}<span class="establishment-chip-name">${escapeMarkup(displayName)}</span>`;
  const chipAttrs = `class="establishment-chip" title="${escapeMarkup(title)}"`;
  const chipMarkup = `<span ${chipAttrs}>${chipInner}</span>`;

  return `
    <span class="establishment-cell">
      ${chipMarkup}
      ${locationMarkup}
    </span>
  `.trim();
}

/** Affichage compact pour les cartes du podium global */
export function podiumEstablishmentMarkup({
  label,
  key,
  school = null,
}) {
  if (!label || label === '—') {
    return '';
  }

  const { city, establishmentName } = parsePodiumEstablishmentDisplay(label, {
    key,
    school,
  });
  const cityMarkup = city
    ? `<span class="podium-establishment-city">${escapeMarkup(city)}</span>`
    : '';
  const nameMarkup = `<span class="podium-establishment-name">${escapeMarkup(establishmentName)}</span>`;
  const linkInner = `${cityMarkup}${nameMarkup}`;
  const linkMarkup = `<span class="podium-establishment-link">${linkInner}</span>`;

  return `<span class="podium-establishment">${linkMarkup}</span>`;
}
