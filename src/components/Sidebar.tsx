'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { num: '01', label: 'Tableau de Bord', href: '/', badge: 'Général' },
  { num: '02', label: 'Work Plan', href: '/work-plan', badge: 'Activités' },
  { num: '03', label: 'Suivi B09 (eSIGL)', href: '/b09', badge: '>= 70%' },
  { num: '04', label: 'Suivi B13 (Quantif)', href: '/b13', badge: '2 Livrables' },
  { num: '05', label: 'Missions de Terrain', href: '/missions' },
  { num: '06', label: 'Formations', href: '/formations' },
  { num: '07', label: 'Livrables PSI', href: '/livrables' },
  { num: '08', label: 'Documentation & GED', href: '/documentation' },
  { num: '09', label: 'Rapports & Exports', href: '/rapports', badge: 'PDF / XLS' },
  { num: '10', label: 'Administration', href: '/administration', badge: 'Sécurité' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 min-h-screen flex flex-col border-r border-slate-800 shrink-0 font-sans">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded bg-teal-600 flex items-center justify-center font-bold text-white text-xs tracking-wider">
            SN
          </div>
          <div>
            <h1 className="font-bold text-xs tracking-wider text-white uppercase">SANINOVA HUB</h1>
            <p className="text-[11px] text-teal-400 font-medium">AFGHS-PSI Bénin</p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Pilotage du Projet
        </div>
        {NAV_ITEMS.map((item) => {
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

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium text-slate-300">Période :</span>
          <span className="text-teal-400 font-semibold">2026 - 2027</span>
        </div>
        <p className="text-[10px] text-slate-400">SaniNova Global Consulting</p>
      </div>
    </aside>
  );
}
