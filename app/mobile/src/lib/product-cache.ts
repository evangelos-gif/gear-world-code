import type { Product } from './api';

// Products shown in a list are kept in memory, so the product screen opens instantly without a new request.
const products = new Map<string, Product>();
const MAX = 2000;

export function rememberProducts(list: Product[]): void {
  for (const p of list) {
    products.delete(p.key);
    products.set(p.key, p);
  }
  while (products.size > MAX) {
    const first = products.keys().next().value;
    if (first === undefined) break;
    products.delete(first);
  }
}

export function findProduct(key: string): Product | undefined {
  return products.get(key);
}
