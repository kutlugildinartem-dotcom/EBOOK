import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Leaf — читать и понимать',description:'Английские книги, которые становятся понятнее с каждой страницей.'};
export default function RootLayout({children}: {children:React.ReactNode}) {return <html lang="ru"><head><link rel="preload" as="fetch" href="/dictionary/fast-v3.json.gz" crossOrigin="anonymous"/></head><body>{children}</body></html>}
