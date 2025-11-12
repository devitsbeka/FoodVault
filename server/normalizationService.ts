/**
 * Ingredient Normalization Service
 * 
 * Provides consistent ingredient name matching across:
 * - Recipe ingredients
 * - Kitchen inventory
 * - Shopping list items
 */

// Common ingredient aliases for better matching
const INGREDIENT_ALIASES: Record<string, string> = {
  // Vegetables
  "tomatoes": "tomato",
  "potatoes": "potato",
  "onions": "onion",
  "red onions": "red onion",  // Keep color for distinction
  "yellow onions": "yellow onion",
  "white onions": "white onion",
  "carrots": "carrot",
  "cucumbers": "cucumber",
  // Bell peppers (but NOT plain "pepper" which could be black pepper!)
  "bell peppers": "bell pepper",
  "green peppers": "bell pepper",
  "red peppers": "bell pepper",
  "yellow peppers": "bell pepper",
  "orange peppers": "bell pepper",
  "green pepper": "bell pepper",
  "red pepper": "bell pepper",
  
  // Fruits
  "apples": "apple",
  "bananas": "banana",
  "oranges": "orange",
  "berries": "berry",
  "strawberries": "strawberry",
  "blueberries": "blueberry",
  "raspberries": "raspberry",
  
  // Proteins
  "chicken breasts": "chicken breast",
  "chicken thighs": "chicken thigh",
  "ground beef": "beef",
  "pork chops": "pork chop",
  "eggs": "egg",
  
  // Dairy
  "cheeses": "cheese",
  "cheddar cheese": "cheddar",
  "mozzarella cheese": "mozzarella",
  
  // Grains
  "rices": "rice",
  "pastas": "pasta",
  "noodles": "noodle",
  "breads": "bread",
  
  // Herbs & Spices
  "garlic cloves": "garlic",
  "ginger root": "ginger",
  "basil leaves": "basil",
  "cilantro leaves": "cilantro",
  
  // Common variations
  "scallions": "green onion",
  "spring onions": "green onion",
  "roma tomatoes": "tomato",
  "cherry tomatoes": "tomato",
  "grape tomatoes": "tomato",
};

// Common measurement words and stopwords to strip
const MEASUREMENT_WORDS = new Set([
  // Units
  "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
  "pound", "pounds", "lb", "lbs", "ounce", "ounces", "oz", "gram", "grams", "g",
  "kilogram", "kilograms", "kg", "milliliter", "milliliters", "ml", "liter", "liters", "l",
  "pinch", "dash", "slice", "slices", "piece", "pieces", "can", "cans", "jar", "jars",
  "package", "packages", "pkg", "bunch", "bunches", "clove", "cloves", "head", "heads",
  "inch", "inches", "cm", "mm", "centimeter", "centimeters", "millimeter", "millimeters",
  // Spelled-out numbers
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "thirty", "forty", "fifty", "hundred", "thousand",
  // Fractions
  "half", "halves", "third", "thirds", "quarter", "quarters", "eighth", "eighths",
  // Preparation methods (safe to remove)
  "whole", "chopped", "diced", "sliced", "minced", "grated",
  "finely", "coarsely", "thinly", "thickly", "crushed", "shredded",
  "raw", "cooked", "roasted", "boiled", "steamed", "baked", "fried",
  // Size descriptors (generally safe to remove)
  "large", "medium", "small", "about", "approximately",
  // State descriptors (generally safe)
  "fresh", "frozen",
  // Stopwords
  "of", "a", "an", "the", "to", "and", "or", "with", "for"
]);

// Simple singularization rules
function singularize(word: string): string {
  // Handle common irregular plurals
  const irregulars: Record<string, string> = {
    "leaves": "leaf",
    "knives": "knife",
    "wives": "wife",
    "lives": "life",
    "loaves": "loaf",
    "shelves": "shelf",
    "thieves": "thief",
    "wolves": "wolf",
    "tomatoes": "tomato",
    "potatoes": "potato",
    "avocadoes": "avocado",
    "mangoes": "mango",
    "heroes": "hero",
    "echoes": "echo",
  };

  if (irregulars[word]) {
    return irregulars[word];
  }

  // Handle -oes endings (tomatoes, potatoes, etc.)
  if (word.endsWith("oes")) {
    return word.slice(0, -2);
  }

  // Basic pluralization rules
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("ves")) {
    return word.slice(0, -3) + "f";
  }
  if (word.endsWith("ses") || word.endsWith("shes") || word.endsWith("ches") || word.endsWith("xes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Normalize an ingredient name for consistent matching
 */
export function normalizeIngredientName(name: string): string {
  if (!name) return "";

  // Convert to lowercase and trim
  let normalized = name.toLowerCase().trim();

  // Remove punctuation and extra spaces
  normalized = normalized
    .replace(/[^\w\s]/g, " ")  // Replace punctuation with spaces
    .replace(/\s+/g, " ")       // Collapse multiple spaces
    .trim();

  // FIRST: Check for alias match on the full phrase (before filtering)
  // This handles cases like "green peppers" -> "bell pepper" before we strip "green"
  if (INGREDIENT_ALIASES[normalized]) {
    return INGREDIENT_ALIASES[normalized];
  }

  // Split into words
  let words = normalized.split(" ");

  // Filter out:
  // 1. All numeric tokens (handles "2", "1/2" split into "1" and "2", etc.)
  // 2. Measurement words and stopwords
  words = words.filter(word => {
    // Remove pure numbers
    if (/^\d+(\.\d+)?$/.test(word)) {
      return false;
    }
    // Remove measurement/stopwords
    if (MEASUREMENT_WORDS.has(word)) {
      return false;
    }
    return true;
  });

  // Rejoin after filtering and check for alias again
  normalized = words.join(" ").trim();
  if (normalized && INGREDIENT_ALIASES[normalized]) {
    return INGREDIENT_ALIASES[normalized];
  }

  // Try singularizing each word
  const singularized = words.map(word => singularize(word)).join(" ").trim();

  // Check singularized version for alias
  if (singularized && INGREDIENT_ALIASES[singularized]) {
    return INGREDIENT_ALIASES[singularized];
  }

  // Return singularized version as canonical (or empty string if nothing left)
  return singularized || normalized;
}

/**
 * Check if two ingredient names match after normalization
 */
export function ingredientsMatch(name1: string, name2: string): boolean {
  return normalizeIngredientName(name1) === normalizeIngredientName(name2);
}

/**
 * Find a matching item in inventory by normalized name
 */
export function findMatchingIngredient<T extends { name: string; normalizedName?: string | null }>(
  ingredientName: string,
  inventory: T[]
): T | undefined {
  const normalizedSearch = normalizeIngredientName(ingredientName);
  
  return inventory.find(item => {
    // First check if normalized name exists and matches
    if (item.normalizedName && item.normalizedName === normalizedSearch) {
      return true;
    }
    
    // Fallback to normalizing the name on the fly
    return normalizeIngredientName(item.name) === normalizedSearch;
  });
}

/**
 * Batch normalize multiple ingredient names
 */
export function normalizeIngredientList(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const name of names) {
    result[name] = normalizeIngredientName(name);
  }
  
  return result;
}
