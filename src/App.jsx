import { useState, useEffect, useRef, Children, isValidElement, cloneElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import './App.css';
import sectionsData from './data/sections.json';

const rehypeHighlightWord = (options) => {
  return (tree) => {
    if (!options || !options.query) return;
    const query = options.query.toLowerCase();
    
    visit(tree, 'text', (node, index, parent) => {
      if (!node.value || !node.value.toLowerCase().includes(query)) return;
      if (parent && parent.tagName === 'mark') return;

      const escapedQuery = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const parts = node.value.split(regex);
      
      const newNodes = [];
      parts.forEach((part) => {
        if (!part) return;
        if (part.toLowerCase() === query) {
          newNodes.push({
            type: 'element',
            tagName: 'mark',
            properties: { className: ['search-highlight'] },
            children: [{ type: 'text', value: part }]
          });
        } else {
          newNodes.push({ type: 'text', value: part });
        }
      });

      if (parent && parent.children) {
        parent.children.splice(index, 1, ...newNodes);
        // Returns the index to skip the newly inserted nodes to prevent infinite loop
        return index + newNodes.length;
      }
    });
  };
};

const rehypeAddHighlightToLinks = () => {
  const getText = (node) => {
    if (!node) return '';
    if (node.type === 'text') return node.value;
    if (node.children) return node.children.map(getText).join('');
    return '';
  };

  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'p' || node.tagName === 'li') {
         let topic = '';
         const firstChild = node.children && node.children[0];
         if (firstChild && firstChild.tagName === 'strong') {
             topic = firstChild.children
                .filter(c => c.type === 'text')
                .map(c => c.value)
                .join('')
                .trim();
         }
         if (topic) {
           visit(node, 'element', (linkNode) => {
             if (linkNode.tagName === 'a' && linkNode.properties && linkNode.properties.href) {
                const href = String(linkNode.properties.href);
                if (href.startsWith('#') && !href.startsWith('#crossref-') && !href.includes('?hl=')) {
                   linkNode.properties.href = `${href}?hl=${encodeURIComponent(topic)}`;
                }
             }
           });
         } else if (node.children) {
           for (let i = 0; i < node.children.length; i++) {
               const child = node.children[i];
               let linkNode = null;
               if (child.tagName === 'a') {
                   linkNode = child;
               } else if (child.tagName === 'em' && child.children && child.children[0] && child.children[0].tagName === 'a') {
                   linkNode = child.children[0];
               }
               
               if (linkNode && linkNode.properties && linkNode.properties.href) {
                   const href = String(linkNode.properties.href);
                   if (href.startsWith('#') && !href.startsWith('#crossref-') && !href.includes('?hl=')) {
                       let precedingText = '';
                       for (let j = 0; j < i; j++) {
                           precedingText += getText(node.children[j]);
                       }
                       precedingText = precedingText
                           .replace(/^[-\s•*_*#|—]+|[-\s•*_*#|—]+$/g, '')
                           .trim();
                           
                       if (precedingText && precedingText.length < 100) {
                           linkNode.properties.href = `${href}?hl=${encodeURIComponent(precedingText)}`;
                       }
                   }
               }
           }
         }
      }
    });
  };
};

const toTitleCase = (str) => {
  if (typeof str !== 'string') return str;
  const articles = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'with', 'in', 'of'];
  return str.split(' ').map((word, index) => {
    if (index > 0 && articles.includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

const TitleCasedChildren = ({ children }) => {
  return Children.map(children, child => {
    if (typeof child === 'string') {
      return toTitleCase(child);
    }
    if (isValidElement(child) && child.props.children) {
      return cloneElement(child, {
        children: <TitleCasedChildren>{child.props.children}</TitleCasedChildren>
      });
    }
    return child;
  });
};

const HighlightedText = ({ text, highlight }) => {
  if (!text) return null;
  if (!highlight || !highlight.trim()) return <>{text}</>;
  const escaped = highlight.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.trim().toLowerCase() 
          ? <mark key={i} className="search-highlight">{part}</mark> 
          : part
      )}
    </>
  );
};

const BASE_URL = import.meta.env.BASE_URL || '/';

function App() {
  const [activeSectionId, setActiveSectionId] = useState(sectionsData[0]?.id || 'contents');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightQuery, setHighlightQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    'General': true,
    'Sections': true,
    'Tables & Diagrams': true,
    'Appendices': true,
    'Index': true
  });
  
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  
  const speechRef = useRef(null);
  const settingsRef = useRef(null);

  const activeSection = sectionsData.find(sec => sec.id === activeSectionId);

  useEffect(() => {
    // Stop speaking if the user switches sections
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [activeSectionId, searchQuery]);

  // Load and populate speech synthesis voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      
      // Sort: English first, then others
      const sortedVoices = [...allVoices].sort((a, b) => {
        const aEn = a.lang.toLowerCase().startsWith('en');
        const bEn = b.lang.toLowerCase().startsWith('en');
        if (aEn && !bEn) return -1;
        if (!aEn && bEn) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setVoices(sortedVoices);
      
      // Default voice selection: prioritize Natural or Google US/UK English
      const defaultVoice = sortedVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft'))) ||
                           sortedVoices.find(v => v.lang.toLowerCase().startsWith('en')) ||
                           sortedVoices[0];
      if (defaultVoice) {
        setSelectedVoiceName(defaultVoice.name);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Click outside to close TTS settings dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowTtsSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const getTopicText = (content, query) => {
    if (!query || !query.trim()) return content;
    
    const cleanQuery = query.trim().toLowerCase();
    const blocks = content.split(/\n\n+/);
    
    const startIndex = blocks.findIndex(block => block.toLowerCase().includes(cleanQuery));
    if (startIndex === -1) return content;
    
    const chosenBlocks = [blocks[startIndex]];
    const startBlock = blocks[startIndex].trim();
    
    const isHeading = (block) => {
      const b = block.trim();
      return b.startsWith('#') || b.startsWith('**[') || b.startsWith('**');
    };
    
    const getHeadingLevel = (block) => {
      const b = block.trim();
      if (b.startsWith('###')) return 3;
      if (b.startsWith('##')) return 2;
      if (b.startsWith('#')) return 1;
      if (b.startsWith('**[')) return 3;
      if (b.startsWith('**')) return 3;
      return 99;
    };
    
    if (isHeading(startBlock)) {
      const startLevel = getHeadingLevel(startBlock);
      for (let i = startIndex + 1; i < blocks.length; i++) {
        const nextBlock = blocks[i].trim();
        if (!nextBlock) continue;
        if (isHeading(nextBlock)) {
          const nextLevel = getHeadingLevel(nextBlock);
          if (nextLevel <= startLevel) {
            break;
          }
        }
        chosenBlocks.push(blocks[i]);
      }
    }
    
    return chosenBlocks.join('\n\n');
  };

  const getSpeechText = () => {
    // 1. Prioritize any manually highlighted selection on the page
    const selection = window.getSelection().toString().trim();
    if (selection) {
      return { text: selection, type: 'selection' };
    }
    
    // 2. Read only the chosen topic if a link was clicked/highlight query is present
    if (highlightQuery && activeSection) {
      const topicText = getTopicText(activeSection.content, highlightQuery);
      if (topicText) {
        return { text: topicText, type: 'topic', label: highlightQuery };
      }
    }
    
    // 3. Fallback to active section
    return { text: activeSection ? activeSection.content : '', type: 'section' };
  };

  // Preprocess the Contents section so each entry appears on its own line
  const preprocessContents = (md) => {
    if (!md) return md;
    // Split on the pattern: italic page number (e.g. _53_ or _[53](#id)_) followed by a space
    // and then the next entry. We insert a newline after each italic page number.
    return md
      // Insert newline after every inline italic page number that is followed by more text
      // Matches: _number_ or _[number](#id)_ followed by a space and non-whitespace
      .replace(/(_\[?\d+\]?(?:\(#[^)]+\))?_)(?= +[^\n])/g, '$1\n\n')
      // Also add newline before bold section headers that appear mid-paragraph
      // (they start with **[ or **S after a space)
      .replace(/ (?=\*\*\[)/g, '\n\n')
      // Collapse any extra blank lines created
      .replace(/\n{3,}/g, '\n\n');
  };

  // Strip raw HTML tags from PDF-extracted markdown so ReactMarkdown
  // doesn't render them as literal text (e.g. <br>, <sup>, <span>, etc.)
  const sanitizeMarkdown = (md) => {
    if (!md) return md;
    
    // Strip all HTML tags EXCEPT br, sup, sub, and u
    let sanitized = md.replace(/<(?!br\s*\/?>|sup\b|sub\b|u\b|\/sup\b|\/sub\b|\/u\b)[^>]*>/gi, '');
      
    // Turn "see Topic ." into a link to Topic
    sanitized = sanitized.replace(/\bsee\s+(?:\*\*([A-Z][A-Za-z0-9 -]+?)\*\*|([A-Z][A-Za-z0-9 -]+?))(?=\s*\.)/g, (match, p1, p2) => {
      const topic = p1 || p2;
      return `[see ${p1 ? `**${p1}**` : p2}](#crossref-${topic})`;
    });
    
    return sanitized;
  };



  // Auto-scroll to the highlighted match after navigation
  useEffect(() => {
    if (!highlightQuery) return;
    const timer = setTimeout(() => {
      const marks = Array.from(document.querySelectorAll('mark.search-highlight'));
      if (marks.length > 0) {
        // Find a mark that represents the definition (often wrapped in <strong>)
        let targetEl = marks[0];
        for (const mark of marks) {
          if (mark.closest('strong') || mark.closest('h1') || mark.closest('h2') || mark.closest('h3') || mark.closest('h4')) {
            targetEl = mark;
            break;
          }
        }
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightQuery, activeSectionId]);

  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (isPlaying) {
      if (isPaused) {
        // Resume
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        // Pause
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      if (activeSection) {
        window.speechSynthesis.cancel(); // clear queue
        setIsPaused(false);
        
        const speechInfo = getSpeechText();
        const cleanText = stripMarkdown(speechInfo.text);
        const paragraphs = cleanText.split('\n\n').filter(p => p.trim().length > 0);
        
        if (paragraphs.length === 0) return;
        
        paragraphs.forEach((para, index) => {
          const utterance = new SpeechSynthesisUtterance(para);
          
          if (selectedVoiceName) {
            const voice = voices.find(v => v.name === selectedVoiceName);
            if (voice) utterance.voice = voice;
          }
          
          utterance.rate = speechRate;
          
          if (index === paragraphs.length - 1) {
            utterance.onend = () => {
              setIsPlaying(false);
              setIsPaused(false);
            };
          }
          
          utterance.onerror = (e) => {
            if (e.error === 'interrupted') return;
            console.error("Speech synthesis error", e);
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            setIsPaused(false);
          };

          window.speechSynthesis.speak(utterance);
        });
        
        setIsPlaying(true);
      }
    }
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
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
                setHighlightQuery(''); // clear highlight when user types a new search
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
                            setHighlightQuery('');
                            setActiveSectionId(section.id);
                            setHighlightQuery(''); // Clear highlight on direct nav
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
                      setHighlightQuery(searchQuery);
                      setSearchQuery('');
                      setActiveSectionId(res.sectionId);
                      setIsMobileMenuOpen(false);
                    }}>
                      <h3><HighlightedText text={res.title} highlight={searchQuery} /></h3>
                      <p><HighlightedText text={res.snippet} highlight={searchQuery} /></p>
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
              <div className="tts-controls" ref={settingsRef}>
                <div className="tts-mode-indicator">
                  {highlightQuery ? (
                    <span className="tts-mode-badge" title={`Will read only the section for: ${highlightQuery}`}>
                      Topic: {highlightQuery}
                    </span>
                  ) : (
                    <span className="tts-mode-badge secondary">
                      Full Section
                    </span>
                  )}
                </div>
                <button 
                  className={`tts-button ${isPlaying ? (isPaused ? 'paused' : 'playing') : ''}`} 
                  onClick={toggleSpeech}
                  aria-label={!isPlaying ? 'Read Aloud' : isPaused ? 'Resume Reading' : 'Pause Reading'}
                >
                  {!isPlaying ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                      </svg>
                      Read Aloud
                    </>
                  ) : isPaused ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                      </svg>
                      Resume
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                        <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
                      </svg>
                      Pause
                    </>
                  )}
                </button>
                {isPlaying && (
                  <button
                    className="tts-stop-button"
                    onClick={stopSpeech}
                    aria-label="Stop Reading"
                    title="Stop"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    </svg>
                  </button>
                )}
                <button
                  className={`tts-settings-toggle ${showTtsSettings ? 'active' : ''}`}
                  onClick={() => setShowTtsSettings(!showTtsSettings)}
                  aria-label="Speech Settings"
                  title="Speech Settings"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
                
                {showTtsSettings && (
                  <div className="tts-settings-dropdown">
                    <div className="tts-setting-row">
                      <label htmlFor="tts-voice-select">Reading Voice</label>
                      <select 
                        id="tts-voice-select"
                        value={selectedVoiceName}
                        onChange={(e) => setSelectedVoiceName(e.target.value)}
                        className="tts-select"
                      >
                        {voices.map(voice => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tts-setting-row">
                      <label htmlFor="tts-rate-slider">Speed: {speechRate}x</label>
                      <input 
                        id="tts-rate-slider"
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="tts-slider"
                      />
                    </div>
                    <div className="tts-info-box">
                      {highlightQuery ? (
                        <span>Will read highlighted topic <strong>{highlightQuery}</strong>. Highlight/select any text on the page to read that instead.</span>
                      ) : (
                        <span>Will read the full section. Highlight/select any text on the page to read only that portion.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </header>
            <div className="content-body">
              <div className={`content-text markdown-body ${activeSection.id === 'contents' ? 'contents-page' : ''}`}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeAddHighlightToLinks, [rehypeHighlightWord, { query: highlightQuery }]]}
                  components={{
                    a: ({ href, children }) => {
                      if (href && href.startsWith('#crossref-')) {
                        const targetTopic = href.substring(10);
                        return (
                          <a href={href} className="cross-ref-link" onClick={(e) => {
                            e.preventDefault();
                            setSearchQuery('');
                            setHighlightQuery(targetTopic);
                            const targetRegex = new RegExp(`\\*\\*${targetTopic}\\*\\*`, 'i');
                            const foundSection = sectionsData.find(sec => targetRegex.test(sec.content));
                            if (foundSection && foundSection.id !== activeSectionId) {
                               setActiveSectionId(foundSection.id);
                            }
                            setIsMobileMenuOpen(false);
                          }}>
                            {children}
                          </a>
                        );
                      }
                      if (href && href.startsWith('#')) {
                        let targetId = href.substring(1);
                        let highlightFromUrl = '';
                        if (targetId.includes('?hl=')) {
                           const parts = targetId.split('?hl=');
                           targetId = parts[0];
                           highlightFromUrl = decodeURIComponent(parts[1]);
                        }
                        
                        const linkText = Array.isArray(children)
                          ? children.map(c => (typeof c === 'string' ? c : '')).join('')
                          : typeof children === 'string' ? children : '';
                        
                        if (targetId === 'tables' && !highlightFromUrl) {
                          const match = linkText.match(/Table[s]?\s+(\d+[A-Z]?)/i);
                          if (match) {
                            highlightFromUrl = `Table ${match[1]}`;
                          } else {
                            highlightFromUrl = linkText;
                          }
                        } else if (targetId === 'diagrams' && !highlightFromUrl) {
                          const match = linkText.match(/Diagram[s]?\s+(\d+)/i);
                          if (match) {
                            highlightFromUrl = `Diagram ${match[1]}`;
                          } else {
                            highlightFromUrl = linkText;
                          }
                        } else if (targetId.startsWith('appendix-') && !highlightFromUrl) {
                          const match = linkText.match(/Appendix\s+([A-M])/i);
                          if (match) {
                            highlightFromUrl = `Appendix ${match[1].toUpperCase()}`;
                          } else {
                            const appendixLetter = targetId.split('-')[1]?.toUpperCase();
                            if (appendixLetter) {
                              highlightFromUrl = `Appendix ${appendixLetter}`;
                            } else {
                              highlightFromUrl = linkText;
                            }
                          }
                        }
                        
                        const found = sectionsData.find(sec => sec.id === targetId || sec.id.includes(targetId));
                        if (found) {
                          return (
                            <a
                              href={href}
                              onClick={(e) => {
                                e.preventDefault();
                                setSearchQuery('');
                                setActiveSectionId(found.id);
                                
                                if (highlightFromUrl) {
                                   setHighlightQuery(highlightFromUrl);
                                } else if (activeSection?.id === 'contents' && linkText && isNaN(linkText.trim())) {
                                  setHighlightQuery(linkText.trim());
                                } else {
                                  setHighlightQuery('');
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
                    table: ({ children }) => (
                      <div className="table-wrapper">
                        <table>{children}</table>
                      </div>
                    ),
                    img: ({ src, alt }) => {
                      // Fix image paths for GitHub Pages base URL
                      let resolvedSrc = src || '';
                      if (resolvedSrc.startsWith('/') && !resolvedSrc.startsWith('//')) {
                        // Strip leading slash and prepend BASE_URL
                        const stripped = resolvedSrc.replace(/^\//, '');
                        resolvedSrc = BASE_URL.replace(/\/$/, '') + '/' + stripped;
                      }
                      return (
                        <figure className="diagram-figure">
                          <img src={resolvedSrc} alt={alt || 'Diagram'} className="diagram-img" loading="lazy" />
                          {alt && alt !== 'Diagram' && <figcaption>{alt}</figcaption>}
                        </figure>
                      );
                    },
                    h3: ({ children }) => <h3><TitleCasedChildren>{children}</TitleCasedChildren></h3>,
                    h4: ({ children }) => <h4><TitleCasedChildren>{children}</TitleCasedChildren></h4>,
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
