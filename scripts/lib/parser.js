import * as cheerio from 'cheerio';
import { config } from './config.js';
import { extractEstablishment } from './establishment.js';

const SLUG_RE = /\/fr\/ressources\/([a-z0-9-]+)/i;
const EDITION_RE = /Edition\s+(20\d{2})/i;
const CATEGORY_RE =
  /catégorie\s+(Cycle\s+[34]\s*\([^)]+\)|Lycée[^,\n]*|Internationale[^,\n]*)/i;
const ACADEMY_RE = /Académie de\s+([^\n<]+)/i;
const VOTE_CLOSED_RE = /Votes clôturés/i;
const VOTE_BUTTON_RE = /Je vote pour ce podcast\s*\((\d+)\)/i;

export function resourceUrl(slug) {
  return `${config.afdBaseUrl}/fr/ressources/${slug}`;
}

export function listPageUrl(pageIndex) {
  return `${config.listUrl}&page=${pageIndex}`;
}

export function extractSlugsFromListHtml(html) {
  const $ = cheerio.load(html);
  const slugs = new Set();
  $('a[href*="/fr/ressources/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(SLUG_RE);
    if (m) slugs.add(m[1]);
  });
  return [...slugs];
}

export function extractLastPageIndex(html) {
  const $ = cheerio.load(html);
  const lastLink = $('a.fr-pagination__link--last').attr('href') || '';
  const m = lastLink.match(/page=(\d+)/);
  if (m) return Number(m[1]);
  const pageLinks = $('a[href*="page="]')
    .map((_, el) => {
      const href = $(el).attr('href') || '';
      const pm = href.match(/page=(\d+)/);
      return pm ? Number(pm[1]) : 0;
    })
    .get();
  return pageLinks.length ? Math.max(...pageLinks) : 0;
}

export function parsePodcastPage(html, slug) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    slug;

  let school = null;
  const realized = $('p').filter((_, el) => {
    return $(el).text().includes('Réalisé par');
  });
  if (realized.length) {
    school = realized
      .first()
      .text()
      .replace(/^Réalisé par\s*/i, '')
      .trim();
  }
  if (!school) {
    school =
      $('meta[property="og:description"]').attr('content')?.trim() || null;
  }

  const editionMatch = bodyText.match(EDITION_RE);
  const edition = editionMatch ? editionMatch[1] : null;

  let category = null;
  $('p, span, div').each((_, el) => {
    const t = $(el).text().trim();
    const cm = t.match(CATEGORY_RE);
    if (cm && !category) category = cm[1].trim();
  });
  if (!category) {
    const categoryMatch = bodyText.match(CATEGORY_RE);
    category = categoryMatch ? categoryMatch[1].trim() : null;
  }

  let academy = null;
  $('p.fr-tag').each((_, el) => {
    const t = $(el).text().trim();
    if (t.startsWith('Académie de')) {
      academy = t;
    }
  });
  if (!academy) {
    const academyMatch = bodyText.match(ACADEMY_RE);
    if (academyMatch) {
      academy = `Académie de ${academyMatch[1].trim()}`;
    }
  }

  let country = null;
  if (school) {
    const parts = school.split(',').map((s) => s.trim().replace(/\.$/, ''));
    if (parts.length > 1) {
      country = parts[parts.length - 1];
    }
  }

  let status = null;
  $('p, span').each((_, el) => {
    const t = $(el).text().trim();
    if (/^(Demi-finaliste|Lauréat|Finaliste)/i.test(t) && t.length < 120) {
      status = t;
    }
  });

  const votesClosed = VOTE_CLOSED_RE.test(bodyText);
  const voteInput = $('input[data-drupal-selector="edit-likes"]');
  let votes = null;
  let scrapeError = null;

  if (voteInput.length) {
    const val = voteInput.attr('value');
    votes = val != null ? Number(val) : null;
  } else {
    const likeSpan = $('span.like-num span').first().text().trim();
    if (likeSpan && /^\d+$/.test(likeSpan)) {
      votes = Number(likeSpan);
    } else {
      const btnMatch = bodyText.match(VOTE_BUTTON_RE);
      if (btnMatch) votes = Number(btnMatch[1]);
    }
  }

  let voteStatus;
  let active;

  if (votesClosed) {
    voteStatus = 'closed';
    active = false;
  } else if (!voteInput.length && votes == null) {
    voteStatus = 'unavailable';
    active = false;
    scrapeError = 'no_vote_widget';
  } else if (edition !== '2026') {
    voteStatus = 'not_eligible';
    active = false;
  } else {
    voteStatus = 'open';
    active = true;
  }

  return {
    slug,
    title,
    url: resourceUrl(slug),
    school,
    category,
    academy,
    country,
    edition,
    status,
    voteStatus,
    active,
    votes,
    scrapeError,
  };
}

export function mergeParticipant(existing, parsed, validatedAt) {
  const base = existing || {
    slug: parsed.slug,
    firstSeenAt: validatedAt,
  };

  const merged = {
    ...base,
    slug: parsed.slug,
    title: parsed.title || base.title,
    url: parsed.url,
    school: parsed.school ?? base.school,
    category: parsed.category ?? base.category,
    academy: parsed.academy ?? base.academy,
    country: parsed.country ?? base.country,
    edition: parsed.edition ?? base.edition,
    status: parsed.status ?? base.status,
    voteStatus: parsed.voteStatus,
    active: parsed.active,
    lastValidatedAt: validatedAt,
    firstSeenAt: base.firstSeenAt || validatedAt,
  };

  if (parsed.scrapeError) {
    merged.scrapeError = parsed.scrapeError;
  } else if (merged.scrapeError === 'no_vote_widget' && parsed.active) {
    delete merged.scrapeError;
  }

  if (parsed.votes != null) {
    merged.lastVotes = parsed.votes;
  }

  const school = merged.school ?? null;
  const { establishment, establishmentKey } = extractEstablishment(school);
  merged.establishment = establishment;
  merged.establishmentKey = establishmentKey;

  return merged;
}
