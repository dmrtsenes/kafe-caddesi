import type { CharacterHandle, CharacterOpts, CharRole } from "./types";
import { loadCafeCharacterPack, createCafeCharacter } from "./CafeCharacters";
import { loadCafeCustomerPack, createCafeCustomer } from "./CafeCustomers";
export * from "./types";

// Preview and installed game share the same cast, assets, and animations.
export async function loadCharacterPack(): Promise<void> {
  await Promise.all([loadCafeCharacterPack(), loadCafeCustomerPack()]);
}
export function createCharacter(
  role: CharRole,
  opts: CharacterOpts = {},
): CharacterHandle {
  return role === "customer" || role === "dasher" || role === "investor"
    ? createCafeCustomer(role, opts)
    : createCafeCharacter(role, opts);
}

/** Warm the actual shipped bodies, not an unused alternative character pack. */
export function createCharacterWarmup(): CharacterHandle[] {
  return [
    createCharacter('player', { seed: 417 }),
    createCharacter('waiter', { seed: 1 }),
    createCharacter('cashier', { seed: 2 }),
    createCharacter('busser', { seed: 3 }),
    createCharacter('barista', { seed: 4 }),
    createCharacter('dasher', { seed: 0 }),
    ...Array.from({ length: 8 }, (_, seed) => createCharacter('customer', { seed })),
  ];
}
