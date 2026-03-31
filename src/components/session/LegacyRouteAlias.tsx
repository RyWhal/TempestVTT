import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LegacyRouteAliasProps {
  to: string;
  children: React.ReactNode;
}

export const LegacyRouteAlias: React.FC<LegacyRouteAliasProps> = ({ to, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);

  return <>{children}</>;
};
