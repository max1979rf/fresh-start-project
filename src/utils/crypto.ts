// ─── Password hashing utilities ──────────────────────────────────────────────
// Uses the Web Crypto API (PBKDF2-SHA256) for secure password hashing.
// Maintains backward compatibility with the legacy simple hash format (h_ prefix).

const PBKDF2_ITERATIONS = 100_000;
const KEY_BITS = 256;

// Legacy hash kept ONLY for reading old stored hashes during migration.
// New passwords must never use this function.
function legacySimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

function hexEncode(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexDecode(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g) ?? [];
    return new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
}

/**
 * Hash a password with PBKDF2-SHA256 and a random 16-byte salt.
 * Returns "pbkdf2:{iterations}:{saltHex}:{hashHex}".
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        KEY_BITS,
    );

    return `pbkdf2:${PBKDF2_ITERATIONS}:${hexEncode(salt.buffer)}:${hexEncode(derivedBits)}`;
}

/**
 * Verify a plain-text password against a stored hash.
 * Handles both the legacy "h_" format and the new "pbkdf2:" format.
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith('h_')) {
        // Legacy path — compare with the old simple hash
        return storedHash === legacySimpleHash(plain);
    }

    if (!storedHash.startsWith('pbkdf2:')) return false;

    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;

    const iterations = parseInt(parts[1], 10);
    const salt = hexDecode(parts[2]);
    const storedHashHex = parts[3];

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(plain),
        'PBKDF2',
        false,
        ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
        keyMaterial,
        KEY_BITS,
    );

    return hexEncode(derivedBits) === storedHashHex;
}

/**
 * Compute the legacy simple hash for seed data initialization only.
 * Do NOT use this for new passwords.
 * @internal
 */
export function legacyHash(str: string): string {
    return legacySimpleHash(str);
}
