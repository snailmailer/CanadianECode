import { useState, useEffect, useRef, Children, isValidElement, cloneElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';
import sectionsData from './data/sections.json';

function App() {
  const [activeSectionId, setActiveSectionId] = useState(sectionsData[0]?.id || 'contents');
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [highlightTerm, setHighlightTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    'General': true,
    'Sections': true,
    'Tables & Diagrams': true,
    'Appendices': true,
    'Index': true
  });
  
  const speechRef = useRef(null);

  const activeSection = sectionsData.find(sec => sec.id === activeSectionId);

  useEffect(() => {
    // Stop speaking if the user switches sections
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
    // NOTE: highlightTerm is NOT cleared here — clearing it on activeSectionId
    // change would kill the highlight set by Contents-link or search-result clicks
    // before the component even renders. It is cleared by explicit user actions instead.
  }, [activeSectionId, searchQuery]);

  // Keep activeSectionId in sync if sectionsData loads/changes
  useEffect(() => {
    if (sectionsData.length > 0 && !sectionsData.find(sec => sec.id === activeSectionId)) {
      setActiveSectionId(sectionsData[0].id);
    }
  }, [sectionsData]);

  const stripMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/[#_*~`|>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\n\n+/g, '\n\n')
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, ''); // images
  };

  // Preprocess the Contents section so each entry appears on its own line
  const preprocessContents = (md) => {
    if (!md) return md;
    // Split on the pattern: italic page number (e.g. _53_ or _[53](#id)_) followed by a space
    // and then the next entry. We insert a newline after each italic page number.
    return md
      // Insert newline after every inline italic page number that is followed by more text
      // Matches: _number_ or _[number](#id)_ followed by a space and non-whitespace
      .replace(/(_\[?\d+\]?(?:\(#[^)]+\))?_)(?= +[^\n])/g, '$1  \n')
      // Also add newline before bold section headers that appear mid-paragraph
      // (they start with **[ or **S after a space)
      .replace(/ (?=\*\*\[)/g, '\n')
      // Collapse any extra blank lines created
      .replace(/\n{3,}/g, '\n\n');
  };

  // Strip raw HTML tags from PDF-extracted markdown so ReactMarkdown
  // doesn't render them as literal text (e.g. <br>, <sup>, <span>, etc.)
  const sanitizeMarkdown = (md) => {
    if (!md) return md;
    return md
      .replace(/<br\s*\/?>/gi, '  \n')   // <br> → markdown hard line-break
      .replace(/<[^>]+>/g, '');            // strip all other HTML tags
  };

  // Regex helpers for keyword highlighting
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightChildren = (nodes, term) => {
    if (!term || !term.trim()) return nodes;
    const escaped = escapeRegex(term.trim());
    const regex = new RegExp(`(${escaped})`, 'gi');
    return Children.map(nodes, (child) => {
      if (typeof child === 'string') {
        const parts = child.split(regex);
        if (parts.length === 1) return child;
        return parts.map((part, i) =>
          part.toLowerCase() === term.trim().toLowerCase()
            ? <mark key={i} className="search-highlight">{part}</mark>
            : part
        );
      }
      if (isValidElement(child) && child.props.children) {
        return cloneElement(child, {
          children: highlightChildren(child.props.children, term),
        });
      }
      return child;
    });
  };

  // Auto-scroll to the first highlighted match after navigation
  useEffect(() => {
    if (!highlightTerm) return;
    const timer = setTimeout(() => {
      const el = document.querySelector('mark.search-highlight');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightTerm, activeSectionId]);

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      if (activeSection) {
        window.speechSynthesis.cancel(); // clear queue
        
        // Strip markdown to make it readable
        const cleanText = stripMarkdown(activeSection.content);
        const paragraphs = cleanText.split('\n\n').filter(p => p.trim().length > 0);
        
        paragraphs.forEach((para, index) => {
          const utterance = new SpeechSynthesisUtterance(para);
          
          if (index === paragraphs.length - 1) {
            utterance.onend = () => {
              setIsPlaying(false);
            };
          }
          
          utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            window.speechSynthesis.cancel();
            setIsPlaying(false);
          };

          window.speechSynthesis.speak(utterance);
        });
        
        setIsPlaying(true);
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Search logic
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results = [];

    sectionsData.forEach(section => {
      if (section.content && section.content.toLowerCase().includes(query)) {
        // find a snippet
        const text = stripMarkdown(section.content);
        const lowerText = text.toLowerCase();
        const index = lowerText.indexOf(query);
        
        // Grab context around the keyword
        const start = Math.max(0, index - 60);
        const end = Math.min(text.length, index + query.length + 60);
        let snippet = text.substring(start, end).replace(/\n/g, ' ');
        
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        results.push({
          sectionId: section.id,
          title: section.title,
          snippet
        });
      }
    });

    return results;
  };

  const searchResults = getSearchResults();

  // Helper to categorize sections in sidebar
  const getSectionGroup = (id) => {
    if (id === 'contents') return 'General';
    if (id.startsWith('section-')) return 'Sections';
    if (id === 'tables' || id === 'diagrams') return 'Tables & Diagrams';
    if (id.startsWith('appendix-')) return 'Appendices';
    if (id === 'index') return 'Index';
    return 'Other';
  };

  // Group sections
  const groupedSections = {};
  sectionsData.forEach(section => {
    const grp = getSectionGroup(section.id);
    if (!groupedSections[grp]) {
      groupedSections[grp] = [];
    }
    groupedSections[grp].push(section);
  });

  const groupOrder = ['General', 'Sections', 'Tables & Diagrams', 'Appendices', 'Index'];

  return (
    <div className={`app-container ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="drawer-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title-container">
            <h1>Canadian Electrical Code</h1>
            <p>2024 • 26th Edition</p>
          </div>
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search code book..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightTerm(''); // clear highlight when user types a new search
              }}
              className="search-input"
            />
          </div>
        </div>
        <ul className="nav-list">
          {groupOrder.map((group) => {
            const sections = groupedSections[group] || [];
            if (sections.length === 0) return null;
            
            const isExpanded = expandedGroups[group];
            
            return (
              <li key={group} className="nav-group-container">
                <button 
                  className="nav-group-header"
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
                >
                  <span className="group-title-text">{group}</span>
                  <svg 
                    className={`chevron-icon ${isExpanded ? 'expanded' : ''}`} 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isExpanded && (
                  <ul className="nav-group-list">
                    {sections.map((section) => (
                      <li key={section.id} className="nav-item">
                        <button
                          className={`nav-button ${!searchQuery && activeSectionId === section.id ? 'active' : ''}`}
                          onClick={() => {
                            setSearchQuery('');
                            setActiveSectionId(section.id);
                            setHighlightTerm(''); // Clear highlight on direct nav
                            setIsMobileMenuOpen(false); // Close mobile drawer
                          }}
                        >
                          {section.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Header Bar */}
        <header className="mobile-header">
          <button 
            className="hamburger-button" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="mobile-header-title">
            <span>CEC 2024 Guide</span>
          </div>
        </header>

        {searchQuery ? (
          <>
            <header className="content-header">
              <h2>Search Results for "{searchQuery}"</h2>
            </header>
            <div className="content-body">
              <div className="content-text search-results-container">
                {searchResults.length > 0 ? (
                  searchResults.map((res, i) => (
                    <div key={i} className="search-result-card" onClick={() => {
                      setHighlightTerm(searchQuery); // highlight the searched term in the section
                      setSearchQuery('');
                      setActiveSectionId(res.sectionId);
                      setIsMobileMenuOpen(false);
                    }}>
                      <h3>{res.title}</h3>
                      <p>{res.snippet}</p>
                    </div>
                  ))
                ) : (
                  <p>No results found for "{searchQuery}".</p>
                )}
              </div>
            </div>
          </>
        ) : activeSection ? (
          <>
            <header className="content-header">
              <h2>{activeSection.title}</h2>
              <button 
                className={`tts-button ${isPlaying ? 'playing' : ''}`} 
                onClick={toggleSpeech}
                aria-label={isPlaying ? "Stop Reading" : "Read Aloud"}
              >
                {isPlaying ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                    Stop Reading
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Read Aloud
                  </>
                )}
              </button>
            </header>
            <div className="content-body">
              <div className={`content-text markdown-body ${activeSection.id === 'contents' ? 'contents-page' : ''}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      if (href && href.startsWith('#')) {
                        const targetId = href.substring(1);
                        const found = sectionsData.find(sec => sec.id === targetId || sec.id.includes(targetId));
                        if (found) {
                          // Extract plain text from link children to use as highlight target
                          const linkText = Array.isArray(children)
                            ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                            : typeof children === 'string' ? children : '';
                          return (
                            <a
                              href={href}
                              onClick={(e) => {
                                e.preventDefault();
                                setSearchQuery('');
                                setActiveSectionId(found.id);
                                // If navigating from Contents and the link text is a topic (not a page number),
                                // highlight that topic in the destination section
                                if (activeSection?.id === 'contents' && linkText && isNaN(linkText.trim())) {
                                  setHighlightTerm(linkText.trim());
                                } else {
                                  setHighlightTerm('');
                                }
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              {children}
                            </a>
                          );
                        }
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                    p:  ({ children }) => <p>{highlightChildren(children, highlightTerm)}</p>,
                    li: ({ children, ...props }) => <li {...props}>{highlightChildren(children, highlightTerm)}</li>,
                    h1: ({ children }) => <h1>{highlightChildren(children, highlightTerm)}</h1>,
                    h2: ({ children }) => <h2>{highlightChildren(children, highlightTerm)}</h2>,
                    h3: ({ children }) => <h3>{highlightChildren(children, highlightTerm)}</h3>,
                    h4: ({ children }) => <h4>{highlightChildren(children, highlightTerm)}</h4>,
                    td: ({ children, ...props }) => <td {...props}>{highlightChildren(children, highlightTerm)}</td>,
                    th: ({ children, ...props }) => <th {...props}>{highlightChildren(children, highlightTerm)}</th>,
                  }}
                >
                  {activeSection.id === 'contents'
                    ? sanitizeMarkdown(preprocessContents(activeSection.content))
                    : sanitizeMarkdown(activeSection.content)}
                </ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="content-body">
            <p>Select a section from the sidebar to view its content.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
