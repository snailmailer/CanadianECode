import { useState, useEffect, useRef } from 'react';
import './App.css';
import sectionsData from './data/sections.json';

function App() {
  const [activeSectionId, setActiveSectionId] = useState(sectionsData[0]?.id);
  const [isPlaying, setIsPlaying] = useState(false);
  const speechRef = useRef(null);

  const activeSection = sectionsData.find(sec => sec.id === activeSectionId);

  useEffect(() => {
    // Stop speaking if the user switches sections
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, [activeSectionId]);

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
        // Since text can be very long, we should break it up into smaller chunks for the TTS engine
        // Or just pass the entire string and let it handle it (some browsers cut off after 15 seconds)
        // A simple workaround for large texts is to speak paragraph by paragraph
        
        window.speechSynthesis.cancel(); // clear queue
        
        const textToSpeak = activeSection.content;
        const paragraphs = textToSpeak.split('\n\n').filter(p => p.trim().length > 0);
        
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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Your Guide to the Canadian Electrical Code</h1>
          <p>2024 26th Edition</p>
        </div>
        <ul className="nav-list">
          {sectionsData.map((section) => (
            <li key={section.id} className="nav-item">
              <button
                className={`nav-button ${activeSectionId === section.id ? 'active' : ''}`}
                onClick={() => setActiveSectionId(section.id)}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeSection ? (
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
              <div className="content-text">
                {activeSection.content.split('\n\n').map((paragraph, idx) => (
                  paragraph.trim() && <p key={idx} className="content-paragraph">{paragraph}</p>
                ))}
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
