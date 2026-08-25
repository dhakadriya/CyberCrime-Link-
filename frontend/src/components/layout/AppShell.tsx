import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface Props { children?: React.ReactNode }

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

