import React from 'react';
import { Outlet } from 'react-router-dom';

export const DunGENLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-storm-950 text-storm-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
};
