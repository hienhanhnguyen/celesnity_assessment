import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader.tsx';
import './globals.css';

export const metadata: Metadata = {
  title: 'Celesnity - Factory Data & Production',
  description:
    'Collect factory data from local sources, normalize it into one traceable dataset, and manage production-line status.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-800">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
