import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';
import sectionsData from './data/sections.json';

function App() {
  const [activeSectionId, setActiveSectionId] = useState(sectionsData[0]?.id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const speechRef = useRef(null);

  const activeSection = sectionsData.find(sec => sec.id === activeSectionId);

  useEffect(() => {
    // Stop speaking if the user switches sections
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, [activeSectionId, searchQuery]);

  const stripMarkdown = (md) => {
    if (!md) return '';
    return md
      .replace(/[#_*~`|>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/\n\n+/g, '\n\n')
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, ''); // images
  };

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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Your Guide to the Canadian Electrical Code</h1>
          <p>2024 26th Edition</p>
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <ul className="nav-list">
          {sectionsData.map((section) => (
            <li key={section.id} className="nav-item">
              <button
                className={`nav-button ${!searchQuery && activeSectionId === section.id ? 'active' : ''}`}
                onClick={() => {
                  setSearchQuery('');
                  setActiveSectionId(section.id);
                }}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
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
                      setSearchQuery('');
                      setActiveSectionId(res.sectionId);
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
              <div className="content-text markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      if (href && href.startsWith('#')) {
                        const targetId = href.substring(1);
                        const found = sectionsData.find(sec => sec.id === targetId || sec.id.includes(targetId));
                        if (found) {
                          return (
                            <a
                              href={href}
                              onClick={(e) => {
                                e.preventDefault();
                                setSearchQuery('');
                                setActiveSectionId(found.id);
                              }}
                            >
                              {children}
                            </a>
                          );
                        }
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                    }
                  }}
                >
                  {activeSection.content}
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
