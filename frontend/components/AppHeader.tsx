'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

const NAV: NavItem[] = [
  { href: '/data-sources', label: 'Data Sources' },
  { href: '/production', label: 'Production Lines' },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/data-sources" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-500 text-sm font-bold text-white">
            C
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight">Celesnity</span>
          <span className="hidden text-xs font-medium text-slate-400 sm:inline">
            Factory Data &amp; Production
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'rounded-md bg-slate-800 px-3 py-1.5 font-semibold text-white'
                    : 'rounded-md px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
