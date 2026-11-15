import { useSyncExternalStore } from 'react';

import { keyValueStorage } from './storage';

/**
 * Panier du client, gardé sur l'appareil. Une commande = une boutique :
 * le panier est rangé par boutique et chaque boutique se commande séparément.
 * Les prix affichés ici sont indicatifs ; la base recalcule tout à la commande.
 */

export interface CartLine {
  productId: string;
  merchantId: string;
  merchantName: string;
  title: string;
  unitPriceXaf: number;
  quantity: number;
  /** Stock connu au moment de l'ajout, pour plafonner la quantité. */
  maxQuantity: number;
}

export type Cart = readonly CartLine[];

export interface CartGroup {
  merchantId: string;
  merchantName: string;
  lines: CartLine[];
  subtotalXaf: number;
}

const MAX_PER_LINE = 99;

export function addToCart(cart: Cart, line: Omit<CartLine, 'quantity'>, quantity = 1): Cart {
  const cap = Math.min(line.maxQuantity, MAX_PER_LINE);
  if (cap < 1) return cart;
  const existing = cart.find((l) => l.productId === line.productId);
  if (!existing) return [...cart, { ...line, quantity: Math.min(quantity, cap) }];
  return cart.map((l) =>
    l.productId === line.productId
      ? { ...l, ...line, quantity: Math.min(l.quantity + quantity, cap) }
      : l,
  );
}

export function setCartQuantity(cart: Cart, productId: string, quantity: number): Cart {
  if (quantity < 1) return cart.filter((l) => l.productId !== productId);
  return cart.map((l) =>
    l.productId === productId
      ? { ...l, quantity: Math.min(quantity, l.maxQuantity, MAX_PER_LINE) }
      : l,
  );
}

export function removeMerchantFromCart(cart: Cart, merchantId: string): Cart {
  return cart.filter((l) => l.merchantId !== merchantId);
}

export function groupCart(cart: Cart): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const line of cart) {
    const group = groups.get(line.merchantId) ?? {
      merchantId: line.merchantId,
      merchantName: line.merchantName,
      lines: [],
      subtotalXaf: 0,
    };
    group.lines.push(line);
    group.subtotalXaf += line.unitPriceXaf * line.quantity;
    groups.set(line.merchantId, group);
  }
  return [...groups.values()];
}

export function cartCount(cart: Cart): number {
  return cart.reduce((n, l) => n + l.quantity, 0);
}

// ---------------------------------------------------------------------------
// Panier partagé par tous les écrans de l'application
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'amara.cart.v1';
const EMPTY: Cart = [];
let current: Cart = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: Cart) {
  current = next;
  listeners.forEach((l) => l());
  void keyValueStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function load() {
  if (loaded) return;
  loaded = true;
  void keyValueStorage.getItem(STORAGE_KEY).then((raw) => {
    if (!raw || current !== EMPTY) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        current = parsed as CartLine[];
        listeners.forEach((l) => l());
      }
    } catch {
      // Panier illisible : on repart d'un panier vide.
    }
  });
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const cartActions = {
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) =>
    emit(addToCart(current, line, quantity)),
  setQuantity: (productId: string, quantity: number) =>
    emit(setCartQuantity(current, productId, quantity)),
  clearMerchant: (merchantId: string) => emit(removeMerchantFromCart(current, merchantId)),
};

export function useCart(): Cart {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}
