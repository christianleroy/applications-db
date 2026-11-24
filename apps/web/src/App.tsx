import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { config } from './config';
import { ClientProvider, createClient } from './data/ClientProvider';
import { BackendGate, createGateSignal, createQueryClient } from './components/BackendGate';
import { Layout } from './components/Layout';
import { Button } from '@/components/ui/button';
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
                    <QuickAddDialog
                      open={quickAddOpen}
                      onClose={() => setQuickAddOpen(false)}
                      trigger={
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setQuickAddOpen(true)}
                          className="bg-white text-primary hover:bg-white/90 focus-visible:ring-white/60"
                        >
                          <PlusIcon aria-hidden="true" />
                          Add application
                        </Button>
                      }
                    />
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
