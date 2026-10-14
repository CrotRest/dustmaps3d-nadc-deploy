import { useLang } from '../../i18n/LangContext.jsx';
import { REFERENCE } from '../../i18n/reference.js';
import ReferenceDoc from './ReferenceDoc.jsx';

/** The dustmaps3d package documentation. */
export default function DocsPanel() {
  const { lang } = useLang();
  return <ReferenceDoc blocks={REFERENCE[lang].docs} />;
}
