document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // --- STATE VARIABLES ---
    let currentConversationId = null;

    // --- DOM ELEMENTS ---
    const historySidebar = document.getElementById('history-sidebar');
    const historyToggleButton = document.getElementById('history-toggle-btn');
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button'); 
    const chatLoading = document.getElementById('chat-loading');
    const emojiButton = document.getElementById('emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const fileUploadButton = document.getElementById('file-upload-button');
    const fileUploadInput = document.getElementById('file-upload');
    const attachmentPreview = document.getElementById('attachment-preview');
    const attachmentFilename = document.getElementById('attachment-filename');
    const removeAttachmentButton = document.getElementById('remove-attachment-button');

    let attachedFile = null;

    // --- HELPER: SAFE DISABLE ---
    const disableChatInputs = () => {
        if (chatInput) chatInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        if (micButton) micButton.disabled = true;
        if (emojiButton) emojiButton.disabled = true;
        if (fileUploadButton) fileUploadButton.classList.add('disabled-input');
    };

    const enableChatInputs = () => {
        if (chatInput) chatInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (micButton) micButton.disabled = false;
        if (emojiButton) emojiButton.disabled = false;
        if (fileUploadButton) fileUploadButton.classList.remove('disabled-input');
        if (chatInput) chatInput.focus();
    };

    // --- HISTORY SIDEBAR LOGIC ---
    if (historyToggleButton && historySidebar) {
        historyToggleButton.addEventListener('click', () => {
            historySidebar.classList.toggle('-translate-x-full');
            document.body.classList.toggle('history-open');
        });
    }

    const loadHistory = async () => {
        if (!historyList) return;
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error('Failed to load history');
            const conversations = await response.json();
            
            historyList.innerHTML = ''; 
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.className = 'p-3 hover:bg-white/10 rounded-lg cursor-pointer truncate text-sm text-gray-300 transition-colors';
                li.textContent = conv.title;
                li.addEventListener('click', () => selectConversation(conv._id));
                historyList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
        }
    };
    
    const selectConversation = async (id) => {
        try {
            const response = await fetch(`/api/conversation/${id}`);
            if (!response.ok) throw new Error('Failed to load conversation');
            const conversation = await response.json();
            
            if (chatWindow) chatWindow.innerHTML = '';
            
            conversation.messages.forEach(message => {
                const sender = message.role === 'user' ? 'user' : 'bot';
                addMessage(message.parts[0].text, sender); 
            });
            currentConversationId = id;
            
            if (historySidebar && window.innerWidth < 768) {
                historySidebar.classList.add('-translate-x-full');
            }
        } catch (error) {
            console.error(error);
        }
    };
    
    const startNewChat = () => {
        currentConversationId = null;
        if (chatWindow) chatWindow.innerHTML = '';
        
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'flex justify-start';
        welcomeDiv.innerHTML = `<div class="chat-message-ai p-4 max-w-[80%] text-sm leading-relaxed shadow-lg">Hello! I'm ready to help. How can I assist you today?</div>`;
        chatWindow.appendChild(welcomeDiv);

        if (historySidebar && window.innerWidth < 768) {
            historySidebar.classList.add('-translate-x-full');
        }
    };
    
    if (newChatButton) newChatButton.addEventListener('click', startNewChat);
    loadHistory();

    // --- PANEL TOGGLE LOGIC ---
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatLauncherButton = document.getElementById('chat-launcher-button');
    const closeChatButton = document.getElementById('close-chat-button');

    const toggleChatWindow = () => {
        if (!chatbotContainer) return;
        document.body.classList.toggle('chat-open');
        chatbotContainer.classList.toggle('scale-0');
        chatbotContainer.classList.toggle('opacity-0');
    };

    if (chatLauncherButton) chatLauncherButton.addEventListener('click', toggleChatWindow);
    if (closeChatButton) closeChatButton.addEventListener('click', toggleChatWindow);

    // --- TAB SWITCHING LOGIC (MOVED HERE) ---
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            
            // Visual update for tabs
            tabs.forEach(item => {
                item.classList.remove('bg-white/10');
                const icon = item.querySelector('i');
                const text = item.querySelector('span');
                if(icon) icon.classList.remove('text-white');
                if(text) text.classList.remove('text-white');
            });
            
            tab.classList.add('bg-white/10');
            const activeIcon = tab.querySelector('i');
            const activeText = tab.querySelector('span');
            if(activeIcon) activeIcon.classList.add('text-white');
            if(activeText) activeText.classList.add('text-white');

            const target = tab.getAttribute('data-tab');
            contents.forEach(content => {
                content.id === `${target}-tab` ? content.classList.remove('hidden') : content.classList.add('hidden');
            });
            
            // Stop assistant if leaving assistant tab
            if (target !== 'assistant' && typeof isAssistantActive !== 'undefined' && isAssistantActive) {
                if (typeof stopConversation === 'function') stopConversation();
            }
        });
    });

    // --- EMOJI PICKER ---
    if (emojiButton && emojiPickerContainer) {
        emojiButton.addEventListener('click', (event) => {
            event.stopPropagation();
            emojiPickerContainer.classList.toggle('hidden');
        });

        const picker = document.querySelector('emoji-picker');
        if (picker) {
            picker.addEventListener('emoji-click', event => {
                if (chatInput) chatInput.value += event.detail.unicode;
            });
        }

        document.addEventListener('click', (event) => {
            if (!emojiPickerContainer.contains(event.target) && !emojiButton.contains(event.target)) {
                emojiPickerContainer.classList.add('hidden');
            }
        });
    }

    // --- FILE ATTACHMENT ---
    const clearAttachment = () => {
        attachedFile = null;
        if (fileUploadInput) fileUploadInput.value = '';
        if (attachmentPreview) attachmentPreview.classList.add('hidden');
        if (fileUploadButton) {
            const icon = fileUploadButton.querySelector('i, svg');
            if (icon) icon.classList.remove('text-blue-400', 'text-white');
        }
    };

    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                clearAttachment();
                return;
            }
            attachedFile = file;
            if (attachmentPreview) attachmentPreview.classList.remove('hidden');
            if (attachmentFilename) attachmentFilename.textContent = file.name;
            
            const icon = fileUploadButton.querySelector('i, svg');
            if (icon) icon.classList.add('text-blue-400');
        });
    }

    if (removeAttachmentButton) {
        removeAttachmentButton.addEventListener('click', clearAttachment);
    }

    // --- MESSAGING LOGIC ---
    const formatMarkdownForHTML = (text) => {
        if (!text) return '';
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="bg-black/50 p-2 rounded my-2 overflow-x-auto"><code>$1</code></pre>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded text-sm">$1</code>');
        return formatted;
    };
    
    const addMessage = (message, sender) => {
        if (!chatWindow) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        let messageText = message || "An unexpected error occurred.";
        const bubbleClass = sender === 'user' ? 'chat-message-user' : 'chat-message-ai';
        
        if (sender === 'bot') {
            messageText = formatMarkdownForHTML(messageText);
            messageText = messageText.replace(/\n/g, '<br>');
        }

        messageDiv.innerHTML = `<div class="${bubbleClass} p-4 max-w-[85%] text-sm leading-relaxed shadow-lg">${messageText}</div>`;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    const addImage = (base64String) => {
        if (!chatWindow) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-start';
        
        const img = document.createElement('img');
        const imageDataUrl = `data:image/png;base64,${base64String}`;
        img.src = imageDataUrl;
        img.className = 'rounded-lg max-w-full shadow-lg border border-white/10';
        
        const downloadButton = document.createElement('a');
        downloadButton.href = imageDataUrl;
        downloadButton.download = 'generated-image.png';
        downloadButton.className = 'mt-2 inline-flex items-center text-xs text-blue-400 hover:text-blue-300';
        downloadButton.innerHTML = `<i data-lucide="download" class="w-4 h-4 mr-1"></i> Download`;
        
        const container = document.createElement('div');
        container.className = 'chat-message-ai p-3';
        container.appendChild(img);
        container.appendChild(downloadButton);
        
        messageDiv.appendChild(container);
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        // FIX: Ensure icons render after dynamic insertion
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 0);
    };

    const addMusicPlayer = (trackId) => {
        if (!chatWindow) return;
        addMessage("Playing your request on Spotify:", 'bot');

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-start w-full max-w-md';

        const iframe = document.createElement('iframe');
        iframe.style.borderRadius = '12px';
        iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
        iframe.width = '100%';
        iframe.height = '152';
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.loading = 'lazy';
        
        messageDiv.appendChild(iframe);
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    // --- MAIN SEND FUNCTION ---
    const handleChat = async () => {
        const userInput = chatInput.value.trim();
        if (!userInput && !attachedFile) return;
        
        disableChatInputs(); 
        
        if (userInput) {
            addMessage(userInput, 'user');
        }
        
        chatInput.value = ''; 
        if (chatLoading) chatLoading.classList.remove('hidden');
        if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
        
        const formData = new FormData();
        formData.append('prompt', userInput);
        
        if (currentConversationId) {
            formData.append('conversationId', currentConversationId);
        }
        
        if (attachedFile) {
            formData.append('file', attachedFile, attachedFile.name);
        }

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData, 
                credentials: 'include' 
            });

            if (response.status === 401) {
                 addMessage('Session expired. Redirecting to login...', 'bot');
                 setTimeout(() => { window.location.href = '/'; }, 2000);
                 return;
            }

            if (!response.ok) {
                 throw new Error(`Server status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.conversationId && !currentConversationId) {
                currentConversationId = data.conversationId;
                loadHistory(); 
            }

            if (data.error) {
                addMessage(`Error: ${data.error}`, 'bot');
            } else if (data.type === 'image') {
                addImage(data.data);
            } else if (data.type === 'music') {
                addMusicPlayer(data.trackId);
            } else if (data.type === 'language_switch') {
                addMessage(data.data, 'bot');
            } else {
                addMessage(data.data, 'bot');
            }
        } catch (error) {
            console.error("Chat Error:", error);
            addMessage("Sorry, I couldn't connect to the server. Please try again.", 'bot');
        } finally {
            if (chatLoading) chatLoading.classList.add('hidden');
            clearAttachment();
            enableChatInputs();
        }
    };

    if (sendButton) sendButton.addEventListener('click', handleChat);
    if (chatInput) chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleChat());

    // --- SPEECH RECOGNITION (Chat Bar) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && micButton) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        micButton.addEventListener('click', () => recognition.start());
        recognition.onstart = () => micButton.classList.add('text-red-500', 'animate-pulse');
        recognition.onend = () => micButton.classList.remove('text-red-500', 'animate-pulse');
        recognition.onresult = (event) => {
            chatInput.value = event.results[0][0].transcript;
            handleChat();
        };
    }

    // --- UTILITIES: VIDEO TO AUDIO ---
    const vtoaInput = document.getElementById('vtoa-input');
    const vtoaConvertBtn = document.getElementById('vtoa-convert');
    const vtoaFilename = document.getElementById('vtoa-filename');
    const vtoaStatus = document.getElementById('vtoa-status');
    let vtoaFile;

    if(vtoaInput) {
        vtoaInput.addEventListener('change', (e) => {
            vtoaFile = e.target.files[0];
            if (vtoaFile) {
                vtoaFilename.textContent = vtoaFile.name;
                vtoaConvertBtn.disabled = false;
                vtoaStatus.innerHTML = '';
            }
        });
    }

    if(vtoaConvertBtn) {
        vtoaConvertBtn.addEventListener('click', () => {
            if (!vtoaFile) return;
            vtoaStatus.textContent = 'Processing...';
            vtoaConvertBtn.disabled = true;
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                    
                    const wavBlob = audioBufferToWav(audioBuffer);
                    const url = URL.createObjectURL(wavBlob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = vtoaFile.name.replace(/\.[^/.]+$/, "") + ".wav";
                    link.className = "text-blue-400 underline block mt-2";
                    link.textContent = "Download Audio";
                    
                    vtoaStatus.innerHTML = '';
                    vtoaStatus.appendChild(link);
                } catch (err) {
                    vtoaStatus.textContent = "Error converting video.";
                    console.error(err);
                } finally {
                    vtoaConvertBtn.disabled = false;
                }
            };
            reader.readAsArrayBuffer(vtoaFile);
        });
    }

    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; 
        const bitDepth = 16;
        
        let result;
        if (numChannels === 2) {
            result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
    }

    function interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);
        let index = 0;
        let inputIndex = 0;
        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
        const view = new DataView(buffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * bytesPerSample, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * bytesPerSample, true);

        const floatTo16BitPCM = (output, offset, input) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        floatTo16BitPCM(view, 44, samples);
        return new Blob([view], { type: 'audio/wav' });
    }

    // --- UTILITIES: TRANSLATOR ---
    const translatorButton = document.getElementById('translator-button');
    const translatorOutput = document.getElementById('translator-output');
    
    if (translatorButton) {
        translatorButton.addEventListener('click', async () => {
            const text = document.getElementById('translator-text-input').value;
            const from = document.getElementById('translator-language-from').value;
            const to = document.getElementById('translator-language-select').value;
            
            if (!text) return;
            
            translatorButton.disabled = true;
            translatorButton.textContent = 'Translating...';
            
            try {
                const res = await fetch('/translate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ text, sourceLanguage: from, targetLanguage: to })
                });
                const data = await res.json();
                if(data.translatedText) {
                    translatorOutput.textContent = data.translatedText;
                } else {
                    translatorOutput.textContent = "Translation failed.";
                }
            } catch (err) {
                translatorOutput.textContent = "Error connecting to server.";
            } finally {
                translatorButton.disabled = false;
                translatorButton.textContent = 'Translate';
            }
        });
    }

    // --- UTILITIES: TEXT TO SPEECH ---
    const ttoaSpeakBtn = document.getElementById('ttoa-speak');
    const ttoaText = document.getElementById('ttoa-text');
    const ttoaVoiceSelect = document.getElementById('ttoa-voice');
    
    const loadVoices = () => {
        if (!ttoaVoiceSelect) return;
        const voices = window.speechSynthesis.getVoices();
        ttoaVoiceSelect.innerHTML = voices
            .map(voice => `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`)
            .join('');
    };
    
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }

    if (ttoaSpeakBtn) {
        ttoaSpeakBtn.addEventListener('click', () => {
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            
            const text = ttoaText.value;
            if (!text) return;
            
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === ttoaVoiceSelect.value);
            if (selectedVoice) utterance.voice = selectedVoice;
            
            window.speechSynthesis.speak(utterance);
        });
    }

    // --- VOICE ASSISTANT & VISUALIZER ---
    const toggleAssistantBtn = document.getElementById('toggle-assistant-btn');
    const assistantStatus = document.getElementById('assistant-status');
    const userTranscript = document.getElementById('user-transcript');
    const visualizerCanvas = document.getElementById('voice-visualizer');
    let canvasCtx;
    if(visualizerCanvas) {
       canvasCtx = visualizerCanvas.getContext('2d');
    }

    const VoiceAssistantSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let audioContext;
    let analyser;
    let source;
    let dataArray;
    let animationFrameId;
    let isAssistantActive = false;
    let assistantVoices = []; 
    let currentLang = 'en-US';

    const setupSpeech = () => {
        assistantVoices = speechSynthesis.getVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => assistantVoices = speechSynthesis.getVoices();
        }
    };
    setupSpeech(); 

    const sanitizeTextForSpeech = (text) => {
        let cleanText = text.replace(/\*\*/g, '');
        cleanText = cleanText.replace(/^(\d+)\.\s/gm, 'Point $1, ');
        return cleanText;
    };

    const startConversation = () => {
        if (!VoiceAssistantSpeechRecognition || isAssistantActive) return;
        
        navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true }})
            .then(stream => {
                isAssistantActive = true;
                toggleAssistantBtn.innerHTML = `<i data-lucide="mic-off" class="w-5 h-5 mr-2"></i> Stop Assistant`;
                toggleAssistantBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                toggleAssistantBtn.classList.add('bg-red-600', 'hover:bg-red-700');
                
                // FIX: Update icons
                setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 0);
                
                setupVisualizer(stream); 
                listen(); 
            })
            .catch(err => {
                console.error("Microphone access denied:", err);
                assistantStatus.textContent = "Microphone access is required.";
            });
    };

    const stopConversation = () => {
        if (!isAssistantActive) return;
        isAssistantActive = false;
        
        if (recognition) recognition.stop();
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.error("Error closing AudioContext:", e));
        }
        
        assistantStatus.textContent = "Press the button to start.";
        userTranscript.textContent = "...";
        toggleAssistantBtn.innerHTML = `<i data-lucide="mic" class="w-5 h-5 mr-2"></i> Start Assistant`;
        toggleAssistantBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        toggleAssistantBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        currentLang = 'en-US';
        
        // FIX: Update icons
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 0);

        clearCanvas();
    };

    const listen = () => {
        if (!isAssistantActive) return;
        assistantStatus.textContent = "Listening...";
        
        recognition = new VoiceAssistantSpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = false;
        recognition.lang = currentLang;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            if (transcript) {
                userTranscript.textContent = transcript;
                assistantStatus.textContent = "Thinking...";
                sendToAI(transcript);
            } else {
                listen();
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech' && isAssistantActive) {
                listen();
            }
        };

        recognition.start();
    };

    const sendToAI = async (promptText) => {
        try {
            const formData = new FormData();
            formData.append('prompt', promptText);
            const response = await fetch('/chat', { method: 'POST', body: formData, credentials: 'include' });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.type === 'language_switch') {
                currentLang = data.lang_code;
                speak(data.data);
            } else {
                const aiResponse = data.data || "I'm not sure how to respond to that.";
                speak(aiResponse);
            }
        } catch (error) {
            console.error("Error in sendToAI function:", error);
            speak("Sorry, I seem to have encountered an error.");
        }
    };

    const speak = (text) => {
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        
        const cleanTextForSpeech = sanitizeTextForSpeech(text);
        const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech);
        
        let selectedVoice = assistantVoices.find(voice => voice.lang === currentLang);
        
        if (!selectedVoice && !currentLang.startsWith('en-')) {
            assistantStatus.textContent = `No '${currentLang}' voice found in browser.`;
            setTimeout(() => { if (isAssistantActive) listen(); }, 3500);
            return;
        }

        if (!selectedVoice) {
            selectedVoice = assistantVoices.find(voice => voice.name === 'Google US English') || 
                            assistantVoices.find(voice => voice.lang.startsWith('en-') && voice.localService);
        }
        
        utterance.voice = selectedVoice;
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => { assistantStatus.textContent = "Speaking..."; };
        utterance.onend = () => { if (isAssistantActive) listen(); };

        speechSynthesis.speak(utterance);
    };

    const setupVisualizer = (stream) => {
        if(!visualizerCanvas) return;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 512;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        drawVisualizer();
    };

    const drawVisualizer = () => {
        if (!isAssistantActive) return;
        animationFrameId = requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.fillStyle = '#111827';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const centerX = visualizerCanvas.width / 2;
        const centerY = visualizerCanvas.height / 2;
        const radius = 60;
        const barWidth = 2;
        const numBars = 100;
        for (let i = 0; i < numBars; i++) {
            const barHeight = dataArray[i] * 0.4;
            const angle = (i / numBars) * 2 * Math.PI;
            const startX = centerX + radius * Math.cos(angle);
            const startY = centerY + radius * Math.sin(angle);
            const endX = centerX + (radius + barHeight) * Math.cos(angle);
            const endY = centerY + (radius + barHeight) * Math.sin(angle);
            const gradient = canvasCtx.createLinearGradient(0, 0, 0, visualizerCanvas.height);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#a855f7');
            canvasCtx.strokeStyle = gradient;
            canvasCtx.lineWidth = barWidth;
            canvasCtx.beginPath();
            canvasCtx.moveTo(startX, startY);
            canvasCtx.lineTo(endX, endY);
            canvasCtx.stroke();
        }
    };

    const clearCanvas = () => {
        if(!visualizerCanvas) return;
        canvasCtx.fillStyle = '#111827';
        canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    };

    const toggleConversation = () => {
        if (isAssistantActive) stopConversation();
        else startConversation();
    };

    if (toggleAssistantBtn) {
        toggleAssistantBtn.addEventListener('click', toggleConversation);
    }

    const closeChatBtn = document.getElementById('close-chat-button');
    if(closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            if(isAssistantActive) stopConversation();
        });
    }

    // Trigger initial tab
    const defaultTab = document.querySelector('[data-tab="chatbot"]');
    if (defaultTab) defaultTab.click();
});