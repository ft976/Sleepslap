import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Sleep Slap — Late-Night Arcade',
  description:
    'Mobile-first hand-drawn ink & photo-cutout arcade game with aiming ray physics, comic starburst hits, and custom voice-line loader.',
  openGraph: {
    title: 'Sleep Slap — Late-Night Arcade',
    description:
      'Mobile-first hand-drawn ink & photo-cutout arcade game with aiming ray physics, comic starburst hits, and custom voice-line loader.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sleep Slap — Late-Night Arcade',
    description:
      'Mobile-first hand-drawn ink & photo-cutout arcade game with aiming ray physics, comic starburst hits, and custom voice-line loader.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#EAEAEA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body
        suppressHydrationWarning
        className="font-sans bg-[#EAEAEA] text-[#222222] antialiased overflow-hidden select-none"
      >
        {children}
      </body>
    </html>
  );
}
