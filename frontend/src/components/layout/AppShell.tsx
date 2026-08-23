import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

interface Props { children?: React.ReactNode }

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
