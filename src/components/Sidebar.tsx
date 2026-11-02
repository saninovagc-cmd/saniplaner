'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Activity, 
  PackageCheck, 
  MapPin, 
  GraduationCap, 
  FileCheck2, 
  FolderArchive, 
  FileSpreadsheet, 
  ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Tableau de Bord', href: '/', icon: LayoutDashboard, badge: 'Général' },
  { label: 'Work Plan', href: '/work-plan', icon: CalendarCheck, badge: 'Activités' },
  { label: 'Suivi B09 (eSIGL)', href: '/b09', icon: Activity, badge: '>= 70%' },
  { label: 'Suivi B13 (Quantif)', href: '/b13', icon: PackageCheck, badge: '2 Livrables' },
  { label: 'Missions de Terrain', href: '/missions', icon: MapPin },
  { label: 'Formations', href: '/formations', icon: GraduationCap },
  { label: 'Livrables PSI', href: '/livrables', icon: FileCheck2 },
  { label: 'Documentation & GED', href: '/documentation', icon: FolderArchive },
  { label: 'Rapports & Exports', href: '/rapports', icon: FileSpreadsheet, badge: 'PDF/XLS' },
  { label: 'Administration', href: '/administration', icon: ShieldCheck, badge: 'RLS' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 min-h-screen flex flex-col border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white shadow-md shadow-teal-900/40 text-lg">
          SN
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white leading-tight">SANINOVA HUB</h1>
          <p className="text-[11px] text-teal-400 font-medium">AFGHS-PSI Bénin</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
          Pilotage du Projet
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-teal-700 text-teal-100' : 'bg-slate-800 text-slate-400'
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
          <span className="font-medium text-slate-300">Période du projet :</span>
          <span className="text-teal-400 font-semibold">2026 - 2027</span>
        </div>
        <p className="text-[10px] text-slate-400">SaniNova Global Consulting</p>
      </div>
    </aside>
  );
}
