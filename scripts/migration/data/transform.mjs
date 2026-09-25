const requiredText = (value, code) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
};
const timestamp = (value, code) => {
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (value === null || value === undefined || !Number.isFinite(date.getTime())) throw new Error(code);
  return date.toISOString();
};
const date = (value, code) => timestamp(value, code).slice(0, 10);
const amount = (value, code) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
};
const currency = value => {
  const result = value || 'EUR';
  if (typeof result !== 'string' || !/^[A-Z]{3}$/.test(result)) throw new Error('INVALID_CURRENCY');
  return result;
};
const array = (value, code) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch { /* quarantine below */ }
  }
  throw new Error(code);
};

export function transform(record, userId) {
  const data = record.data;
  const base = { user_id: userId, source: 'FIREBASE', legacy_id: record.path };
  switch (record.collection) {
    case 'inventory':
      return { table: 'inventory_items', row: {
        ...base, name: requiredText(data.name, 'INVALID_NAME'), normalized_name: data.normalizedName || null,
        expiry_date: timestamp(data.expiryDate, 'INVALID_EXPIRY_DATE'), category: data.category || null,
        quantity: amount(data.quantity, 'INVALID_QUANTITY'), notes: data.notes || null,
        unit: requiredText(data.unit, 'INVALID_UNIT'), added_at: timestamp(data.addedAt, 'INVALID_ADDED_AT'),
      } };
    case 'drafts':
      return { table: 'receipt_drafts', row: {
        ...base, raw_text: requiredText(data.rawText, 'INVALID_RAW_TEXT'), captured_at: timestamp(data.timestamp, 'INVALID_CAPTURED_AT'),
        merchant: data.merchant || null, purchase_date: data.purchaseDate ? date(data.purchaseDate, 'INVALID_PURCHASE_DATE') : null,
        currency: currency(data.currency), total: data.total == null ? null : amount(data.total, 'INVALID_TOTAL'),
        lines: array(data.linesJson, 'INVALID_LINES'), unrecognized_lines: array(data.unrecognizedLines, 'INVALID_UNRECOGNIZED_LINES'),
        confirmed: data.confirmed === true,
      } };
    case 'savedRecipes': {
      const matchPercentage = amount(data.matchPercentage, 'INVALID_MATCH_PERCENTAGE');
      if (matchPercentage > 100) throw new Error('INVALID_MATCH_PERCENTAGE');
      return { table: 'favorite_recipes', row: {
        ...base, recipe_id: record.path.split('/').at(-1), name: requiredText(data.name, 'INVALID_NAME'),
        match_percentage: matchPercentage,
        matched_ingredients: array(data.matchedIngredients, 'INVALID_MATCHED_INGREDIENTS'),
        missing_ingredients: array(data.missingIngredients, 'INVALID_MISSING_INGREDIENTS'),
        ingredients_with_measures: array(data.ingredientsWithMeasures, 'INVALID_INGREDIENTS_WITH_MEASURES'),
        instructions: typeof data.instructions === 'string' ? data.instructions : '', saved_at: timestamp(data.savedAt, 'INVALID_SAVED_AT'),
      } };
    }
    case 'meal_entries': {
      const mealType = requiredText(data.mealType, 'INVALID_MEAL_TYPE');
      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) throw new Error('INVALID_MEAL_TYPE');
      if (!data.recipeId && !data.customName) throw new Error('MISSING_MEAL_REFERENCE');
      return { table: 'meal_entries', row: {
        ...base, meal_type: mealType, meal_date: date(data.mealDate, 'INVALID_MEAL_DATE'),
        recipe_id: data.recipeId || null, custom_name: data.customName || null,
        ingredients_consumed: array(data.ingredientsConsumed, 'INVALID_INGREDIENTS_CONSUMED'),
        notes: data.notes || null, calories_estimate: data.caloriesEstimate == null ? null : amount(data.caloriesEstimate, 'INVALID_CALORIES'),
        consumed_at: timestamp(data.consumedAt, 'INVALID_CONSUMED_AT'),
      } };
    }
    default: throw new Error('MAPPING_NOT_IMPLEMENTED');
  }
}
