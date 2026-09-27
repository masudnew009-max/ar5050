export default function Footer() {
  return (
    <footer className="mt-12 border-t border-dark-700/60 bg-dark-900">
      <div className="px-4 lg:px-8 py-6 text-center text-dark-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Marketplace. All rights reserved.</p>
      </div>
    </footer>
  );
}
