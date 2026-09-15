export function initialsFrom(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || 'A';
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0];
  const second = parts[1];
  if (first && second) return `${first[0]}${second[0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
