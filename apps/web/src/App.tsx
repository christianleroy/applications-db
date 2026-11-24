import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { config } from './config';
import { ClientProvider, createClient } from './data/ClientProvider';
import { BackendGate, createGateSignal, createQueryClient } from './components/BackendGate';
import { Layout } from './components/Layout';
import { QuickAddDialog } from './components/QuickAddDialog';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatisticsPage } from './pages/StatisticsPage';

export function App() {
  const [client] = useState(() => createClient(config));
  const [signal] = useState(createGateSignal);
  const [queryClient] = useState(() => createQueryClient(signal));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  return (
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <BackendGate dataSource={config.dataSource} signal={signal} queryClient={queryClient}>
          <Routes>
            <Route
              element={
                <Layout
                  headerActions={
                    <>
                      <button
                        type="button"
                        onClick={() => setQuickAddOpen(true)}
                        className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800"
                      >
                        Add application
                      </button>
                      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
                    </>
                  }
                />
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
              <Route path="statistics" element={<StatisticsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BackendGate>
      </ClientProvider>
    </QueryClientProvider>
  );
}
