/**
 * Utility to detect and repair UTF-8 mojibake in strings.
 *
 * Common pattern: UTF-8 bytes (e.g., emoji) were stored as individual
 * Latin-1 / ISO-8859-1 characters during data import. This results in
 * sequences like "ð\x9F\x87³ð\x9F\x87¬" instead of the 🇳🇬 flag emoji.
 *
 * The fix re-encodes the string as Latin-1 bytes and decodes those bytes
 * as UTF-8, which recovers the original characters.
 */

/**
 * Detect whether a string contains mojibake (UTF-8 bytes misinterpreted as Latin-1).
 * Looks for the telltale leading bytes of multi-byte UTF-8 sequences appearing
 * as high Latin-1 codepoints (0xC0–0xF4 range).
 */
function hasMojibake(str) {
  if (!str || typeof str !== 'string') return false;
  // Match sequences that look like raw UTF-8 leading bytes in Latin-1 range
  // 0xC0-0xDF = 2-byte lead, 0xE0-0xEF = 3-byte lead, 0xF0-0xF4 = 4-byte lead
  // followed by continuation bytes 0x80-0xBF
  return /[\u00C0-\u00F4][\u0080-\u00BF]/.test(str);
}

/**
 * Repair a single mojibake string by re-encoding Latin-1 → UTF-8.
 * Returns the original string unchanged if no mojibake is detected
 * or if the repair fails.
 */
function fixMojibakeString(str) {
  if (!str || typeof str !== 'string') return str;
  if (!hasMojibake(str)) return str;

  try {
    // Convert each char code (treated as a Latin-1 byte) into a Uint8Array
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xFF;
    }
    // Decode those bytes as UTF-8
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Sanity check: the decoded string should be shorter (multi-byte → single codepoint)
    if (decoded.length < str.length) {
      return decoded;
    }
    return str;
  } catch {
    // If TextDecoder throws (invalid UTF-8 sequence), return original
    return str;
  }
}

/**
 * Fix mojibake in specific text fields of a listing object.
 * Only processes fields known to contain user-facing text.
 * Returns a new object (does not mutate the original).
 */
function fixListingEncoding(listing) {
  if (!listing || typeof listing !== 'object') return listing;

  const textFields = ['location', 'title', 'originalDescription', 'address'];
  let changed = false;
  const fixed = { ...listing };

  for (const field of textFields) {
    if (fixed[field] && typeof fixed[field] === 'string') {
      const repaired = fixMojibakeString(fixed[field]);
      if (repaired !== fixed[field]) {
        fixed[field] = repaired;
        changed = true;
      }
    }
  }

  return changed ? fixed : listing;
}

module.exports = { hasMojibake, fixMojibakeString, fixListingEncoding };
