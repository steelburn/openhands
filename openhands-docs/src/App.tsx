import { useState, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import CodePanel from './components/CodePanel';
import { topTabs, navigationByTab } from './data/navigation';
import { getPage } from './data/pages';

export default function App() {
  const [activeTab, setActiveTab] = useState('introduction');
  const [activePage, setActivePage] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    const tab = topTabs.find(t => t.id === tabId);
    if (tab) {
      const navItems = navigationByTab[tabId];
      if (navItems && navItems.length > 0) {
        setActivePage(navItems[0].route);
      } else {
        setActivePage(tab.slug);
      }
    }
  }, []);

  const handlePageChange = useCallback((route: string) => {
    setActivePage(route);
    setMobileSidebarOpen(false);
  }, []);

  const navItems = navigationByTab[activeTab] || [];
  const currentPage = getPage(activePage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          navItems={navItems}
          activePage={activePage}
          onPageChange={handlePageChange}
          searchQuery={searchQuery}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        <ContentArea page={currentPage} onPageChange={handlePageChange} />
        <CodePanel page={currentPage} />
      </div>
    </div>
  );
}
