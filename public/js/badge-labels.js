const VARIANTS = {
  champion: ['Champion', 'Le boss', 'Numéro 1', 'Roi du podium'],
  flop: ['Flop du jour', 'Grosse chute', 'Plot twist', 'Ils ont dormi', 'Chute libre'],
  underdog: ['Underdog', 'Surprise du jour', 'Dark horse', 'Personne l\'avait vu'],
  gem: ['Pépite', 'Top du jour', 'Hidden gem', 'Ça déchire'],
  enFeu: ['En feu', 'Survolté', 'Mode rocket', 'Invincible'],
  remontada: ['Remontada', 'Come-back', 'Ils reviennent', 'En ascension'],
  meilleurRang: ['Meilleur rang', 'Au sommet', 'Le plus haut', 'Star locale'],
};

function daySeed() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getBadgeLabel(type) {
  const variants = VARIANTS[type];
  if (!variants?.length) return type;
  const index = hashString(`${daySeed()}-${type}`) % variants.length;
  return variants[index];
}
