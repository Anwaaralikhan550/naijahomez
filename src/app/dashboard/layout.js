// app/dashboard/layout.js
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout({ children }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: '#4caf50',
              color: 'white',
            },
          },
          error: {
            style: {
              background: '#f44336',
              color: 'white',
            },
          },
        }}
      />
    </>
  );
}