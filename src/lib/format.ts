export function formatDistanceMiles(distanceMiles: number): string {
  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} mi`;
  }

  return `${Math.round(distanceMiles)} mi`;
}

export function formatVerificationAge(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return 'verified today';
  }

  if (diffDays === 1) {
    return 'verified 1 day ago';
  }

  if (diffDays < 30) {
    return `verified ${diffDays} days ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);

  if (diffMonths === 1) {
    return 'verified 1 month ago';
  }

  return `verified ${diffMonths} months ago`;
}

export function formatVerificationDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
}
