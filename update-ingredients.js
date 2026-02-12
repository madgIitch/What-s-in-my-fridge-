const fs = require('fs');

const jsonPath = 'C:/Users/peorr/Desktop/What-s-in-my-fridge-/whats-in-my-fridge-backend/data/normalized-ingredients.json';

// Read the JSON file
const content = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(content);

// Update oil
data.oil.synonyms = ['oil', 'oils', 'aceite', 'aceites', 'öl', 'huile', 'olio'];

// Update broth
data.broth.synonyms = ['broth', 'broths', 'caldo', 'caldos', 'brühe', 'bouillon', 'consomé'];

// Update olive
data.olive.synonyms = ['olive', 'olives', 'aceituna', 'aceitunas', 'oliva', 'oliven'];

// Update orange
data.orange.synonyms = ['orange', 'oranges', 'naranja', 'naranjas', 'orange', 'orangen', 'arancia'];

// Update whiskey
data.whiskey.synonyms = ['whiskey', 'whisky', 'güisqui', 'bourbon', 'whiskey irlandés', 'scotch'];

// Update scallops
data.scallops.synonyms = ['scallops', 'scallop', 'vieira', 'veiras', 'coquille', 'kammuschel'];

// Update fish broth
data['fish broth'].synonyms = ['fish broth', 'fish stock', 'caldo de pescado', 'caldo de pez', 'fischbrühe', 'fumet de poisson'];

// Update sesame oil
data['sesame oil'].synonyms = ['sesame oil', 'aceite de sésamo', 'aceite de ajonjolí', 'sésamöl', 'huile de sésame', 'olio di sesamo'];

// Save
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Updated successfully');
