import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiGet } from '../lib/api';
import { buildCategoryPalette, catColors as catColorsStandalone } from '../lib/categoryPalette';

const CategoryPaletteContext = createContext(null);

/**
 * App-wide category color registry. Fetches the full, real list of product
 * categories once (GET /products/categories — same endpoint every page
 * already uses) and builds one stable color map from it, so:
 *  - every table/chart in the app colors a given category identically
 *  - colors are computed from the WHOLE category set at once, guaranteeing
 *    maximal separation instead of a per-name hash gamble
 */
export function CategoryPaletteProvider({ children }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!user) { setCategories([]); return; }
    let cancelled = false;
    apiGet('/products/categories')
      .then((data) => { if (!cancelled) setCategories(data.categories || []); })
      .catch(() => { /* color is a visual nicety — fall back silently */ });
    return () => { cancelled = true; };
  }, [user]);

  const palette = useMemo(() => buildCategoryPalette(categories), [categories]);

  const getColor = useCallback((cat) => catColorsStandalone(cat, palette), [palette]);

  const value = useMemo(() => ({ getColor, palette, categories }), [getColor, palette, categories]);

  return (
    <CategoryPaletteContext.Provider value={value}>
      {children}
    </CategoryPaletteContext.Provider>
  );
}

export function useCategoryPalette() {
  const ctx = useContext(CategoryPaletteContext);
  if (!ctx) throw new Error('useCategoryPalette must be used within CategoryPaletteProvider');
  return ctx;
}
