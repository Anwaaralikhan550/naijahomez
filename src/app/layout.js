// app/layout.js
import "./globals.css";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { GeolocationProvider } from '@/context/GeolocationContext';
import { AuthProvider } from '@/context/AuthContext';
import AuthErrorBoundary from '@/components/auth/AuthErrorBoundary';
import { Toaster } from 'react-hot-toast';
import ScrollToTop from '@/components/shared/ScrollToTop';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';

export const metadata = {
  title: 'Nijahomzs - Properties, Marketplace & Services',
  description: 'Discover properties, marketplace items, and professional services on Nijahomzs',
  metadataBase: new URL('https://nijahomzs.com'),
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Nijahomzs',
    description: 'Your one-stop platform for properties, marketplace, and services',
    url: 'https://nijahomzs.com',
    siteName: 'Nijahomzs',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AnalyticsProvider>
          <AuthErrorBoundary>
            <AuthProvider>
              <GeolocationProvider>
                <Header />
                <main className="flex-grow pb-20 md:pb-0">
                  {children}
                </main>
                {/* Global footer for all routes */}
                <Footer />
                <Toaster 
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    }
                  }}
                />
                <ScrollToTop />
              </GeolocationProvider>
            </AuthProvider>
          </AuthErrorBoundary>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
