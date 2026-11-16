/**
 * Group a brand's products by subcategory so a brand page can offer
 * browsable tiles instead of one long list.
 *
 * Products with no subcategory are collected under a single "Other" group so
 * they stay reachable rather than silently disappearing from every tile.
 */

export const OTHER_GROUP_ID = '__other__';
export const OTHER_GROUP_NAME = 'Other';

const subcategoryIdOf = (product) => {
  const raw = product?.subcategory ?? product?.subcategory_id;
  if (raw && typeof raw === 'object') return raw.id ?? null;
  return raw ?? null;
};

const subcategoryNameOf = (product) => {
  const raw = product?.subcategory;
  if (raw && typeof raw === 'object' && raw.name) return raw.name;
  return product?.subcategory_name || '';
};

/**
 * @param {Array} products
 * @returns {Array<{id: string|number, name: string, count: number, products: Array}>}
 *   Groups sorted by product count descending, then name ascending.
 *   The "Other" group always sorts last.
 */
export const groupProductsBySubcategory = (products = []) => {
  const groups = new Map();

  for (const product of products) {
    const id = subcategoryIdOf(product);
    const name = subcategoryNameOf(product);
    const key = id == null || !name ? OTHER_GROUP_ID : String(id);

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: key === OTHER_GROUP_ID ? OTHER_GROUP_NAME : name,
        count: 0,
        products: [],
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.products.push(product);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.id === OTHER_GROUP_ID) return 1;
    if (b.id === OTHER_GROUP_ID) return -1;
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
};

/**
 * Tiles are only worth showing when the brand genuinely spans more than one
 * subcategory; a single group would just be a redundant "All" button.
 */
export const shouldShowSubcategoryTiles = (groups = []) => groups.length > 1;
