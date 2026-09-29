import { LayoutGrid } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { categoryIcon } from '../../lib/category-icons';

interface CategoryGridProps {
  /** 'All' or one of PRODUCT_CATEGORIES */
  selected: string;
  onSelect: (category: string) => void;
}

/**
 * Icon tiles for filtering the shop by category.
 * Phones: two rows that scroll sideways. Desktop: a normal wrapped grid.
 */
export default function CategoryGrid({ selected, onSelect }: CategoryGridProps) {
  const tiles = [{ name: 'All', Icon: LayoutGrid }, ...PRODUCT_CATEGORIES.map((name) => ({ name, Icon: categoryIcon(name) }))];

  return (
    <div
      className="no-scrollbar -mx-4 grid auto-cols-[76px] grid-flow-col grid-rows-2 gap-x-1 gap-y-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-8 lg:grid-rows-none lg:px-0"
      role="group"
      aria-label="Filter by category"
    >
      {tiles.map(({ name, Icon }) => {
        const active = selected === name;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            aria-pressed={active}
            className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
                active
                  ? 'border-primary-500 bg-primary-600 text-white'
                  : 'border-dark-700 bg-dark-800 text-primary-400'
              }`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span
              className={`line-clamp-2 text-[11px] leading-tight ${
                active ? 'font-medium text-white' : 'text-dark-300'
              }`}
            >
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
