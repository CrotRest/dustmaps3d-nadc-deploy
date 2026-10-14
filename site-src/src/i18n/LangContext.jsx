import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { STRINGS } from './strings.js';
import { TOOL_DOCS } from './docs.js';

const LangContext = createContext(null);

export function LangProvider({ initialLang = 'zh', children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = STRINGS[lang].docTitle;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: STRINGS[lang], docs: TOOL_DOCS[lang] }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
