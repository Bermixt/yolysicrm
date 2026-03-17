const DOMAIN_PATTERNS = ["domain", "url", "website", "store", "shop", "site", "link"];

export function detectDomainColumn(headers: string[]): string | null {
  let bestHeader: string | null = null;
  let bestScore = 0;

  for (const header of headers) {
    const lower = header.toLowerCase();
    for (let i = 0; i < DOMAIN_PATTERNS.length; i++) {
      if (lower.includes(DOMAIN_PATTERNS[i])) {
        const score = DOMAIN_PATTERNS.length - i;
        if (score > bestScore) {
          bestScore = score;
          bestHeader = header;
        }
      }
    }
  }

  return bestHeader;
}
