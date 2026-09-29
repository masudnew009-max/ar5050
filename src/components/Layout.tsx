import { ReactNode, useState } from 'react';
import { AuthModal } from './AuthModal';
import Header from './Header';
import MobileMenu from './MobileMenu';
import BottomNav from './BottomNav';
import Footer from './Footer';
import InstallButton from './InstallButton';

interface LayoutProps {
  children: ReactNode;
  /** Edge-to-edge content with no padding/footer (used by the Reels feed). */
  fullBleed?: boolean;
}

export default function Layout({ children, fullBleed = false }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col" style={{ paddingBottom: 'var(--bottom-nav-h)' }}>
      <Header onLoginClick={() => setShowAuthModal(true)} onMenuClick={() => setMenuOpen(true)} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} onLoginClick={() => setShowAuthModal(true)} />

      <main className="flex-1 pt-16">
        {fullBleed ? (
          children
        ) : (
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">{children}</div>
        )}
      </main>

      {!fullBleed && <Footer />}

      <BottomNav
        onLoginClick={() => setShowAuthModal(true)}
        onCategoriesClick={() => setMenuOpen(true)}
        categoriesActive={menuOpen}
      />
      <InstallButton />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
