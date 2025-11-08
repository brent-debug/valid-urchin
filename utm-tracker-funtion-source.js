const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

exports.utmTracker = async (req, res) => {
// Set CORS headers for preflight requests
res.set('Access-Control-Allow-Origin', '*');
res.set('Access-Control-Allow-Methods', 'POST');
res.set('Access-Control-Allow-Headers', 'Content-Type');
res.set('Access-Control-Max-Age', '3600');

if (req.method === 'OPTIONS') {
// End preflight request successfully
res.status(204).send('');
return;
}

if (req.method !== 'POST') {
res.status(405).send('Method Not Allowed');
return;
}


const { apiKey, url, timestamp, utmParameters } = req.body;

if (!apiKey || !utmParameters) {
res.status(400).send('Bad Request: Missing apiKey or utmParameters.');
return;
}

try {
// Use the apiKey to create a unique collection for each client
const collectionPath = `organizations/${apiKey}/utm_events`;
await firestore.collection(collectionPath).add({
url,
timestamp,
utmParameters,
receivedAt: new Date().toISOString()
});
res.status(200).send('Data received.');
} catch (error) {
console.error('Error writing to Firestore:', error);
res.status(500).send('Internal Server Error.');
}
};