import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { useThemeSync } from '@/design-system/theme';
import { Sidebar } from './Sidebar';
import { BottomNav, MobileHeader, QuickAddFab } from './MobileNav';
import { QuickAddSheet } from './QuickAddSheet';
import { UpdatePrompt } from './UpdatePrompt';
import { DataStatusScreen } from './DataStatusScreen';
import { Toaster } from '@/design-system';

export function AppShell() {
  useThemeSync();
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pt-10 md:pb-12"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <QuickAddFab />
      <QuickAddSheet />
      <Toaster>
        <UpdatePrompt />
      </Toaster>
      <DataStatusScreen />
      <ScrollRestoration />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-xl bg-surface-muted" />
      <div className="h-32 rounded-2xl bg-surface-muted" />
      <div className="h-32 rounded-2xl bg-surface-muted" />
    </div>
  );
}
