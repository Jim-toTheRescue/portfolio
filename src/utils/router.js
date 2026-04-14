import { useState, useEffect } from 'react';

function getHashPath() {
  const hash = window.location.hash;
  return hash ? hash.slice(1) : '/';
}

export function useRouter() {
  const [path, setPath] = useState(getHashPath());
  
  useEffect(() => {
    const handleHashChange = () => {
      setPath(getHashPath());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newPath) => {
    if (typeof newPath === 'number') {
      window.history.go(newPath);
    } else {
      window.location.hash = newPath;
    }
  };

  return { path, navigate };
}

export function useParams() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || '/');
  
  useEffect(() => {
    const handleHashChange = () => {
      setPath(window.location.hash.slice(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const params = {};
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const parts = cleanPath.split('/').filter(Boolean);
  
  if (parts.length >= 2 && parts[0] === 'note') {
    const symbolPart = parts[1].split('?')[0];
    params.symbol = symbolPart;
  }
  
  return params;
}