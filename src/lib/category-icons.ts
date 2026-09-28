import {
  Smartphone, Shirt, Armchair, Dumbbell, Puzzle, Baby, BookOpen, Car,
  Coffee, Gem, Sparkles, Wrench, Boxes, Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Electronics: Smartphone,
  Clothing: Shirt,
  Furniture: Armchair,
  Sports: Dumbbell,
  Toys: Puzzle,
  'Baby Products': Baby,
  Books: BookOpen,
  'Auto Accessories': Car,
  'Food & Beverages': Coffee,
  Jewelry: Gem,
  Cosmetics: Sparkles,
  'Hardware, Sanitary & Utilities': Wrench,
  'All-in-One Equipment Hub': Boxes,
};

export const categoryIcon = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag;
