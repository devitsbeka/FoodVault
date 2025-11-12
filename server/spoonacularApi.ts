import memoizee from "memoizee";

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com/recipes";
const SPOONACULAR_FOOD_URL = "https://api.spoonacular.com/food/ingredients";

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image?: string;
  imageType?: string;
  readyInMinutes?: number;
  servings?: number;
  summary?: string;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  occasions?: string[];
  instructions?: string;
  analyzedInstructions?: Array<{
    name: string;
    steps: Array<{
      number: number;
      step: string;
    }>;
  }>;
  extendedIngredients?: Array<{
    id: number;
    aisle: string;
    image: string;
    name: string;
    amount: number;
    unit: string;
    original: string;
    originalName: string;
  }>;
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

export interface NormalizedRecipe {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number;
  calories: number | null;
  dietType: string | null;
  cuisine: string | null;
  mealType: string | null;
  ingredients: Array<{ name: string; amount: string; unit: string; imageUrl?: string }>;
  instructions: string[];
  tags: string[];
  averageRating: number | null;
  totalRatings: number;
  ratings: any[];
}

// Normalize Spoonacular recipe to our format
function normalizeSpoonacularRecipe(recipe: SpoonacularRecipe): NormalizedRecipe {
  // Extract ingredients with images
  const ingredients = (recipe.extendedIngredients || []).map(ing => ({
    name: ing.name || ing.originalName,
    amount: ing.amount?.toString() || '1',
    unit: ing.unit || '',
    imageUrl: ing.image ? `https://spoonacular.com/cdn/ingredients_100x100/${ing.image}` : undefined
  }));

  // Extract instructions
  let instructions: string[] = [];
  if (recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0) {
    instructions = recipe.analyzedInstructions[0].steps.map(step => step.step);
  } else if (recipe.instructions) {
    // Fallback to plain instructions if available
    instructions = recipe.instructions
      .split(/\r?\n/)
      .filter(line => line.trim().length > 0);
  }

  // Extract calories from nutrition
  let calories: number | null = null;
  if (recipe.nutrition?.nutrients) {
    const calorieNutrient = recipe.nutrition.nutrients.find(n => n.name === 'Calories');
    if (calorieNutrient) {
      calories = Math.round(calorieNutrient.amount);
    }
  }

  // Determine diet type
  let dietType: string | null = null;
  if (recipe.diets && recipe.diets.length > 0) {
    const primaryDiet = recipe.diets[0];
    if (primaryDiet === 'vegetarian') dietType = 'vegetarian';
    else if (primaryDiet === 'vegan') dietType = 'vegan';
    else if (primaryDiet === 'ketogenic') dietType = 'keto';
    else if (primaryDiet === 'paleo') dietType = 'paleo';
    else if (primaryDiet === 'gluten free') dietType = 'gluten-free';
  }

  // Detect cuisine from cuisines array
  let cuisine: string | null = null;
  if (recipe.cuisines && recipe.cuisines.length > 0) {
    const firstCuisine = recipe.cuisines[0].toLowerCase();
    // Map to our cuisine options
    if (firstCuisine.includes('italian')) cuisine = 'italian';
    else if (firstCuisine.includes('mexican')) cuisine = 'mexican';
    else if (firstCuisine.includes('chinese')) cuisine = 'chinese';
    else if (firstCuisine.includes('indian')) cuisine = 'indian';
    else if (firstCuisine.includes('japanese')) cuisine = 'japanese';
    else if (firstCuisine.includes('thai')) cuisine = 'thai';
    else if (firstCuisine.includes('french')) cuisine = 'french';
    else if (firstCuisine.includes('mediterranean') || firstCuisine.includes('greek')) cuisine = 'mediterranean';
    else if (firstCuisine.includes('american')) cuisine = 'american';
  }

  // Detect mealType from dishTypes
  let mealType: string | null = null;
  if (recipe.dishTypes && recipe.dishTypes.length > 0) {
    const dishTypesStr = recipe.dishTypes.join(' ').toLowerCase();
    if (dishTypesStr.includes('breakfast')) mealType = 'breakfast';
    else if (dishTypesStr.includes('main course') || dishTypesStr.includes('dinner')) mealType = 'dinner';
    else if (dishTypesStr.includes('lunch') || dishTypesStr.includes('salad') || dishTypesStr.includes('sandwich')) mealType = 'lunch';
    else if (dishTypesStr.includes('snack') || dishTypesStr.includes('appetizer')) mealType = 'snack';
  }

  // Generate tags
  const tags = [
    ...(recipe.cuisines || []),
    ...(recipe.dishTypes || []),
    ...(recipe.diets || [])
  ].slice(0, 5);

  // Create summary
  const summary = recipe.summary
    ? recipe.summary.replace(/<[^>]*>/g, '').slice(0, 200)
    : `${recipe.title} - Serves ${recipe.servings || 4}`;

  return {
    id: `spoon-${recipe.id}`,
    name: recipe.title,
    description: summary,
    imageUrl: recipe.image || null,
    prepTime: null,
    cookTime: recipe.readyInMinutes || null,
    servings: recipe.servings || 4,
    calories,
    dietType,
    cuisine,
    mealType,
    ingredients,
    instructions,
    tags,
    averageRating: null,
    totalRatings: 0,
    ratings: [],
  };
}

// Fetch recipes from Spoonacular API
async function fetchSpoonacularRecipes(params: {
  query?: string;
  cuisine?: string;
  type?: string; // breakfast, lunch, dinner, snack
  diet?: string;
  maxCalories?: number;
  number?: number;
  offset?: number;
  addRecipeInformation?: boolean;
  addRecipeNutrition?: boolean;
  fillIngredients?: boolean;
}): Promise<SpoonacularRecipe[]> {
  if (!SPOONACULAR_API_KEY) {
    throw new Error("SPOONACULAR_API_KEY environment variable is not set");
  }

  const queryParams = new URLSearchParams();
  queryParams.append('apiKey', SPOONACULAR_API_KEY);
  
  if (params.query) queryParams.append('query', params.query);
  if (params.cuisine) queryParams.append('cuisine', params.cuisine);
  if (params.type) queryParams.append('type', params.type);
  if (params.diet) queryParams.append('diet', params.diet);
  if (params.maxCalories) queryParams.append('maxCalories', params.maxCalories.toString());
  if (params.number) queryParams.append('number', params.number.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.addRecipeInformation) queryParams.append('addRecipeInformation', 'true');
  if (params.addRecipeNutrition) queryParams.append('addRecipeNutrition', 'true');
  if (params.fillIngredients) queryParams.append('fillIngredients', 'true');

  const url = `${SPOONACULAR_BASE_URL}/complexSearch?${queryParams.toString()}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

// Memoized version with 5 minute cache
const fetchSpoonacularRecipesMemoized = memoizee(fetchSpoonacularRecipes, {
  maxAge: 5 * 60 * 1000, // 5 minutes
  promise: true,
  normalizer: (args) => JSON.stringify(args[0]),
});

// Main search function
export async function searchSpoonacularRecipes(params: {
  searchQuery?: string;
  dietType?: string;
  cuisine?: string;
  mealType?: string;
  maxCalories?: number;
  limit?: number;
  offset?: number;
}): Promise<NormalizedRecipe[]> {
  const spoonacularParams: Parameters<typeof fetchSpoonacularRecipes>[0] = {
    number: params.limit || 15, // Default to 15 recipes to ensure we get 10+ results
    offset: params.offset || 0,
    addRecipeInformation: true,
    addRecipeNutrition: true,
    fillIngredients: true,
  };

  if (params.searchQuery) {
    spoonacularParams.query = params.searchQuery;
  }
  
  if (params.cuisine && params.cuisine !== 'all') {
    spoonacularParams.cuisine = params.cuisine;
  }
  
  if (params.mealType && params.mealType !== 'all') {
    // Map our meal types to Spoonacular's type parameter
    // Spoonacular supports: main course, side dish, dessert, appetizer, salad, bread, breakfast, soup, beverage, sauce, marinade, fingerfood, snack, drink
    const mealTypeMap: Record<string, string> = {
      'breakfast': 'breakfast',
      'lunch': 'main course',
      'dinner': 'main course',
      'snack': 'snack',
    };
    spoonacularParams.type = mealTypeMap[params.mealType] || params.mealType;
  }
  
  if (params.dietType && params.dietType !== 'all') {
    // Map our diet types to Spoonacular's
    const dietMap: Record<string, string> = {
      'vegetarian': 'vegetarian',
      'vegan': 'vegan',
      'keto': 'ketogenic',
      'paleo': 'paleo',
      'gluten-free': 'gluten free'
    };
    spoonacularParams.diet = dietMap[params.dietType] || params.dietType;
  }

  if (params.maxCalories) {
    spoonacularParams.maxCalories = params.maxCalories;
  }

  const recipes = await fetchSpoonacularRecipesMemoized(spoonacularParams);
  return recipes.map(normalizeSpoonacularRecipe);
}

// Get single recipe by ID
export async function getSpoonacularRecipeById(id: string): Promise<NormalizedRecipe | null> {
  if (!id.startsWith('spoon-')) {
    return null;
  }

  const spoonacularId = id.replace('spoon-', '');
  
  if (!SPOONACULAR_API_KEY) {
    return null;
  }

  try {
    const url = `${SPOONACULAR_BASE_URL}/${spoonacularId}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=true`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const recipe = await response.json();
    return normalizeSpoonacularRecipe(recipe);
  } catch (error) {
    console.error("Error fetching recipe from Spoonacular:", error);
    return null;
  }
}

interface IngredientAutocomplete {
  id: number;
  name: string;
  image: string;
}

export interface IngredientSuggestion {
  id: number;
  name: string;
  imageUrl: string | null;
}

// Get ingredient autocomplete suggestions
export async function getIngredientSuggestions(query: string): Promise<IngredientSuggestion[]> {
  if (!SPOONACULAR_API_KEY || !query) {
    return [];
  }

  try {
    const url = `${SPOONACULAR_FOOD_URL}/autocomplete?apiKey=${SPOONACULAR_API_KEY}&query=${encodeURIComponent(query)}&number=10&metaInformation=true`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Spoonacular API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const results: IngredientAutocomplete[] = await response.json();
    
    return results.map(item => ({
      id: item.id,
      name: item.name,
      imageUrl: item.image ? `https://spoonacular.com/cdn/ingredients_100x100/${item.image}` : null,
    }));
  } catch (error) {
    console.error("Error fetching ingredient suggestions from Spoonacular:", error);
    return [];
  }
}

// Memoized version with 5 minute cache
export const getIngredientSuggestionsMemoized = memoizee(getIngredientSuggestions, {
  maxAge: 5 * 60 * 1000, // 5 minutes
  promise: true,
});

// Get ingredient image from Spoonacular autocomplete
export async function getIngredientImage(ingredientName: string): Promise<string | null> {
  if (!SPOONACULAR_API_KEY || !ingredientName) {
    return null;
  }

  try {
    const url = `${SPOONACULAR_FOOD_URL}/autocomplete?apiKey=${SPOONACULAR_API_KEY}&query=${encodeURIComponent(ingredientName)}&number=1&metaInformation=true`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const results: IngredientAutocomplete[] = await response.json();
    
    if (results.length > 0 && results[0].image) {
      return `https://spoonacular.com/cdn/ingredients_100x100/${results[0].image}`;
    }

    return null;
  } catch (error) {
    console.error("Error fetching ingredient image from Spoonacular:", error);
    return null;
  }
}

// Memoized version with 24 hour cache (ingredient images don't change often)
export const getIngredientImageMemoized = memoizee(getIngredientImage, {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  promise: true,
});
