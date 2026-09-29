import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** { "Electronics": ["Mobile Phones", ...], ... } — categories without sub-categories are absent. */
export type SubcategoryMap = Record<string, string[]>;

type Row = { id: string; name: string; parent_id: string | null; sort_order: number };

let cache: SubcategoryMap | null = null;
let inflight: Promise<SubcategoryMap> | null = null;

function load(): Promise<SubcategoryMap> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_id, sort_order')
        .order('sort_order');
      if (error || !data) {
        inflight = null; // allow a retry later; callers fall back to "no sub-categories"
        return {};
      }
      const rows = data as Row[];
      const parents = new Map(rows.filter((r) => r.parent_id === null).map((r) => [r.id, r.name]));
      const map: SubcategoryMap = {};
      rows
        .filter((r) => r.parent_id !== null && parents.has(r.parent_id))
        .forEach((r) => {
          const parent = parents.get(r.parent_id as string) as string;
          (map[parent] ??= []).push(r.name);
        });
      cache = map;
      return map;
    })();
  }
  return inflight;
}

/** Sub-categories from the `categories` table. Empty until loaded (or if migration 015 hasn't been run). */
export function useSubcategories(): SubcategoryMap {
  const [map, setMap] = useState<SubcategoryMap>(cache ?? {});
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setMap(m));
    return () => {
      alive = false;
    };
  }, []);
  return map;
}
