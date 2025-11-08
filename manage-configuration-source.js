const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

/**
 * HTTP API for managing UTM validation configuration
 * Handles CRUD operations for monitored parameters, casing rules, allowed values, and conditional rules
 * Runtime: Node.js 22
 */
exports.manageConfiguration = async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  console.log(`Configuration API called: ${req.method} ${req.path}`);
  console.log('Request body:', req.body);
  console.log('Query params:', req.query);

  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Missing API key. Provide via ?apiKey=xxx or x-api-key header' 
      });
    }

    console.log('Processing request for API key:', apiKey);

    // Route to appropriate handler based on HTTP method and path
    if (req.method === 'GET') {
      return await handleGetConfiguration(req, res, apiKey);
    } else if (req.method === 'POST' || req.method === 'PUT') {
      return await handleUpdateConfiguration(req, res, apiKey);
    } else if (req.method === 'DELETE') {
      return await handleDeleteConfiguration(req, res, apiKey);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Configuration API error:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Extract API key from query parameter or header
 */
function extractApiKey(req) {
  return req.query.apiKey || req.get('x-api-key') || req.get('authorization')?.replace('Bearer ', '');
}

/**
 * Handle GET requests - retrieve configuration
 */
async function handleGetConfiguration(req, res, apiKey) {
  console.log('Fetching configuration for API key:', apiKey);
  
  const configRef = firestore.collection(`organizations/${apiKey}/configuration`);
  
  try {
    const [casingRulesDoc, allowedValuesDoc, monitoredParametersDoc, conditionalRulesDoc] = await Promise.all([
      configRef.doc('casing_rules').get(),
      configRef.doc('allowed_values').get(),
      configRef.doc('monitored_parameters').get(),
      configRef.doc('conditional_rules').get()
    ]);

    const configuration = {
      casingRules: casingRulesDoc.exists ? casingRulesDoc.data() : {},
      allowedValues: allowedValuesDoc.exists ? allowedValuesDoc.data() : {},
      monitoredParameters: monitoredParametersDoc.exists ? monitoredParametersDoc.data() : {
        utm_source: { active: true, created: new Date().toISOString() },
        utm_medium: { active: true, created: new Date().toISOString() },
        utm_campaign: { active: true, created: new Date().toISOString() }
      },
      conditionalRules: conditionalRulesDoc.exists ? conditionalRulesDoc.data().rules || [] : [],
      lastUpdated: new Date().toISOString(),
      apiKey: apiKey
    };

    console.log('Configuration retrieved successfully');
    return res.status(200).json(configuration);

  } catch (error) {
    console.error('Error fetching configuration:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch configuration',
      message: error.message 
    });
  }
}

/**
 * Handle POST/PUT requests - update configuration
 */
async function handleUpdateConfiguration(req, res, apiKey) {
  console.log('Updating configuration for API key:', apiKey);
  
  const { casingRules, allowedValues, monitoredParameters, conditionalRules } = req.body;
  
  // Validate request body
  if (!casingRules && !allowedValues && !monitoredParameters && !conditionalRules) {
    return res.status(400).json({ 
      error: 'Request must include at least one of: casingRules, allowedValues, monitoredParameters, conditionalRules' 
    });
  }

  // Validate monitored parameters format
  if (monitoredParameters && !validateMonitoredParameters(monitoredParameters)) {
    return res.status(400).json({ 
      error: 'Invalid monitoredParameters format. Expected: { paramName: { active: boolean, created: string } }' 
    });
  }

  // Validate casing rules format
  if (casingRules && !validateCasingRules(casingRules)) {
    return res.status(400).json({ 
      error: 'Invalid casingRules format. Expected: { paramName: "lowercase" | "uppercase" }' 
    });
  }

  // Validate allowed values format
  if (allowedValues && !validateAllowedValues(allowedValues)) {
    return res.status(400).json({ 
      error: 'Invalid allowedValues format. Expected: { paramName: [string, string, ...] }' 
    });
  }

  // Validate conditional rules format
  if (conditionalRules && !validateConditionalRules(conditionalRules)) {
    return res.status(400).json({ 
      error: 'Invalid conditionalRules format. Expected: array of rule objects' 
    });
  }

  const configRef = firestore.collection(`organizations/${apiKey}/configuration`);
  
  try {
    const updatePromises = [];
    
    if (casingRules !== undefined) {
      // Filter casing rules to only include active parameters
      const activeCasingRules = filterRulesForActiveParameters(casingRules, monitoredParameters);
      updatePromises.push(configRef.doc('casing_rules').set(activeCasingRules));
      console.log('Updating casing rules:', activeCasingRules);
    }
    
    if (allowedValues !== undefined) {
      // Filter allowed values to only include active parameters
      const activeAllowedValues = filterRulesForActiveParameters(allowedValues, monitoredParameters);
      updatePromises.push(configRef.doc('allowed_values').set(activeAllowedValues));
      console.log('Updating allowed values:', activeAllowedValues);
    }
    
    if (monitoredParameters !== undefined) {
      updatePromises.push(configRef.doc('monitored_parameters').set(monitoredParameters));
      console.log('Updating monitored parameters:', monitoredParameters);
    }

    if (conditionalRules !== undefined) {
      // Store conditional rules as an object with metadata
      const conditionalRulesData = {
        rules: conditionalRules,
        lastUpdated: new Date().toISOString(),
        count: conditionalRules.length
      };
      updatePromises.push(configRef.doc('conditional_rules').set(conditionalRulesData));
      console.log('Updating conditional rules:', conditionalRulesData);
    }

    await Promise.all(updatePromises);

    console.log('Configuration updated successfully');
    return res.status(200).json({ 
      message: 'Configuration updated successfully',
      updatedAt: new Date().toISOString(),
      apiKey: apiKey
    });

  } catch (error) {
    console.error('Error updating configuration:', error.message);
    return res.status(500).json({ 
      error: 'Failed to update configuration',
      message: error.message 
    });
  }
}

/**
 * Handle DELETE requests - remove configuration
 */
async function handleDeleteConfiguration(req, res, apiKey) {
  console.log('Deleting configuration for API key:', apiKey);
  
  const { type } = req.query; // ?type=casingRules|allowedValues|monitoredParameters|conditionalRules|all
  
  if (!type) {
    return res.status(400).json({ 
      error: 'Delete type required. Use ?type=casingRules|allowedValues|monitoredParameters|conditionalRules|all' 
    });
  }

  const configRef = firestore.collection(`organizations/${apiKey}/configuration`);
  
  try {
    const deletePromises = [];
    
    if (type === 'all') {
      deletePromises.push(
        configRef.doc('casing_rules').delete(),
        configRef.doc('allowed_values').delete(),
        configRef.doc('monitored_parameters').delete(),
        configRef.doc('conditional_rules').delete()
      );
    } else if (type === 'casingRules') {
      deletePromises.push(configRef.doc('casing_rules').delete());
    } else if (type === 'allowedValues') {
      deletePromises.push(configRef.doc('allowed_values').delete());
    } else if (type === 'monitoredParameters') {
      deletePromises.push(configRef.doc('monitored_parameters').delete());
    } else if (type === 'conditionalRules') {
      deletePromises.push(configRef.doc('conditional_rules').delete());
    } else {
      return res.status(400).json({ 
        error: 'Invalid delete type. Use: casingRules, allowedValues, monitoredParameters, conditionalRules, or all' 
      });
    }

    await Promise.all(deletePromises);

    console.log(`Configuration ${type} deleted successfully`);
    return res.status(200).json({ 
      message: `Configuration ${type} deleted successfully`,
      deletedAt: new Date().toISOString(),
      apiKey: apiKey
    });

  } catch (error) {
    console.error('Error deleting configuration:', error.message);
    return res.status(500).json({ 
      error: 'Failed to delete configuration',
      message: error.message 
    });
  }
}

/**
 * Filter rules to only include active parameters OR draft parameters
 */
function filterRulesForActiveParameters(rules, monitoredParameters) {
  if (!monitoredParameters) return rules;
  
  const filteredRules = {};
  Object.entries(rules).forEach(([param, rule]) => {
    // Include rules for active parameters OR draft parameters
    if (monitoredParameters[param]?.active === true || monitoredParameters[param]?.status === 'draft') {
      filteredRules[param] = rule;
    }
  });
  return filteredRules;
}

/**
 * Validation functions
 */
function validateMonitoredParameters(params) {
  if (typeof params !== 'object' || params === null) return false;
  
  return Object.values(params).every(config => 
    typeof config === 'object' && 
    typeof config.active === 'boolean' &&
    typeof config.created === 'string'
  );
}

function validateCasingRules(rules) {
  if (typeof rules !== 'object' || rules === null) return false;
  
  return Object.values(rules).every(rule => 
    rule === 'lowercase' || rule === 'uppercase'
  );
}

function validateAllowedValues(values) {
  if (typeof values !== 'object' || values === null) return false;
  
  return Object.values(values).every(valueArray =>
    Array.isArray(valueArray) && 
    valueArray.every(item => typeof item === 'string')
  );
}

function validateConditionalRules(rules) {
  if (!Array.isArray(rules)) return false;
  
  return rules.every(rule => 
    typeof rule === 'object' &&
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    typeof rule.anchor === 'object' &&
    typeof rule.anchor.parameter === 'string' &&
    typeof rule.anchor.value === 'string' &&
    typeof rule.conditionals === 'object' &&
    typeof rule.created === 'string' &&
    typeof rule.active === 'boolean'
  );
}