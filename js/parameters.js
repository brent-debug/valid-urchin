// js/parameters.js
// Parameter Management Functions Module - Updated for Simplified Cards

// Parameter Grid Rendering - Simplified
function renderParametersGrid() {
    const grid = document.getElementById('parametersGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    Object.entries(monitoredParametersData).forEach(([paramName, paramData]) => {
        // Determine status - draft, active, or paused
        let status = 'paused';
        let statusText = 'Paused';
        if (paramData.status === 'draft') {
            status = 'draft';
            statusText = 'Draft';
        } else if (paramData.active) {
            status = 'active';
            statusText = 'Active';
        }
        
        const paramCard = document.createElement('div');
        paramCard.className = `parameter-card ${status}`;
        paramCard.onclick = () => selectParameter(paramName);
        paramCard.style.cursor = 'pointer';
        paramCard.innerHTML = `
            <div class="parameter-header">
                <div class="parameter-name">${paramName}</div>
                <span class="status-badge ${status}">
                    ${statusText}
                </span>
            </div>
        `;
        grid.appendChild(paramCard);
    });
}

// Parameter Status Management
async function pauseParameter(paramName) {
    if (monitoredParametersData[paramName]) {
        monitoredParametersData[paramName].active = false;
        renderParametersGrid();
        await autoSaveConfiguration();
        showStatus(`Parameter "${paramName}" paused`, 'success');
    }
}

async function resumeParameter(paramName) {
    if (monitoredParametersData[paramName]) {
        monitoredParametersData[paramName].active = true;
        renderParametersGrid();
        await autoSaveConfiguration();
        showStatus(`Parameter "${paramName}" resumed`, 'success');
    }
}

async function deleteParameter(paramName) {
    if (confirm(`Are you sure you want to delete "${paramName}"?`)) {
        delete monitoredParametersData[paramName];
        delete casingRulesData[paramName];
        delete allowedValuesData[paramName];
        
        renderParametersGrid();
        await autoSaveConfiguration();
        showStatus(`Parameter "${paramName}" deleted`, 'success');
    }
}

// Parameter Creation
async function createNewParameter() {
    const input = document.getElementById('modalParameterName');
    const paramName = input.value.trim();
    
    if (!paramName) {
        showStatus('Please enter a parameter name', 'error');
        return;
    }
    
    // Validate parameter name format
    if (!/^[a-zA-Z0-9_-]+$/.test(paramName)) {
        showStatus('Parameter name can only contain letters, numbers, underscores, and hyphens', 'error');
        return;
    }
    
    if (monitoredParametersData[paramName]) {
        showStatus('Parameter already exists', 'error');
        return;
    }
    
    // Create parameter in draft mode
    monitoredParametersData[paramName] = {
        active: false, // Start in draft mode (inactive)
        status: 'draft',
        created: new Date().toISOString()
    };
    
    hideCreateParameterDialog();
    await autoSaveConfiguration();
    showStatus(`Parameter "${paramName}" created in draft mode`, 'success');
    
    // Refresh the grid and navigate to parameter editor
    renderParametersGrid();
    selectedParameter = paramName;
    showPage('parameter-editor');
    loadParameterEditor(paramName);
}

// Parameter Selection and Editor Loading
function selectParameter(paramName) {
    console.log('selectParameter called with:', paramName);
    selectedParameter = paramName;
    
    try {
        // Navigate to parameter editor page
        console.log('About to navigate to parameter-editor page');
        showPage('parameter-editor');
        
        console.log('About to load parameter editor');
        loadParameterEditor(paramName);
        
        console.log('Successfully completed selectParameter');
    } catch (error) {
        console.error('Error in selectParameter:', error);
        showStatus('Error loading parameter editor: ' + error.message, 'error');
    }
}

function loadParameterEditor(paramName) {
    console.log('Loading parameter editor for:', paramName);
    
    // Update page header
    const currentParameterElement = document.getElementById('currentParameterName');
    if (currentParameterElement) {
        currentParameterElement.textContent = paramName;
    }
    
    // Load parameter data
    const paramData = monitoredParametersData[paramName];
    if (!paramData) {
        console.error('No parameter data found for:', paramName);
        return;
    }
    
    // Update status display
    updateStatusDisplay();
    
    // Update case sensitivity display
    updateCaseSensitivityDisplay();
    
    // Set dates
    const createdDateElement = document.getElementById('createdDate');
    if (createdDateElement) {
        createdDateElement.textContent = new Date(paramData.created).toLocaleString();
    }
    
    const lastUpdatedElement = document.getElementById('lastUpdatedDate');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = paramData.lastUpdated ? 
            new Date(paramData.lastUpdated).toLocaleString() : 
            new Date(paramData.created).toLocaleString();
    }
    
    // Load allowed values display
    updateAllowedValuesDisplay();
}

// Parameter Status Display and Management
function updateStatusDisplay() {
    if (!selectedParameter) return;
    
    const paramData = monitoredParametersData[selectedParameter];
    const statusBadge = document.getElementById('currentStatusBadge');
    const statusActions = document.getElementById('statusActions');
    
    if (!statusBadge || !statusActions) return;
    
    // Determine current status
    let status = 'paused';
    let statusText = 'Paused';
    if (paramData.status === 'draft') {
        status = 'draft';
        statusText = 'Draft';
    } else if (paramData.active) {
        status = 'active';
        statusText = 'Active';
    }
    
    // Update status badge
    statusBadge.className = `status-badge ${status}`;
    statusBadge.textContent = statusText;
    
    // Update status actions
    if (status === 'active') {
        statusActions.innerHTML = '<button class="btn btn-secondary btn-small" onclick="pauseParameterEditor()">Pause</button>';
    } else {
        statusActions.innerHTML = '<button class="btn btn-primary btn-small" onclick="activateParameterEditor()">Activate</button>';
    }
}

async function activateParameterEditor() {
    if (!selectedParameter) return;
    
    monitoredParametersData[selectedParameter].active = true;
    monitoredParametersData[selectedParameter].status = 'active';
    monitoredParametersData[selectedParameter].lastUpdated = new Date().toISOString();
    
    updateStatusDisplay();
    renderParametersGrid(); // Update the grid to reflect status change
    await autoSaveConfiguration();
    showStatus(`Parameter "${selectedParameter}" activated`, 'success');
}

async function pauseParameterEditor() {
    if (!selectedParameter) return;
    
    monitoredParametersData[selectedParameter].active = false;
    monitoredParametersData[selectedParameter].status = 'paused';
    monitoredParametersData[selectedParameter].lastUpdated = new Date().toISOString();
    
    updateStatusDisplay();
    renderParametersGrid(); // Update the grid to reflect status change
    await autoSaveConfiguration();
    showStatus(`Parameter "${selectedParameter}" paused`, 'success');
}

// Parameter Deletion from Editor
async function confirmDeleteParameter() {
    if (!selectedParameter) return;
    
    const paramToDelete = selectedParameter;
    
    delete monitoredParametersData[paramToDelete];
    delete casingRulesData[paramToDelete];
    delete allowedValuesData[paramToDelete];
    
    hideDeleteParameterDialog();
    await autoSaveConfiguration();
    showStatus(`Parameter "${paramToDelete}" deleted`, 'success');
    
    // Navigate back to monitor settings
    showPage('monitor-settings');
    renderParametersGrid();
}

// Case Sensitivity Management
function updateCaseSensitivityDisplay() {
    if (!selectedParameter) return;
    
    const display = document.getElementById('currentCaseSensitivity');
    if (!display) return;
    
    const currentRule = casingRulesData[selectedParameter];
    let displayText = 'No restriction';
    
    if (currentRule === 'lowercase') {
        displayText = 'Must be lowercase';
    } else if (currentRule === 'uppercase') {
        displayText = 'Must be uppercase';
    }
    
    display.textContent = displayText;
}

async function saveCaseSensitivity() {
    if (!selectedParameter) return;
    
    const casing = document.getElementById('caseSensitivity').value;
    
    if (casing) {
        casingRulesData[selectedParameter] = casing;
    } else {
        delete casingRulesData[selectedParameter];
    }
    
    monitoredParametersData[selectedParameter].lastUpdated = new Date().toISOString();
    
    updateCaseSensitivityDisplay();
    cancelCaseSensitivityEdit();
    await autoSaveConfiguration();
    showStatus('Case sensitivity updated', 'success');
}

// Allowed Values Management
function updateAllowedValuesDisplay() {
    const container = document.getElementById('allowedValuesDisplay');
    if (!container || !selectedParameter) return;
    
    const values = allowedValuesData[selectedParameter] || [];
    
    if (values.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No allowed values configured</div>';
    } else {
        container.innerHTML = `
            <div class="allowed-values-list">
                ${values.map(value => `
                    <div class="allowed-value-item">
                        <span class="allowed-value-text">${value}</span>
                        <button class="remove-value-btn" onclick="showDeleteValueDialog('${value}')" title="Remove this value">×</button>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

async function addNewValue() {
    const input = document.getElementById('newValueInput');
    const value = input.value.trim();
    
    if (value && selectedParameter) {
        console.log('Adding value:', value, 'to parameter:', selectedParameter);
        
        // Initialize array if needed
        if (!allowedValuesData[selectedParameter]) {
            allowedValuesData[selectedParameter] = [];
            console.log('Initialized array for', selectedParameter);
        }
        
        // Add value if not already present
        if (!allowedValuesData[selectedParameter].includes(value)) {
            allowedValuesData[selectedParameter].push(value);
            console.log('Updated allowedValuesData:', allowedValuesData);
            
            await autoSaveRules();
            renderParametersGrid(); // Update rule count if needed
            updateAllowedValuesDisplay();
            hideAddValueInterface();
            
            showStatus(`Added "${value}"`, 'success');
        } else {
            showStatus(`"${value}" already exists`, 'error');
            input.value = '';
        }
    }
}

async function confirmDeleteValue() {
    if (selectedParameter && valueToDelete && allowedValuesData[selectedParameter]) {
        const index = allowedValuesData[selectedParameter].indexOf(valueToDelete);
        if (index > -1) {
            allowedValuesData[selectedParameter].splice(index, 1);
            
            // Remove the rule entirely if no values left
            if (allowedValuesData[selectedParameter].length === 0) {
                delete allowedValuesData[selectedParameter];
            }
            
            await autoSaveRules();
            renderParametersGrid(); // Update rule count if needed
            updateAllowedValuesDisplay();
            hideDeleteValueDialog();
            
            showStatus(`Removed "${valueToDelete}"`, 'success');
        }
    }
}

async function autoSaveRules() {
    await autoSaveConfiguration();
}