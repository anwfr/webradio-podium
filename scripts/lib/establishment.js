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

export function withEstablishment(participant) {
  const { establishment, establishmentKey: key } = extractEstablishment(
    participant.school
  );
  return {
    ...participant,
    establishment: participant.establishment ?? establishment,
    establishmentKey: participant.establishmentKey ?? key,
  };
}
