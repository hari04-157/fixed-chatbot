document.addEventListener('DOMContentLoaded', () => {

    // --- 1. INITIALIZATION & ANIMATIONS ---
    
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Scroll Animation Observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });

    // --- 2. UI HELPER FUNCTIONS ---

    const statusBanner = document.getElementById('error-banner');
    
    const showStatus = (message, type = 'error') => {
        statusBanner.textContent = message;
        statusBanner.className = 'hidden mt-4 p-4 rounded-xl text-center text-sm font-medium backdrop-blur-md'; // Reset classes
        statusBanner.classList.remove('hidden');

        if (type === 'success') {
            statusBanner.classList.add('bg-green-500/20', 'text-green-200', 'border', 'border-green-500/50');
        } else {
            statusBanner.classList.add('bg-red-500/20', 'text-red-200', 'border', 'border-red-500/50');
        }
    };

    const hideStatus = () => {
        statusBanner.classList.add('hidden');
    };

    const setLoading = (btn, isLoading, originalText) => {
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
        } else {
            btn.disabled = false;
            btn.textContent = originalText;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    };

    // --- 3. NAVIGATION LOGIC ---
    
    const welcomeSection = document.getElementById('welcome-section');
    const loginSection = document.getElementById('login-section');
    const getStartedBtn = document.getElementById('get-started-btn');
    const featuresSection = document.getElementById('features');

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', async () => {
            const originalText = getStartedBtn.textContent;
            setLoading(getStartedBtn, true, originalText);
            
            try {
                const response = await fetch('/api/user');
                const data = await response.json();

                if (data.loggedIn) {
                    window.location.href = '/chat.html';
                } else {
                    welcomeSection.classList.add('hidden');
                    if(featuresSection) featuresSection.classList.add('hidden');
                    loginSection.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Auth check failed', error);
                welcomeSection.classList.add('hidden');
                if(featuresSection) featuresSection.classList.add('hidden');
                loginSection.classList.remove('hidden');
            } finally {
                setLoading(getStartedBtn, false, originalText);
            }
        });
    }

    // --- 4. FORM LOGIC ---

    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    
    const toggleToSignupLink = document.getElementById('toggle-to-signup');
    const toggleToSigninLink = document.getElementById('toggle-to-signin');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginLink = document.getElementById('back-to-login');
    const authToggleText = document.getElementById('auth-toggle-text');
    const toggleToSignupText = document.getElementById('toggle-to-signup-text');
    const toggleToSigninText = document.getElementById('toggle-to-signin-text');

    const switchForm = (showForm, hideForms) => {
        hideStatus();
        hideForms.forEach(f => f.classList.add('hidden'));
        showForm.classList.remove('hidden');
    };

    if (toggleToSignupLink) {
        toggleToSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm(signupForm, [signinForm, forgotPasswordForm]);
            toggleToSignupText.classList.add('hidden');
            toggleToSigninText.classList.remove('hidden');
        });
    }

    if (toggleToSigninLink) {
        toggleToSigninLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm(signinForm, [signupForm, forgotPasswordForm]);
            toggleToSigninText.classList.add('hidden');
            toggleToSignupText.classList.remove('hidden');
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm(forgotPasswordForm, [signinForm, signupForm]);
            if(authToggleText) authToggleText.classList.add('hidden');
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchForm(signinForm, [forgotPasswordForm]);
            if(authToggleText) authToggleText.classList.remove('hidden');
        });
    }

    // --- 5. SUBMISSION HANDLERS ---

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideStatus();
            const btn = signupForm.querySelector('button');
            const originalText = btn.textContent;
            setLoading(btn, true, "Creating Account...");

            const firstName = document.getElementById('signup-firstname').value;
            const lastName = document.getElementById('signup-lastname').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            if (password !== confirmPassword) {
                showStatus("Passwords do not match.", 'error');
                setLoading(btn, false, originalText);
                return;
            }

            try {
                const response = await fetch('/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ firstName, lastName, email, password })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Signup failed.');
                window.location.href = '/chat.html';
            } catch (error) {
                showStatus(error.message, 'error');
            } finally {
                setLoading(btn, false, originalText);
            }
        });
    }

    if (signinForm) {
        signinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideStatus();
            const btn = signinForm.querySelector('button');
            const originalText = btn.textContent;
            setLoading(btn, true, "Signing In...");

            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const contentType = response.headers.get("content-type");
                let data;
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    throw new Error("Server Error: " + text); 
                }

                if (!response.ok) throw new Error(data.message || 'Login failed.');
                window.location.href = '/chat.html';
            } catch (error) {
                showStatus(error.message, 'error');
            } finally {
                setLoading(btn, false, originalText);
            }
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideStatus();
            const btn = forgotPasswordForm.querySelector('button');
            const originalText = btn.textContent;
            const emailInput = document.getElementById('reset-email');
            setLoading(btn, true, "Sending Link...");

            try {
                const response = await fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                const data = await response.json();
                if (response.ok) {
                    showStatus(data.message, 'success');
                    emailInput.value = ''; 
                } else {
                    showStatus(data.message, 'error');
                }
            } catch (error) {
                showStatus("Failed to connect to server.", 'error');
            } finally {
                setLoading(btn, false, originalText);
            }
        });
    }
});