'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

interface NavItemDef {
  id: string;
  num: string;
  label: string;
  href: string;
  badge?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'dashboard', num: '01', label: 'Tableau de Bord', href: '/', badge: 'Général' },
  { id: 'work_plan', num: '02', label: 'Work Plan', href: '/work-plan', badge: 'Activités' },
  { id: 'planning_hebdo', num: '03', label: 'Planning Hebdo', href: '/planning-hebdo', badge: 'Semaine' },
  { id: 'timesheets', num: '04', label: 'Timesheets Mensuels', href: '/timesheets', badge: 'Temps' },
  { id: 'budget', num: '05', label: 'Budget & Finances PSI', href: '/budget', badge: '406,9M' },
  { id: 'b09', num: '06', label: 'Suivi B09 (eSIGL)', href: '/b09', badge: '>= 70%' },
  { id: 'b13', num: '07', label: 'Suivi B13 (Quantif)', href: '/b13', badge: 'Unités B13' },
  { id: 'missions', num: '08', label: 'Missions de Terrain', href: '/missions' },
  { id: 'formations', num: '09', label: 'Formations', href: '/formations' },
  { id: 'livrables', num: '10', label: 'Livrables PSI', href: '/livrables' },
  { id: 'documentation', num: '11', label: 'Documentation & GED', href: '/documentation' },
  { id: 'rapports', num: '12', label: 'Rapports & Exports', href: '/rapports', badge: 'PDF / XLS' },
  { id: 'administration', num: '13', label: 'Administration', href: '/administration', badge: 'Sécurité' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, lastSyncTime, logout, mobileSidebarOpen, setMobileSidebarOpen } = useApp();

  const handleLogout = () => {
    if (window.confirm(`Confirmez-vous la déconnexion de ${currentUser.full_name} ?`)) {
      setMobileSidebarOpen(false);
      logout();
      router.replace('/login');
    }
  };

  // Filter modules based on user's authorized modules
  const visibleItems = NAV_ITEMS.filter((item) => {
    // Direction always sees all modules
    if (currentUser.role === 'direction') return true;

    // If allowed_modules is customized for this user, respect it strictly
    if (currentUser.allowed_modules && Array.isArray(currentUser.allowed_modules)) {
      return currentUser.allowed_modules.includes(item.id);
    }

    // Default fallback: all modules except administration
    return item.id !== 'administration';
  });

  const renderNavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex justify-between items-center">
        <span>Modules Autorisés</span>
        <span className="font-mono text-[9px] text-slate-500">
          {visibleItems.length}/{NAV_ITEMS.length}
        </span>
      </div>
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileSidebarOpen(false)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
              isActive
                ? 'bg-teal-700 text-white shadow-xs font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate">
              <span className={`text-[10px] font-mono shrink-0 ${isActive ? 'text-teal-200 font-bold' : 'text-slate-400'}`}>
                {item.num}
              </span>
              <span className="truncate">{item.label}</span>
            </div>
            {item.badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ml-1.5 ${
                isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-800 text-slate-400'
              }`}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderFooter = () => (
    <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-400 space-y-2.5">
      {/* Current User Card */}
      <div className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/90 border border-slate-800">
        <div className="w-8 h-8 rounded-full bg-teal-800 text-teal-200 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs border border-teal-700">
          {currentUser.full_name.charAt(0)}
        </div>
        <div className="truncate min-w-0 flex-1">
          <div className="font-bold text-white text-xs truncate">{currentUser.full_name}</div>
          <div className="text-[10px] text-teal-400 font-mono truncate">@{currentUser.username || 'user'}</div>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
        <span className="font-medium text-slate-400">Période : <span className="text-teal-400 font-semibold">2026 - 2027</span></span>
        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-mono text-[9px] text-slate-500">{lastSyncTime || 'Connecté'}</span>
        </div>
      </div>

      {/* Logout button */}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/60 hover:border-rose-700 text-xs font-bold transition shadow-xs cursor-pointer group"
        title="Se déconnecter de la plateforme"
      >
        <svg className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Déconnexion</span>
      </button>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP SIDEBAR (Visible on lg and larger) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-200 h-screen flex-col border-r border-slate-800 shrink-0 font-sans sticky top-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="relative h-9 w-auto max-w-[110px] flex items-center shrink-0">
              <Image
                src="/images/logo-saninova-white.png"
                alt="SaniNova"
                width={110}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
            </div>
            <div className="truncate border-l border-slate-800 pl-2">
              <h1 className="font-bold text-[11px] tracking-wider text-white uppercase group-hover:text-teal-300 transition truncate">
                HUB OPÉRATIONNEL
              </h1>
              <p className="text-[10px] text-teal-400 font-medium truncate">AFGHS-PSI Bénin</p>
            </div>
          </Link>
        </div>

        {/* Nav List */}
        {renderNavList()}

        {/* Footer Info & Auto-Sync status */}
        {renderFooter()}
      </aside>

      {/* 2. MOBILE OFF-CANVAS DRAWER (Slide-over on mobile & tablet < lg) */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Dark Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setMobileSidebarOpen(false)}
        />

        {/* Slide-in Navigation Sheet */}
        <aside
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 text-slate-200 flex flex-col shadow-2xl border-r border-slate-800 transition-transform duration-300 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Mobile Header with Close button */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <Link 
              href="/" 
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center space-x-2.5 group"
            >
              <div className="relative h-8 w-auto max-w-[100px] flex items-center shrink-0">
                <Image
                  src="/images/logo-saninova-white.png"
                  alt="SaniNova"
                  width={100}
                  height={32}
                  className="h-7 w-auto object-contain"
                />
              </div>
              <div className="border-l border-slate-800 pl-2">
                <h2 className="font-bold text-[11px] tracking-wider text-white uppercase">HUB OPÉRATIONNEL</h2>
                <p className="text-[10px] text-teal-400 font-medium">AFGHS-PSI Bénin</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Fermer le menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav List */}
          {renderNavList()}

          {/* Current User Quick Info in Mobile Drawer */}
          <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
              {currentUser.full_name.charAt(0)}
            </div>
            <div className="truncate text-xs">
              <div className="font-bold text-white truncate">{currentUser.full_name}</div>
              <div className="text-[10px] text-teal-400 font-mono">@{currentUser.username || 'user'}</div>
            </div>
          </div>

          {/* Footer Info */}
          {renderFooter()}
        </aside>
      </div>
    </>
  );
}
