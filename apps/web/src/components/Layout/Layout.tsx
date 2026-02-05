import { ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-surface-border py-6">
        <div className="container mx-auto px-4 text-center text-text-muted text-sm font-mono">
          <span className="text-accent-cyan">●</span> Splat Library — 3D Gaussian Splatting Platform
        </div>
      </footer>
    </div>
  );
}
