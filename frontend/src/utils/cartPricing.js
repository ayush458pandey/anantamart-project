/**
 * Cart line pricing.
 *
 * A cart line can point at a specific ProductVariant (size / colour), which
 * carries its own price. The API returns that as `unit_price` on the cart item.
 * Reading `item.product.base_price` instead silently charges the parent
 * product's price for every variant, so two sizes of the same product both
 * show the same amount.
 */

/**
 * Price for one unit of a cart line.
 * Prefers the server-computed `unit_price`, then the variant's own price, and
 * only falls back to the parent product price when neither exists.
 */
export const cartLineUnitPrice = (item) => {
  if (!item) return 0;

  const unit = parseFloat(item.unit_price);
  if (Number.isFinite(unit)) return unit;

  const variantPrice = parseFloat(item.variant_ref?.effective_base_price);
  if (Number.isFinite(variantPrice)) return variantPrice;

  const productPrice = parseFloat(item.product?.base_price);
  return Number.isFinite(productPrice) ? productPrice : 0;
};

/** Line total for a cart line (unit price x quantity). */
export const cartLineTotal = (item) => {
  if (!item) return 0;
  const qty = Number(item.quantity) || 0;
  return cartLineUnitPrice(item) * qty;
};

/** Sum of every line total in the cart. */
export const cartSubtotal = (cart) => {
  const items = cart?.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + cartLineTotal(item), 0);
};
