// One place to change the site's name/tagline/contact details.
// Contact fields are optional: leave a field as '' and it is simply hidden in the footer.
export const BRAND = {
  name: 'AR Traders',
  tagline: 'Multi-Vendor Marketplace',
  about:
    'A marketplace where independent sellers list their products and customers shop from catalogs and shoppable reels. Every product is reviewed by our team before it goes live.',
  contact: {
    phone: '',
    email: 'artreadrsaminur@gmail.com',
    address: '',
  },
};

/** Pages linked from the drawer and footer (Phase 15ছ). */
export const INFO_LINKS = [
  { label: 'Contact Us', path: '/contact' },
  { label: 'Shop FAQ', path: '/faq' },
  { label: 'Terms & Conditions', path: '/terms' },
] as const;
