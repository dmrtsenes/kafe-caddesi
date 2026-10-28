import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalPressure, checkoutQueueLimit } from "./ArrivalPacing.ts";
test("empty and light cafes retain their normal arrival rhythm", () => {
  assert.equal(arrivalPressure(0, 3, 1), 1);
  assert.equal(arrivalPressure(3, 3, 0.2), 1);
});
test("unfinished and aging table orders gradually ease new arrivals without stopping them", () => {
  const normal = arrivalPressure(3, 3, 0.2),
    busy = arrivalPressure(7, 3, 0.3),
    urgent = arrivalPressure(7, 3, 0.85);
  assert.ok(normal < busy && busy < urgent);
  assert.ok(urgent <= 2.5);
  assert.ok(arrivalPressure(7, 10, 0.3) < busy);
  for (const units of [1, 3, 10, 80])
    for (const age of [0, 0.4, 0.7, 1])
      assert.ok(
        arrivalPressure(units, 3, age) >= 1 &&
          arrivalPressure(units, 3, age) <= 2.5,
      );
});
test("checkout headroom depends on a ready cashier, not merely a hire", () => {
  assert.equal(checkoutQueueLimit(false), 3);
  assert.equal(checkoutQueueLimit(true), 5);
});
