import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { bus } from '../core/EventBus.ts';
import { SettledVisual } from './SettledVisual.ts';

it('caches settled furniture while glass and changing stock remain live', () => {
  const furniture = new Group(), stock = new Mesh();
  const opaque = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true, opacity: .2 }));
  furniture.add(opaque, glass);
  stock.layers.set(1);
  let invalidations = 0;
  const unsubscribe = bus.on('render:structure', () => invalidations++);
  try {
    const cache = new SettledVisual([furniture]);
    assert.equal(opaque.layers.mask, 2);
    cache.set(true);
    assert.equal(opaque.layers.mask, 1);
    assert.equal(glass.layers.mask, 2);
    assert.equal(stock.layers.mask, 2);
    cache.set(true);
    assert.equal(invalidations, 1);
    cache.set(false);
    assert.equal(opaque.layers.mask, 2);
    cache.set(true);
    cache.dispose();
    cache.dispose();
    assert.equal(invalidations, 4);
  } finally { unsubscribe(); }
});
