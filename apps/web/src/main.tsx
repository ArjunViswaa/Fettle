import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queries';
import { ThemeProvider, useTheme } from './lib/theme';
import { router } from './router';
import './styles.css';

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      offset={{ bottom: 100, right: 16 }}
      mobileOffset={{ bottom: 100 }}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text)',
          borderRadius: '16px',
        },
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <ThemedToaster />
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
);
