import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Base types for the Multi-Vendor Platform.
 * More fields/types (Product, Order, Reel, Settings, etc.) will be added
 * as the corresponding database-schema phases (Phase 1-3) are completed.
 */
export type UserRole = 'admin' | 'seller' | 'customer';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  mobile_number: string | null;
  is_active: boolean;
  created_at: string;
};

export type SellerProfile = {
  id: string;
  shop_name: string;
  shop_slug: string;
  shop_description: string | null;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
};

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
  unit: string;
  image_url: string | null;
  status: ProductStatus;
  rejection_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CommissionType = 'percentage' | 'fixed';

export type CommissionSettings = {
  id: true;
  commission_type: CommissionType;
  commission_value: number;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  zilla: string;
  thana: string;
  delivery_charge: number;
  created_at: string;
  updated_at: string;
};

export type Reel = {
  id: string;
  seller_id: string;
  product_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReelWithProduct = Reel & { product: Product | null };

export type PaymentMethod = 'cod' | 'online';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid';
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export type Order = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  zilla: string;
  thana: string;
  delivery_charge: number;
  subtotal: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_amount: number;
  seller_net_amount: number;
  created_at: string;
  product?: Product;
};

/**
 * Calls the register_seller() Postgres function: turns the current
 * 'customer' into a 'seller' and creates their seller_profiles row,
 * atomically. Throws if the user isn't a customer or the slug is taken.
 */
export async function registerSeller(params: {
  shopName: string;
  shopSlug: string;
  shopDescription?: string;
  contactPhone?: string;
  address?: string;
}) {
  const { error } = await supabase.rpc('register_seller', {
    p_shop_name: params.shopName,
    p_shop_slug: params.shopSlug,
    p_shop_description: params.shopDescription ?? null,
    p_contact_phone: params.contactPhone ?? null,
    p_address: params.address ?? null,
  });
  if (error) throw error;
}
