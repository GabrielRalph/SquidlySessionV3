class KoreanInput {
    constructor() {
        // Font size management
        this.fontSize = 18;  // Default font size
        
        // Keyboard map (normal state)
        this.normalMap = {
            // Consonants (initial/final)
            'q': 'ㅂ', 'w': 'ㅈ', 'e': 'ㄷ', 'r': 'ㄱ', 't': 'ㅅ',
            'a': 'ㅁ', 's': 'ㄴ', 'd': 'ㅇ', 'f': 'ㄹ', 'g': 'ㅎ',
            'z': 'ㅋ', 'x': 'ㅌ', 'c': 'ㅊ', 'v': 'ㅍ',
            
            // Vowels (medial)
            'y': 'ㅛ', 'u': 'ㅕ', 'l': 'ㅣ', 'o': 'ㅐ', 'p': 'ㅔ',
            'h': 'ㅗ', 'j': 'ㅓ', 'k': 'ㅏ', 'i': 'ㅑ',
            'b': 'ㅠ', 'n': 'ㅜ', 'm': 'ㅡ'
        };

        // Keyboard map (shift state)
        this.shiftMap = {
            // Double consonants
            'Q': 'ㅃ', 'W': 'ㅉ', 'E': 'ㄸ', 'R': 'ㄲ', 'T': 'ㅆ',
            
            // Compound vowels
            'O': 'ㅒ', 'P': 'ㅖ',
            
            // Other keys keep same mapping (lowercase -> uppercase)
            'q': 'ㅃ', 'w': 'ㅉ', 'e': 'ㄸ', 'r': 'ㄲ', 't': 'ㅆ',
            'o': 'ㅒ', 'p': 'ㅖ'
        };

        // Hangul Unicode range constants
        this.HANGUL_BASE = 0xAC00;
        this.CHOSUNG_BASE = 0x1100;
        this.JUNGSUNG_BASE = 0x1161;
        this.JONGSUNG_BASE = 0x11A7;
        
        // Initial consonants (19)
        this.chosungList = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        
        // Medial vowels (21)
        this.jungsungList = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
        
        // Final consonants (28, including empty)
        this.jongsungList = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

        // Full Hangul composition engine tables (ported from reference project)
        this.initial = [12593, 12594, 12596, 12599, 12600, 12601, 12609, 12610, 12611, 12613, 12614, 12615, 12616, 12617, 12618, 12619, 12620, 12621, 12622];
        this.finale = [0, 12593, 12594, 12595, 12596, 12597, 12598, 12599, 12601, 12602, 12603, 12604, 12605, 12606, 12607, 12608, 12609, 12610, 12612, 12613, 12614, 12615, 12616, 12618, 12619, 12620, 12621, 12622];
        this.dMedial = [0, 0, 0, 0, 0, 0, 0, 0, 0, 800, 801, 820, 0, 0, 1304, 1305, 1320, 0, 0, 1820];
        this.dFinale = [0, 0, 0, 119, 0, 422, 427, 0, 0, 801, 816, 817, 819, 825, 826, 827, 0, 0, 1719, 0, 1919];
        
        // Unicode constants
        this.SBase = 44032;
        this.LBase = 4352;
        this.VBase = 12623;
        this.TBase = 4519;
        this.LCount = 19;
        this.VCount = 21;
        this.TCount = 28;
        this.NCount = 588;
        this.SCount = 11172;

        // Current composition state
        this.currentChosung = '';
        this.currentJungsung = '';
        this.currentJongsung = '';
        this.buffer = '';
    }

    // Find index of a value in an array (helper)
    indexOf(array, value) {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === value) {
                return i;
            }
        }
        return -1;
    }

    // Get mapped character
    getCharacter(key, isShift) {
        if (isShift && this.shiftMap[key]) {
            return this.shiftMap[key];
        }
        return this.normalMap[key.toLowerCase()] || null;
    }

    // Check if consonant
    isConsonant(char) {
        return this.chosungList.includes(char) || this.jongsungList.includes(char);
    }

    // Check if vowel
    isVowel(char) {
        return this.jungsungList.includes(char);
    }

    // Full Hangul composition algorithm (ported & optimized)
    composeHangul(inputString) {
        const length = inputString.length;
        if (length === 0) {
            return "";
        }
        
        let currentCharCode = inputString.charCodeAt(0);
        let result = String.fromCharCode(currentCharCode);
        
        for (let i = 1; i < length; i++) {
            const nextCharCode = inputString.charCodeAt(i);
            
            const initialIndex = this.indexOf(this.initial, currentCharCode);
            
            // Initial + medial → syllable
            if (initialIndex !== -1) {
                const vowelOffset = nextCharCode - this.VBase;
                if (0 <= vowelOffset && vowelOffset < this.VCount) {
                    currentCharCode = this.SBase + (initialIndex * this.VCount + vowelOffset) * this.TCount;
                    result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode);
                    continue;
                }
            }
            
            // Vowel + vowel → compound vowel
            const currentVowelOffset = currentCharCode - this.VBase;
            const nextVowelOffset = nextCharCode - this.VBase;
            if (0 <= currentVowelOffset && currentVowelOffset < this.VCount && 
                0 <= nextVowelOffset && nextVowelOffset < this.VCount) {
                const dMedialIndex = this.indexOf(this.dMedial, (currentVowelOffset * 100) + nextVowelOffset);
                if (dMedialIndex > 0) {
                    currentCharCode = this.VBase + dMedialIndex;
                    result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode);
                    continue;
                }
            }
            
            const syllableOffset = currentCharCode - this.SBase;
            
            // Syllable + final consonant → complete syllable
            if (0 <= syllableOffset && syllableOffset < 11145 && (syllableOffset % this.TCount) === 0) {
                const finaleIndex = this.indexOf(this.finale, nextCharCode);
                if (finaleIndex !== -1) {
                    currentCharCode += finaleIndex;
                    result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode);
                    continue;
                }
                
                // Handle compound medial vowel
                const vowelIndex = Math.floor((syllableOffset % this.NCount) / this.TCount);
                const dMedialIndex = this.indexOf(this.dMedial, (vowelIndex * 100) + (nextCharCode - this.VBase));
                if (dMedialIndex > 0) {
                    currentCharCode += (dMedialIndex - vowelIndex) * this.TCount;
                    result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode);
                    continue;
                }
            }
            
            // Complete syllable + vowel → split final consonant + new syllable (key fix!)
            if (0 <= syllableOffset && syllableOffset < 11172 && (syllableOffset % this.TCount) !== 0) {
                const finaleIndex = syllableOffset % this.TCount;
                const vowelOffset = nextCharCode - this.VBase;
                
                if (0 <= vowelOffset && vowelOffset < this.VCount) {
                    const newInitialIndex = this.indexOf(this.initial, this.finale[finaleIndex]);
                    if (0 <= newInitialIndex && newInitialIndex < this.LCount) {
                        // Remove final consonant and start a new syllable
                        result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode - finaleIndex);
                        currentCharCode = this.SBase + (newInitialIndex * this.VCount + vowelOffset) * this.TCount;
                        result = result + String.fromCharCode(currentCharCode);
                        continue;
                    }
                    
                    // Handle splitting compound final consonant
                    if (finaleIndex < this.dFinale.length && this.dFinale[finaleIndex] !== 0) {
                        result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode - finaleIndex + Math.floor(this.dFinale[finaleIndex] / 100));
                        currentCharCode = this.SBase + (this.indexOf(this.initial, this.finale[(this.dFinale[finaleIndex] % 100)]) * this.VCount + vowelOffset) * this.TCount;
                        result = result + String.fromCharCode(currentCharCode);
                        continue;
                    }
                }
                
                // Handle compound final consonant
                const dFinaleIndex = this.indexOf(this.dFinale, (finaleIndex * 100) + this.indexOf(this.finale, nextCharCode));
                if (dFinaleIndex > 0) {
                    currentCharCode = currentCharCode + dFinaleIndex - finaleIndex;
                    result = result.slice(0, result.length - 1) + String.fromCharCode(currentCharCode);
                    continue;
                }
            }
            
            // Can't compose; append as a new character
            currentCharCode = nextCharCode;
            result = result + String.fromCharCode(nextCharCode);
        }
        
        return result;
    }

    // Decompose Hangul syllables (per reference project)
    decomposeHangul(inputString) {
        const length = inputString.length;
        let result = "";
        
        for (let i = 0; i < length; i++) {
            const charCode = inputString.charCodeAt(i);
            const syllableOffset = charCode - this.SBase;
            
            // Check if this is a Hangul syllable
            if (syllableOffset < 0 || syllableOffset >= this.SCount) {
                result += String.fromCharCode(charCode);
                continue;
            }
            
            // Decompose syllable
            const initialIndex = Math.floor(syllableOffset / this.NCount);
            const vowelCode = this.VBase + Math.floor((syllableOffset % this.NCount) / this.TCount);
            const finaleCode = this.finale[syllableOffset % this.TCount];
            
            result += String.fromCharCode(this.initial[initialIndex], vowelCode);
            if (finaleCode !== 0) {
                result += String.fromCharCode(finaleCode);
            }
        }
        
        return result;
    }

    // Input handling (simplified): return the character for smartInsert to handle
    processInput(char) {
        // Simplified: return the char; smartInsert handles all composition logic
        return char;
    }

    // Detect whether a Hangul character is complete (used to decide history-save timing)
    isHangulCharComplete(char) {
        if (!char) return false;
        
        const charCode = char.charCodeAt(0);
        const syllableOffset = charCode - this.SBase;
        
        // Check if it's a complete Hangul syllable (not a standalone jamo)
        if (0 <= syllableOffset && syllableOffset < this.SCount) {
            return true; // Complete Hangul syllable
        }
        
        return false; // Not a complete Hangul syllable (or not Hangul)
    }
    
    // Detect whether any Hangul character completed between old and new text
    detectHangulCompletion(oldText, newText, cursorPosition) {
        // Check around the cursor for a newly completed Hangul character
        if (cursorPosition <= 0) return false;
        
        const newChar = newText[cursorPosition - 1];
        const oldChar = oldText[cursorPosition - 1] || '';
        
        // If new char is complete Hangul but old char wasn't, a character completed
        if (this.isHangulCharComplete(newChar) && !this.isHangulCharComplete(oldChar)) {
            return true;
        }
        
        // Check if a Hangul char changed from incomplete to complete
        if (newChar !== oldChar && this.isHangulCharComplete(newChar)) {
            return true;
        }
        
        return false;
    }

    // Smart insert (improved): better Hangul composition + completion detection
    smartInsert(currentText, cursorStart, cursorEnd, newChar) {
        // 1) Build tentative text by inserting the new character
        const textBefore = currentText.substring(0, cursorStart);
        const textAfter = currentText.substring(cursorEnd);
        const tempText = textBefore + newChar + textAfter;
        const tempCursorPos = cursorStart + newChar.length;
        
        // 2) Try composing different-length sequences near the cursor
        for (let testLength = Math.min(4, tempCursorPos); testLength >= 2; testLength--) {
            const testChars = tempText.substring(tempCursorPos - testLength, tempCursorPos);
            const composed = this.composeHangul(testChars);
            
            // 3) If composition succeeded (shorter, or meaningfully changed), replace
            if (composed.length < testChars.length || composed !== testChars) {
                const newText = tempText.substring(0, tempCursorPos - testLength) + composed + tempText.substring(tempCursorPos);
                const newCursorPos = tempCursorPos - testLength + composed.length;
                
                // 4) Detect whether a Hangul character just completed (for history)
                const hangulCompleted = this.detectHangulCompletion(currentText, newText, newCursorPos);
                
                return {
                    text: newText,
                    cursorPosition: newCursorPos,
                    hangulCompleted: hangulCompleted
                };
            }
        }
        
        // 5) No composition; return tentative text and check for completion
        const hangulCompleted = this.detectHangulCompletion(currentText, tempText, tempCursorPos);
        
        return {
            text: tempText,
            cursorPosition: tempCursorPos,
            hangulCompleted: hangulCompleted
        };
    }

    // Handle consonant input
    processConsonant(consonant) {
        if (!this.currentChosung) {
            // Start a new syllable
            this.currentChosung = consonant;
            this.currentJungsung = '';
            this.currentJongsung = '';
            return consonant;
        } else if (this.currentJungsung && !this.currentJongsung) {
            // Add final consonant
            this.currentJongsung = consonant;
            return this.combineHangul(this.currentChosung, this.currentJungsung, this.currentJongsung);
        } else {
            // Start a new syllable
            const result = this.finalizeCurrent() + consonant;
            this.currentChosung = consonant;
            this.currentJungsung = '';
            this.currentJongsung = '';
            return result;
        }
    }

    // Handle vowel input
    processVowel(vowel) {
        if (this.currentChosung && !this.currentJungsung) {
            // Add medial vowel
            this.currentJungsung = vowel;
            return this.combineHangul(this.currentChosung, this.currentJungsung);
        } else if (this.currentChosung && this.currentJungsung && this.currentJongsung) {
            // Move final consonant to become the next syllable's initial
            const result = this.combineHangul(this.currentChosung, this.currentJungsung) + 
                          this.combineHangul(this.currentJongsung, vowel);
            this.currentChosung = this.currentJongsung;
            this.currentJungsung = vowel;
            this.currentJongsung = '';
            return result;
        } else {
            // Other cases
            const result = this.finalizeCurrent() + vowel;
            this.reset();
            return result;
        }
    }

    // Finalize current composed character
    finalizeCurrent() {
        if (this.currentChosung && this.currentJungsung) {
            return this.combineHangul(this.currentChosung, this.currentJungsung, this.currentJongsung);
        } else if (this.currentChosung) {
            return this.currentChosung;
        }
        return '';
    }

    // Reset state
    reset() {
        this.currentChosung = '';
        this.currentJungsung = '';
        this.currentJongsung = '';
    }

    // Restore input state from a single Hangul character
    restoreStateFromCharacter(char) {
        if (!char) {
            this.reset();
            return;
        }
        
        const decomposed = this.decomposeHangul(char);
        if (decomposed) {
            // If it's a complete Hangul syllable, restore composition state
            this.currentChosung = decomposed.chosung;
            this.currentJungsung = decomposed.jungsung;
            this.currentJongsung = decomposed.jongsung;
        } else if (this.isConsonant(char)) {
            // If it's a standalone consonant, treat it as an initial consonant
            this.currentChosung = char;
            this.currentJungsung = '';
            this.currentJongsung = '';
        } else if (this.isVowel(char)) {
            // If it's a standalone vowel (shouldn't happen in normal Hangul input)
            // Reset state
            this.reset();
        } else {
            // Not Hangul; reset state
            this.reset();
        }
    }

    // Handle backspace (uses the new decomposeHangul)
    handleBackspace(currentText) {
        if (currentText.length === 0) return '';
        
        const lastChar = currentText[currentText.length - 1];
        const decomposed = this.decomposeHangul(lastChar);
        
        // Check if it's Hangul (via decomposition result length)
        if (decomposed.length > 1) {
            // Hangul: follow the reference project's logic
            const decomposedArray = Array.from(decomposed);
            if (decomposedArray.length > 1) {
                // Remove last jamo, then recompose
                const remaining = decomposedArray.slice(0, -1).join('');
                const recomposed = this.composeHangul(remaining);
                return currentText.slice(0, -1) + recomposed;
            }
        }
        
        // Not Hangul or can't decompose; delete normally
        return currentText.slice(0, -1);
    }
    
    // Programmatic input handling (for mobile virtual keyboard)
    processInputProgrammatically(key, isShift, currentText, cursorPosition) {
        const char = this.getCharacter(key, isShift);
        if (!char) return null;
        
        // Use smartInsert to handle input
        return this.smartInsert(currentText, cursorPosition, cursorPosition, char);
    }
    
    // === New feature: Save text ===
    
    // Save text as a file
    saveTextAsFile(text) {
        if (!text.trim()) {
            alert(window.languageManager ? window.languageManager.getText('noTextToSave') || 'No text to save!' : 'No text to save!');
            return;
        }
        
        try {
            // Create Blob
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Generate filename (with timestamp)
            const now = new Date();
            const timestamp = now.getFullYear() + 
                            String(now.getMonth() + 1).padStart(2, '0') + 
                            String(now.getDate()).padStart(2, '0') + '-' +
                            String(now.getHours()).padStart(2, '0') + 
                            String(now.getMinutes()).padStart(2, '0') + 
                            String(now.getSeconds()).padStart(2, '0');
            
            link.download = `korean-text-${timestamp}.txt`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up object URL
            URL.revokeObjectURL(url);
            
        } catch (e) {
            console.error('Failed to save file:', e);
            alert('Failed to save file. Please try again.');
        }
    }
    
    // === New feature: Font size controls ===
    
    // Simple settings persistence
    saveSettings() {
        try {
            const data = {
                fontSize: this.fontSize
            };
            localStorage.setItem('korean-input-data', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save settings to localStorage:', e);
        }
    }
    
    // Load settings from localStorage
    loadSettings() {
        const savedData = localStorage.getItem('korean-input-data');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                if (data.fontSize) {
                    this.fontSize = data.fontSize;
                }
            } catch (e) {
                console.warn('Failed to load settings from localStorage:', e);
            }
        }
    }
    
    // Get current font size
    getFontSize() {
        return this.fontSize;
    }
    
    // Set font size
    setFontSize(size) {
        this.fontSize = Math.max(12, Math.min(36, size)); // Clamp to 12–36px
        
        const textarea = document.getElementById('koreanInput');
        if (textarea) {
            textarea.style.fontSize = this.fontSize + 'px';
        }
        
        this.saveSettings(); // Persist font size setting
        return this.fontSize;
    }
    
    // Increase font size
    increaseFontSize() {
        return this.setFontSize(this.fontSize + 2);
    }
    
    // Decrease font size
    decreaseFontSize() {
        return this.setFontSize(this.fontSize - 2);
    }
    
    // Initialize font size
    initializeFontSize() {
        this.loadSettings(); // Load saved setting
        const textarea = document.getElementById('koreanInput');
        if (textarea) {
            textarea.style.fontSize = this.fontSize + 'px';
        }
    }
}

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const koreanInput = new KoreanInput();
    const textarea = document.getElementById('koreanInput');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const saveBtn = document.getElementById('saveBtn');
    const fontSmallerBtn = document.getElementById('fontSmallerBtn');
    const fontLargerBtn = document.getElementById('fontLargerBtn');

    // Initialize font size
    koreanInput.initializeFontSize();

    // Initialize virtual keyboard and language switcher
    window.virtualKeyboard = new VirtualKeyboard(koreanInput);
    window.languageSwitcher = new LanguageSwitcher();
    
    // Initialize UI language
    window.languageManager.updateUI();
    
    // Fix init ordering: ensure virtual keyboard's translated labels render correctly
    if (window.virtualKeyboard) {
        // Update function-key labels (fixes space key label)
        window.virtualKeyboard.updateFunctionKeysText();
        
        // If on mobile and currently in virtual keyboard mode, update state indicator
        if (window.virtualKeyboard.isMobileDevice && window.virtualKeyboard.isVirtualKeyboardMode) {
            window.virtualKeyboard.updateKeyboardStateIndicator(false);
        }
    }

    // Keyboard event listener
    textarea.addEventListener('keydown', function(e) {
        // If input came from the virtual keyboard on mobile, ignore
        if (window.virtualKeyboard && window.virtualKeyboard.inputSource === 'virtual' && window.virtualKeyboard.isMobileDevice) {
            return;
        }
        
        if (e.key === 'Backspace') {
            e.preventDefault();
            
            // Get cursor/selection info
            const cursorStart = this.selectionStart;
            const cursorEnd = this.selectionEnd;
            
            if (cursorStart === cursorEnd) {
                // Normal delete: delete one character before the cursor
                if (cursorStart > 0) {
                    const textBefore = this.value.substring(0, cursorStart);
                    const textAfter = this.value.substring(cursorStart);
                    
                    // Apply Hangul-smart backspace logic to text before the cursor
                    const newTextBefore = koreanInput.handleBackspace(textBefore);
                    const newText = newTextBefore + textAfter;
                    
                    this.value = newText;
                    
                    // Set new cursor position
                    const newCursorPos = newTextBefore.length;
                    this.setSelectionRange(newCursorPos, newCursorPos);
                    
                    // Restore Hangul input state based on cursor position
                    if (newCursorPos > 0) {
                        const charBeforeCursor = newText[newCursorPos - 1];
                        koreanInput.restoreStateFromCharacter(charBeforeCursor);
                    } else {
                        koreanInput.reset();
                    }
                }
            } else {
                // Selection delete: remove the selected text
                const textBefore = this.value.substring(0, cursorStart);
                const textAfter = this.value.substring(cursorEnd);
                const newText = textBefore + textAfter;
                
                this.value = newText;
                this.setSelectionRange(cursorStart, cursorStart);
                
                // Restore Hangul input state based on cursor position
                if (cursorStart > 0) {
                    const charBeforeCursor = newText[cursorStart - 1];
                    koreanInput.restoreStateFromCharacter(charBeforeCursor);
                } else {
                    koreanInput.reset();
                }
            }
            
            // Note: we no longer call koreanInput.reset() here because state is restored above
            return;
        }

        if (e.key === ' ') {
            e.preventDefault();
            
            const cursorStart = this.selectionStart;
            const textBefore = this.value.substring(0, cursorStart);
            const textAfter = this.value.substring(this.selectionEnd);
            
            this.value = textBefore + ' ' + textAfter;
            
            // Move cursor to after the space
            const newCursorPos = cursorStart + 1;
            this.setSelectionRange(newCursorPos, newCursorPos);
            
            // Reset Hangul input state
            koreanInput.reset();
            
            return;
        }

        // Ignore other special keys
        if (e.key.length > 1 && e.key !== 'Shift') return;

        const char = koreanInput.getCharacter(e.key, e.shiftKey);
        if (char) {
            e.preventDefault();
            const result = koreanInput.processInput(char);
            
            // Update textarea content
            const cursorPos = this.selectionStart;
            const textBefore = this.value.substring(0, cursorPos);
            const textAfter = this.value.substring(this.selectionEnd);
            
            // New Hangul input logic: smart cursor-aware insertion
            const insertResult = koreanInput.smartInsert(this.value, cursorPos, this.selectionEnd, result);
            
            // Update text and cursor position
            this.value = insertResult.text;
            this.setSelectionRange(insertResult.cursorPosition, insertResult.cursorPosition);
        }
    });
    
    // Add touch/focus listeners to distinguish input source
    textarea.addEventListener('touchstart', function(e) {
        if (window.virtualKeyboard) {
            window.virtualKeyboard.inputSource = 'touch';
            // Sync virtual cursor position
            setTimeout(() => {
                window.virtualKeyboard.syncVirtualCursor();
            }, 50);
        }
    });
    
    textarea.addEventListener('mousedown', function(e) {
        if (window.virtualKeyboard) {
            window.virtualKeyboard.inputSource = 'mouse';
            // Sync virtual cursor position
            setTimeout(() => {
                window.virtualKeyboard.syncVirtualCursor();
            }, 50);
        }
    });
    
    textarea.addEventListener('focus', function(e) {
        if (window.virtualKeyboard) {
            // If focus was caused by the virtual keyboard, blur immediately
            if (window.virtualKeyboard.isMobileDevice && window.virtualKeyboard.isVirtualKeyboardMode) {
                e.preventDefault();
                this.blur();
                return false;
            }
            
            // On mobile, if the input source isn't the virtual keyboard, allow the system keyboard
            if (window.virtualKeyboard.isMobileDevice && 
                window.virtualKeyboard.inputSource !== 'virtual') {
                // Normal focus behavior; allow system keyboard
                window.virtualKeyboard.syncVirtualCursor();
            }
        }
        koreanInput.reset();
    });
    
    // Listen for custom virtual input events
    textarea.addEventListener('virtualinput', function(e) {
        // Handle virtual input events; optional extra logic can go here
        // e.g. update other UI elements
    });
    
    // Listen for cursor position changes (selectionchange)
    document.addEventListener('selectionchange', function() {
        if (window.virtualKeyboard && document.activeElement === textarea) {
            // User moved the cursor in the textarea; sync virtual cursor
            if (!window.virtualKeyboard.isVirtualKeyboardMode) {
                window.virtualKeyboard.syncVirtualCursor();
            }
        }
    });
    
    // Listen for selection changes (more compatible approach)
    textarea.addEventListener('selectionchange', function() {
        if (window.virtualKeyboard && !window.virtualKeyboard.isVirtualKeyboardMode) {
            window.virtualKeyboard.syncVirtualCursor();
        }
    });
    
    // Sync cursor on keyup (when using a physical keyboard)
    textarea.addEventListener('keyup', function(e) {
        if (window.virtualKeyboard && !window.virtualKeyboard.isVirtualKeyboardMode) {
            window.virtualKeyboard.syncVirtualCursor();
        }
    });

    // Copy
    copyBtn.addEventListener('click', function() {
        textarea.select();
        document.execCommand('copy');
        
        // Show "copied" feedback (multi-language)
        const originalText = this.textContent;
        this.textContent = window.languageManager.getText('copiedMsg');
        setTimeout(() => {
            this.textContent = originalText;
        }, 1000);
    });

    // Clear
    clearBtn.addEventListener('click', function() {
        textarea.value = '';
        koreanInput.reset();
        window.virtualKeyboard.reset();
        textarea.focus();
    });

    // Save text
    saveBtn.addEventListener('click', function() {
        koreanInput.saveTextAsFile(textarea.value);
        textarea.focus();
    });

    // Decrease font size
    fontSmallerBtn.addEventListener('click', function() {
        koreanInput.decreaseFontSize();
        textarea.focus();
    });

    // Increase font size
    fontLargerBtn.addEventListener('click', function() {
        koreanInput.increaseFontSize();
        textarea.focus();
    });
    
    // On click: reset state and sync cursor
    textarea.addEventListener('click', function() {
        koreanInput.reset();
        // Mark input source as direct
        if (window.virtualKeyboard) {
            window.virtualKeyboard.inputSource = 'direct';
            // Sync virtual cursor position
            window.virtualKeyboard.syncVirtualCursor();
        }
    });
});