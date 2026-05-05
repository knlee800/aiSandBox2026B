import {notFound} from 'next/navigation';
import {TranslationProvider} from '../../components/TranslationProvider';
import SystemReadiness from '../../components/SystemReadiness';
import "../globals.css";
import fallbackMessages from '../../messages/en.json';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  // Await params in Next.js 15
  const { locale } = await params;

  // Validate the locale
  const locales = ['en', 'zh-TW', 'zh-CN'];
  if (!locales.includes(locale)) {
    notFound();
  }

  // Manually import JSON file based on locale
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale}>
      <body>
        <TranslationProvider
          locale={locale}
          messages={messages}
          fallbackMessages={fallbackMessages}
        >
          <SystemReadiness />
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
