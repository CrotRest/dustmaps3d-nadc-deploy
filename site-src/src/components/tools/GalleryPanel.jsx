import { useLang } from '../../i18n/LangContext.jsx';
import { GALLERY, NADC_RESOURCES_URL } from '../../data/content.js';
import RichText from '../ui/RichText.jsx';
import './reference.css';

/** The twelve figures of the NADC resources page: local previews, originals on NADC. */
export default function GalleryPanel() {
  const { t } = useLang();
  return (
    <div className="gallery">
      <p className="gallery__intro">
        <RichText text={t.galleryIntro.replace('{url}', NADC_RESOURCES_URL)} />
      </p>
      <div className="gallery__grid">
        {GALLERY.map((fig, i) => (
          <figure key={fig.href} className={`gallery__item${i === 0 ? ' gallery__item--wide' : ''}`}>
            <a className="gallery__plate" href={fig.src} target="_blank" rel="noopener noreferrer">
              <img src={fig.src} alt={t.galleryCaptions[i].slice(0, 60)} loading="lazy" decoding="async" />
            </a>
            <figcaption className="gallery__caption">
              <p>
                <RichText text={t.galleryCaptions[i]} />
              </p>
              <a className="gallery__download" href={fig.href} target="_blank" rel="noopener noreferrer">
                ↓ {t.galleryDownload} · PNG {fig.px} · {fig.size}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
