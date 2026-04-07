const API_BASE = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" ? "http://127.0.0.1:5000/api" : "/api";

// ---- State ----
let pets = [];
let currentPetId = null;

// Diet dictionaries for detailed breakdowns
const DIET_DETAILS = {
    "Maintenance Plan": [
        { time: "08:00 AM", meal: "1 Cup Dry Kibble + Multivitamin" },
        { time: "06:00 PM", meal: "1 Cup Dry Kibble + Fish Oil Pump" }
    ],
    "Weight Loss Plan": [
        { time: "07:30 AM", meal: "3/4 Cup Low-Cal Kibble + Green Beans" },
        { time: "05:30 PM", meal: "1/2 Cup Low-Cal Kibble + Carrots" }
    ],
    "High Energy Plan": [
        { time: "07:00 AM", meal: "1.5 Cups Performance Kibble + Raw Egg" },
        { time: "01:00 PM", meal: "High-Protein Snack / Jerky" },
        { time: "07:00 PM", meal: "1.5 Cups Performance Kibble" }
    ]
};

// Chart Instances
let activityChartInstance = null;
let sleepChartInstance = null;
let weightChartInstance = null;

// ---- API Wrappers ----

async function fetchSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        return await response.json();
    } catch { return {}; }
}

async function loadWeather() {
    try {
        const res = await fetch(`${API_BASE}/weather`);
        const data = await res.json();
        const widget = document.getElementById('weather-widget');
        widget.style.display = 'flex';
        
        if(data.error) {
            document.querySelector('.weather-msg').textContent = data.error;
            document.getElementById('weather-temp').textContent = '--°C';
            document.getElementById('weather-desc').textContent = 'Error';
            document.getElementById('weather-icon').src = '';
        } else {
            document.querySelector('.weather-msg').textContent = 'Live Data';
            document.getElementById('weather-temp').textContent = `${data.temp}°C`;
            document.getElementById('weather-desc').textContent = data.condition + " - " + data.desc;
            document.getElementById('weather-icon').src = `http://openweathermap.org/img/wn/${data.icon}.png`;
        }
    } catch(e) {
        console.error("Weather load failed", e);
    }
}

async function fetchPets() {
    try {
        const response = await fetch(`${API_BASE}/pets`);
        const data = await response.json();
        
        if (data.error) {
            showToast(`DB Error: ${data.error}`, "fa-triangle-exclamation");
            pets = [];
            return;
        }
        
        pets = data;
        if (pets.length > 0) {
            // retain selection if possible
            if (!currentPetId || !pets.find(p => p.id === currentPetId)) {
                currentPetId = pets[0].id;
            }
            loadProfile();
        }
    } catch (e) {
        showToast("Error connecting to database.", "fa-triangle-exclamation");
        console.error(e);
    }
}

function getCurrentPet() {
    return pets.find(p => p.id === currentPetId) || pets[0];
}

// ---- Core Functions ----

function loadProfile() {
    const pet = getCurrentPet();
    if (!pet) return;

    if (pet.avatar_url && (pet.avatar_url.startsWith('data:') || pet.avatar_url.startsWith('http'))) {
        document.getElementById('pet-avatar-img').src = pet.avatar_url;
    } else {
        const baseUrl = API_BASE.replace('/api', '');
        document.getElementById('pet-avatar-img').src = `${baseUrl}${pet.avatar_url && pet.avatar_url.startsWith('/') ? '' : '/'}${pet.avatar_url || ''}`;
    }
    document.getElementById('pet-name').textContent = pet.name;
    document.getElementById('pet-breed').textContent = pet.breed;
    document.getElementById('pet-age').textContent = pet.age;
    
    // Diet Plan
    let dietDesc = "Standard balanced diet for healthy adult pets.";
    if (pet.diet_plan === "Weight Loss Plan") dietDesc = "High fiber, low calorie formulation to safely shed excess pounds.";
    if (pet.diet_plan === "High Energy Plan") dietDesc = "Protein-packed diet built for working dogs or highly active pets.";
    
    document.getElementById('active-diet-name').textContent = pet.diet_plan || "Maintenance Plan";
    document.getElementById('active-diet-desc').textContent = dietDesc;
    document.getElementById('diet-pet-name-label').textContent = pet.name;

    // Build Detailed Diet List
    const breakdownList = document.getElementById('diet-breakdown-list');
    breakdownList.innerHTML = '';
    const meals = DIET_DETAILS[pet.diet_plan || "Maintenance Plan"];
    meals.forEach(m => {
        const div = document.createElement('div');
        div.className = 'diet-meal';
        div.innerHTML = `<strong><i class="fa-regular fa-clock"></i> ${m.time}</strong><p>${m.meal}</p>`;
        breakdownList.appendChild(div);
    });

    // Build Switcher
    const selector = document.getElementById('pet-selector');
    selector.innerHTML = '';
    pets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentPetId) opt.selected = true;
        selector.appendChild(opt);
    });

    updateChartsData();
}

function handlePetSwitch(e) {
    currentPetId = e.target.value;
    loadProfile();
    showToast(`Switched to ${getCurrentPet().name}`, "fa-paw");
}

// ---- Modals & Events ----

function setupModals() {
    const addModal = document.getElementById('add-pet-modal');
    const dietModal = document.getElementById('diet-modal');

    // Add Pet Modal
    document.getElementById('add-pet-btn').addEventListener('click', () => addModal.classList.add('open'));
    document.getElementById('cancel-add-pet').addEventListener('click', () => addModal.classList.remove('open'));
    document.getElementById('confirm-add-pet').addEventListener('click', async () => {
        const name = document.getElementById('new-pet-name').value;
        const breed = document.getElementById('new-pet-breed').value;
        const age = document.getElementById('new-pet-age').value;
        const fileInput = document.getElementById('new-pet-avatar');
        
        if (name && breed && age) {
            let avatarBase64 = null;
            if(fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const img = new Image();
                img.src = URL.createObjectURL(file);
                avatarBase64 = await new Promise(resolve => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const maxDim = 300;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
                        else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    };
                    img.onerror = () => resolve(null);
                });
            }

            const payload = {name, breed, age, avatarBase64};
            
            const res = await fetch(`${API_BASE}/pets`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) 
            });
            const data = await res.json();
            
            if (data.success) {
                currentPetId = data.id; // switch to new pet
                await fetchPets();
                addModal.classList.remove('open');
                
                // Clear form
                document.getElementById('new-pet-name').value = '';
                document.getElementById('new-pet-breed').value = '';
                document.getElementById('new-pet-age').value = '';
                fileInput.value = '';
                
                showToast(`${name} securely added to DB!`, "fa-database");
            }
        }
    });

    // Diet Modal
    const openDiet = () => dietModal.classList.add('open');
    document.getElementById('nav-diet-btn').addEventListener('click', (e) => { e.preventDefault(); openDiet(); });
    document.getElementById('card-diet-btn').addEventListener('click', openDiet);
    document.getElementById('close-diet-modal').addEventListener('click', () => dietModal.classList.remove('open'));

    // Diet Selection Logic
    document.querySelectorAll('.diet-card').forEach(card => {
        card.addEventListener('click', async function() {
            const plan = this.getAttribute('data-plan');
            await fetch(`${API_BASE}/pets/${currentPetId}/diet`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan })
            });

            // UI refresh
            document.querySelectorAll('.diet-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            await fetchPets();
            dietModal.classList.remove('open');
            showToast(`Diet updated to ${plan}`, "fa-utensils");
        });
    });

    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('nav-settings-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const pet = getCurrentPet();
        if(!pet) return;
        document.getElementById('settings-pet-name').textContent = pet.name;
        document.getElementById('settings-step-goal').value = pet.daily_step_goal || 10000;
        
        const sets = await fetchSettings();
        document.getElementById('settings-city').value = sets['weather_city'] || '';
        document.getElementById('settings-weather-key').value = sets['openweather_key'] || '';
        document.getElementById('settings-gemini-key').value = sets['gemini_key'] || '';

        settingsModal.classList.add('open');
    });
    document.getElementById('close-settings-modal').addEventListener('click', () => settingsModal.classList.remove('open'));
    
    document.getElementById('save-settings-modal').addEventListener('click', async () => {
        const goal = document.getElementById('settings-step-goal').value;
        const city = document.getElementById('settings-city').value;
        const weatherKey = document.getElementById('settings-weather-key').value;
        const geminiKey = document.getElementById('settings-gemini-key').value;

        if(goal) {
            await fetch(`${API_BASE}/pets/${currentPetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field: 'daily_step_goal', value: Number(goal) })
            });
        }
        
        const toSave = [
            { key: 'weather_city', value: city },
            { key: 'openweather_key', value: weatherKey },
            { key: 'gemini_key', value: geminiKey }
        ];

        for(let s of toSave) {
            await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(s)
            });
        }

        await fetchPets();
        loadWeather();
        settingsModal.classList.remove('open');
        showToast('Settings & Integrations saved', 'fa-check');
    });

    document.getElementById('delete-pet-btn').addEventListener('click', async () => {
        const pet = getCurrentPet();
        if(confirm(`Are you extremely sure you want to delete ${pet.name}? This cannot be undone.`)) {
            settingsModal.classList.remove('open');
            showToast(`Deleting ${pet.name}...`, 'fa-trash');
            await fetch(`${API_BASE}/pets/${currentPetId}`, { method: 'DELETE' });
            currentPetId = null; 
            await fetchPets();
            showToast(`Pet deleted successfully.`, 'fa-check');
        }
    });

    // Avatar Overlay Click
    document.querySelector('.avatar-container').addEventListener('click', () => {
        document.getElementById('avatar-upload').click();
    });

    // Handle Avatar change via Base64
    document.getElementById('avatar-upload').addEventListener('change', async (e) => {
        if(e.target.files.length > 0) {
            showToast("Uploading photo securely...", "fa-spinner");
            
            const file = e.target.files[0];
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const maxDim = 300;
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxDim) { h *= maxDim / w; w = maxDim; } }
                else { if (h > maxDim) { w *= maxDim / h; h = maxDim; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                
                const res = await fetch(`${API_BASE}/pets/${currentPetId}/avatar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatarBase64: compressedBase64 })
                });
                const data = await res.json();

                if(data.success) {
                    await fetchPets();
                    showToast("Photo updated!", "fa-camera");
                }
            };
            e.target.value = '';
        }
    });

    // Handle AI Insights Generation
    document.getElementById('card-ai-btn').addEventListener('click', async () => {
        const textElem = document.getElementById('ai-insight-text');
        textElem.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Gemini is analyzing ${getCurrentPet().name}'s data...`;
        
        try {
            const res = await fetch(`${API_BASE}/pets/${currentPetId}/ai-insights`, { method: 'POST' });
            const data = await res.json();
            if(data.error) {
                textElem.innerHTML = `<span style="color:var(--icon-red);">Error: ${data.error}</span>`;
            } else {
                textElem.innerHTML = `<strong>Intelligence Report:</strong><br>${data.advice}`;
                showToast("AI Report Finished!", "fa-wand-magic-sparkles");
            }
        } catch(e) {
            textElem.innerHTML = "Failed to reach backend API.";
        }
    });
}

// ---- Charts (Chart.js) ----

function initCharts() {
    const style = getComputedStyle(document.body);
    const primary = style.getPropertyValue('--primary-color').trim() || '#5D5FEF';
    const orange = style.getPropertyValue('--icon-orange').trim() || '#ff9800';
    const blue = style.getPropertyValue('--icon-blue').trim() || '#2196f3';
    const purple = style.getPropertyValue('--icon-purple').trim() || '#9c27b0';
    const textColor = style.getPropertyValue('--text-color').trim() || '#2b2b2b';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // Initialize empty charts, they will fill when fetchPets completes
    const defaultData = { labels: [], datasets: [] };

    // Activity Chart (Bar)
    const ctxActivity = document.getElementById('activityChart').getContext('2d');
    activityChartInstance = new Chart(ctxActivity, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Steps', data: [], backgroundColor: orange, borderRadius: 6, hoverBackgroundColor: primary }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });

    // Sleep Chart (Line)
    const ctxSleep = document.getElementById('sleepChart').getContext('2d');
    let slpGrad = ctxSleep.createLinearGradient(0, 0, 0, 400);
    slpGrad.addColorStop(0, 'rgba(33, 150, 243, 0.5)'); slpGrad.addColorStop(1, 'rgba(33, 150, 243, 0.0)');
    sleepChartInstance = new Chart(ctxSleep, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Sleep Hours', data: [], borderColor: blue, backgroundColor: slpGrad, borderWidth: 3, fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { suggestedMin: 8, suggestedMax: 16, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });

    // Weight Chart (Line)
    const ctxWeight = document.getElementById('weightChart').getContext('2d');
    let wtGrad = ctxWeight.createLinearGradient(0, 0, 0, 400);
    wtGrad.addColorStop(0, 'rgba(156, 39, 176, 0.5)'); wtGrad.addColorStop(1, 'rgba(156, 39, 176, 0.0)');
    weightChartInstance = new Chart(ctxWeight, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Weight', data: [], borderColor: purple, backgroundColor: wtGrad, borderWidth: 3, fill: true, tension: 0.2 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function updateChartsData() {
    const pet = getCurrentPet();
    if(!pet || !pet.historicalData || !activityChartInstance) return;
    
    const data = pet.historicalData;
    
    activityChartInstance.data.labels = data.labels;
    activityChartInstance.data.datasets[0].data = data.steps;

    sleepChartInstance.data.labels = data.labels;
    sleepChartInstance.data.datasets[0].data = data.sleep;

    weightChartInstance.data.labels = data.labels;
    weightChartInstance.data.datasets[0].data = data.weight;
    
    activityChartInstance.update();
    sleepChartInstance.update();
    weightChartInstance.update();

    // Fill dashboard numbers
    const latestIdx = data.steps.length - 1;
    document.getElementById('steps').textContent = `${data.steps[latestIdx].toLocaleString()} steps today`;
    document.getElementById('sleep-hours').textContent = `${data.sleep[latestIdx]} hrs today`;
    document.getElementById('weight-kg').textContent = `${data.weight[latestIdx]} kg`;
    document.getElementById('hydration-lvl').textContent = `${data.latest_hydration} ml`;
}

// 4. Sync Database Data
async function syncDeviceData() {
    const pet = getCurrentPet();
    if (!pet) { showToast("No pet found.", "fa-triangle-exclamation"); return; }
    
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing...`;
    syncBtn.disabled = true;

    showToast(`Pulling data from DB for ${pet.name}...`, "fa-wifi");

    try {
        const res = await fetch(`${API_BASE}/pets/${currentPetId}/sync`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            document.getElementById('heart-rate').textContent = `${Math.floor(Math.random()*25+75)} bpm`;
            
            // Reload DB data
            await fetchPets();
            
            if (data.steps > pet.daily_step_goal) {
                showToast(`Goal reached! ${pet.name} walked ${data.steps} steps!`, "fa-trophy");
            } else {
                showToast("Vitals synced with Database.", "fa-check-circle");
            }
        } else {
            showToast(`Sync failed: ${data.error || "Unknown error"}`, "fa-times");
            syncBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sync Vitals`;
            syncBtn.disabled = false;
            return;
        }
    } catch (e) {
        showToast("Sync crashed (Network Error).", "fa-times");
    }

    syncBtn.innerHTML = `<i class="fa-solid fa-check"></i> Synced!`;
    setTimeout(() => {
        syncBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sync Vitals`;
        syncBtn.disabled = false;
    }, 2000);
}

// 5. Toast Notification System
function showToast(message, iconClass = "fa-info-circle") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// 6. Config Theme & Edit
function setupThemeToggle() {
    // ... logic unchanged ...
    const toggleBtn = document.getElementById('theme-toggle');
    const icon = toggleBtn.querySelector('i');
    
    if (localStorage.getItem('petwell-theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        icon.classList.replace('fa-moon', 'fa-sun');
    }

    toggleBtn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('petwell-theme', 'light');
            icon.classList.replace('fa-sun', 'fa-moon');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('petwell-theme', 'dark');
            icon.classList.replace('fa-moon', 'fa-sun');
        }
        setTimeout(() => {
            const style = getComputedStyle(document.body);
            const textColor = style.getPropertyValue('--text-color').trim();
            [activityChartInstance, sleepChartInstance, weightChartInstance].forEach(chart => {
                if(chart) {
                    chart.options.scales.x.ticks.color = textColor;
                    chart.options.scales.y.ticks.color = textColor;
                    chart.update();
                }
            });
        }, 50);
    });
}

function setupEditableProfile() {
    const profileContainer = document.querySelector('.pet-info');
    
    profileContainer.addEventListener('click', async function(e) {
        const editableElement = e.target.closest('.editable');
        if (!editableElement) return;

        const field = editableElement.getAttribute('data-field');
        const pet = getCurrentPet();
        
        let promptText = `Update ${field}:`;
        let currentVal = pet[field];

        const newVal = prompt(promptText, currentVal);
        
        if (newVal !== null && newVal.trim() !== "") {
            // Update DB
            await fetch(`${API_BASE}/pets/${currentPetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, value: newVal.trim() })
            });
            await fetchPets();
            showToast(`Profile updated in DB!`, "fa-database");
        }
    });

    document.getElementById('feed-btn').addEventListener('click', () => {
        showToast(`Dispensing food for ${getCurrentPet().name}...`, "fa-utensils");
    });
}

// ---- Initialization ----
window.onload = async () => {
    initCharts(); // Initialize empty charts
    setupModals();
    setupThemeToggle();
    setupEditableProfile();
    
    document.getElementById('pet-selector').addEventListener('change', handlePetSwitch);
    document.getElementById('sync-btn').addEventListener('click', syncDeviceData);
    
    // Fetch data from Flask Backend DB
    await fetchPets(); 
    loadWeather();
};