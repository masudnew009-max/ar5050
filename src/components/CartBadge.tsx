import { useCart } from '../hooks/useCart';

/** Small count bubble; renders nothing when the cart is empty. Parent must be `relative`. */
export default function CartBadge() {
  const { count } = useCart();
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold leading-[18px] text-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}
