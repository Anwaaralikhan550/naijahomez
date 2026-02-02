// utils/slugify.js
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Creates a unique slug by combining the title with a unique identifier
 * @param {string} title - The title to slugify
 * @param {string} uniqueId - A unique identifier (e.g., document ID or timestamp)
 * @returns {string} - A unique, SEO-friendly slug
 */
export function createUniqueSlug(title, uniqueId) {
  const baseSlug = slugify(title);
  // Append the uniqueId to ensure uniqueness
  return `${baseSlug}-${uniqueId}`;
}

/**
 * Modified version to use with document data
 * @param {string} title - The title to slugify
 * @param {string} docId - The document ID for uniqueness
 * @returns {string} - A unique, SEO-friendly slug
 */
export function generateDocumentSlug(title, docId) {
  if (!title || !docId) return '';
  
  // Take the first 8 characters of the ID for brevity
  const shortId = docId.substring(0, 8);
  return createUniqueSlug(title, shortId);
}