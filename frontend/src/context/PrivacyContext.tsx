import { createContext, useContext, useState } from 'react';

interface PrivacyContextType {
  hidden: boolean;
  toggle: () => void;
  mask: (value: string) => string;
}

const MASK = '••••••';

const PrivacyContext = createContext<PrivacyContextType>({
  hidden: false,
  toggle: () => {},
  mask: (v) => v,
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(() => {
    const stored = localStorage.getItem('finbrief_privacy');
    return stored === null ? true : stored === 'true';
  });

  const toggle = () => {
    setHidden((prev) => {
      const next = !prev;
      localStorage.setItem('finbrief_privacy', String(next));
      return next;
    });
  };

  const mask = (value: string) => (hidden ? MASK : value);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle, mask }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
