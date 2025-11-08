// main.js - ValidUrchin Application Entry Point
// Updated for URL-based Navigation Support and Enhanced Error Handling

// Application Entry Point
console.log('ValidUrchin Application Starting...');

// Verify that all required modules are loaded
function verifyModulesLoaded() {
    // Check if CONFIG_API_URL exists (it's a const, not a window property)
    try {
        if (typeof CONFIG_API_URL === 'undefined') {
            console.error('CONFIG_API_URL not found');
            if (typeof showStatus === 'function') {
                showStatus('Configuration API URL missing. Please refresh the page.', 'error');
            }
            return false;
        }
    } catch (e) {
        console.error('CONFIG_API_URL not accessible:', e);
        return false;
    }

    const requiredGlobals = [
        'showStatus',                   // from ui.js
        'renderParametersGrid',         // from parameters.js
        'generateRuleId'                // from utils.js
    ];
    
    // Optional functions that may load later
    const optionalGlobals = [
        'renderConditionalRulesTable',  // from conditionalRules.js
        'initializeRuleEditor',         // from conditionalRules.js
        'initializeNavigation'          // from navigation.js
    ];
    
    const missing = requiredGlobals.filter(global => typeof window[global] === 'undefined');
    
    if (missing.length > 0) {
        console.error('Missing required modules or functions:', missing);
        if (typeof window.showStatus === 'function') {
            window.showStatus('Application failed to load. Please refresh the page.', 'error');
        }
        return false;
    }
    
    // Check optional functions and warn if missing
    const missingOptional = optionalGlobals.filter(global => typeof window[global] === 'undefined');
    if (missingOptional.length > 0) {
        console.warn('Optional functions not yet loaded:', missingOptional);
    }
    
    console.log('All required modules loaded successfully');
    return true;
}

// Enhanced application initialization with better error handling
function initializeApplication() {
    console.log('Initializing ValidUrchin application...');
    
    // Verify modules are loaded
    if (!verifyModulesLoaded()) {
        console.error('Module verification failed, retrying in 500ms...');
        setTimeout(initializeApplication, 500);
        return;
    }
    
    try {
        // Load initial configuration and render UI
        renderParametersGrid();
        loadRules();
        
        console.log('Application initialized successfully');
        
        // Additional initialization for rule editor if needed
        setTimeout(() => {
            if (typeof window.initializeRuleEditor === 'function' && window.isEditingRule) {
                console.log('Late initialization of rule editor detected');
                window.initializeRuleEditor();
            }
        }, 500);
        
    } catch (error) {
        console.error('Error during application initialization:', error);
        showStatus('Failed to initialize application: ' + error.message, 'error');
    }
}

// Enhanced error handling for the entire application
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    if (typeof showStatus === 'function') {
        showStatus('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    if (typeof showStatus === 'function') {
        showStatus('A network or data error occurred.', 'error');
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event handlers...');
    
    // Set up any additional event handlers that weren't covered in modules
    setupGlobalEventHandlers();
    
    // Initialize URL-based navigation with enhanced error handling
    if (typeof initializeNavigation === 'function') {
        console.log('Initializing URL-based navigation...');
        try {
            initializeNavigation();
        } catch (error) {
            console.error('Navigation initialization failed:', error);
            // Fallback to basic initialization
            setTimeout(() => {
                initializeApplication();
            }, 200);
        }
    } else {
        console.warn('Navigation system not loaded, falling back to basic initialization');
        // Fallback initialization
        setTimeout(() => {
            initializeApplication();
        }, 200);
    }
});

// Initialize when all resources are loaded
window.addEventListener('load', function() {
    console.log('All resources loaded');
    
    // If navigation wasn't initialized, do basic initialization
    if (typeof initializeNavigation !== 'function') {
        console.log('Fallback: initializing application without URL navigation');
        initializeApplication();
    }
    
    // Ensure all global variables are properly set
    if (typeof window.isEditingRule === 'undefined') {
        window.isEditingRule = false;
        window.editingRuleId = null;
        window.currentEditingRule = null;
    }
    
    // Initialize currentRuleData if not already set
    if (typeof window.currentRuleData === 'undefined') {
        window.currentRuleData = {
            anchor: { parameter: null, value: null },
            conditionals: {}
        };
    }
});

// Global event handlers that don't belong in specific modules
function setupGlobalEventHandlers() {
    // Handle window resize for responsive adjustments
    window.addEventListener('resize', debounce(function() {
        console.log('Window resized');
        // Could add responsive behavior here
    }, 250));
    
    // Handle online/offline status
    window.addEventListener('online', function() {
        console.log('Connection restored');
        if (typeof showStatus === 'function') {
            showStatus('Connection restored', 'success');
        }
    });
    
    window.addEventListener('offline', function() {
        console.log('Connection lost');
        if (typeof showStatus === 'function') {
            showStatus('Connection lost - changes may not be saved', 'error');
        }
    });
    
    // Handle modal input enter key
    const modalInput = document.getElementById('modalParameterName');
    if (modalInput) {
        modalInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && typeof createNewParameter === 'function') {
                createNewParameter();
            }
        });
    }
    
    // Handle escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close any open modals
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

// Enhanced debug helpers with better state inspection
if (typeof console !== 'undefined' && console.log) {
    window.debugApp = {
        config: () => ({
            casingRulesData: typeof casingRulesData !== 'undefined' ? casingRulesData : 'undefined',
            allowedValuesData: typeof allowedValuesData !== 'undefined' ? allowedValuesData : 'undefined',
            monitoredParametersData: typeof monitoredParametersData !== 'undefined' ? monitoredParametersData : 'undefined',
            conditionalRulesData: typeof conditionalRulesData !== 'undefined' ? conditionalRulesData : 'undefined'
        }),
        state: () => ({
            selectedParameter: typeof selectedParameter !== 'undefined' ? selectedParameter : 'undefined',
            isEditingRule: typeof isEditingRule !== 'undefined' ? isEditingRule : 'undefined',
            editingRuleId: typeof editingRuleId !== 'undefined' ? editingRuleId : 'undefined',
            currentRuleData: typeof window.currentRuleData !== 'undefined' ? window.currentRuleData : 'undefined'
        }),
        ui: () => ({
            currentPage: document.querySelector('.page.active')?.id,
            currentSubTab: document.querySelector('.sub-tab-pane.active')?.id,
            currentUrl: window.location.href
        }),
        navigation: () => ({
            path: window.location.pathname + window.location.hash,
            navigationInitialized: typeof initializeNavigation === 'function',
            lastProcessedHash: typeof lastProcessedHash !== 'undefined' ? lastProcessedHash : 'undefined'
        }),
        modules: verifyModulesLoaded,
        reload: () => {
            location.reload();
        },
        // Enhanced debugging for conditional rules
        conditionalRules: () => ({
            totalRules: typeof conditionalRulesData !== 'undefined' ? conditionalRulesData.length : 0,
            editMode: {
                isEditingRule: typeof isEditingRule !== 'undefined' ? isEditingRule : 'undefined',
                editingRuleId: typeof editingRuleId !== 'undefined' ? editingRuleId : 'undefined',
                currentRuleData: typeof window.currentRuleData !== 'undefined' ? window.currentRuleData : 'undefined'
            },
            functions: {
                initializeRuleEditor: typeof initializeRuleEditor === 'function',
                renderConditionalRulesTable: typeof renderConditionalRulesTable === 'function',
                editExistingRule: typeof editExistingRule === 'function'
            }
        }),
        // Force rule editor initialization for debugging
        forceInitRuleEditor: () => {
            if (typeof initializeRuleEditor === 'function') {
                console.log('Force initializing rule editor...');
                initializeRuleEditor();
            } else {
                console.error('initializeRuleEditor function not available');
            }
        }
    };
    
    console.log('Enhanced debug helpers available at window.debugApp');
}

console.log('Main application script loaded with enhanced error handling');