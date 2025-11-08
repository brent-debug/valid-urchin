// js/navigation.js
// Hash-based Navigation System for ValidUrchin (Local Development Compatible)

// URL routing configuration
const ROUTES = {
    // Main pages
    'dashboard': { page: 'dashboard', title: 'Dashboard' },
    'monitor-settings': { page: 'monitor-settings', subtab: 'monitored-parameters', title: 'Monitor Settings - Parameters' },
    'monitor-settings/parameters': { page: 'monitor-settings', subtab: 'monitored-parameters', title: 'Monitor Settings - Parameters' },
    'monitor-settings/conditional-rules': { page: 'monitor-settings', subtab: 'conditional-rules', title: 'Monitor Settings - Conditional Rules' },
    'monitor-settings/bulk-operations': { page: 'monitor-settings', subtab: 'bulk-operations', title: 'Monitor Settings - Bulk Operations' },
    'conflict-log': { page: 'conflict-log', title: 'Conflict Log' },
    'campaign-manager': { page: 'campaign-manager', title: 'Campaign Manager' },
    'admin': { page: 'admin', title: 'Admin Panel' },
    
    // Parameter editor
    'parameter-editor': { page: 'parameter-editor', title: 'Parameter Editor' },
    
    // Conditional rule editor
    'conditional-rule-editor': { page: 'conditional-rule-editor', title: 'Conditional Rule Editor' },
    'conditional-rule-editor/new': { page: 'conditional-rule-editor', mode: 'create', title: 'Create New Conditional Rule' },
    'conditional-rule-editor/edit': { page: 'conditional-rule-editor', mode: 'edit', title: 'Edit Conditional Rule' }
};

// Current navigation state
let currentRoute = null;
let navigationInitialized = false;
let lastProcessedHash = '';

// Initialize hash-based navigation
function initializeNavigation() {
    if (navigationInitialized) {
        console.log('Navigation already initialized');
        return;
    }
    
    console.log('Initializing hash-based navigation...');
    
    try {
        // Handle browser back/forward buttons and hash changes
        window.addEventListener('hashchange', handleHashChange);
        window.addEventListener('popstate', handleHashChange);
        
        // Handle initial page load
        const initialHash = getCurrentHash();
        console.log('Initial hash:', initialHash);
        
        if (initialHash && initialHash !== '') {
            navigateFromHash(initialHash);
        } else {
            // Default to dashboard if no hash specified
            console.log('No hash found, defaulting to dashboard');
            navigateToRoute('dashboard', false);
        }
        
        navigationInitialized = true;
        console.log('Navigation initialized successfully');
        
    } catch (error) {
        console.error('Error initializing navigation:', error);
        // Fallback to basic page show
        showPageInternal('monitor-settings');
    }
}

// Get current hash from URL
function getCurrentHash() {
    const hash = window.location.hash.replace('#', '');
    return hash || '';
}

// Handle hash changes (back/forward buttons)
function handleHashChange(event) {
    console.log('Hash change event triggered, new hash:', getCurrentHash());
    const hash = getCurrentHash();
    navigateFromHash(hash, false);
}

// Navigate based on hash
function navigateFromHash(hash, updateHistory = false) {
    console.log('Navigating from hash:', hash);
    
    try {
        // Handle parameter editor with parameter name
        if (hash.startsWith('parameter-editor/')) {
            const paramName = hash.replace('parameter-editor/', '');
            if (paramName && typeof monitoredParametersData !== 'undefined' && monitoredParametersData[paramName]) {
                selectedParameter = paramName;
                showPageInternal('parameter-editor');
                setTimeout(() => {
                    if (typeof loadParameterEditor === 'function') {
                        loadParameterEditor(paramName);
                    }
                }, 100);
                updatePageTitle('Parameter Editor - ' + paramName);
                return;
            }
        }
        
        // Handle conditional rule editor with rule ID
        if (hash.startsWith('conditional-rule-editor/edit/')) {
            const ruleId = hash.replace('conditional-rule-editor/edit/', '');
            if (ruleId) {
                editExistingRuleFromHash(ruleId);
                return;
            }
        }
        
        // Handle standard routes
        const route = ROUTES[hash];
        if (route) {
            currentRoute = route;
            showPageInternal(route.page);
            
            if (route.subtab) {
                setTimeout(() => {
                    showSubTabInternal(route.subtab);
                }, 50);
            }
            
            updatePageTitle(route.title);
            
            // Handle special page initializations
            if (route.page === 'conditional-rule-editor' && route.mode === 'create') {
                setTimeout(() => {
                    showCreateNewRuleInternal();
                }, 100);
            }
        } else {
            console.warn('Route not found:', hash);
            // Fallback to dashboard
            navigateToRoute('dashboard', true);
        }
    } catch (error) {
        console.error('Error navigating from hash:', error);
        // Fallback to showing the page without hash update
        showPageInternal('monitor-settings');
    }
}

// Navigate to a specific route
function navigateToRoute(routeKey, updateHistory = true) {
    console.log('Navigating to route:', routeKey);
    
    try {
        const route = ROUTES[routeKey];
        if (!route) {
            console.error('Invalid route:', routeKey);
            return;
        }
        
        currentRoute = route;
        
        // Update hash
        if (updateHistory) {
            console.log('Updating hash to:', routeKey);
            window.location.hash = '#' + routeKey;
            return; // Let hashchange event handle the rest
        }
        
        // Navigate to page
        showPageInternal(route.page);
        
        if (route.subtab) {
            setTimeout(() => {
                showSubTabInternal(route.subtab);
            }, 50);
        }
        
        updatePageTitle(route.title);
        
    } catch (error) {
        console.error('Error navigating to route:', error);
        // Fallback
        showPageInternal(routeKey);
    }
}

// Internal navigation functions (don't update hash)
function showPageInternal(pageId) {
    console.log('Showing page internally:', pageId);
    
    try {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        } else {
            console.error('Page not found:', pageId);
            return;
        }
        
        // Update nav tab
        const navTab = findNavTabForPage(pageId);
        if (navTab) {
            navTab.classList.add('active');
        }
        
        // Initialize page-specific content
        if (pageId === 'monitor-settings') {
            if (typeof renderParametersGrid === 'function') {
                renderParametersGrid();
            }
            if (typeof renderConditionalRulesTable === 'function') {
                renderConditionalRulesTable();
            }
        } else if (pageId === 'conflict-log') {
            // Auto-initialize conflict log when page is shown
            setTimeout(() => {
                if (typeof initializeConflictLog === 'function') {
                    initializeConflictLog();
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('Error showing page:', error);
    }
}

function showSubTabInternal(tabId) {
    console.log('Showing sub tab internally:', tabId);
    
    try {
        document.querySelectorAll('.sub-nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.sub-tab-pane').forEach(pane => pane.classList.remove('active'));
        
        // Find and activate the correct tab button
        const targetTab = findSubNavTabForId(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Show the correct tab content
        const targetPane = document.getElementById(tabId);
        if (targetPane) {
            targetPane.classList.add('active');
        }
        
        // Initialize tab-specific content
        if (tabId === 'conditional-rules') {
            if (typeof renderConditionalRulesTable === 'function') {
                renderConditionalRulesTable();
            }
        }
        
    } catch (error) {
        console.error('Error showing sub tab:', error);
    }
}

// Helper function to find nav tab for page
function findNavTabForPage(pageId) {
    try {
        const navTabs = document.querySelectorAll('.nav-tab');
        for (const tab of navTabs) {
            const onclick = tab.getAttribute('onclick');
            if (onclick && onclick.includes(`'${pageId}'`)) {
                return tab;
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding nav tab:', error);
        return null;
    }
}

// Helper function to find sub nav tab for tab ID
function findSubNavTabForId(tabId) {
    try {
        const subNavTabs = document.querySelectorAll('.sub-nav-tab');
        for (const tab of subNavTabs) {
            const onclick = tab.getAttribute('onclick');
            if (onclick && onclick.includes(`'${tabId}'`)) {
                return tab;
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding sub nav tab:', error);
        return null;
    }
}

// Update page title
function updatePageTitle(title) {
    try {
        document.title = title + ' - ValidUrchin';
    } catch (error) {
        console.error('Error updating page title:', error);
    }
}

// Enhanced navigation functions that replace the original ones
function showPage(pageId) {
    console.log('showPage called:', pageId);
    
    try {
        // Map page IDs to routes
        let routeKey = pageId;
        if (pageId === 'monitor-settings') {
            routeKey = 'monitor-settings/parameters'; // Default to parameters tab
        }
        
        navigateToRoute(routeKey);
    } catch (error) {
        console.error('Error in showPage:', error);
        // Fallback to direct page show
        showPageInternal(pageId);
    }
}

function showSubTab(tabId) {
    console.log('showSubTab called:', tabId);
    
    try {
        // Update hash to include subtab
        let routeKey = 'monitor-settings';
        if (tabId === 'conditional-rules') {
            routeKey = 'monitor-settings/conditional-rules';
        } else if (tabId === 'bulk-operations') {
            routeKey = 'monitor-settings/bulk-operations';
        } else {
            routeKey = 'monitor-settings/parameters';
        }
        
        navigateToRoute(routeKey);
    } catch (error) {
        console.error('Error in showSubTab:', error);
        // Fallback to direct sub tab show
        showSubTabInternal(tabId);
    }
}

// Enhanced parameter selection with hash update
function selectParameter(paramName) {
    console.log('selectParameter called with hash update:', paramName);
    try {
        selectedParameter = paramName;
        const hash = 'parameter-editor/' + paramName;
        lastProcessedHash = hash; // Set before changing hash
        window.location.hash = '#' + hash;
        // Let hashchange handle the rest
    } catch (error) {
        console.error('Error in selectParameter:', error);
        // Fallback
        if (typeof window !== 'undefined') {
            window.selectedParameter = paramName;
        }
        showPageInternal('parameter-editor');
        if (typeof loadParameterEditor === 'function') {
            loadParameterEditor(paramName);
        }
    }
}

// Enhanced rule creation with hash update
function showCreateNewRule() {
    console.log('showCreateNewRule called with hash update');
    try {
        const hash = 'conditional-rule-editor/new';
        lastProcessedHash = hash; // Set before changing hash
        window.location.hash = '#' + hash;
        // Let hashchange handle the rest
    } catch (error) {
        console.error('Error in showCreateNewRule:', error);
        // Fallback
        showPageInternal('conditional-rule-editor');
        showCreateNewRuleInternal();
    }
}

// Enhanced rule editing with hash update
function editExistingRule(ruleId) {
    console.log('editExistingRule called with hash update:', ruleId);
    try {
        const hash = 'conditional-rule-editor/edit/' + ruleId;
        lastProcessedHash = hash; // Set before changing hash
        window.location.hash = '#' + hash;
        // Let hashchange handle the rest
    } catch (error) {
        console.error('Error in editExistingRule:', error);
        // Fallback
        showPageInternal('conditional-rule-editor');
        editExistingRuleInternal(ruleId);
    }
}

// Internal function for editing rule from hash
function editExistingRuleFromHash(ruleId) {
    try {
        console.log('🔧 editExistingRuleFromHash called with ruleId:', ruleId);
        
        const rule = typeof conditionalRulesData !== 'undefined' ? conditionalRulesData.find(r => r.id === ruleId) : null;
        if (!rule) {
            console.error('Rule not found for hash:', ruleId);
            navigateToRoute('monitor-settings/conditional-rules', true);
            return;
        }
        
        console.log('✅ Found rule:', rule);
        
        // Set edit mode BEFORE showing the page
        window.isEditingRule = true;
        window.editingRuleId = ruleId;
        window.currentEditingRule = rule;
        
        console.log('📊 Edit state set in navigation:', {
            isEditingRule: window.isEditingRule,
            editingRuleId: window.editingRuleId,
            ruleName: rule.name
        });
        
        showPageInternal('conditional-rule-editor');
        updatePageTitle('Edit Conditional Rule - ' + rule.name);
        
        setTimeout(() => {
            if (typeof initializeRuleEditor === 'function') {
                console.log('🚀 Calling initializeRuleEditor from navigation...');
                initializeRuleEditor();
            } else {
                console.error('❌ initializeRuleEditor function not available');
            }
        }, 200);
    } catch (error) {
        console.error('Error editing rule from hash:', error);
        showPageInternal('conditional-rule-editor');
    }
}

// Internal functions that don't update hash
function showCreateNewRuleInternal() {
    try {
        // Clean up any previous edit state
        window.isEditingRule = false;
        window.editingRuleId = null;
        window.currentEditingRule = null;
        window.currentlyEditingRuleId = null;
        window.ruleEditorInitialized = false;
        
        console.log('➕ Create new rule mode set');
        
        setTimeout(() => {
            if (typeof initializeRuleEditor === 'function') {
                initializeRuleEditor();
            }
        }, 100);
    } catch (error) {
        console.error('Error showing create new rule:', error);
    }
}

function editExistingRuleInternal(ruleId) {
    try {
        window.isEditingRule = true;
        window.editingRuleId = ruleId;
        window.currentlyEditingRuleId = ruleId;
        
        setTimeout(() => {
            if (typeof initializeRuleEditor === 'function') {
                initializeRuleEditor();
            }
        }, 100);
    } catch (error) {
        console.error('Error editing existing rule:', error);
    }
}

// Back navigation functions
function backToConditionalRules() {
    console.log('Navigating back to conditional rules');
    try {
        // Clean up edit state
        window.isEditingRule = false;
        window.editingRuleId = null;
        window.currentEditingRule = null;
        window.currentlyEditingRuleId = null;
        window.ruleEditorInitialized = false;
        
        navigateToRoute('monitor-settings/conditional-rules');
    } catch (error) {
        console.error('Error in backToConditionalRules:', error);
        showPageInternal('monitor-settings');
        showSubTabInternal('conditional-rules');
    }
}

function backToMonitorSettings() {
    console.log('Navigating back to monitor settings');
    try {
        // Clean up edit state
        window.isEditingRule = false;
        window.editingRuleId = null;
        window.currentEditingRule = null;
        window.currentlyEditingRuleId = null;
        window.ruleEditorInitialized = false;
        
        navigateToRoute('monitor-settings/parameters');
    } catch (error) {
        console.error('Error in backToMonitorSettings:', error);
        showPageInternal('monitor-settings');
        showSubTabInternal('monitored-parameters');
    }
}

// Export navigation functions
window.initializeNavigation = initializeNavigation;
window.navigateToRoute = navigateToRoute;
window.showPage = showPage;
window.showSubTab = showSubTab;
window.selectParameter = selectParameter;
window.showCreateNewRule = showCreateNewRule;
window.editExistingRule = editExistingRule;
window.backToConditionalRules = backToConditionalRules;
window.backToMonitorSettings = backToMonitorSettings;

console.log('Hash-based navigation system loaded and functions exported globally');