import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupProductsBySubcategory,
  shouldShowSubcategoryTiles,
  OTHER_GROUP_ID,
} from './brandGrouping.js';

const p = (id, subcategory, subcategory_name) => ({ id, subcategory, subcategory_name });

test('groups products by subcategory and sorts by count descending', () => {
  const groups = groupProductsBySubcategory([
    p(1, 112, 'Locks and Security Accessories'),
    p(2, 115, 'Handles, Hinges and Fittings'),
    p(3, 112, 'Locks and Security Accessories'),
    p(4, 112, 'Locks and Security Accessories'),
    p(5, 115, 'Handles, Hinges and Fittings'),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Locks and Security Accessories');
  assert.equal(groups[0].count, 3);
  assert.equal(groups[1].name, 'Handles, Hinges and Fittings');
  assert.equal(groups[1].count, 2);
});

test('collects products with no subcategory into a single Other group sorted last', () => {
  const groups = groupProductsBySubcategory([
    p(1, null, ''),
    p(2, 112, 'Locks'),
    p(3, undefined, undefined),
    p(4, 112, 'Locks'),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Locks');
  assert.equal(groups[groups.length - 1].id, OTHER_GROUP_ID);
  assert.equal(groups[groups.length - 1].count, 2);
});

test('Other group sorts last even when it has the most products', () => {
  const groups = groupProductsBySubcategory([
    p(1, null, ''),
    p(2, null, ''),
    p(3, null, ''),
    p(4, 112, 'Locks'),
  ]);

  assert.equal(groups[0].name, 'Locks');
  assert.equal(groups[1].id, OTHER_GROUP_ID);
});

test('reads subcategory from a nested object when the API returns one', () => {
  const groups = groupProductsBySubcategory([
    { id: 1, subcategory: { id: 90, name: 'Cricket' } },
    { id: 2, subcategory: { id: 90, name: 'Cricket' } },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, '90');
  assert.equal(groups[0].name, 'Cricket');
  assert.equal(groups[0].count, 2);
});

test('breaks count ties by name so ordering is stable', () => {
  const groups = groupProductsBySubcategory([
    p(1, 91, 'Football'),
    p(2, 90, 'Cricket'),
  ]);

  assert.deepEqual(groups.map((g) => g.name), ['Cricket', 'Football']);
});

test('returns an empty array for no products', () => {
  assert.deepEqual(groupProductsBySubcategory([]), []);
  assert.deepEqual(groupProductsBySubcategory(), []);
});

test('tiles are hidden for a single-subcategory brand', () => {
  const groups = groupProductsBySubcategory([p(1, 112, 'Locks'), p(2, 112, 'Locks')]);
  assert.equal(shouldShowSubcategoryTiles(groups), false);
});

test('tiles are shown when a brand spans multiple subcategories', () => {
  const groups = groupProductsBySubcategory([p(1, 112, 'Locks'), p(2, 115, 'Handles')]);
  assert.equal(shouldShowSubcategoryTiles(groups), true);
});
