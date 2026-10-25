/**
 * Privacy checks read the plaintext, never its digits (akinaza#358, same class as #341's « 514 »): ciphertext, ids and hashes
 * are random bytes that hold any short run of digits about one time in many, so a check on « 4821 » flakes. The whole secret
 * is what a leak looks like.
 */
export const GUARDED_DIGITS = ["4821", "514"] as const;

export const leaksPlaintext = (haystack: string, secret: string): boolean => haystack.includes(secret) || haystack.includes(JSON.stringify(secret).slice(1, -1));
