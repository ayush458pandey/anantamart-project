/**
 * Price utility functions for tax-inclusive pricing.
 * All prices shown on the site include GST.
 */

/**
 * Returns the tax-inclusive price (rounded to nearest integer).
 * @param {number|string} basePrice - The base price (ex-GST)
 * @param {number|string} gstRate - GST rate in % (default 18)
 * @returns {number} Rounded inclusive price
 */
export function getInclusivePrice(basePrice, gstRate = 18) {
    const price = parseFloat(basePrice) || 0;
    const rate = parseFloat(gstRate) || 18;
    return Math.round(price * (1 + rate / 100));
}

/**
 * Returns the exact tax-inclusive price (not rounded).
 * @param {number|string} basePrice - The base price (ex-GST)
 * @param {number|string} gstRate - GST rate in % (default 18)
 * @returns {number} Exact inclusive price
 */
export function getInclusivePriceExact(basePrice, gstRate = 18) {
    const price = parseFloat(basePrice) || 0;
    const rate = parseFloat(gstRate) || 18;
    return price * (1 + rate / 100);
}

/**
 * Back-calculate the tax amount from an inclusive price.
 * @param {number} inclusivePrice - Price including GST
 * @param {number|string} gstRate - GST rate in %
 * @returns {number} Tax amount
 */
export function getTaxFromInclusive(inclusivePrice, gstRate = 18) {
    const rate = parseFloat(gstRate) || 18;
    return inclusivePrice * rate / (100 + rate);
}
