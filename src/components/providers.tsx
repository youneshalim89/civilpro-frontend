'use client';
// src/components/providers.tsx — Providers globaux
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '10px', background: '#1a1f2e', color: '#fff' },
          success: { iconTheme: { primary: '#f08c0a', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}
