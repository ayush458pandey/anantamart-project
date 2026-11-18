import test from 'node:test';
import assert from 'node:assert/strict';
import { cartLineUnitPrice, cartLineTotal, cartSubtotal } from './cartPricing.js';

const line = (overrides = {}) => ({
  quantity: 1,
  unit_price: '600.00',
  variant_ref: { id: 11, effective_base_price: '600.00' },
  product: { base_price: '500.00' },
  ...overrides,
});

test('uses the server unit_price, not the parent product price', () => {
  assert.equal(cartLineUnitPrice(line()), 600);
});

test('two variants of the same product price differently', () => {
  const a = line({ unit_price: '600.00', variant_ref: { effective_base_price: '600.00' } });
  const b = line({ unit_price: '700.00', variant_ref: { effective_base_price: '700.00' } });

  assert.equal(cartLineUnitPrice(a), 600);
  assert.equal(cartLineUnitPrice(b), 700);
  assert.notEqual(cartLineUnitPrice(a), cartLineUnitPrice(b));
});

test('falls back to the variant price when unit_price is absent', () => {
  const item = line({ unit_price: undefined });
  assert.equal(cartLineUnitPrice(item), 600);
});

test('falls back to the product price for a line with no variant', () => {
  const item = line({ unit_price: undefined, variant_ref: null });
  assert.equal(cartLineUnitPrice(item), 500);
});

test('returns 0 rather than NaN for malformed lines', () => {
  assert.equal(cartLineUnitPrice(null), 0);
  assert.equal(cartLineUnitPrice({}), 0);
  assert.equal(cartLineUnitPrice({ unit_price: 'abc', product: {} }), 0);
});

test('line total multiplies unit price by quantity', () => {
  assert.equal(cartLineTotal(line({ quantity: 3 })), 1800);
});

test('subtotal sums variant-priced lines correctly', () => {
  const cart = {
    items: [
      line({ quantity: 1, unit_price: '600.00' }),
      line({ quantity: 1, unit_price: '700.00' }),
    ],
  };
  assert.equal(cartSubtotal(cart), 1300);
});

test('subtotal is 0 for an empty or malformed cart', () => {
  assert.equal(cartSubtotal(null), 0);
  assert.equal(cartSubtotal({}), 0);
  assert.equal(cartSubtotal({ items: [] }), 0);
});
