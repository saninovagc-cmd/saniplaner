'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import FirstLoginModal from '@/components/FirstLoginModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isAuthLoading } = useApp();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated && !isLoginPage) {
        router.replace('/login');
      } else if (isAuthenticated && isLoginPage) {
        router.replace('/');
      }
    }
  }, [isAuthenticated, isAuthLoading, isLoginPage, router]);

  // Loading state while checking localStorage session
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-sm font-bold text-white uppercase tracking-wider">SANINOVA HUB</p>
          <p className="text-xs text-slate-400 mt-1">Vérification de la session en cours...</p>
        </div>
      </div>
    );
  }

  // Login page is rendered full-screen without Sidebar and Header
  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-950">{children}</main>;
  }

  // Not authenticated: show brief transition while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Redirection vers la page de connexion...</p>
      </div>
    );
  }

  // Authenticated application layout
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <FirstLoginModal />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
