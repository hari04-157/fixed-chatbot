const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const SpotifyWebApi = require('spotify-web-api-node');
// --- NEW IMPORTS FOR PASSWORD RESET ---
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const port = 3000;

// --- VERCEL FIX: Required for secure cookies & links in production ---
app.set('trust proxy', 1);

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI, {})
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- NEW: Email Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- Spotify API Setup ---
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

const getSpotifyToken = async () => {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
    } catch (err) {
        console.error('Something went wrong when retrieving an access token for Spotify', err);
    }
};

getSpotifyToken();
setInterval(getSpotifyToken, 1000 * 60 * 60);

// --- User Schema and Model ---
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    firstName: { type: String },
    lastName: { type: String },
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    displayName: { type: String },
    profilePicture: { type: String },
    // --- NEW FIELDS FOR RESET ---
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: { type: Date, default: Date.now }
});
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};
const User = mongoose.model('User', UserSchema);

// --- Schemas for Chat History ---
const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'model'], // 'model' represents the AI
        required: true
    },
    parts: [{
        text: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ConversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        default: 'New Conversation'
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Conversation = mongoose.model('Conversation', ConversationSchema);

// --- Middleware ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions' }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 1000 * 60 * 60 * 24 * 7,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname)));

// --- Passport.js Strategies Configuration ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
        ? "https://fixed-chatbot.vercel.app/auth/google/callback" 
        : "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            return done(null, user);
        } else {
            let existingUser = await User.findOne({ email: profile.emails[0].value });
            if (existingUser) {
                existingUser.googleId = profile.id;
                existingUser.displayName = existingUser.displayName || profile.displayName;
                existingUser.profilePicture = existingUser.profilePicture || profile.photos[0].value;
                await existingUser.save();
                return done(null, existingUser);
            }
            const newUser = new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value.toLowerCase(),
                profilePicture: profile.photos[0].value,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (err) {
        return done(err, null);
    }
}));
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return done(null, false, { message: 'No user found with that email.' });
        }
        if (!user.password) {
            return done(null, false, { message: 'This account was registered with Google. Please use Google to log in.' });
        }
        const isMatch = await user.comparePassword(password);
        if (isMatch) {
            return done(null, user);
        } else {
            return done(null, false, { message: 'Password incorrect.' });
        }
    } catch (err) {
        return done(err);
    }
}));
passport.serializeUser((user, done) => { done(null, user.id); });
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) { done(err, null); }
});

// --- Authentication Routes ---
app.post('/auth/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }
        const newUser = new User({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password,
            displayName: `${firstName} ${lastName}`
        });
        await newUser.save();
        req.login(newUser, (err) => {
            if (err) {
                return res.status(500).json({ message: 'Session could not be established after signup.' });
            }
            res.status(201).json({ message: 'User created successfully' });
        });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ message: 'Server error during signup.' });
    }
});

app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { 
            return res.status(500).json({ message: 'An error occurred during login.' });
        }
        if (!user) {
            return res.status(401).json({ message: info.message || 'Invalid email or password.' });
        }
        req.logIn(user, (err) => {
            if (err) { 
                return res.status(500).json({ message: 'Session could not be saved.' });
            }
            return res.status(200).json({ message: 'Logged in successfully' });
        });
    })(req, res, next);
});

// --- NEW: FORGOT PASSWORD ROUTE ---
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: 'No user found with that email.' });
        }

        // Generate Token
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Construct Link (Detects https or http automatically)
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset Request',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                  `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                  `${resetUrl}\n\n` +
                  `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'An email has been sent to ' + user.email + ' with further instructions.' });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ message: 'Error sending email. Please try again later.' });
    }
});

// --- NEW: RESET PASSWORD ROUTE ---
app.post('/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const user = await User.findOne({ 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        user.password = password; // Will be hashed by pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Success! Your password has been changed. You can now log in.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ message: 'Error resetting password.' });
    }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/chat.html');
});
app.get('/auth/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- Middleware and Protected Routes ---
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}
app.get('/chat.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});
// Serve the reset password page
app.get('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset-password.html'));
});

// --- Chat History API Routes ---
app.get('/api/history', ensureAuthenticated, async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.user._id }).sort({ createdAt: -1 }).select('id title');
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
});

app.get('/api/conversation/:id', ensureAuthenticated, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
        res.json(conversation);
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation.' });
    }
});

// --- Main Chat Endpoint ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

app.post('/chat', upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    
    let { prompt: userPrompt = "", conversationId } = req.body;
    const file = req.file;
    const userId = req.user._id;

    if (!userPrompt && !file) {
        return res.status(400).json({ error: 'Prompt or file is required' });
    }

    let conversation;
    let responsePayload = { type: 'text', data: "An unexpected error occurred." };

    try {
        // Find or create conversation
        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                conversationId = null; 
            }
        }
        
        if (!conversationId) {
            const title = userPrompt.substring(0, 40) + (userPrompt.length > 40 ? '...' : '');
            conversation = new Conversation({ userId, title });
        }

        const userMessageContent = userPrompt + (file ? ` [File: ${file.originalname}]` : "");
        conversation.messages.push({ role: 'user', parts: [{ text: userMessageContent }] });
        
        const introTriggers = ['introduce yourself', 'who are you', 'what is your name', "what's your name", 'who made you', 'who developed you', 'who created you'];
        if (introTriggers.some(trigger => userPrompt.toLowerCase().includes(trigger))) {
            const customResponse = "My name is Jarvis.Developed by maxxgaming";
            responsePayload = { type: 'text', data: customResponse };
        } else if (file) {
            const responseText = await generateTextWithGemini(userPrompt || "Explain this file.", file);
            responsePayload = { type: 'text', data: responseText };
        } else {
            const routingPrompt = `Analyze the user's request and classify it. Respond with a single JSON object and nothing else.
Your response must be one of the following formats:
1. For generating an image: {"type": "image", "prompt": "the subject for the image"}
2. For changing the conversation language (e.g., "speak in telugu"): {"type": "language_switch", "lang_code": "the BCP-47 language code", "response": "a short confirmation message in the new language"}
3. For playing music (e.g., "play a love song"): {"type": "music", "query": "the name of the song, artist, or genre"}
4. For a regular text-based question: {"type": "text", "prompt": "the user's original question"}
User question: "${userPrompt}"`;
            const intentText = await generateTextWithGemini(routingPrompt);
            let intent;
            try {
                const jsonMatch = intentText.match(/\{[\s\S]*\}/);
                intent = JSON.parse(jsonMatch[0]);
            } catch (e) {
                intent = { type: 'text', prompt: userPrompt };
            }
            
            if (intent.type === 'image' && intent.prompt) {
                const imageBase64 = await generateImageWithStability(intent.prompt);
                responsePayload = { type: 'image', data: imageBase64, textContent: `Generated image for: ${intent.prompt}` };
            } else if (intent.type === 'language_switch') {
                responsePayload = { type: 'language_switch', lang_code: intent.lang_code, data: intent.response };
            } else if (intent.type === 'music' && intent.query) {
                const trackId = await searchSongOnSpotify(intent.query);
                if (trackId) {
                    responsePayload = { type: 'music', trackId: trackId, textContent: `Playing song matching: ${intent.query}` };
                } else {
                    responsePayload = { type: 'text', data: `Sorry, I couldn't find songs for "${intent.query}".` };
                }
            } else {
                const textResponse = await generateTextWithGemini(userPrompt);
                responsePayload = { type: 'text', data: textResponse };
            }
        }
        
        const aiMessageText = responsePayload.textContent || responsePayload.data || `[${responsePayload.type} response]`;
        conversation.messages.push({ role: 'model', parts: [{ text: aiMessageText }] });
        
        await conversation.save();

        responsePayload.conversationId = conversation._id;
        res.json(responsePayload);

    } catch (error) {
        console.error('Server Error in /chat endpoint:', error);
        res.status(500).json({ error: 'Failed to process the request.', conversationId: conversationId || null });
    }
});

// --- Helper Functions ---
async function searchSongOnSpotify(query) {
    try {
        const searchResult = await spotifyApi.searchTracks(query, { limit: 1 });
        if (searchResult.body.tracks.items.length > 0) {
            const track = searchResult.body.tracks.items[0];
            console.log(`Found track: ${track.name} by ${track.artists[0].name}`);
            return track.id;
        }
        return null;
    } catch (err) {
        console.error('Error searching for song on Spotify:', err);
        if (err.statusCode === 401) {
            await getSpotifyToken();
            return searchSongOnSpotify(query);
        }
        return null;
    }
}

async function generateTextWithGemini(prompt, file = null) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    let requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };
    if(file) {
        requestBody.contents[0].parts.push({ inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') } });
    }
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => response.text());
        console.error('Gemini API Error:', errorBody);
        throw new Error('Failed to get response from Gemini API.');
    }
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
        if (data.promptFeedback?.blockReason) {
            return `I'm sorry, I cannot process this request due to safety restrictions (${data.promptFeedback.blockReason}).`;
        }
        return "Sorry, I couldn't get a valid response from the AI.";
    }

    return data.candidates[0]?.content?.parts[0]?.text || "Sorry, I couldn't get a response.";
}

async function generateImageWithStability(prompt) {
    if (!STABILITY_API_KEY) throw new Error('Stability AI API key not configured.');
    const engineId = 'stable-diffusion-xl-1024-v1-0';
    const apiHost = 'https://api.stability.ai';
    const apiUrl = `${apiHost}/v1/generation/${engineId}/text-to-image`;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${STABILITY_API_KEY}` },
        body: JSON.stringify({ text_prompts: [{ text: prompt }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1 }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability API Error:', errorText);
        throw new Error('Failed to get image from Stability API.');
    }
    const data = await response.json();
    return data.artifacts[0].base64;
}

// --- Translation Endpoint ---
app.post('/translate', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const { text, sourceLanguage, targetLanguage } = req.body;

    if (!text || !targetLanguage || !sourceLanguage) {
        return res.status(400).json({ error: 'Text, source language, and target language are required.' });
    }

    try {
        let translationPrompt;
        if (sourceLanguage === 'Auto-Detect') {
            translationPrompt = `Translate the following text to ${targetLanguage}. Provide only the translated text as the response:\n\n"${text}"`;
        } else {
            translationPrompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Provide only the translated text as the response:\n\n"${text}"`;
        }
        
        const translatedText = await generateTextWithGemini(translationPrompt);
        
        res.json({ translatedText });

    } catch (error) {
        console.error('Translation Error:', error);
        res.status(500).json({ error: 'Failed to translate the text.' });
    }
});

// --- Serve Landing Page (Fix for Vercel "Cannot GET /") ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- App Listener ---
app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});
