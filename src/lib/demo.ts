export interface FeaturedDemoSearch {
  game: string;
  location: string;
  title: string;
}

export const defaultDemoAlias = 'demo';

export const featuredDemoSearches: FeaturedDemoSearch[] = [
  {
    game: 'Street Fighter III: 3rd Strike',
    location: '75201',
    title: 'Fighting game run',
  },
  {
    game: 'Marvel vs. Capcom 2',
    location: '75080',
    title: 'Rare cabinet search',
  },
  {
    game: 'DanceDanceRevolution',
    location: '76051',
    title: 'Rhythm game search',
  },
];

export function buildExpoAliasUrl(alias: string): string {
  const normalizedAlias = alias.trim() || defaultDemoAlias;

  return `https://arcade-radar--${normalizedAlias}.expo.app/`;
}

export function buildDemoSearchParams(search: FeaturedDemoSearch) {
  return {
    game: search.game,
    location: search.location,
  };
}
