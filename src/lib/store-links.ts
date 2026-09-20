/** Official store URLs. Leave empty until Apple/Google accept the listing.
 *  When they do, paste the public URLs here. The same badges become real links.
 *  Example:
 *    export const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.innovapro.vaiinilla';
 *    export const appStoreUrl = 'https://apps.apple.com/app/id000000000';
 */
export const playStoreUrl = '';
export const appStoreUrl = '';

export function storeHref(kind: 'play' | 'apple'): string | null {
  const raw = kind === 'play' ? playStoreUrl : appStoreUrl;
  const url = raw.trim();
  return url ? url : null;
}
