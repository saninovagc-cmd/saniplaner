'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import FirstLoginModal from '@/components/FirstLoginModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, isAuthLoading } = useApp();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated && !isLoginPage) {
        // Redirection directe et garantie vers la page de connexion
        window.location.replace('/login');
      } else if (isAuthenticated && isLoginPage) {
        window.location.replace('/');
      }
    }
  }, [isAuthenticated, isAuthLoading, isLoginPage]);

  // Loading state while checking localStorage session
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans text-center p-4">
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

  // Not authenticated: show brief transition while redirecting with direct manual fallback button
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans text-center p-4">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-white uppercase tracking-wider">SANINOVA HUB</p>
          <p className="text-xs text-slate-400">Redirection vers la page de connexion...</p>
        </div>
        <a
          href="/login"
          className="mt-3 px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-lg transition inline-flex items-center space-x-2"
        >
          <span>Accéder à la connexion</span>
          <span>&rarr;</span>
        </a>
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
