const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

/**
 * Cloud Run function for Eventarc Firestore trigger
 */
exports.validateUtmEvent = async (req, res) => {
  console.log('🚀 Function triggered via Eventarc HTTP');
  console.log('📅 Function started at:', new Date().toISOString());
  
  try {
    // Extract CloudEvent properties from headers
    const cloudEvent = {
      type: req.get('ce-type'),
      source: req.get('ce-source'), 
      subject: req.get('ce-subject'),
      time: req.get('ce-time'),
      id: req.get('ce-id'),
      document: req.get('ce-document'),
      datacontenttype: req.get('ce-datacontenttype') || req.get('content-type')
    };

    console.log('📦 CloudEvent extracted:', JSON.stringify(cloudEvent, null, 2));

    // Get document path from ce-document header
    const documentPath = cloudEvent.document;
    if (!documentPath) {
      console.log('❌ No document path found in ce-document header');
      return res.status(200).json({ status: 'success', message: 'No document path found' });
    }

    console.log('📄 Document path:', documentPath);

    // Extract API key from path
    const pathParts = documentPath.split('/');
    if (pathParts.length < 2 || pathParts[0] !== 'organizations') {
      console.log('❌ Invalid document path format');
      return res.status(200).json({ status: 'success', message: 'Invalid document path format' });
    }

    const apiKey = pathParts[1];
    console.log('🔑 API Key:', apiKey);

    // Fetch the document directly from Firestore
    console.log('🔍 Fetching document from Firestore...');
    const docRef = firestore.doc(documentPath);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      console.log('❌ Document does not exist');
      return res.status(200).json({ status: 'success', message: 'Document not found' });
    }

    const documentData = docSnapshot.data();
    console.log('✅ Document fetched successfully');
    console.log('📋 Document keys:', Object.keys(documentData || {}));

    // Check for UTM parameters
    if (!documentData.utmParameters) {
      console.log('❌ No UTM parameters found in document');
      console.log('📋 Available fields:', Object.keys(documentData));
      return res.status(200).json({ 
        status: 'success', 
        message: 'No UTM parameters found',
        availableFields: Object.keys(documentData)
      });
    }

    console.log('🎯 UTM parameters found:', documentData.utmParameters);

    // Fetch validation rules
    console.log('📚 Fetching validation rules...');
    const configRef = firestore.collection(`organizations/${apiKey}/configuration`);
    
    const [casingRulesDoc, allowedValuesDoc] = await Promise.all([
      configRef.doc('casing_rules').get(),
      configRef.doc('allowed_values').get()
    ]);

    const casingRules = casingRulesDoc.exists ? casingRulesDoc.data() : {};
    const allowedValues = allowedValuesDoc.exists ? allowedValuesDoc.data() : {};
    
    console.log('📏 Casing rules loaded:', casingRulesDoc.exists ? 'Yes' : 'No');
    console.log('📝 Allowed values loaded:', allowedValuesDoc.exists ? 'Yes' : 'No');
    console.log('📏 Casing rules:', JSON.stringify(casingRules, null, 2));
    console.log('📝 Allowed values:', JSON.stringify(allowedValues, null, 2));

    // Check if we have any rules at all
    const hasCasingRules = Object.keys(casingRules).length > 0;
    const hasAllowedValues = Object.keys(allowedValues).length > 0;
    
    if (!hasCasingRules && !hasAllowedValues) {
      console.log('⚠️ No validation rules configured - no conflicts will be found');
      return res.status(200).json({ 
        status: 'success', 
        conflicts: 0,
        message: 'No validation rules configured',
        utmParameters: documentData.utmParameters
      });
    }

    // Validate UTM parameters
    console.log('🔍 Starting validation...');
    const conflicts = validateUtmParameters(documentData.utmParameters, casingRules, allowedValues);
    
    console.log(`✅ Validation complete. Found ${conflicts.length} conflicts`);
    
    if (conflicts.length > 0) {
      console.log('⚠️ Conflicts found:', JSON.stringify(conflicts, null, 2));
      
      // Store conflicts
      const conflictData = {
        originalEventData: {
          url: documentData.url,
          timestamp: documentData.timestamp || new Date().toISOString(),
          utmParameters: documentData.utmParameters
        },
        conflictReasons: conflicts,
        validationTimestamp: new Date().toISOString(),
        status: 'new',
        documentPath: documentPath,
        eventType: cloudEvent.type
      };
      
      const conflictRef = await firestore
        .collection(`organizations/${apiKey}/conflicts`)
        .add(conflictData);
      
      console.log(`💾 Conflict stored with ID: ${conflictRef.id}`);
      
      return res.status(200).json({ 
        status: 'success', 
        conflicts: conflicts.length,
        conflictId: conflictRef.id,
        message: 'Conflicts found and stored'
      });
    } else {
      console.log('✅ No conflicts found - all UTM parameters are valid');
      return res.status(200).json({ 
        status: 'success', 
        conflicts: 0,
        message: 'No conflicts found'
      });
    }

  } catch (error) {
    console.error('❌ Function error:', error.message);
    console.error('📋 Error stack:', error.stack);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};

/**
 * Validate UTM parameters against rules
 */
function validateUtmParameters(utmParameters, casingRules, allowedValues) {
  const conflicts = [];
  
  console.log('🔍 Validating parameters:', Object.keys(utmParameters));
  
  Object.entries(utmParameters).forEach(([parameter, value]) => {
    if (!value) {
      console.log(`⏭️ Skipping empty parameter: ${parameter}`);
      return;
    }

    const stringValue = String(value).trim();
    console.log(`🔍 Validating ${parameter}: "${stringValue}"`);

    // Check casing rules
    if (casingRules[parameter]) {
      const expectedCasing = casingRules[parameter];
      console.log(`📏 Checking casing rule for ${parameter}: expected ${expectedCasing}`);
      
      if (expectedCasing === 'lowercase' && stringValue !== stringValue.toLowerCase()) {
        const conflict = {
          parameter,
          value: stringValue,
          rule: 'casing',
          expected: 'lowercase',
          actual: 'contains uppercase characters',
          severity: 'warning'
        };
        conflicts.push(conflict);
        console.log(`❌ Casing conflict found:`, conflict);
      } else if (expectedCasing === 'uppercase' && stringValue !== stringValue.toUpperCase()) {
        const conflict = {
          parameter,
          value: stringValue,
          rule: 'casing',
          expected: 'uppercase', 
          actual: 'contains lowercase characters',
          severity: 'warning'
        };
        conflicts.push(conflict);
        console.log(`❌ Casing conflict found:`, conflict);
      } else {
        console.log(`✅ Casing rule passed for ${parameter}`);
      }
    }

    // Check allowed values
    if (allowedValues[parameter] && Array.isArray(allowedValues[parameter])) {
      console.log(`📝 Checking allowed values for ${parameter}:`, allowedValues[parameter]);
      
      if (!allowedValues[parameter].includes(stringValue)) {
        const conflict = {
          parameter,
          value: stringValue,
          rule: 'allowed_values',
          expected: allowedValues[parameter],
          actual: `"${stringValue}" is not in allowed list`,
          severity: 'error'
        };
        conflicts.push(conflict);
        console.log(`❌ Allowed values conflict found:`, conflict);
      } else {
        console.log(`✅ Allowed values rule passed for ${parameter}`);
      }
    }
  });

  return conflicts;
}