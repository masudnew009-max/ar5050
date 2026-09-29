import { Phone, Mail, MapPin } from 'lucide-react';
import { BRAND } from '../../lib/brand';
import { InfoPage, Section } from './InfoPage';

export default function Contact() {
  const { phone, email } = BRAND.contact;
  const card = 'flex items-start gap-3 p-4 bg-dark-800/60 border border-dark-700 rounded-2xl hover:border-primary-600/50 transition-colors';
  const icon = 'w-5 h-5 text-primary-400 shrink-0 mt-0.5';

  return (
    <InfoPage title="Contact Us" intro="Questions about an order, a product or selling with us? Reach out any time.">
      <div className="grid sm:grid-cols-2 gap-4">
        <a href={`tel:${phone}`} className={card}>
          <Phone className={icon} />
          <span>
            <span className="block text-sm text-dark-400">Call us</span>
            <span className="font-semibold">{phone}</span>
          </span>
        </a>
        <a href={`mailto:${email}`} className={card}>
          <Mail className={icon} />
          <span className="min-w-0">
            <span className="block text-sm text-dark-400">Email us</span>
            <span className="font-semibold break-all">{email}</span>
          </span>
        </a>
      </div>

      <Section title="Where do I send a return?">
        <div className="flex items-start gap-3">
          <MapPin className={icon} />
          <p>
            {BRAND.name} is a marketplace, so we don&apos;t hold a central warehouse. A returned product goes back to
            the <b className="text-white">seller who sold it</b>, and the return address is that seller&apos;s address.
            Please contact us first with your order number and we&apos;ll give you the correct address and confirm the
            return before you send anything.
          </p>
        </div>
      </Section>

      <Section title="When contacting us, please include">
        <ul className="list-disc pl-5 space-y-1">
          <li>Your order number (shown on the My Orders page)</li>
          <li>The mobile number used for the order</li>
          <li>A short description of the problem, and photos if the item arrived damaged</li>
        </ul>
      </Section>
    </InfoPage>
  );
}
