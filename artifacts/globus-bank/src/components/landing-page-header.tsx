import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'wouter';
import { AppLanguageSelector } from '@/components/app-language-selector';
import './landing-page-header.css';

export type LandingPageHeaderProps = {
  isSignedIn: boolean;
  t: (message: string) => string;
  className?: string;
};

export function LandingPageHeader({
  isSignedIn,
  t,
  className = '',
}: LandingPageHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = 'globus-landing-navigation';

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isMenuOpen]);

  const closeMenuOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') setIsMenuOpen(false);
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={`globus-landing-header ${className}`.trim()} onKeyDown={closeMenuOnEscape}>
      <div className="globus-landing-header__bar">
        <Link
          href={isSignedIn ? '/home' : '/'}
          aria-label={t('DUTSTAR BANK home')}
          className="globus-landing-header__brand"
          data-testid="link-globus-home"
          onClick={closeMenu}
        >
          <img
            src={`${import.meta.env.BASE_URL}dutstar-mark.svg`}
            alt={t('DUTSTAR BANK — Your world. Our priority.')}
          />
        </Link>

        <div className="globus-landing-header__controls">
          <AppLanguageSelector
            className="globus-landing-header__language"
            testId="select-language"
            compactLabel
          />

          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="globus-landing-header__account globus-landing-header__account--signed-in"
              data-testid="link-header-dashboard"
              onClick={closeMenu}
            >
              {t('Dashboard')}
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="globus-landing-header__signin"
                data-testid="link-header-sign-in"
                onClick={closeMenu}
              >
                {t('Sign in')}
              </Link>
              <Link
                href="/sign-up"
                className="globus-landing-header__account"
                data-testid="link-header-open-account"
                onClick={closeMenu}
              >
                {t('Open an account')}
              </Link>
            </>
          )}

          <div className="globus-landing-header__menu-anchor" ref={menuRef}>
            <button
              type="button"
              className="globus-landing-header__menu-toggle"
              aria-label={isMenuOpen ? t('Close navigation menu') : t('Open navigation menu')}
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
              onClick={() => setIsMenuOpen(open => !open)}
              data-testid="button-toggle-landing-navigation"
            >
              {isMenuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
              <span className="globus-landing-header__menu-label">{isMenuOpen ? t('Close') : t('Menu')}</span>
            </button>

            <nav
              id={menuId}
              className={`globus-landing-header__menu${isMenuOpen ? ' is-open' : ''}`}
              aria-label={t('Landing page navigation')}
              hidden={!isMenuOpen}
              data-testid="landing-navigation-menu"
            >
              <p className="globus-landing-header__menu-eyebrow">{t('Explore DUTSTAR')}</p>
              <a href="#features" onClick={closeMenu} data-testid="link-nav-features">{t('Features')}</a>
              <a href="#account-record" onClick={closeMenu} data-testid="link-nav-account-record">{t('Account record')}</a>
              <div className="globus-landing-header__menu-auth">
                {!isSignedIn && (
                  <>
                    <Link href="/sign-in" onClick={closeMenu} data-testid="link-menu-sign-in">{t('Sign in')}</Link>
                    <Link href="/sign-up" onClick={closeMenu} data-testid="link-menu-open-account">{t('Open an account')}</Link>
                  </>
                )}
                {isSignedIn && <Link href="/dashboard" onClick={closeMenu} data-testid="link-menu-dashboard">{t('Dashboard')}</Link>}
              </div>
              <span className="globus-landing-header__menu-divider" aria-hidden="true" />
              <Link href="/fees" onClick={closeMenu} data-testid="link-nav-fees">{t('Fees')}</Link>
              <Link href="/contact" onClick={closeMenu} data-testid="link-nav-contact">{t('Contact')}</Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

export default LandingPageHeader;
