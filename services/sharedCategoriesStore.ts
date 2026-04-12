/**
 * Shared in-memory store for service categories.
 * ServicesScreen populates this when it fetches categories.
 * AllServicesScreen reads from here to avoid a duplicate Firestore fetch.
 */
import { ServiceCategory } from './firestoreService';

let _categories: ServiceCategory[] = [];
let _ts = 0;

export function setSharedCategories(cats: ServiceCategory[]) {
  _categories = cats;
  _ts = Date.now();
}

export function getSharedCategories(): ServiceCategory[] {
  return _categories;
}

export function hasSharedCategories(): boolean {
  return _categories.length > 0;
}

export function getSharedCategoriesAge(): number {
  return _ts > 0 ? Date.now() - _ts : Infinity;
}
