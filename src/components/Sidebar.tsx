'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const { currentUser, lastSyncTime } = useApp();

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

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 min-h-screen flex flex-col border-r border-slate-800 shrink-0 font-sans">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded bg-teal-600 group-hover:bg-teal-500 transition flex items-center justify-center font-bold text-white text-xs tracking-wider">
            SN
          </div>
          <div>
            <h1 className="font-bold text-xs tracking-wider text-white uppercase group-hover:text-teal-300 transition">SANINOVA HUB</h1>
            <p className="text-[11px] text-teal-400 font-medium">AFGHS-PSI Bénin</p>
          </div>
        </Link>
      </div>

      {/* Nav List */}
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
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-teal-700 text-white shadow-xs font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className={`text-[10px] font-mono ${isActive ? 'text-teal-200 font-bold' : 'text-slate-400'}`}>
                  {item.num}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info & Auto-Sync status */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium text-slate-300">Période :</span>
          <span className="text-teal-400 font-semibold">2026 - 2027</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
          <div className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Synchro Auto</span>
          </div>
          {lastSyncTime && (
            <span className="font-mono text-[9px] text-slate-500">{lastSyncTime}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
