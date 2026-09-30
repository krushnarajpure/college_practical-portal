import { useEffect } from 'react';
import MyraaApp from '@myraa/App.tsx';
import { ApiKeyGate } from '@myraa/components/ApiKeyGate.tsx';

const MYRAA_STYLE_ID = 'myraa-integrated-styles';

export default function MyraaIntegrated() {
  useEffect(() => {
    if (document.getElementById(MYRAA_STYLE_ID)) return undefined;
    const link = document.createElement('link');
    link.id = MYRAA_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/myraa-assets/assets/index-CgR-eYnk.css';
    document.head.appendChild(link);
    return () => {
      document.getElementById(MYRAA_STYLE_ID)?.remove();
    };
  }, []);

  return <section className="myraa-integrated-shell"><ApiKeyGate><MyraaApp /></ApiKeyGate></section>;
}
