/**
 * Converts Brazilian date format (DD/MM/YYYY) to ISO format (YYYY-MM-DD).
 * Used for <input type="date"> fields.
 */
export function brToIso(br: string): string {
    if (!br) return '';
    const p = br.split('/');
    if (p.length !== 3) return br;
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

/**
 * Converts ISO date format (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY).
 * Used for displaying dates to the user.
 */
export function isoToBr(iso: string): string {
    if (!iso) return '';
    const p = iso.split('-');
    if (p.length !== 3) return iso;
    return `${p[2]}/${p[1]}/${p[0]}`;
}
