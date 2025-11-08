// js/conditionalRules.js
// Conditional Monitoring Functions Module - Complete Rewrite

// Render Conditional Rules Table
function renderConditionalRulesTable() {
    const container = document.getElementById('conditionalRulesTableContainer');
    if (!container) {
        console.error('conditionalRulesTableContainer element not found');
        return;
    }
    
    console.log('Rendering conditional rules table. conditionalRulesData:', conditionalRulesData);
    
    if (!conditionalRulesData || conditionalRulesData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Conditional Rules</h3>
                <p>Create your first conditional monitoring rule using the button above.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table class="rules-table">
            <thead>
                <tr>
                    <th>Rule Name & Anchor</th>
                    <th>Conditional Parameters</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${conditionalRulesData.map(rule => `
                <tr>
                    <td>
                        <div class="rule-name">${rule.name}</div>
                        <div class="rule-anchor">When <strong>${rule.anchor.parameter}</strong> = "<strong>${rule.anchor.value}</strong>"</div>
                    </td>
                    <td>
                        <div class="rule-conditions">
                            ${Object.entries(rule.conditionals).map(([param, data]) => `
                                <div class="condition-item">
                                    <span class="condition-param">${param}:</span>
                                    <span class="condition-values">[${data.values.join(', ')}]</span>
                                </div>
                            `).join('')}
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${rule.active ? 'active' : 'paused'}">
                            ${rule.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>${new Date(rule.created).toLocaleDateString()}</td>
                    <td>
                        <div class="rule-actions">
                            <button class="rule-action-btn edit" onclick="editExistingRule('${rule.id}')" title="Edit rule">✏️</button>
                            <button class="rule-action-btn toggle" onclick="toggleRuleStatus('${rule.id}')" title="${rule.active ? 'Deactivate' : 'Activate'} rule">
                                ${rule.active ? '⏸️' : '▶️'}
                            </button>
                            <button class="rule-action-btn delete" onclick="deleteConditionalRule('${rule.id}')" title="Delete rule">🗑️</button>
                        </div>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    console.log('Rules table rendered successfully');
}

// Rule Status Management
async function toggleRuleStatus(ruleId) {
    const rule = conditionalRulesData.find(r => r.id === ruleId);
    if (!rule) return;
    
    rule.active = !rule.active;
    rule.lastUpdated = new Date().toISOString();
    
    try {
        await autoSaveConfiguration();
        renderConditionalRulesTable();
        showStatus(`Rule "${rule.name}" ${rule.active ? 'activated' : 'deactivated'}`, 'success');
    } catch (error) {
        rule.active = !rule.active;
        showStatus('Failed to update rule status: ' + error.message, 'error');
    }
}

async function deleteConditionalRule(ruleId) {
    const rule = conditionalRulesData.find(r => r.id === ruleId);
    if (!rule) return;
    
    if (!confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
        return;
    }
    
    const ruleIndex = conditionalRulesData.findIndex(r => r.id === ruleId);
    const deletedRule = conditionalRulesData.splice(ruleIndex, 1)[0];
    
    try {
        await autoSaveConfiguration();
        renderConditionalRulesTable();
        showStatus(`Rule "${deletedRule.name}" deleted`, 'success');
    } catch (error) {
        conditionalRulesData.splice(ruleIndex, 0, deletedRule);
        renderConditionalRulesTable();
        showStatus('Failed to delete rule: ' + error.message, 'error');
    }
}

// Edit Existing Rule - FIXED VERSION
function editExistingRule(ruleId) {
    const rule = conditionalRulesData.find(r => r.id === ruleId);
    if (!rule) return;
    
    // Set edit mode
    isEditingRule = true;
    editingRuleId = ruleId;
    
    // Navigate to rule editor page
    showPage('conditional-rule-editor');
    
    // Initialize the rule editor - THIS WAS MISSING!
    setTimeout(() => {
        initializeRuleEditor();
    }, 100);
}

// Create New Rule - Entry Point
function showCreateNewRule() {
    // Reset editing state for new rule
    isEditingRule = false;
    editingRuleId = null;
    
    // Navigate to rule editor page
    showPage('conditional-rule-editor');
    
    // Initialize the rule editor
    setTimeout(() => {
        initializeRuleEditor();
    }, 100);
}

// Initialize Rule Editor Page
function initializeRuleEditor() {
    console.log('Initializing rule editor...');
    
    // Reset form state
    resetRuleForm();
    
    // Populate anchor parameter options
    populateRuleAnchorParameterOptions();
    
    // Set page title based on edit mode
    if (isEditingRule && editingRuleId) {
        const rule = conditionalRulesData.find(r => r.id === editingRuleId);
        if (rule) {
            document.getElementById('ruleEditorTitle').textContent = 'Edit Conditional Rule';
            const nameElement = document.getElementById('currentRuleName');
            if (nameElement) {
                nameElement.textContent = rule.name;
                nameElement.style.display = 'inline-block';
            }
            const saveBtn = document.getElementById('saveRuleBtn');
            if (saveBtn) saveBtn.textContent = 'Update Rule';
            
            // Populate form with existing rule data
            loadExistingRuleData(rule);
        }
    } else {
        document.getElementById('ruleEditorTitle').textContent = 'Create New Conditional Rule';
        const nameElement = document.getElementById('currentRuleName');
        if (nameElement) nameElement.style.display = 'none';
        const saveBtn = document.getElementById('saveRuleBtn');
        if (saveBtn) saveBtn.textContent = 'Create Rule';
    }
}

// Load existing rule data into the form
function loadExistingRuleData(rule) {
    // Set current rule data
    window.currentRuleData = {
        anchor: {
            parameter: rule.anchor.parameter,
            value: rule.anchor.value
        },
        conditionals: { ...rule.conditionals }
    };
    
    // Populate anchor parameter
    const anchorParam = document.getElementById('ruleAnchorParameter');
    if (anchorParam) {
        anchorParam.value = rule.anchor.parameter;
        onRuleAnchorParameterSelect();
        
        // Wait for anchor values to populate, then select the value
        setTimeout(() => {
            const anchorValue = document.getElementById('ruleAnchorValue');
            if (anchorValue) {
                anchorValue.value = rule.anchor.value;
                onRuleAnchorValueSelect();
                
                // Update conditional parameters display
                updateRuleConditionalsList();
                updateRuleSummary();
            }
        }, 100);
    }
}

// Reset Rule Form
function resetRuleForm() {
    // Reset form fields safely
    const anchorParam = document.getElementById('ruleAnchorParameter');
    const anchorValue = document.getElementById('ruleAnchorValue');
    const anchorValueGroup = document.getElementById('ruleAnchorValueGroup');
    const conditionalCard = document.getElementById('conditionalParametersCard');
    const summaryCard = document.getElementById('ruleSummaryCard');
    const conditionalsList = document.getElementById('ruleConditionalsList');
    
    if (anchorParam) anchorParam.value = '';
    if (anchorValue) anchorValue.value = '';
    if (anchorValueGroup) anchorValueGroup.style.display = 'none';
    if (conditionalCard) conditionalCard.style.display = 'none';
    if (summaryCard) summaryCard.style.display = 'none';
    if (conditionalsList) conditionalsList.innerHTML = '';
    
    hideAddConditionalParameterSection();
    
    // Reset global state
    window.currentRuleData = {
        anchor: { parameter: null, value: null },
        conditionals: {}
    };
}

// Rule Form Management Functions
function populateRuleAnchorParameterOptions() {
    const select = document.getElementById('ruleAnchorParameter');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '<option value="">-- Select Parameter --</option>';
    
    // Add monitored parameters as options
    Object.keys(monitoredParametersData).forEach(paramName => {
        const option = document.createElement('option');
        option.value = paramName;
        option.textContent = paramName;
        select.appendChild(option);
    });
}

function onRuleAnchorParameterSelect() {
    const select = document.getElementById('ruleAnchorParameter');
    const valueGroup = document.getElementById('ruleAnchorValueGroup');
    const parameterName = select ? select.value : '';
    
    if (parameterName) {
        window.currentRuleData.anchor.parameter = parameterName;
        populateRuleAnchorValues(parameterName);
        if (valueGroup) valueGroup.style.display = 'block';
    } else {
        window.currentRuleData.anchor.parameter = null;
        window.currentRuleData.anchor.value = null;
        if (valueGroup) valueGroup.style.display = 'none';
        const conditionalCard = document.getElementById('conditionalParametersCard');
        const summaryCard = document.getElementById('ruleSummaryCard');
        if (conditionalCard) conditionalCard.style.display = 'none';
        if (summaryCard) summaryCard.style.display = 'none';
    }
}

function populateRuleAnchorValues(parameterName) {
    const select = document.getElementById('ruleAnchorValue');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '<option value="">-- Select Value --</option>';
    
    // Get allowed values for this parameter
    const allowedValues = allowedValuesData[parameterName] || [];
    
    allowedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
    
    if (allowedValues.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No allowed values configured';
        option.disabled = true;
        select.appendChild(option);
    }
}

function onRuleAnchorValueSelect() {
    const select = document.getElementById('ruleAnchorValue');
    const conditionalCard = document.getElementById('conditionalParametersCard');
    const value = select ? select.value : '';
    
    if (value) {
        window.currentRuleData.anchor.value = value;
        if (conditionalCard) conditionalCard.style.display = 'block';
        populateRuleConditionalParameterOptions();
        updateRuleConditionalsList();
        updateRuleSummary();
    } else {
        window.currentRuleData.anchor.value = null;
        if (conditionalCard) conditionalCard.style.display = 'none';
        const summaryCard = document.getElementById('ruleSummaryCard');
        if (summaryCard) summaryCard.style.display = 'none';
    }
}

// Conditional Parameters Management
function populateRuleConditionalParameterOptions() {
    const select = document.getElementById('ruleConditionalParameter');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '<option value="">-- Select Parameter --</option>';
    
    // Add all monitored parameters except the anchor
    Object.keys(monitoredParametersData).forEach(paramName => {
        if (paramName !== window.currentRuleData.anchor.parameter) {
            const option = document.createElement('option');
            option.value = paramName;
            option.textContent = paramName;
            select.appendChild(option);
        }
    });
}

function updateRuleConditionalsList() {
    const container = document.getElementById('ruleConditionalsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Add existing conditional parameters
    Object.entries(window.currentRuleData.conditionals).forEach(([paramName, paramData]) => {
        const paramDiv = document.createElement('div');
        paramDiv.style.cssText = 'background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;';
        paramDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; font-family: 'Monaco', 'Menlo', monospace; color: var(--gray-900);">${paramName}</span>
                <button type="button" onclick="removeRuleConditionalParameter('${paramName}')" 
                    style="background: var(--error-color); color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${paramData.values.map(value => `
                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.75rem; font-weight: 500;">
                        ${value}
                    </span>
                `).join('')}
            </div>
        `;
        container.appendChild(paramDiv);
    });
}

function showAddConditionalParameterSection() {
    const addSection = document.getElementById('addConditionalSection');
    const addBtn = document.getElementById('addConditionalBtn');
    
    if (addSection) addSection.style.display = 'block';
    if (addBtn) addBtn.style.display = 'none';
    populateRuleConditionalParameterOptions();
}

function hideAddConditionalParameterSection() {
    const addSection = document.getElementById('addConditionalSection');
    const addBtn = document.getElementById('addConditionalBtn');
    
    if (addSection) addSection.style.display = 'none';
    if (addBtn) addBtn.style.display = 'block';
    
    // Reset form
    const paramSelect = document.getElementById('ruleConditionalParameter');
    const valuesGroup = document.getElementById('ruleConditionalValuesGroup');
    const searchInput = document.getElementById('ruleValuesSearchInput');
    
    if (paramSelect) paramSelect.value = '';
    if (valuesGroup) valuesGroup.style.display = 'none';
    if (searchInput) searchInput.value = '';
    hideAddRuleValueInput();
}

function onRuleConditionalParameterSelect() {
    const select = document.getElementById('ruleConditionalParameter');
    const valuesGroup = document.getElementById('ruleConditionalValuesGroup');
    const parameterName = select ? select.value : '';
    
    if (parameterName) {
        populateExistingRuleConditionalValues(parameterName);
        if (valuesGroup) valuesGroup.style.display = 'block';
    } else {
        if (valuesGroup) valuesGroup.style.display = 'none';
    }
}

function populateExistingRuleConditionalValues(parameterName) {
    const container = document.getElementById('existingRuleConditionalValues');
    if (!container) return;
    
    const allowedValues = allowedValuesData[parameterName] || [];
    
    // Store currently checked values before clearing
    const checkedValues = new Set();
    container.querySelectorAll('.value-checkbox:checked').forEach(checkbox => {
        checkedValues.add(checkbox.value);
    });
    
    container.innerHTML = '';
    
    if (allowedValues.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); font-style: italic; padding: 1rem; text-align: center;">No existing allowed values. Add new values below.</p>';
        return;
    }
    
    allowedValues.forEach(value => {
        const item = document.createElement('div');
        item.className = 'value-checkbox-item';
        const isChecked = checkedValues.has(value) ? 'checked' : '';
        item.innerHTML = `
            <input type="checkbox" class="value-checkbox" value="${value}" id="rule-val-${CSS.escape(value)}" ${isChecked}>
            <label for="rule-val-${CSS.escape(value)}">${value}</label>
        `;
        container.appendChild(item);
    });
}

function filterRuleConditionalValues() {
    const searchInput = document.getElementById('ruleValuesSearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const valueItems = document.querySelectorAll('#existingRuleConditionalValues .value-checkbox-item');
    
    valueItems.forEach(item => {
        const label = item.querySelector('label');
        if (label) {
            const labelText = label.textContent.toLowerCase();
            item.style.display = labelText.includes(searchTerm) ? 'flex' : 'none';
        }
    });
}

// Value Management Functions
function showAddRuleValueInput() {
    const addContainer = document.getElementById('addNewRuleValueContainer');
    const showBtn = document.getElementById('showAddRuleValueBtn');
    const input = document.getElementById('newRuleConditionalValue');
    
    if (addContainer) addContainer.style.display = 'block';
    if (showBtn) showBtn.style.display = 'none';
    if (input) input.focus();
}

function hideAddRuleValueInput() {
    const addContainer = document.getElementById('addNewRuleValueContainer');
    const showBtn = document.getElementById('showAddRuleValueBtn');
    const input = document.getElementById('newRuleConditionalValue');
    
    if (addContainer) addContainer.style.display = 'none';
    if (showBtn) showBtn.style.display = 'block';
    if (input) input.value = '';
}

function handleRuleConditionalValueEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNewRuleConditionalValue();
    }
}

async function addNewRuleConditionalValue() {
    const input = document.getElementById('newRuleConditionalValue');
    const select = document.getElementById('ruleConditionalParameter');
    const parameterName = select ? select.value : '';
    const value = input ? input.value.trim() : '';
    
    if (!value || !parameterName) {
        showStatus('Please enter a value and select a parameter', 'error');
        return;
    }
    
    // Add to allowed values for this parameter
    if (!allowedValuesData[parameterName]) {
        allowedValuesData[parameterName] = [];
    }
    
    if (!allowedValuesData[parameterName].includes(value)) {
        allowedValuesData[parameterName].push(value);
        
        try {
            await autoSaveConfiguration();
            populateExistingRuleConditionalValues(parameterName);
            
            // Auto-check the newly added value
            const newCheckbox = document.querySelector(`#rule-val-${CSS.escape(value)}`);
            if (newCheckbox) newCheckbox.checked = true;
            
            if (input) input.value = '';
            hideAddRuleValueInput();
            showStatus(`Added "${value}" to ${parameterName}`, 'success');
            
        } catch (error) {
            // If save fails, remove the value from local data
            const index = allowedValuesData[parameterName].indexOf(value);
            if (index > -1) {
                allowedValuesData[parameterName].splice(index, 1);
            }
            showStatus(`Failed to save "${value}": ${error.message}`, 'error');
        }
    } else {
        showStatus(`"${value}" already exists for ${parameterName}`, 'error');
    }
}

function addRuleConditionalParameter() {
    const select = document.getElementById('ruleConditionalParameter');
    const parameterName = select ? select.value : '';
    
    if (!parameterName) {
        showStatus('Please select a parameter', 'error');
        return;
    }
    
    // Get selected values
    const checkboxes = document.querySelectorAll('#existingRuleConditionalValues .value-checkbox:checked');
    const selectedValues = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedValues.length === 0) {
        showStatus('Please select at least one value', 'error');
        return;
    }
    
    // Add to conditional monitoring data
    window.currentRuleData.conditionals[parameterName] = {
        values: selectedValues
    };
    
    // Update displays
    updateRuleConditionalsList();
    updateRuleSummary();
    hideAddConditionalParameterSection();
    
    showStatus(`Added conditional parameter "${parameterName}"`, 'success');
}

function removeRuleConditionalParameter(parameterName) {
    delete window.currentRuleData.conditionals[parameterName];
    updateRuleConditionalsList();
    updateRuleSummary();
    showStatus(`Removed conditional parameter "${parameterName}"`, 'success');
}

// Rule Summary Management
function updateRuleSummary() {
    const summaryCard = document.getElementById('ruleSummaryCard');
    const summaryContent = document.getElementById('ruleSummaryContent');
    
    if (!summaryCard || !summaryContent) return;
    
    const hasAnchor = window.currentRuleData.anchor.parameter && window.currentRuleData.anchor.value;
    const hasConditionals = Object.keys(window.currentRuleData.conditionals).length > 0;
    
    if (hasAnchor && hasConditionals) {
        summaryCard.style.display = 'block';
        
        let summaryHTML = `
            <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary-color);">
                <div style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem;">
                    When ${window.currentRuleData.anchor.parameter} = "${window.currentRuleData.anchor.value}"
                </div>
                <div style="color: var(--gray-700); font-size: 0.9rem; line-height: 1.6;">
                    Then apply these conditional validations:
        `;
        
        const conditions = Object.entries(window.currentRuleData.conditionals);
        conditions.forEach(([paramName, paramData], index) => {
            summaryHTML += `
                <div style="margin: 0.5rem 0; padding: 0.5rem; background: white; border-radius: 6px;">
                    <span style="font-weight: 600; color: var(--primary-color); font-family: 'Monaco', 'Menlo', monospace;">${paramName}:</span>
                    must be one of 
                    <span style="background: var(--gray-100); padding: 0.25rem 0.5rem; border-radius: 4px; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.8rem;">[${paramData.values.join(', ')}]</span>
                </div>
            `;
            
            if (index < conditions.length - 1) {
                summaryHTML += '<div style="text-align: center; font-weight: 700; color: var(--secondary-color); margin: 0.5rem 0;">AND</div>';
            }
        });
        
        summaryHTML += `
                </div>
            </div>
        `;
        
        summaryContent.innerHTML = summaryHTML;
    } else {
        summaryCard.style.display = 'none';
    }
}

// Save Conditional Rule
async function saveConditionalRule() {
    const hasAnchor = window.currentRuleData.anchor.parameter && window.currentRuleData.anchor.value;
    const hasConditionals = Object.keys(window.currentRuleData.conditionals).length > 0;
    
    if (!hasAnchor) {
        showStatus('Please select an anchor parameter and value', 'error');
        return;
    }
    
    if (!hasConditionals) {
        showStatus('Please add at least one conditional parameter', 'error');
        return;
    }
    
    try {
        showStatus('Saving conditional rule...', 'loading');
        
        if (isEditingRule && editingRuleId) {
            // Update existing rule
            const ruleIndex = conditionalRulesData.findIndex(r => r.id === editingRuleId);
            if (ruleIndex === -1) {
                throw new Error('Rule not found');
            }
            
            const updatedRule = {
                ...conditionalRulesData[ruleIndex],
                name: `${window.currentRuleData.anchor.parameter} = "${window.currentRuleData.anchor.value}"`,
                anchor: {
                    parameter: window.currentRuleData.anchor.parameter,
                    value: window.currentRuleData.anchor.value
                },
                conditionals: { ...window.currentRuleData.conditionals },
                lastUpdated: new Date().toISOString()
            };
            
            conditionalRulesData[ruleIndex] = updatedRule;
            showStatus('Conditional rule updated successfully!', 'success');
        } else {
            // Create new rule
            const newRule = {
                id: generateRuleId(),
                name: `${window.currentRuleData.anchor.parameter} = "${window.currentRuleData.anchor.value}"`,
                anchor: {
                    parameter: window.currentRuleData.anchor.parameter,
                    value: window.currentRuleData.anchor.value
                },
                conditionals: { ...window.currentRuleData.conditionals },
                created: new Date().toISOString(),
                active: true
            };
            
            console.log('About to save conditional rule:', newRule);
            conditionalRulesData.push(newRule);
            showStatus('Conditional rule created successfully!', 'success');
        }
        
        // Save to Firebase
        await autoSaveConfiguration();
        
        // Navigate back to conditional rules
        setTimeout(() => {
            backToConditionalRules();
        }, 1000);
        
    } catch (error) {
        console.error('Error saving conditional rule:', error);
        
        // Remove the rule from local data if save failed and it was a new rule
        if (!isEditingRule && conditionalRulesData.length > 0) {
            conditionalRulesData.pop();
        }
        
        showStatus('Failed to save conditional rule: ' + error.message, 'error');
    }
}

// Legacy Functions for Backward Compatibility
function initializeConditionalMonitoring() {
    console.log('Initializing conditional monitoring (legacy function)...');
    renderConditionalRulesTable();
}

function showConditionalMonitoringForParameter() {
    if (!selectedParameter) {
        showStatus('Please select a parameter first', 'error');
        return;
    }
    
    // Navigate to conditional rules tab
    showPage('monitor-settings');
    setTimeout(() => {
        showSubTab('conditional-rules');
    }, 100);
}

// Navigation function
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

// Export functions to global scope
window.renderConditionalRulesTable = renderConditionalRulesTable;
window.initializeRuleEditor = initializeRuleEditor;
window.showCreateNewRule = showCreateNewRule;
window.toggleRuleStatus = toggleRuleStatus;
window.deleteConditionalRule = deleteConditionalRule;
window.editExistingRule = editExistingRule;
window.saveConditionalRule = saveConditionalRule;
window.resetRuleForm = resetRuleForm;
window.onRuleAnchorParameterSelect = onRuleAnchorParameterSelect;
window.onRuleAnchorValueSelect = onRuleAnchorValueSelect;
window.onRuleConditionalParameterSelect = onRuleConditionalParameterSelect;
window.showAddConditionalParameterSection = showAddConditionalParameterSection;
window.hideAddConditionalParameterSection = hideAddConditionalParameterSection;
window.addRuleConditionalParameter = addRuleConditionalParameter;
window.removeRuleConditionalParameter = removeRuleConditionalParameter;
window.filterRuleConditionalValues = filterRuleConditionalValues;
window.showAddRuleValueInput = showAddRuleValueInput;
window.hideAddRuleValueInput = hideAddRuleValueInput;
window.handleRuleConditionalValueEnter = handleRuleConditionalValueEnter;
window.addNewRuleConditionalValue = addNewRuleConditionalValue;
window.backToConditionalRules = backToConditionalRules;

console.log('Conditional rules module loaded and functions exported globally');