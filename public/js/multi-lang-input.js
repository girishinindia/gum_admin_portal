/**
 * Multi-Language Input Component with Speech Recognition
 * Version 2.0
 * 
 * Features:
 * - ✅ Auto-convert on Space, punctuation marks (no need to press Enter!)
 * - ✅ Speech recognition for ALL languages including English
 * - ✅ Number keys (1-9) for quick selection
 * - ✅ Arrow navigation with Enter/Tab to select
 * - ✅ ESC to close popup without selecting
 */

window.MultiLangInput = (function() {
    
    // Language Configuration
    const LANG_CONFIG = {
        en: { name: "English", native: "English", speechCode: "en-IN", transliterate: false },
        hi: { name: "Hindi", native: "हिन्दी", speechCode: "hi-IN", transliterate: true },
        gu: { name: "Gujarati", native: "ગુજરાતી", speechCode: "gu-IN", transliterate: true },
        mr: { name: "Marathi", native: "मराठी", speechCode: "mr-IN", transliterate: true },
        ta: { name: "Tamil", native: "தமிழ்", speechCode: "ta-IN", transliterate: true },
        te: { name: "Telugu", native: "తెలుగు", speechCode: "te-IN", transliterate: true },
        kn: { name: "Kannada", native: "ಕನ್ನಡ", speechCode: "kn-IN", transliterate: true },
        ml: { name: "Malayalam", native: "മലയാളം", speechCode: "ml-IN", transliterate: true },
        bn: { name: "Bengali", native: "বাংলা", speechCode: "bn-IN", transliterate: true },
        pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", speechCode: "pa-IN", transliterate: true },
        or: { name: "Odia", native: "ଓଡ଼ିଆ", speechCode: "or-IN", transliterate: true },
        sa: { name: "Sanskrit", native: "संस्कृतम्", speechCode: "hi-IN", transliterate: true }
    };
    
    // Keys that trigger auto-selection of first suggestion
    const AUTO_CONVERT_KEYS = [' ', '.', ',', '!', '?', ';', ':', '-', '(', ')', '[', ']', '"', "'", '/', '\\', '\n'];
    
    // State management
    let activeInputs = {};
    let recognition = null;
    let isRecording = false;
    let currentRecordingInput = null;

    // Reset all state (useful for page reload / bfcache restore)
    function resetAll() {
        stopAllRecording();
        activeInputs = {};
        recognition = null;
        isRecording = false;
        currentRecordingInput = null;
    }
    
    // Check speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSupported = !!SpeechRecognition;
    
    // Initialize speech recognition
    function initSpeechRecognition() {
        if (!speechSupported) return null;
        
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        
        rec.onresult = function(event) {
            if (!currentRecordingInput) return;
            
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            const inputEl = document.getElementById(currentRecordingInput);
            if (inputEl) {
                const state = activeInputs[currentRecordingInput];
                if (finalTranscript) {
                    // Add space before new text if needed
                    const currentText = state.baseText || '';
                    const needsSpace = currentText.length > 0 && 
                                       !currentText.endsWith(' ') && 
                                       !currentText.endsWith('\n');
                    state.baseText = currentText + (needsSpace ? ' ' : '') + finalTranscript;
                    inputEl.value = state.baseText;
                    
                    // Move cursor to end
                    inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
                    
                    // Update interim display
                    const interimEl = document.getElementById('mli-interim-' + currentRecordingInput);
                    if (interimEl) interimEl.textContent = '';
                } else if (interimTranscript) {
                    const currentText = state.baseText || '';
                    const needsSpace = currentText.length > 0 && 
                                       !currentText.endsWith(' ') && 
                                       !currentText.endsWith('\n');
                    inputEl.value = currentText + (needsSpace ? ' ' : '') + interimTranscript;
                    
                    // Show interim text in status bar
                    const interimEl = document.getElementById('mli-interim-' + currentRecordingInput);
                    if (interimEl) interimEl.textContent = '"' + interimTranscript + '"';
                }
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        
        rec.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                stopAllRecording();
            }
        };
        
        rec.onend = function() {
            if (isRecording) {
                // Auto-restart if still recording
                setTimeout(() => {
                    if (isRecording && recognition) {
                        try {
                            recognition.start();
                        } catch (e) {
                            // Already started or other error
                        }
                    }
                }, 100);
            }
        };
        
        return rec;
    }
    
    // Fetch transliteration suggestions from Google API
    async function fetchSuggestions(langCode, word) {
        if (!word || word.length < 1) return [];
        
        // No transliteration for English
        const config = LANG_CONFIG[langCode];
        if (!config || !config.transliterate) return [];
        
        try {
            const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${langCode}-t-i0-und&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data[0] === "SUCCESS" && data[1] && data[1][0] && data[1][0][1]) {
                return data[1][0][1];
            }
        } catch (e) {
            console.error('Transliteration error:', e);
        }
        return [];
    }
    
    // Create popup HTML
    function createPopupHTML(suggestions, langCode, word) {
        const config = LANG_CONFIG[langCode] || { name: langCode, native: '' };
        
        let html = `
            <div class="mli-popup-header">
                <div class="mli-popup-lang-info">
                    <span class="mli-popup-lang">${config.name}</span>
                    <span class="mli-popup-native">${config.native}</span>
                </div>
                <span class="mli-popup-hint">
                    <span class="mli-key-hint">Space</span> = auto-select
                </span>
            </div>
            <div class="mli-popup-items">
        `;
        
        suggestions.forEach((s, i) => {
            html += `
                <div class="mli-popup-item ${i === 0 ? 'active' : ''}" data-idx="${i}" data-value="${escapeHtml(s)}">
                    <span class="mli-item-text">${escapeHtml(s)}</span>
                    <span class="mli-item-key">${i + 1}</span>
                </div>
            `;
        });
        
        // Add English option at the end
        if (word) {
            html += `
                <div class="mli-popup-item mli-english-option" data-idx="${suggestions.length}" data-value="${escapeHtml(word)}">
                    <span class="mli-item-text">${escapeHtml(word)}</span>
                    <span class="mli-item-key">EN</span>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
    
    // Position popup near input
    function positionPopup(popup, input) {
        const rect = input.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        popup.style.position = 'absolute';
        popup.style.top = (rect.bottom + scrollTop + 4) + 'px';
        popup.style.left = (rect.left + scrollLeft) + 'px';
        popup.style.minWidth = Math.min(rect.width, 320) + 'px';
        popup.style.maxWidth = '350px';
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Get word at caret position
    function getWordAtCaret(input) {
        const text = input.value;
        const end = input.selectionStart || 0;
        let start = end;
        
        // Go back to find word start (only English letters for transliteration)
        while (start > 0 && /[A-Za-z]/.test(text[start - 1])) {
            start--;
        }
        
        return {
            word: text.slice(start, end),
            start: start,
            end: end
        };
    }
    
    // Replace word in input
    function replaceWord(input, start, end, newWord, appendChar = '') {
        const text = input.value;
        const before = text.slice(0, start);
        const after = text.slice(end);
        
        input.value = before + newWord + appendChar + after;
        
        const newPos = start + newWord.length + appendChar.length;
        input.setSelectionRange(newPos, newPos);
        
        // Dispatch events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Stop all recording
    function stopAllRecording() {
        isRecording = false;
        currentRecordingInput = null;
        
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {}
        }
        
        // Update all mic buttons
        document.querySelectorAll('.mli-mic-btn.recording').forEach(btn => {
            btn.classList.remove('recording');
            const label = btn.querySelector('.mli-mic-label');
            if (label) label.textContent = 'SPEAK';
        });
        
        // Hide all speech status bars
        document.querySelectorAll('.mli-speech-status.show').forEach(el => {
            el.classList.remove('show');
        });
    }
    
    // Initialize an input field
    function initInput(inputId, langCode = 'hi') {
        const input = document.getElementById(inputId);
        if (!input) {
            console.warn('MultiLangInput: Input not found:', inputId);
            return null;
        }
        
        // Normalize language code
        langCode = (langCode || 'hi').toLowerCase();
        const config = LANG_CONFIG[langCode];
        if (!config) {
            console.warn('MultiLangInput: Unknown language:', langCode, '- defaulting to Hindi');
            langCode = 'hi';
        }
        
        // Check if already initialized — verify DOM elements still match
        if (activeInputs[inputId]) {
            // Verify the mic button still exists in DOM (handles bfcache/page restore)
            const existingWrapper = input.closest('.mli-wrapper');
            const existingMic = existingWrapper ? existingWrapper.querySelector('.mli-mic-btn') : null;
            if (existingMic) {
                setLanguage(inputId, langCode);
                return activeInputs[inputId];
            }
            // DOM is stale, re-initialize
            delete activeInputs[inputId];
        }
        
        // Create wrapper if not exists
        let wrapper = input.closest('.mli-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'mli-wrapper';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }
        
        // Create input row if not exists
        let inputRow = wrapper.querySelector('.mli-input-row');
        if (!inputRow) {
            inputRow = document.createElement('div');
            inputRow.className = 'mli-input-row';
            wrapper.insertBefore(inputRow, wrapper.firstChild);
            inputRow.appendChild(input);
        }
        
        input.classList.add('mli-input');
        
        // Add mic button for ALL languages (including English)
        if (speechSupported && !wrapper.querySelector('.mli-mic-btn')) {
            const currentConfig = LANG_CONFIG[langCode] || LANG_CONFIG['hi'];
            
            const micBtn = document.createElement('button');
            micBtn.type = 'button';
            micBtn.className = 'mli-mic-btn';
            micBtn.id = 'mli-mic-' + inputId;
            micBtn.title = 'Click to speak in ' + currentConfig.name;
            micBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="mli-mic-label">SPEAK</span>
            `;
            inputRow.appendChild(micBtn);
            
            // Speech status bar
            const speechStatus = document.createElement('div');
            speechStatus.className = 'mli-speech-status';
            speechStatus.id = 'mli-status-' + inputId;
            speechStatus.innerHTML = `
                <span class="mli-speech-icon">🎤</span>
                <span class="mli-speech-text">
                    Listening in <strong class="mli-speech-lang">${currentConfig.name}</strong>...
                    <span class="mli-interim" id="mli-interim-${inputId}"></span>
                </span>
                <button type="button" class="mli-stop-btn">Stop</button>
            `;
            wrapper.appendChild(speechStatus);
            
            // Mic button click handler
            micBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const currentLang = activeInputs[inputId]?.langCode || langCode;
                toggleRecording(inputId, currentLang, micBtn, speechStatus);
            });
            
            // Stop button handler
            speechStatus.querySelector('.mli-stop-btn').addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                stopAllRecording();
            });
        }
        
        // Create popup
        let popup = document.getElementById('mli-popup-' + inputId);
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'mli-popup';
            popup.id = 'mli-popup-' + inputId;
            document.body.appendChild(popup);
        }
        
        // State
        activeInputs[inputId] = {
            langCode: langCode,
            popup: popup,
            suggestions: [],
            activeIndex: 0,
            currentWord: '',
            wordStart: 0,
            wordEnd: 0,
            debounceTimer: null,
            baseText: input.value || '',
            skipNextInput: false
        };
        
        // Add transliteration handlers
        input.addEventListener('input', function(e) {
            const state = activeInputs[inputId];
            if (!state) return;
            
            // Skip if we just replaced text
            if (state.skipNextInput) {
                state.skipNextInput = false;
                return;
            }
            
            handleInput(inputId);
        });
        
        // Keydown handler - IMPORTANT for auto-select on space
        input.addEventListener('keydown', function(e) {
            handleKeydown(e, inputId, input);
        });
        
        // Focus handler
        input.addEventListener('focus', function() {
            // Hide other popups
            Object.keys(activeInputs).forEach(id => {
                if (id !== inputId && activeInputs[id].popup) {
                    activeInputs[id].popup.classList.remove('show');
                }
            });
        });
        
        // Blur handler
        input.addEventListener('blur', function(e) {
            setTimeout(() => {
                const state = activeInputs[inputId];
                if (state && state.popup) {
                    state.popup.classList.remove('show');
                }
            }, 200);
        });
        
        // Click outside to close popup
        document.addEventListener('mousedown', function(e) {
            const state = activeInputs[inputId];
            if (state && state.popup && !input.contains(e.target) && !state.popup.contains(e.target)) {
                state.popup.classList.remove('show');
            }
        });
        
        return {
            setLanguage: (newLang) => setLanguage(inputId, newLang),
            stopRecording: stopAllRecording,
            getState: () => activeInputs[inputId]
        };
    }
    
    // Toggle recording
    function toggleRecording(inputId, langCode, micBtn, speechStatus) {
        if (isRecording && currentRecordingInput === inputId) {
            // Stop recording
            stopAllRecording();
        } else {
            // Start recording
            stopAllRecording();
            
            // Always create fresh recognition to avoid stale state
            try {
                if (recognition) {
                    recognition.onresult = null;
                    recognition.onerror = null;
                    recognition.onend = null;
                    try { recognition.abort(); } catch(e) {}
                }
            } catch(e) {}
            recognition = initSpeechRecognition();

            if (!recognition) {
                alert('Speech recognition is not supported in this browser.\nPlease use Chrome, Edge, or Safari.');
                return;
            }
            
            isRecording = true;
            currentRecordingInput = inputId;
            
            const state = activeInputs[inputId];
            const input = document.getElementById(inputId);
            state.baseText = input.value;
            
            // Set language for speech recognition
            const config = LANG_CONFIG[langCode] || LANG_CONFIG['en'];
            recognition.lang = config.speechCode;
            
            // Update UI
            micBtn.classList.add('recording');
            micBtn.querySelector('.mli-mic-label').textContent = 'STOP';
            speechStatus.classList.add('show');
            speechStatus.querySelector('.mli-speech-lang').textContent = config.name;
            
            // Clear interim display
            const interimEl = document.getElementById('mli-interim-' + inputId);
            if (interimEl) interimEl.textContent = '';
            
            try {
                recognition.start();
            } catch (e) {
                console.error('Speech start error:', e);
                stopAllRecording();
            }
            
            // Focus the input
            input.focus();
        }
    }
    
    // Handle input
    async function handleInput(inputId) {
        const state = activeInputs[inputId];
        const input = document.getElementById(inputId);
        
        if (!state || !input) return;
        
        // Check if language supports transliteration
        const config = LANG_CONFIG[state.langCode];
        if (!config || !config.transliterate) {
            state.popup.classList.remove('show');
            return;
        }
        
        clearTimeout(state.debounceTimer);
        
        state.debounceTimer = setTimeout(async () => {
            const { word, start, end } = getWordAtCaret(input);
            
            // Need at least 1 character and must be English letters only
            if (!word || word.length < 1 || !/^[A-Za-z]+$/.test(word)) {
                state.popup.classList.remove('show');
                state.suggestions = [];
                return;
            }
            
            state.currentWord = word;
            state.wordStart = start;
            state.wordEnd = end;
            
            // Fetch suggestions
            const suggestions = await fetchSuggestions(state.langCode, word);
            
            if (!suggestions || suggestions.length === 0) {
                state.popup.classList.remove('show');
                state.suggestions = [];
                return;
            }
            
            state.suggestions = suggestions;
            state.activeIndex = 0;
            
            // Show popup
            state.popup.innerHTML = createPopupHTML(suggestions, state.langCode, word);
            positionPopup(state.popup, input);
            state.popup.classList.add('show');
            
            // Add click handlers to items
            state.popup.querySelectorAll('.mli-popup-item').forEach(item => {
                item.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = this.dataset.value;
                    state.skipNextInput = true;
                    replaceWord(input, state.wordStart, state.wordEnd, value);
                    state.popup.classList.remove('show');
                    state.suggestions = [];
                    input.focus();
                });
                
                item.addEventListener('mouseenter', function() {
                    state.popup.querySelectorAll('.mli-popup-item').forEach(el => el.classList.remove('active'));
                    this.classList.add('active');
                    state.activeIndex = parseInt(this.dataset.idx);
                });
            });
            
        }, 50);
    }
    
    // Handle keydown - Auto-select on space/punctuation
    function handleKeydown(e, inputId, input) {
        const state = activeInputs[inputId];
        if (!state) return;
        
        const isPopupOpen = state.popup && 
                           state.popup.classList.contains('show') && 
                           state.suggestions && 
                           state.suggestions.length > 0;
        
        // AUTO-SELECT on Space and punctuation
        if (AUTO_CONVERT_KEYS.includes(e.key) && isPopupOpen) {
            e.preventDefault();
            e.stopPropagation();
            
            // Select first suggestion (or currently active one)
            const selectedValue = state.suggestions[state.activeIndex] || state.suggestions[0];
            if (selectedValue) {
                state.skipNextInput = true;
                replaceWord(input, state.wordStart, state.wordEnd, selectedValue, e.key);
            }
            
            state.popup.classList.remove('show');
            state.suggestions = [];
            return;
        }
        
        // If popup is not open, don't handle other keys
        if (!isPopupOpen) return;
        
        const items = state.popup.querySelectorAll('.mli-popup-item');
        const maxIndex = items.length - 1;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                state.activeIndex = Math.min(state.activeIndex + 1, maxIndex);
                updateActiveItem(state.popup, state.activeIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                state.activeIndex = Math.max(state.activeIndex - 1, 0);
                updateActiveItem(state.popup, state.activeIndex);
                break;
                
            case 'Enter':
                e.preventDefault();
                const activeItem = items[state.activeIndex];
                if (activeItem) {
                    const value = activeItem.dataset.value;
                    state.skipNextInput = true;
                    replaceWord(input, state.wordStart, state.wordEnd, value);
                }
                state.popup.classList.remove('show');
                state.suggestions = [];
                break;
                
            case 'Tab':
                e.preventDefault();
                // Tab selects first suggestion
                if (state.suggestions[0]) {
                    state.skipNextInput = true;
                    replaceWord(input, state.wordStart, state.wordEnd, state.suggestions[0]);
                }
                state.popup.classList.remove('show');
                state.suggestions = [];
                break;
                
            case 'Escape':
                e.preventDefault();
                state.popup.classList.remove('show');
                state.suggestions = [];
                break;
                
            default:
                // Number keys 1-9 for quick selection
                if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const idx = parseInt(e.key) - 1;
                    if (idx < state.suggestions.length) {
                        e.preventDefault();
                        state.skipNextInput = true;
                        replaceWord(input, state.wordStart, state.wordEnd, state.suggestions[idx]);
                        state.popup.classList.remove('show');
                        state.suggestions = [];
                    }
                }
                break;
        }
    }
    
    // Update active item in popup
    function updateActiveItem(popup, activeIndex) {
        const items = popup.querySelectorAll('.mli-popup-item');
        items.forEach((el, i) => {
            const isActive = i === activeIndex;
            el.classList.toggle('active', isActive);
            if (isActive) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }
    
    // Update language for an input
    function setLanguage(inputId, langCode) {
        langCode = (langCode || 'hi').toLowerCase();
        const state = activeInputs[inputId];
        
        if (state) {
            state.langCode = langCode;
            
            // Update mic button and status bar
            const wrapper = document.getElementById(inputId)?.closest('.mli-wrapper');
            if (wrapper) {
                const micBtn = wrapper.querySelector('.mli-mic-btn');
                const statusBar = wrapper.querySelector('.mli-speech-status');
                const config = LANG_CONFIG[langCode] || LANG_CONFIG['hi'];
                
                if (micBtn) {
                    micBtn.title = 'Click to speak in ' + config.name;
                }
                if (statusBar) {
                    const langEl = statusBar.querySelector('.mli-speech-lang');
                    if (langEl) langEl.textContent = config.name;
                }
            }
        }
    }
    
    // Get language config
    function getLangConfig(langCode) {
        return LANG_CONFIG[(langCode || '').toLowerCase()] || null;
    }
    
    // Get all supported languages
    function getSupportedLanguages() {
        return Object.keys(LANG_CONFIG).map(code => ({
            code: code,
            ...LANG_CONFIG[code]
        }));
    }
    
    // Check if speech is supported
    function isSpeechSupported() {
        return speechSupported;
    }
    
    // Public API
    return {
        init: initInput,
        setLanguage: setLanguage,
        getLangConfig: getLangConfig,
        getSupportedLanguages: getSupportedLanguages,
        stopRecording: stopAllRecording,
        resetAll: resetAll,
        isSpeechSupported: isSpeechSupported,
        LANGUAGES: LANG_CONFIG
    };
    
})();

// Auto-initialize inputs with data-mli-lang attribute on page load
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-mli-lang]').forEach(function(input) {
        if (input.id) {
            MultiLangInput.init(input.id, input.dataset.mliLang);
        }
    });
});