document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // --- STATE VARIABLE ---
    let currentConversationId = null;

    // --- HISTORY SIDEBAR LOGIC ---
    const historySidebar = document.getElementById('history-sidebar');
    const historyToggleButton = document.getElementById('history-toggle-btn');
    const historyList = document.getElementById('history-list');
    const newChatButton = document.getElementById('new-chat-btn');
    
    if (historyToggleButton) {
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
            
            historyList.innerHTML = ''; // Clear existing list
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.className = 'p-2 rounded-md hover:bg-gray-700 cursor-pointer truncate text-sm';
                li.textContent = conv.title;
                li.dataset.id = conv._id; // Use _id from MongoDB
                li.addEventListener('click', () => selectConversation(conv._id));
                historyList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
            historyList.innerHTML = '<li>Could not load history.</li>';
        }
    };
    
    const selectConversation = async (id) => {
        try {
            const response = await fetch(`/api/conversation/${id}`);
            if (!response.ok) throw new Error('Failed to load conversation');
            const conversation = await response.json();
            
            chatWindow.innerHTML = ''; // Clear the chat window
            conversation.messages.forEach(message => {
                const sender = message.role === 'user' ? 'user' : 'bot';
                addMessage(message.parts[0].text, sender); 
            });
            currentConversationId = id;
            if (historySidebar) {
                historySidebar.classList.add('-translate-x-full');
                document.body.classList.remove('history-open');
            }
        } catch (error) {
            console.error(error);
        }
    };
    
    const startNewChat = () => {
        currentConversationId = null;
        chatWindow.innerHTML = '';
        addMessage("Hello! I'm ready to help. How can I assist you today?", 'bot');
        if (historySidebar) {
            historySidebar.classList.add('-translate-x-full');
            document.body.classList.remove('history-open');
        }
    };
    
    if (newChatButton) newChatButton.addEventListener('click', startNewChat);

    loadHistory();
    // --- END HISTORY LOGIC ---


    // --- Panel Toggle Logic ---
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatLauncherButton = document.getElementById('chat-launcher-button');
    const closeChatButton = document.getElementById('close-chat-button');

    const toggleChatWindow = () => {
        document.body.classList.toggle('chat-open');
        chatbotContainer.classList.toggle('scale-0');
        chatbotContainer.classList.toggle('opacity-0');
    };

    if (chatLauncherButton) chatLauncherButton.addEventListener('click', toggleChatWindow);
    if (closeChatButton) closeChatButton.addEventListener('click', toggleChatWindow);

    // --- Tab Switching ---
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (speechSynthesis.speaking) speechSynthesis.cancel();
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            contents.forEach(content => {
                content.id === `${target}-tab` ? content.classList.remove('hidden') : content.classList.add('hidden');
            });
        });
    });

    // --- Chatbot, Emoji, and File Upload Logic ---
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button'); // This might be null in new design
    const chatLoading = document.getElementById('chat-loading');
    const emojiButton = document.getElementById('emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const emojiPicker = document.querySelector('emoji-picker');
    const fileUploadButton = document.getElementById('file-upload-button');
    const fileUploadInput = document.getElementById('file-upload');
    
    const attachmentPreview = document.getElementById('attachment-preview');
    const attachmentFilename = document.getElementById('attachment-filename');
    const removeAttachmentButton = document.getElementById('remove-attachment-button');
    
    let attachedFile = null;

    // --- UPDATED: Safe Disable/Enable Functions ---
    const disableChatInputs = () => {
        if(chatInput) chatInput.disabled = true;
        if(sendButton) sendButton.disabled = true;
        if(micButton) micButton.disabled = true; // Check if exists before accessing
        if(emojiButton) emojiButton.disabled = true;
        if(fileUploadButton) fileUploadButton.classList.add('disabled-input');
    };

    const enableChatInputs = () => {
        if(chatInput) chatInput.disabled = false;
        if(sendButton) sendButton.disabled = false;
        if(micButton) micButton.disabled = false; // Check if exists before accessing
        if(emojiButton) emojiButton.disabled = false;
        if(fileUploadButton) fileUploadButton.classList.remove('disabled-input');
    };

    if (emojiButton) {
        emojiButton.addEventListener('click', (event) => {
            event.stopPropagation();
            emojiPickerContainer.classList.toggle('hidden');
        });
    }

    if (emojiPicker) {
        emojiPicker.addEventListener('emoji-click', event => {
            chatInput.value += event.detail.unicode;
        });
    }

    document.addEventListener('click', (event) => {
        if (emojiPickerContainer && !emojiPickerContainer.contains(event.target) && emojiButton && !emojiButton.contains(event.target)) {
            emojiPickerContainer.classList.add('hidden');
        }
    });

    const clearAttachment = () => {
        attachedFile = null;
        fileUploadInput.value = '';
        if (attachmentPreview) attachmentPreview.classList.add('hidden');
        if (fileUploadButton) {
            const icon = fileUploadButton.querySelector('i, svg');
            if (icon) {
                icon.classList.remove('text-blue-500');
            }
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
            attachmentPreview.classList.remove('hidden');
            attachmentFilename.textContent = file.name;
            const icon = fileUploadButton.querySelector('i, svg');
            if (icon) {
                icon.classList.add('text-blue-500');
            }
        });
    }

    if (removeAttachmentButton) {
        removeAttachmentButton.addEventListener('click', clearAttachment);
    }
    
    const formatMarkdownForHTML = (text) => {
        return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    };
    
    const addMessage = (message, sender) => {
        if (!chatWindow) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        let messageText = message || "Sorry, an unexpected error occurred.";
        
        if (sender === 'bot') {
            messageText = formatMarkdownForHTML(messageText);
        }

        messageText = messageText.replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = `<div class="chat-bubble ${sender}">${messageText}</div>`;
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
        img.className = 'rounded-lg';
        img.alt = 'Generated Image';
        
        const downloadButton = document.createElement('a');
        downloadButton.href = imageDataUrl;
        downloadButton.download = 'ai-generated-image.png';
        downloadButton.className = 'download-button mt-3 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700';
        downloadButton.innerHTML = `<i data-lucide="download" class="w-4 h-4 mr-2"></i> Download Image`;
        
        const contentContainer = document.createElement('div');
        contentContainer.appendChild(img);
        contentContainer.appendChild(downloadButton);

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot image-bubble'; 
        bubble.appendChild(contentContainer);
        
        messageDiv.appendChild(bubble);
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        lucide.createIcons();
    };

    const addMusicPlayer = (trackId) => {
        if (!chatWindow) return;
        addMessage("Here's the song you requested:", 'bot');

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-start w-full';

        const iframe = document.createElement('iframe');
        iframe.style.borderRadius = '12px';
        iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
        iframe.width = '100%';
        iframe.height = '152';
        iframe.frameBorder = '0';
        iframe.allowFullscreen = '';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.loading = 'lazy';
        
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot p-0';
        bubble.style.width = '100%';
        bubble.style.backgroundColor = 'transparent';
        bubble.style.border = 'none';
        bubble.style.boxShadow = 'none';
        bubble.appendChild(iframe);
        
        messageDiv.appendChild(bubble);
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    const handleChat = async () => {
        const userInput = chatInput.value.trim();
        if (!userInput && !attachedFile) return;
        disableChatInputs();
        if (userInput) {
            addMessage(userInput, 'user');
        }
        chatInput.value = '';
        chatLoading.classList.remove('hidden');
        
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
                 addMessage('Your session has expired. Redirecting to login...', 'bot');
                 setTimeout(() => { window.location.href = '/'; }, 2000);
                 return;
            }

            if (!response.ok) {
                 const errData = await response.json().catch(() => ({ error: 'The server returned an unreadable error.' }));
                 throw new Error(errData.error || `Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            
            const wasNewChat = !currentConversationId;
            if (data.conversationId) {
                currentConversationId = data.conversationId;
                if (wasNewChat) {
                    loadHistory();
                }
            }

            if (data.error) {
                addMessage(`Error: ${data.error}`, 'bot');
            } else if (data.type === 'image') {
                addImage(data.data);
            } else if (data.type === 'music') {
                addMusicPlayer(data.trackId);
            } else {
                addMessage(data.data, 'bot');
            }
        } catch (error) {
            addMessage(`Error: ${error.message}.`, 'bot');
        } finally {
            if(chatLoading) chatLoading.classList.add('hidden');
            clearAttachment();
            enableChatInputs();
        }
    };

    if (sendButton) sendButton.addEventListener('click', handleChat);
    if (chatInput) chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleChat());

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    // --- UPDATED: Safe check for micButton existence ---
    if (SpeechRecognition && micButton) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        micButton.addEventListener('click', () => recognition.start());
        recognition.onstart = () => micButton.classList.add('mic-listening');
        recognition.onend = () => micButton.classList.remove('mic-listening');
        recognition.onresult = (event) => {
            chatInput.value = event.results[0][0].transcript;
            handleChat();
        };
    }

    // --- Utility Functions (Video to Audio, Text to Audio) ---
    const vtoaInput = document.getElementById('vtoa-input');
    const vtoaConvertBtn = document.getElementById('vtoa-convert');
    const vtoaFilename = document.getElementById('vtoa-filename');
    let vtoaFile;
    if(vtoaInput) {
        vtoaInput.addEventListener('change', (e) => {
            vtoaFile = e.target.files[0];
            if (vtoaFile) {
                vtoaFilename.textContent = `Selected: ${vtoaFile.name}`;
                vtoaConvertBtn.disabled = false;
                document.getElementById('vtoa-status').innerHTML = '';
            }
        });
    }
    if(vtoaConvertBtn) {
        vtoaConvertBtn.addEventListener('click', async () => {
            if (!vtoaFile) return;
            showStatus('vtoa-status', 'Processing...', 'info');
            vtoaConvertBtn.disabled = true;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                    const wavBlob = audioBufferToWav(audioBuffer);
                    const url = URL.createObjectURL(wavBlob);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = `${vtoaFile.name.split('.')[0]}.wav`;
                    downloadLink.className = 'mt-4 block text-center text-blue-600 hover:underline';
                    downloadLink.innerText = 'Click here to download your audio file';
                    const statusContainer = document.getElementById('vtoa-status');
                    showStatus('vtoa-status', 'Conversion successful!', 'success');
                    statusContainer.appendChild(downloadLink);
                } catch (error) {
                    console.error('Conversion failed:', error);
                    showStatus('vtoa-status', 'Error: This video format may not be supported by your browser.', 'error');
                } finally {
                    vtoaConvertBtn.disabled = false;
                }
            };
            reader.readAsArrayBuffer(vtoaFile);
        });
    }
    const ttoaText = document.getElementById('ttoa-text');
    const ttoaVoice = document.getElementById('ttoa-voice');
    const ttoaSpeakBtn = document.getElementById('ttoa-speak');
    let voices = [];
    function populateVoiceList() {
        if(!ttoaVoice) return;
        voices = speechSynthesis.getVoices();
        ttoaVoice.innerHTML = voices
            .map(voice => `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`)
            .join('');
    }
    if(speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
    populateVoiceList();
    if(ttoaSpeakBtn) {
        ttoaSpeakBtn.addEventListener('click', () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
            const text = ttoaText.value;
            if (text.trim().length > 0) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = voices.find(voice => voice.name === ttoaVoice.value);
                speechSynthesis.speak(utterance);
            }
        });
    }
    function showStatus(elementId, message, type = 'info') {
        const el = document.getElementById(elementId);
        if(!el) return;
        const colorClass = type === 'success' ? 'text-green-600' : (type === 'error' ? 'text-red-600' : 'text-gray-600');
        el.innerHTML = `<div class="p-2 mt-2 rounded-md ${type !== 'info' ? 'bg-gray-100' : ''} ${colorClass}">${message}</div>`;
    };
    function audioBufferToWav(buffer) {
        let numOfChan = buffer.numberOfChannels, len = buffer.length * numOfChan * 2 + 44, wavBuffer = new ArrayBuffer(len), view = new DataView(wavBuffer), channels = [], i, sample, offset = 0, pos = 0;
        setUint32(0x46464952); setUint32(len - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(len - pos - 4);
        for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
        while (pos < len) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        return new Blob([view], { type: 'audio/wav' });
        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    }

    // --- Language Translator Logic ---
    const translatorTextInput = document.getElementById('translator-text-input');
    const translatorLangFrom = document.getElementById('translator-language-from');
    const translatorLangSelect = document.getElementById('translator-language-select');
    const translatorButton = document.getElementById('translator-button');
    const translatorOutput = document.getElementById('translator-output');
    if (translatorButton) {
        translatorButton.addEventListener('click', async () => {
            const textToTranslate = translatorTextInput.value;
            const sourceLanguage = translatorLangFrom.value;
            const targetLanguage = translatorLangSelect.value;
            if (!textToTranslate.trim()) {
                translatorOutput.textContent = 'Please enter some text to translate.';
                return;
            }
            translatorButton.disabled = true;
            translatorButton.textContent = 'Translating...';
            translatorOutput.textContent = '';
            try {
                const response = await fetch('/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: textToTranslate, 
                        sourceLanguage: sourceLanguage, 
                        targetLanguage: targetLanguage 
                    })
                });
                if (response.status === 401) {
                    translatorOutput.textContent = 'Your session has expired. Please log in again.';
                    return;
                }
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Translation failed due to a server error.' }));
                    throw new Error(errorData.error);
                }
                const data = await response.json();
                translatorOutput.textContent = data.translatedText;
            } catch (error) {
                console.error('Translation error:', error);
                translatorOutput.textContent = `Error: ${error.message}`;
            } finally {
                translatorButton.disabled = false;
                translatorButton.textContent = 'Translate';
            }
        });
    }
    
    // --- Voice Assistant Logic ---
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
                lucide.createIcons();
                
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
        lucide.createIcons();
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

    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            if (targetTab !== 'assistant' && isAssistantActive) {
                stopConversation();
            }
        });
    });

    const closeChatBtn = document.getElementById('close-chat-button');
    if(closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            if(isAssistantActive) stopConversation();
        });
    }
});