import './globals.css';
import type { Metadata } from 'next';
import { Inter, Fredoka } from 'next/font/google';
import { AppProvider } from '@/lib/app-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fredoka = Fredoka({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fun' });

export const metadata: Metadata = {
  title: 'Adventure Learning Quest',
  description: 'A fun learning adventure for 5th graders — math, science, history, geography, and more!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fredoka.variable} font-sans`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
