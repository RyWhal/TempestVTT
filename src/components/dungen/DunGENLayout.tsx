import React from 'react';
import { Outlet } from 'react-router-dom';

interface DunGENLayoutProps {
  children?: React.ReactNode;
}

export const DunGENLayout: React.FC<DunGENLayoutProps> = ({ children }) => {
  return (
    <div className="tempest-shell">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {children ?? <Outlet />}
      </div>
    </div>
  );
};
