import { describe, expect, it } from 'vitest';

import { addToCart, cartCount, groupCart, removeMerchantFromCart, setCartQuantity } from './cart';

const tabouret = {
  productId: 'p1',
  merchantId: 'm1',
  merchantName: 'Ébénisterie Mbarga',
  title: 'Tabouret',
  unitPriceXaf: 25000,
  maxQuantity: 3,
};
const masque = {
  ...tabouret,
  productId: 'p2',
  merchantId: 'm2',
  merchantName: 'Atelier Nkam',
  title: 'Masque',
  unitPriceXaf: 85000,
  maxQuantity: 1,
};

describe('panier', () => {
  it('cumule les quantités sans dépasser le stock', () => {
    let cart = addToCart([], tabouret, 2);
    cart = addToCart(cart, tabouret, 5);
    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(3);
  });

  it('range par boutique avec un sous-total chacune', () => {
    const cart = addToCart(addToCart([], tabouret, 2), masque);
    expect(groupCart(cart)).toEqual([
      expect.objectContaining({ merchantId: 'm1', subtotalXaf: 50000 }),
      expect.objectContaining({ merchantId: 'm2', subtotalXaf: 85000 }),
    ]);
    expect(cartCount(cart)).toBe(3);
  });

  it('retire une ligne à zéro et vide une boutique après commande', () => {
    const cart = addToCart(addToCart([], tabouret), masque);
    expect(setCartQuantity(cart, 'p1', 0).map((l) => l.productId)).toEqual(['p2']);
    expect(removeMerchantFromCart(cart, 'm2').map((l) => l.productId)).toEqual(['p1']);
  });

  it('ignore un objet épuisé', () => {
    expect(addToCart([], { ...tabouret, maxQuantity: 0 })).toEqual([]);
  });
});
