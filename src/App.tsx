import { useEffect, useState } from 'react';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import BhishiDetail from './pages/BhishiDetail';
import Calculator from './pages/Calculator';

function useHash() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export const navigate = (path: string) => {
  window.location.hash = path;
};

export default function App() {
  const path = useHash();
  const [, section, id] = path.split('/');

  let page;
  if (section === 'new') page = <Onboarding />;
  else if (section === 'bhishi' && id) page = <BhishiDetail id={id} />;
  else if (section === 'calculator') page = <Calculator />;
  else page = <Home />;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          🪙 Bhishi Manager
        </a>
        <nav>
          <a href="#/" className={!section ? 'active' : ''}>
            My Bhishis
          </a>
          <a href="#/calculator" className={section === 'calculator' ? 'active' : ''}>
            Calculator
          </a>
          <a href="#/new" className="btn btn-small">
            + New Bhishi
          </a>
        </nav>
      </header>
      <main>{page}</main>
    </div>
  );
}
