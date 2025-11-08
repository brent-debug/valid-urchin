// js/conflictLog.js
// Redesigned Conflict Log Management with Grouping & Bulk Operations

// Global conflict data
let conflictsData = [];
let groupedConflictsData = [];
let conflictStats = {
    totalViolations: 0,
    unresolvedViolations: 0,
    highPriorityViolations: 0,
    affectedUrls: 0
};

// UI State
let currentFilters = {
    search: '',
    violationType: 'all',
    timeRange: 'all',
    status: 'unresolved'
};
let activeFilterChips = [];
let selectedGroups = new Set();
let expandedGroups = new Set();

// Initialize Conflict Log page
function initializeConflictLog() {
    console.log('Initializing redesigned Conflict Log...');
    
    // Set up filter event listeners
    setupConflictFilters();
    setupBulkOperations();
    
    // Auto-load conflicts when page opens
    loadConflicts();
}

// Set up filter event listeners
function setupConflictFilters() {
    const searchInput = document.getElementById('conflictSearchInput');
    const violationTypeFilter = document.getElementById('violationTypeFilter');
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (searchInput) {
        // Debounced search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = e.target.value;
                applyFilters();
            }, 300);
        });
    }
    
    if (violationTypeFilter) {
        violationTypeFilter.addEventListener('change', (e) => {
            currentFilters.violationType = e.target.value;
            updateFilterChips();
            applyFilters();
        });
    }
    
    if (timeRangeFilter) {
        timeRangeFilter.addEventListener('change', (e) => {
            currentFilters.timeRange = e.target.value;
            updateFilterChips();
            applyFilters();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            updateFilterChips();
            applyFilters();
        });
    }
}

// Set up bulk operations
function setupBulkOperations() {
    const selectAllCheckbox = document.getElementById('selectAllGroups');
    
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', toggleSelectAll);
    }
}

// Load conflicts from Firebase and group them
async function loadConflicts() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
    }

    try {
        showStatus('Loading conflicts...', 'loading');
        console.log('Loading conflicts for API key:', apiKey);
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const conflictsSnapshot = await firebase.firestore()
            .collection(`organizations/${apiKey}/conflicts`)
            .orderBy('validationTimestamp', 'desc')
            .limit(100)
            .get();

        conflictsData = [];
        
        if (conflictsSnapshot.empty) {
            console.log('No conflicts found');
        } else {
            conflictsSnapshot.forEach(doc => {
                const data = doc.data();
                conflictsData.push({
                    id: doc.id,
                    ...data
                });
            });
        }
        
        console.log('Loaded raw conflicts:', conflictsData.length);
        
        // Group conflicts by URL and timestamp
        groupConflicts();
        
        // Calculate statistics
        calculateStats();
        
        // Apply current filters and render
        applyFilters();
        
        showStatus('Conflicts loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading conflicts:', error);
        showStatus('Error loading conflicts: ' + error.message, 'error');
        conflictsData = [];
        groupedConflictsData = [];
        renderConflictLog();
    }
}

// Group conflicts by URL and timestamp
function groupConflicts() {
    const groups = new Map();
    
    conflictsData.forEach(conflict => {
        const url = conflict.originalEventData?.url || 'Unknown URL';
        const timestamp = conflict.validationTimestamp;
        
        // Create a group key based on URL and timestamp (within 5 minutes)
        const timeWindow = Math.floor(new Date(timestamp).getTime() / (5 * 60 * 1000));
        const groupKey = `${url}_${timeWindow}`;
        
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                id: generateGroupId(),
                url: url,
                timestamp: timestamp,
                campaign: extractCampaignName(url),
                severity: 'low',
                isExpanded: false,
                isSelected: false,
                violations: []
            });
        }
        
        const group = groups.get(groupKey);
        
        // Add violations from this conflict
        if (conflict.conflictReasons) {
            conflict.conflictReasons.forEach(reason => {
                group.violations.push({
                    id: `${conflict.id}_${reason.parameter}`,
                    parameter: reason.parameter,
                    value: reason.value,
                    violationType: mapViolationType(reason.rule),
                    message: generateHumanReadableMessage(reason),
                    status: 'unresolved',
                    originalReason: reason
                });
            });
        }
    });
    
    // Convert to array and calculate severity
    groupedConflictsData = Array.from(groups.values()).map(group => {
        group.severity = calculateGroupSeverity(group.violations);
        return group;
    });
    
    // Sort by timestamp (newest first)
    groupedConflictsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log('Grouped conflicts:', groupedConflictsData.length, 'groups');
}

// Calculate statistics
function calculateStats() {
    let totalViolations = 0;
    let unresolvedViolations = 0;
    let highPriorityViolations = 0;
    const affectedUrls = new Set();
    
    groupedConflictsData.forEach(group => {
        affectedUrls.add(group.url);
        
        group.violations.forEach(violation => {
            totalViolations++;
            if (violation.status === 'unresolved') {
                unresolvedViolations++;
            }
        });
        
        if (group.severity === 'high') {
            highPriorityViolations++;
        }
    });
    
    conflictStats = {
        totalViolations,
        unresolvedViolations,
        highPriorityViolations,
        affectedUrls: affectedUrls.size
    };
    
    renderStatsBar();
}

// Apply filters to grouped data
function applyFilters() {
    console.log('Applying filters:', currentFilters);
    
    let filteredGroups = [...groupedConflictsData];
    
    // Search filter
    if (currentFilters.search) {
        const searchTerm = currentFilters.search.toLowerCase();
        filteredGroups = filteredGroups.filter(group => {
            return group.url.toLowerCase().includes(searchTerm) ||
                   group.campaign?.toLowerCase().includes(searchTerm) ||
                   group.violations.some(v => 
                       v.parameter.toLowerCase().includes(searchTerm) ||
                       v.value.toLowerCase().includes(searchTerm)
                   );
        });
    }
    
    // Violation type filter
    if (currentFilters.violationType !== 'all') {
        filteredGroups = filteredGroups.filter(group => {
            return group.violations.some(v => v.violationType === currentFilters.violationType);
        });
    }
    
    // Time range filter
    if (currentFilters.timeRange !== 'all') {
        const now = new Date();
        let cutoffTime;
        
        switch (currentFilters.timeRange) {
            case 'last24h':
                cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'last7d':
                cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'last30d':
                cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
        }
        
        if (cutoffTime) {
            filteredGroups = filteredGroups.filter(group => {
                return new Date(group.timestamp) >= cutoffTime;
            });
        }
    }
    
    // Status filter
    if (currentFilters.status !== 'all') {
        filteredGroups = filteredGroups.filter(group => {
            if (currentFilters.status === 'unresolved') {
                return group.violations.some(v => v.status === 'unresolved');
            } else if (currentFilters.status === 'resolved') {
                return group.violations.every(v => v.status !== 'unresolved');
            }
            return true;
        });
    }
    
    console.log('Filtered groups:', filteredGroups.length);
    renderConflictLog(filteredGroups);
}

// Render statistics bar
function renderStatsBar() {
    const container = document.getElementById('conflictStatsBar');
    if (!container) return;
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${conflictStats.totalViolations}</div>
                <div class="stat-label">Total Violations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${conflictStats.unresolvedViolations}</div>
                <div class="stat-label">Unresolved</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${conflictStats.highPriorityViolations}</div>
                <div class="stat-label">High Priority</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${conflictStats.affectedUrls}</div>
                <div class="stat-label">URLs Affected</div>
            </div>
        </div>
    `;
}

// Render main conflict log
function renderConflictLog(groups = groupedConflictsData) {
    const container = document.getElementById('conflictGroupsContainer');
    if (!container) return;
    
    if (!groups || groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Conflicts Found</h3>
                <p>No conflicts match the current filters, or no conflicts have been detected yet.</p>
            </div>
        `;
        hideBulkActions();
        return;
    }
    
    container.innerHTML = groups.map(group => renderConflictGroup(group)).join('');
    updateBulkActionsVisibility();
}

// Render individual conflict group
function renderConflictGroup(group) {
    const isSelected = selectedGroups.has(group.id);
    const isExpanded = expandedGroups.has(group.id);
    const violationCount = group.violations.length;
    const unresolvedCount = group.violations.filter(v => v.status === 'unresolved').length;
    
    return `
        <div class="conflict-group ${isSelected ? 'selected' : ''}" data-group-id="${group.id}">
            <div class="conflict-group-header" onclick="toggleGroupExpansion('${group.id}')">
                <div class="group-selection">
                    <input type="checkbox" 
                           class="group-checkbox" 
                           ${isSelected ? 'checked' : ''}
                           onclick="event.stopPropagation(); toggleGroupSelection('${group.id}')"
                           data-group-id="${group.id}">
                    <div class="severity-indicator severity-${group.severity}"></div>
                </div>
                
                <div class="group-info">
                    <div class="group-url">${group.url}</div>
                    <div class="group-metadata">
                        <span class="group-timestamp">${new Date(group.timestamp).toLocaleString()}</span>
                        ${group.campaign ? `<span class="group-campaign">${group.campaign}</span>` : ''}
                        <span class="violation-count">${violationCount} violation${violationCount !== 1 ? 's' : ''}</span>
                        ${unresolvedCount > 0 ? `<span class="unresolved-count">${unresolvedCount} unresolved</span>` : ''}
                    </div>
                </div>
                
                <div class="group-actions">
                    <button class="expand-button ${isExpanded ? 'expanded' : ''}" onclick="event.stopPropagation(); toggleGroupExpansion('${group.id}')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 6l4 4 4-4H4z"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            ${isExpanded ? renderGroupViolations(group) : ''}
        </div>
    `;
}

// Render violations within a group
function renderGroupViolations(group) {
    return `
        <div class="group-violations">
            ${group.violations.map(violation => renderViolationItem(violation, group.id)).join('')}
            <div class="group-bulk-actions">
                <button class="btn btn-primary btn-small" onclick="allowAllGroupViolations('${group.id}')">
                    Allow All Values
                </button>
                <button class="btn btn-secondary btn-small" onclick="ignoreAllGroupViolations('${group.id}')">
                    Ignore All
                </button>
            </div>
        </div>
    `;
}

// Render individual violation
function renderViolationItem(violation, groupId) {
    return `
        <div class="violation-item ${violation.status}" data-violation-id="${violation.id}">
            <div class="violation-content">
                <div class="violation-details">
                    <span class="parameter-name">${violation.parameter}</span>:
                    <span class="parameter-value">"${violation.value}"</span>
                    <div class="violation-message">${violation.message}</div>
                </div>
                
                <div class="violation-actions">
                    ${violation.status === 'unresolved' ? `
                        <button class="btn btn-primary btn-small" 
                                onclick="allowViolation('${violation.id}', '${groupId}')">
                            Allow Value
                        </button>
                        <button class="btn btn-secondary btn-small" 
                                onclick="ignoreViolation('${violation.id}', '${groupId}')">
                            Ignore
                        </button>
                    ` : `
                        <span class="violation-status">${violation.status}</span>
                    `}
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function generateGroupId() {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function extractCampaignName(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('utm_campaign') || null;
    } catch {
        return null;
    }
}

function mapViolationType(rule) {
    switch (rule) {
        case 'allowed_values':
            return 'VALUE_NOT_ALLOWED';
        case 'casing':
            return 'CASE_SENSITIVITY';
        case 'conditional':
            return 'CONDITIONAL_VIOLATION';
        default:
            return 'UNKNOWN';
    }
}

function generateHumanReadableMessage(reason) {
    switch (reason.rule) {
        case 'allowed_values':
            return `This value is not in the allowed list. Add it to approve this parameter value.`;
        case 'casing':
            if (reason.expected === 'lowercase') {
                return 'Contains uppercase characters. Parameter is configured for lowercase only.';
            } else if (reason.expected === 'uppercase') {
                return 'Contains lowercase characters. Parameter is configured for uppercase only.';
            }
            return 'Case sensitivity violation.';
        case 'conditional':
            return `Conditional rule violation. This value is not allowed when ${reason.anchorParameter} = "${reason.anchorValue}".`;
        default:
            return reason.actual || 'Unknown violation type.';
    }
}

function calculateGroupSeverity(violations) {
    const hasConditional = violations.some(v => v.violationType === 'CONDITIONAL_VIOLATION');
    const hasMultiple = violations.length > 2;
    
    if (hasConditional || hasMultiple) {
        return 'high';
    } else if (violations.length > 1) {
        return 'medium';
    } else {
        return 'low';
    }
}

// Group selection functions
function toggleGroupSelection(groupId) {
    if (selectedGroups.has(groupId)) {
        selectedGroups.delete(groupId);
    } else {
        selectedGroups.add(groupId);
    }
    
    updateGroupSelectionUI(groupId);
    updateBulkActionsVisibility();
    updateSelectAllState();
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllGroups');
    const shouldSelectAll = selectAllCheckbox.checked;
    
    if (shouldSelectAll) {
        groupedConflictsData.forEach(group => selectedGroups.add(group.id));
    } else {
        selectedGroups.clear();
    }
    
    // Update all checkboxes
    document.querySelectorAll('.group-checkbox').forEach(checkbox => {
        checkbox.checked = shouldSelectAll;
    });
    
    updateBulkActionsVisibility();
}

function updateGroupSelectionUI(groupId) {
    const checkbox = document.querySelector(`[data-group-id="${groupId}"]`);
    if (checkbox) {
        checkbox.checked = selectedGroups.has(groupId);
    }
    
    const groupElement = document.querySelector(`[data-group-id="${groupId}"]`).closest('.conflict-group');
    if (groupElement) {
        groupElement.classList.toggle('selected', selectedGroups.has(groupId));
    }
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAllGroups');
    if (!selectAllCheckbox) return;
    
    const totalGroups = groupedConflictsData.length;
    const selectedCount = selectedGroups.size;
    
    if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedCount === totalGroups) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// Group expansion functions
function toggleGroupExpansion(groupId) {
    if (expandedGroups.has(groupId)) {
        expandedGroups.delete(groupId);
    } else {
        expandedGroups.add(groupId);
    }
    
    // Re-render to show/hide violations
    applyFilters();
}

// Bulk actions
function updateBulkActionsVisibility() {
    const bulkActions = document.getElementById('bulkActions');
    const selectionCount = document.getElementById('selectionCount');
    
    if (selectedGroups.size > 0) {
        showBulkActions();
        if (selectionCount) {
            selectionCount.textContent = `${selectedGroups.size} group${selectedGroups.size !== 1 ? 's' : ''} selected`;
        }
    } else {
        hideBulkActions();
    }
}

function showBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) {
        bulkActions.style.display = 'flex';
    }
}

function hideBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) {
        bulkActions.style.display = 'none';
    }
}

// Filter chips
function updateFilterChips() {
    activeFilterChips = [];
    
    if (currentFilters.violationType !== 'all') {
        activeFilterChips.push({
            key: 'violationType',
            label: `Type: ${currentFilters.violationType}`,
            value: currentFilters.violationType
        });
    }
    
    if (currentFilters.timeRange !== 'all') {
        activeFilterChips.push({
            key: 'timeRange',
            label: `Time: ${currentFilters.timeRange}`,
            value: currentFilters.timeRange
        });
    }
    
    if (currentFilters.status !== 'all') {
        activeFilterChips.push({
            key: 'status',
            label: `Status: ${currentFilters.status}`,
            value: currentFilters.status
        });
    }
    
    renderFilterChips();
}

function renderFilterChips() {
    const container = document.getElementById('activeFilterChips');
    if (!container) return;
    
    if (activeFilterChips.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="filter-chips">
            ${activeFilterChips.map(chip => `
                <div class="filter-chip">
                    <span>${chip.label}</span>
                    <button onclick="removeFilterChip('${chip.key}')" class="chip-remove">×</button>
                </div>
            `).join('')}
            <button onclick="clearAllFilters()" class="clear-all-filters">Clear all</button>
        </div>
    `;
}

function removeFilterChip(filterKey) {
    currentFilters[filterKey] = 'all';
    
    // Update UI
    const filterElement = document.getElementById(filterKey + 'Filter');
    if (filterElement) {
        filterElement.value = 'all';
    }
    
    updateFilterChips();
    applyFilters();
}

function clearAllFilters() {
    currentFilters = {
        search: '',
        violationType: 'all',
        timeRange: 'all',
        status: 'all'
    };
    
    // Reset UI
    const searchInput = document.getElementById('conflictSearchInput');
    if (searchInput) searchInput.value = '';
    
    document.querySelectorAll('.filter-select').forEach(select => {
        select.value = 'all';
    });
    
    updateFilterChips();
    applyFilters();
}

// Action functions (allow/ignore violations)
async function allowViolation(violationId, groupId) {
    try {
        const group = groupedConflictsData.find(g => g.id === groupId);
        const violation = group?.violations.find(v => v.id === violationId);
        
        if (!violation) {
            console.error('Violation not found:', violationId);
            return;
        }
        
        showStatus(`Adding "${violation.value}" to allowed values...`, 'loading');
        
        // Add to allowed values
        if (!allowedValuesData[violation.parameter]) {
            allowedValuesData[violation.parameter] = [];
        }
        
        if (!allowedValuesData[violation.parameter].includes(violation.value)) {
            allowedValuesData[violation.parameter].push(violation.value);
            await autoSaveConfiguration();
            
            violation.status = 'allowed';
            showStatus(`Added "${violation.value}" to allowed values for "${violation.parameter}"`, 'success');
            
            // Re-render the group
            applyFilters();
            calculateStats();
        }
        
    } catch (error) {
        console.error('Error allowing violation:', error);
        showStatus('Failed to allow violation: ' + error.message, 'error');
    }
}

async function ignoreViolation(violationId, groupId) {
    try {
        const group = groupedConflictsData.find(g => g.id === groupId);
        const violation = group?.violations.find(v => v.id === violationId);
        
        if (!violation) {
            console.error('Violation not found:', violationId);
            return;
        }
        
        violation.status = 'ignored';
        showStatus(`Ignored violation for "${violation.parameter}"`, 'success');
        
        // Re-render the group
        applyFilters();
        calculateStats();
        
    } catch (error) {
        console.error('Error ignoring violation:', error);
        showStatus('Failed to ignore violation: ' + error.message, 'error');
    }
}

// Bulk operations for groups
async function allowAllGroupViolations(groupId) {
    try {
        const group = groupedConflictsData.find(g => g.id === groupId);
        if (!group) return;
        
        const unresolvedViolations = group.violations.filter(v => v.status === 'unresolved');
        if (unresolvedViolations.length === 0) return;
        
        showStatus(`Adding ${unresolvedViolations.length} values to allowed lists...`, 'loading');
        
        for (const violation of unresolvedViolations) {
            if (!allowedValuesData[violation.parameter]) {
                allowedValuesData[violation.parameter] = [];
            }
            
            if (!allowedValuesData[violation.parameter].includes(violation.value)) {
                allowedValuesData[violation.parameter].push(violation.value);
            }
            
            violation.status = 'allowed';
        }
        
        await autoSaveConfiguration();
        showStatus(`Added ${unresolvedViolations.length} values to allowed lists`, 'success');
        
        applyFilters();
        calculateStats();
        
    } catch (error) {
        console.error('Error allowing group violations:', error);
        showStatus('Failed to allow group violations: ' + error.message, 'error');
    }
}

async function ignoreAllGroupViolations(groupId) {
    try {
        const group = groupedConflictsData.find(g => g.id === groupId);
        if (!group) return;
        
        const unresolvedViolations = group.violations.filter(v => v.status === 'unresolved');
        unresolvedViolations.forEach(violation => {
            violation.status = 'ignored';
        });
        
        showStatus(`Ignored ${unresolvedViolations.length} violations`, 'success');
        
        applyFilters();
        calculateStats();
        
    } catch (error) {
        console.error('Error ignoring group violations:', error);
        showStatus('Failed to ignore group violations: ' + error.message, 'error');
    }
}

// Bulk operations for selected groups
async function bulkAllowSelected() {
    try {
        const selectedGroupIds = Array.from(selectedGroups);
        let totalProcessed = 0;
        
        showStatus(`Processing ${selectedGroupIds.length} groups...`, 'loading');
        
        for (const groupId of selectedGroupIds) {
            const group = groupedConflictsData.find(g => g.id === groupId);
            if (!group) continue;
            
            const unresolvedViolations = group.violations.filter(v => v.status === 'unresolved');
            
            for (const violation of unresolvedViolations) {
                if (!allowedValuesData[violation.parameter]) {
                    allowedValuesData[violation.parameter] = [];
                }
                
                if (!allowedValuesData[violation.parameter].includes(violation.value)) {
                    allowedValuesData[violation.parameter].push(violation.value);
                }
                
                violation.status = 'allowed';
                totalProcessed++;
            }
        }
        
        await autoSaveConfiguration();
        
        selectedGroups.clear();
        showStatus(`Processed ${totalProcessed} violations across ${selectedGroupIds.length} groups`, 'success');
        
        applyFilters();
        calculateStats();
        updateBulkActionsVisibility();
        
    } catch (error) {
        console.error('Error in bulk allow:', error);
        showStatus('Failed to process bulk allow: ' + error.message, 'error');
    }
}

async function bulkIgnoreSelected() {
    try {
        const selectedGroupIds = Array.from(selectedGroups);
        let totalProcessed = 0;
        
        for (const groupId of selectedGroupIds) {
            const group = groupedConflictsData.find(g => g.id === groupId);
            if (!group) continue;
            
            const unresolvedViolations = group.violations.filter(v => v.status === 'unresolved');
            unresolvedViolations.forEach(violation => {
                violation.status = 'ignored';
                totalProcessed++;
            });
        }
        
        selectedGroups.clear();
        showStatus(`Ignored ${totalProcessed} violations across ${selectedGroupIds.length} groups`, 'success');
        
        applyFilters();
        calculateStats();
        updateBulkActionsVisibility();
        
    } catch (error) {
        console.error('Error in bulk ignore:', error);
        showStatus('Failed to process bulk ignore: ' + error.message, 'error');
    }
}

// Quick filter presets
function applyQuickFilter(preset) {
    switch (preset) {
        case 'unresolved':
            currentFilters.status = 'unresolved';
            break;
        case 'last24h':
            currentFilters.timeRange = 'last24h';
            break;
        case 'highPriority':
            // Filter for high severity groups
            break;
    }
    
    updateFilterUI();
    updateFilterChips();
    applyFilters();
}

// Refresh conflicts
function refreshConflicts() {
    console.log('Refreshing conflicts...');
    selectedGroups.clear();
    expandedGroups.clear();
    loadConflicts();
}

// Export functions to global scope
window.initializeConflictLog = initializeConflictLog;
window.loadConflicts = loadConflicts;
window.refreshConflicts = refreshConflicts;
window.toggleGroupSelection = toggleGroupSelection;
window.toggleSelectAll = toggleSelectAll;
window.toggleGroupExpansion = toggleGroupExpansion;
window.allowViolation = allowViolation;
window.ignoreViolation = ignoreViolation;
window.allowAllGroupViolations = allowAllGroupViolations;
window.ignoreAllGroupViolations = ignoreAllGroupViolations;
window.bulkAllowSelected = bulkAllowSelected;
window.bulkIgnoreSelected = bulkIgnoreSelected;
window.removeFilterChip = removeFilterChip;
window.clearAllFilters = clearAllFilters;
window.applyQuickFilter = applyQuickFilter;

console.log('Redesigned Conflict Log module loaded and functions exported globally');