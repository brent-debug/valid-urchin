// js/config.js
// Configuration and API Functions Module

// Configuration constants
const CONFIG_API_URL = 'https://manage-configuration-839290050638.us-central1.run.app';

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "utmscrape.firebaseapp.com",
    projectId: "utmscrape",
    storageBucket: "utmscrape.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Global data state variables
let casingRulesData = {};
let allowedValuesData = {};
let selectedParameter = null;
let monitoredParametersData = {
    utm_source: { active: true, created: new Date().toISOString() },
    utm_medium: { active: true, created: new Date().toISOString() },
    utm_campaign: { active: true, created: new Date().toISOString() }
};
let conditionalRulesData = [];

// Edit mode tracking for conditional rules
let isEditingRule = false;
let editingRuleId = null;

// Current rule being created/edited (replaces conditionalMonitoringData)
let currentRuleData = {
    anchor: {
        parameter: null,
        value: null
    },
    conditionals: {}
};

// Utility Functions
function getApiKey() {
    return document.getElementById('apiKey').value.trim();
}

// API Communication Functions
async function callConfigurationAPI(method, data = null) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API key is required');

    const url = `${CONFIG_API_URL}?apiKey=${encodeURIComponent(apiKey)}`;
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return await response.json();
}

// Configuration Management
async function autoSaveConfiguration() {
    const apiKey = getApiKey();
    if (!apiKey) return;

    try {
        const configurationData = {
            casingRules: collectCasingRules(),
            allowedValues: collectAllowedValuesRules(),
            monitoredParameters: monitoredParametersData,
            conditionalRules: conditionalRulesData
        };
        
        console.log('Auto-saving configuration:', configurationData);
        await callConfigurationAPI('POST', configurationData);
        console.log('Configuration auto-saved successfully');
    } catch (error) {
        console.error('Auto-save failed:', error);
        showStatus('Auto-save failed: ' + error.message, 'error');
    }
}

// Configuration Loading
async function loadRules() {
    try {
        showStatus('Loading configuration...', 'loading');
        const configuration = await callConfigurationAPI('GET');
        
        console.log('Raw configuration response:', configuration);
        
        casingRulesData = configuration.casingRules || {};
        allowedValuesData = configuration.allowedValues || {};
        monitoredParametersData = configuration.monitoredParameters || {
            utm_source: { active: true, created: new Date().toISOString() },
            utm_medium: { active: true, created: new Date().toISOString() },
            utm_campaign: { active: true, created: new Date().toISOString() }
        };
        
        // Debug logging for conditional rules
        console.log('Raw conditionalRules from API:', configuration.conditionalRules);
        
        conditionalRulesData = configuration.conditionalRules || [];
        
        console.log('Final conditionalRulesData after assignment:', conditionalRulesData);
        console.log('conditionalRulesData type:', typeof conditionalRulesData);
        console.log('conditionalRulesData length:', conditionalRulesData.length);

        renderParametersGrid();
        
        // Render conditional rules table if function is available
        setTimeout(() => {
            if (typeof window.renderConditionalRulesTable === 'function') {
                window.renderConditionalRulesTable();
                console.log('Conditional rules table rendered');
            } else {
                console.log('renderConditionalRulesTable function not yet available');
            }
        }, 200);
        
        showStatus('Configuration loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading configuration:', error);
        showStatus('Error loading configuration: ' + error.message, 'error');
    }
}

// Data Collection Functions
function collectCasingRules() {
    const rules = {};
    
    // Preserve existing rules from data
    Object.keys(casingRulesData).forEach(param => {
        rules[param] = casingRulesData[param];
    });
    
    return rules;
}

function collectAllowedValuesRules() {
    const rules = {};
    
    // The allowed values are now stored directly in allowedValuesData
    Object.keys(allowedValuesData).forEach(param => {
        if (allowedValuesData[param] && allowedValuesData[param].length > 0) {
            rules[param] = allowedValuesData[param];
        }
    });
    
    console.log('Collecting allowed values rules:', rules);
    return rules;
}

// Conflict Loading (Firebase integration)
async function loadConflicts() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
    }

    try {
        showStatus('Loading conflicts...', 'loading');
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const conflictsSnapshot = await firebase.firestore()
            .collection(`organizations/${apiKey}/conflicts`)
            .orderBy('validationTimestamp', 'desc')
            .limit(10)
            .get();

        const conflictsList = document.getElementById('conflictsList');
        
        if (conflictsSnapshot.empty) {
            conflictsList.innerHTML = '<div class="placeholder"><h3>No Conflicts Found</h3><p>Your UTM parameters are all valid!</p></div>';
        } else {
            conflictsList.innerHTML = '';
            conflictsSnapshot.forEach(doc => {
                const data = doc.data();
                const conflictDiv = document.createElement('div');
                conflictDiv.className = 'card';
                conflictDiv.style.marginBottom = '1rem';
                conflictDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <strong>${data.originalEventData.url || 'Unknown URL'}</strong>
                        <span style="color: var(--gray-500); font-size: 0.875rem;">${new Date(data.validationTimestamp).toLocaleString()}</span>
                    </div>
                    <div style="color: var(--error-color); font-size: 0.875rem;">
                        ${data.conflictReasons.map(c => 
                            `<div><strong>${c.parameter}:</strong> ${c.value} (${c.rule} violation - ${c.actual})</div>`
                        ).join('')}
                    </div>
                `;
                conflictsList.appendChild(conflictDiv);
            });
        }
        
        showStatus('Conflicts loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading conflicts:', error);
        showStatus('Error loading conflicts: ' + error.message, 'error');
    }
}