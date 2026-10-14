import { LangProvider } from './i18n/LangContext.jsx';
import { ToolsProvider } from './state/ToolsContext.jsx';
import Nav from './components/Nav.jsx';
import GalaxyStage from './components/galaxy/GalaxyStage.jsx';
import Hero from './components/Hero.jsx';
import FeatureCards from './components/FeatureCards.jsx';
import { BcpSection, ReddeningSection, SkyMapSection, ToolsBoxSection } from './components/ShowcaseSections.jsx';
import { CiteSection, ContactAndFooter, PackageSection, ResourcesBand } from './components/InfoSections.jsx';
import ToolModal from './components/ToolModal.jsx';

export default function App() {
  return (
    <LangProvider initialLang="zh">
      <ToolsProvider>
        <div className="page">
          <GalaxyStage />
          <Nav />
          <main>
            <div id="top" className="container">
              <Hero />
              <FeatureCards />
              <SkyMapSection />
              <BcpSection />
              <ReddeningSection />
              <ToolsBoxSection />
              <PackageSection />
              <CiteSection />
            </div>
            <ResourcesBand />
            <ContactAndFooter />
          </main>
          <ToolModal />
        </div>
      </ToolsProvider>
    </LangProvider>
  );
}
