const SHORT_LABELS: Record<string, string> = {
  'Prispevek za pokojninsko in invalidsko zavarovanje': 'Pokojnina (PIZ)',
  'Prispevek za zdravstveno zavarovanje': 'Zdravstveno',
  'Prispevek za zaposlovanje': 'Zaposlovanje',
  'Prispevek za starševsko varstvo': 'Starševsko',
  'Prispevek za dolgotrajno oskrbo': 'Dolgotrajno',
  'Akontacija dohodnine': 'Dohodnina',
  'Obvezni zdravstveni prispevek': 'Zdrav. prispevek',
  'Skupaj prispevki delavca': 'Skupaj prispevki',
  'Prevoz na delo': 'Prevoz',
};

export function shortenLabel(name: string): string {
  if (SHORT_LABELS[name]) return SHORT_LABELS[name];
  const lower = name.toLowerCase();
  const match = Object.keys(SHORT_LABELS).find((k) => k.toLowerCase() === lower);
  if (match) return SHORT_LABELS[match];
  // "Povračilo stroškov ... - prehrana/prevoz" patterns
  if (lower.includes('prehrana')) return 'Prehrana';
  if (lower.includes('prevoz')) return 'Prevoz';
  return name.length > 22 ? name.slice(0, 20) + '…' : name;
}
