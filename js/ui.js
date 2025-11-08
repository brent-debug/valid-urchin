// js/ui.js
// General UI Functions Module - Updated for Tabular Interface

// Navigation and Page Management
function showPage(pageId) {
    console.log('Navigating to page:', pageId);
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('Successfully navigated to:', pageId);
    } else {
        console.error('Page not found:', pageId);
    }
    
    // Update nav tab if it exists
    const navTab = Array.from(document.querySelectorAll('.nav-tab')).find(tab => 
        tab.textContent.toLowerCase().includes(pageId.replace('-', ' '))
    );
    if (navTab) {
        navTab.classList.add('active');
    }
    
    // Initialize page-specific content
    if (pageId === 'monitor-settings') {
        // Reset to first sub-tab when entering monitor settings
        showSubTab('monitored-parameters');
        renderParametersGrid();
        renderConditionalRulesTable();
    }
}

// Sub Tab Navigation
function showSubTab(tabId) {
    console.log('Showing sub tab:', tabId);
    document.querySelectorAll('.sub-nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sub-tab-pane').forEach(pane => pane.classList.remove('active'));
    
    // Find and activate the correct tab button
    const targetTab = Array.from(document.querySelectorAll('.sub-nav-tab')).find(tab => 
        tab.onclick.toString().includes(tabId)
    );
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
        renderConditionalRulesTable();
    }
}

// Status Message Functions
function showStatus(message, type = 'loading') {
    const statusDiv = document.getElementById('status');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    if (type !== 'loading') {
        setTimeout(() => statusDiv.style.display = 'none', 3000);
    }
}

// Modal Dialog Functions
function showCreateParameterDialog() {
    const modal = document.getElementById('createParameterModal');
    const input = document.getElementById('modalParameterName');
    
    if (modal && input) {
        modal.style.display = 'flex';
        input.value = '';
        input.focus();
    }
}

function hideCreateParameterDialog() {
    const modal = document.getElementById('createParameterModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showDeleteParameterDialog() {
    if (!selectedParameter) return;
    
    const modal = document.getElementById('deleteParameterModal');
    const paramNameElement = document.getElementById('deleteParameterName');
    
    if (modal && paramNameElement) {
        paramNameElement.textContent = selectedParameter;
        modal.style.display = 'flex';
    }
}

function hideDeleteParameterDialog() {
    const modal = document.getElementById('deleteParameterModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Delete Value Modal Functions
let valueToDelete = null;

function showDeleteValueDialog(value) {
    valueToDelete = value;
    const modal = document.getElementById('deleteValueModal');
    const valueNameElement = document.getElementById('deleteValueName');
    
    if (modal && valueNameElement) {
        valueNameElement.textContent = value;
        modal.style.display = 'flex';
    }
}

function hideDeleteValueDialog() {
    const modal = document.getElementById('deleteValueModal');
    if (modal) {
        modal.style.display = 'none';
    }
    valueToDelete = null;
}

// Value Interface Functions
function showAddValueInterface() {
    const addInterface = document.getElementById('addValueInterface');
    const addBtn = document.getElementById('addValueBtn');
    const input = document.getElementById('newValueInput');
    
    if (addInterface && addBtn && input) {
        addInterface.style.display = 'block';
        addBtn.style.display = 'none';
        input.focus();
    }
}

function hideAddValueInterface() {
    const addInterface = document.getElementById('addValueInterface');
    const addBtn = document.getElementById('addValueBtn');
    const input = document.getElementById('newValueInput');
    
    if (addInterface && addBtn && input) {
        addInterface.style.display = 'none';
        addBtn.style.display = 'block';
        input.value = '';
    }
}

// Case Sensitivity UI Functions
function showCaseSensitivityEdit() {
    const editSection = document.getElementById('caseSensitivityEdit');
    const select = document.getElementById('caseSensitivity');
    
    if (editSection && select) {
        // Set current value
        select.value = casingRulesData[selectedParameter] || '';
        editSection.style.display = 'flex';
    }
}

function cancelCaseSensitivityEdit() {
    const editSection = document.getElementById('caseSensitivityEdit');
    if (editSection) {
        editSection.style.display = 'none';
    }
}

// Navigation to Conditional Rules Tab
function showConditionalRulesTab() {
    // Navigate to monitor settings page first
    showPage('monitor-settings');
    
    // Then show the conditional rules sub-tab
    setTimeout(() => {
        showSubTab('conditional-rules');
    }, 100);
}

function backToConditionalRules() {
    // Reset editing state
    isEditingRule = false;
    editingRuleId = null;
    
    // Navigate back to monitor settings and show conditional rules tab
    showPage('monitor-settings');
    setTimeout(() => {
        showSubTab('conditional-rules');
    }, 100);
}

// Rule Modal Value Management
function showAddRuleValueInput() {
    document.getElementById('addNewRuleValueContainer').style.display = 'block';
    document.getElementById('showAddRuleValueBtn').style.display = 'none';
    document.getElementById('newRuleConditionalValue').focus();
}

function hideAddRuleValueInput() {
    document.getElementById('addNewRuleValueContainer').style.display = 'none';
    document.getElementById('showAddRuleValueBtn').style.display = 'block';
    document.getElementById('newRuleConditionalValue').value = '';
}

function handleRuleConditionalValueEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewRuleConditionalValue();
    }
}

function backToConditionalRules() {
    // Reset editing state
    isEditingRule = false;
    editingRuleId = null;
    
    // Navigate back to monitor settings and show conditional rules tab
    showPage('monitor-settings');
    setTimeout(() => {
        showSubTab('conditional-rules');
    }, 100);
}

// Rule Modal Value Management
function showAddRuleValueInput() {
    document.getElementById('addNewRuleValueContainer').style.display = 'block';
    document.getElementById('showAddRuleValueBtn').style.display = 'none';
    document.getElementById('newRuleConditionalValue').focus();
}

function hideAddRuleValueInput() {
    document.getElementById('addNewRuleValueContainer').style.display = 'none';
    document.getElementById('showAddRuleValueBtn').style.display = 'block';
    document.getElementById('newRuleConditionalValue').value = '';
}

function handleRuleConditionalValueEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewRuleConditionalValue();
    }
}

// Event Handlers for Form Inputs
function handleAddValueNew(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewValue();
    }
}

// Close Modal Event Handlers
document.addEventListener('click', function(event) {
    // Close modals when clicking outside
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'createRuleModal') {
            hideCreateRuleModal();
        } else if (event.target.id === 'addRuleConditionalModal') {
            hideAddRuleConditionalModal();
        } else if (event.target.id === 'createParameterModal') {
            hideCreateParameterDialog();
        } else if (event.target.id === 'deleteParameterModal') {
            hideDeleteParameterDialog();
        } else if (event.target.id === 'deleteValueModal') {
            hideDeleteValueDialog();
        }
    }
});

// Application Initialization
window.addEventListener('load', () => {
    renderParametersGrid();
    loadRules();
});

document.addEventListener('DOMContentLoaded', function() {
    // Handle modal input enter key
    const modalInput = document.getElementById('modalParameterName');
    if (modalInput) {
        modalInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createNewParameter();
            }
        });
    }
});