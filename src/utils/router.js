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
    window.location.hash = newPath;
  };

  return { path, navigate };
}

export function useParams() {
  const [path, setPath] = useState(window.location.pathname);
  
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const match = (pattern) => {
    const parts = path.split('/').filter(Boolean);
    const patternParts = pattern.split('/').filter(Boolean);
    
    const params = {};
    let matched = true;
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = parts[i];
      } else if (patternParts[i] !== parts[i]) {
        matched = false;
        break;
      }
    }
    
    return matched ? params : null;
  };

  return { path, match };
}