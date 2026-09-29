import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { BRAND } from '../../lib/brand';
import { InfoPage } from './InfoPage';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I place an order?',
    a: 'Open a product, choose the quantity and tap Buy Now, or tap Add to Cart to shop for several items and check out together. Sign in, enter your name, mobile number and delivery address, pick your Zilla and Thana, and place the order.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Right now we accept Cash on Delivery only: you pay the delivery person when your order arrives. Online payment (bKash, Nagad, Rocket, bank and cards) is coming soon.',
  },
  {
    q: 'How much is delivery?',
    a: 'The delivery charge depends on your Zilla and Thana and is shown at checkout before you confirm. If your cart has items from more than one seller, the delivery charge is applied once per order.',
  },
  {
    q: 'How long will delivery take?',
    a: 'Each seller prepares and ships their own items, so times can vary by seller and area. You can follow the status of your order any time under My Orders.',
  },
  {
    q: 'Can I order from more than one seller at once?',
    a: 'Yes. Put items from different sellers in your cart and check out once. Each seller is notified of their own items and ships them separately.',
  },
  {
    q: 'How do I track my order?',
    a: 'Sign in and open My Orders to see the status of every order. If something looks wrong, contact us with your order number.',
  },
  {
    q: 'Can I cancel or change my order?',
    a: 'Contact us as soon as possible with your order number. An order can be cancelled before the seller has shipped it.',
  },
  {
    q: 'What if my product is damaged, wrong or not as described?',
    a: 'Contact us within 3 days of receiving it, with your order number and photos. If the claim is valid, the product is returned to the seller and you get a replacement or a refund. See our Terms & Conditions for details.',
  },
  {
    q: 'Where do I send a return?',
    a: 'Returns go to the seller who sold the product, at that seller\'s address. Contact us first and we will confirm the return and give you the right address.',
  },
  {
    q: 'How do I become a seller?',
    a: 'Create an account, choose Become a Seller, and submit your shop details and NID for verification. Once approved you can upload products; each product is reviewed by our team before it goes live.',
  },
  {
    q: 'Are the products reviewed?',
    a: 'Yes. Every product is checked by our team before it appears in the shop.',
  },
];

export default function Faq() {
  return (
    <InfoPage title="Shop FAQ" intro="Quick answers to the questions we hear most.">
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group bg-dark-800/60 border border-dark-700 rounded-2xl">
            <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none font-medium">
              {f.q}
              <ChevronDown className="w-4 h-4 text-dark-400 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-sm text-dark-300 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="text-sm text-dark-400">
        Still stuck? Call {BRAND.contact.phone} or visit our{' '}
        <Link to="/contact" className="text-primary-400 hover:text-primary-300">Contact page</Link>.
      </p>
    </InfoPage>
  );
}
