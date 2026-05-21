import './globals.css';
import { LanguageProvider } from './context/LanguageContext';

export const metadata = {
  title: 'Research Thread Agent',
  description: 'Curate the latest AI/ML research from arXiv, Hugging Face, and GitHub.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAF7F2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
