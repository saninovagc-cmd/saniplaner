import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'SaniNova Project Hub | AFGHS-PSI Bénin',
  description: 'Plateforme intégrée de gestion et de pilotage du projet AFGHS-PSI Bénin (B09 & B13)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('unhandledrejection', function(event) {
                  console.warn('[SaniNova Hub] Promesse asynchrone interceptée :', event.reason);
                  event.preventDefault();
                });
                window.addEventListener('error', function(event) {
                  if (!event.message || 
                      event.message.indexOf('ResizeObserver') !== -1 ||
                      event.message.indexOf('WebSocket') !== -1 ||
                      event.message.indexOf('Failed to fetch') !== -1 ||
                      event.message.indexOf('NetworkError') !== -1 ||
                      event.message.indexOf('Loading chunk') !== -1 ||
                      event.message.indexOf('dynamically imported module') !== -1) {
                    event.preventDefault();
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased font-sans">
        <AppProvider>
          <AppShell>
            {children}
          </AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
