import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Globe2, Search } from 'lucide-react';
import { appLanguages, useLanguage } from '@/lib/i18n';

type AppLanguageSelectorProps = {
  className?: string;
  testId?: string;
  compactLabel?: boolean;
};

export function AppLanguageSelector({
  className = '',
  testId = 'select-app-language',
  compactLabel = false,
}: AppLanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = appLanguages.find(option => option.code === language) ?? appLanguages[0];
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return appLanguages.filter(option =>
      !query || option.label.toLocaleLowerCase().includes(query) || option.code === query,
    );
  }, [search]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setSearch('');
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(0, filtered.findIndex(option => option.code === language));
    setActive(selectedIndex);
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => setActive(0), [search]);

  const choose = (code: typeof language) => {
    setLanguage(code);
    close();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(index => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => Math.max(0, index - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option.code);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        aria-label={t('Language: {language}', { language: selected.label })}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-2.5 text-left text-[#344b64] outline-none transition hover:border-[#9ab9bd] focus-visible:border-[#77aeb0] focus-visible:ring-2 focus-visible:ring-[#77aeb0]/20 ${open ? 'border-[#77aeb0] ring-2 ring-[#77aeb0]/15' : 'border-[#dfe6eb]'}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Globe2 size={14} aria-hidden="true" className="shrink-0 text-[#4f8b90]" />
          <span className="truncate text-[10px] font-bold sm:text-[11px]">{compactLabel ? selected.code.toUpperCase() : selected.label}</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[#7d8d9d] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          data-testid={`${testId}-drawer`}
          className="app-language-selector__drawer absolute right-0 top-[calc(100%+6px)] z-[90] w-[min(16rem,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#d9e4e8] bg-white shadow-[0_18px_40px_rgba(20,45,75,.16)]"
        >
          <label className="relative block border-b border-[#edf1f3] p-2">
            <span className="sr-only">{t('Search languages')}</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#8695a5]" />
            <input
              ref={searchRef}
              data-testid={`${testId}-search`}
              role="combobox"
              aria-label={t('Search languages')}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].code}` : undefined}
              aria-autocomplete="list"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t('Search languages')}
              className="h-9 w-full rounded-lg bg-[#f5f8f9] pl-8 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-[#77aeb0]/25"
            />
          </label>
          <ul
            id={listId}
            role="listbox"
            aria-label={t('Language')}
            className="max-h-[min(260px,35dvh)] overflow-y-auto overscroll-contain p-1"
          >
            {filtered.map((option, index) => (
              <li
                key={option.code}
                id={`${listId}-${option.code}`}
                role="option"
                aria-selected={language === option.code}
                onMouseDown={event => event.preventDefault()}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(option.code)}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[12px] text-[#3a516a] ${index === active ? 'bg-[#eaf4f5]' : ''}`}
              >
                <span className="truncate">{option.label}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-[#8b98a5]">
                  {option.code.toUpperCase()}
                  {language === option.code && <Check size={14} aria-hidden="true" className="text-[#408589]" />}
                </span>
              </li>
            ))}
            {!filtered.length && (
              <li className="px-3 py-6 text-center text-[12px] text-[#8794a2]">{t('No language matches that search.')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
