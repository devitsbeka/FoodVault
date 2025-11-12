import memoizee from "memoizee";

const RECIPE_API_BASE_URL = "https://api.api-ninjas.com/v2/recipe";
const RECIPE_API_KEY = process.env.RECIPE_API_KEY;

export interface RecipeApiIngredient {
  name: string;
  amount?: string;
}

export interface RecipeApiResponse {
  title: string;
  ingredients: string[];
  servings: string;
  instructions: string;
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
  ingredients: Array<{ name: string; amount: string; unit: string }>;
  instructions: string[];
  tags: string[];
  averageRating: number | null;
  totalRatings: number;
  ratings: any[];
}

// Generate a stable ID from recipe title
function generateRecipeId(title: string): string {
  return `api-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

// Parse servings string (e.g., "6 servings" -> 6)
function parseServings(servingsStr: string): number {
  const match = servingsStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 4;
}

// Parse ingredient string into structured format
function parseIngredient(ingredientStr: string): { name: string; amount: string; unit: string } {
  // Simple parsing: split by first number or fraction
  const match = ingredientStr.match(/^([\d\/\s]+)?\s*([a-z]+)?\s*(.+)$/i);
  if (match) {
    const [, amount = '1', unit = '', name] = match;
    return {
      amount: amount.trim() || '1',
      unit: unit.trim(),
      name: (name || ingredientStr).trim()
    };
  }
  return {
    amount: '1',
    unit: '',
    name: ingredientStr.trim()
  };
}

// Detect diet type from ingredients
function detectDietType(ingredients: string[]): string | null {
  const ingredientText = ingredients.join(' ').toLowerCase();
  
  if (!ingredientText.includes('meat') && 
      !ingredientText.includes('chicken') && 
      !ingredientText.includes('beef') && 
      !ingredientText.includes('pork') && 
      !ingredientText.includes('fish') &&
      !ingredientText.includes('salmon')) {
    if (!ingredientText.includes('egg') && 
        !ingredientText.includes('cheese') && 
        !ingredientText.includes('milk') &&
        !ingredientText.includes('butter') &&
        !ingredientText.includes('yogurt')) {
      return 'vegan';
    }
    return 'vegetarian';
  }
  
  return null;
}

// Generate tags from recipe data
function generateTags(recipe: RecipeApiResponse): string[] {
  const tags: string[] = [];
  const title = recipe.title.toLowerCase();
  const ingredients = recipe.ingredients.join(' ').toLowerCase();
  
  // Meal type tags
  if (title.includes('breakfast') || ingredients.includes('egg')) tags.push('breakfast');
  if (title.includes('lunch') || title.includes('salad')) tags.push('lunch');
  if (title.includes('dinner') || title.includes('soup')) tags.push('dinner');
  if (title.includes('dessert') || ingredients.includes('sugar')) tags.push('dessert');
  
  // Cuisine tags
  if (title.includes('italian') || ingredients.includes('pasta')) tags.push('italian');
  if (title.includes('mexican') || ingredients.includes('tortilla')) tags.push('mexican');
  if (title.includes('asian') || ingredients.includes('soy sauce')) tags.push('asian');
  if (title.includes('indian') || ingredients.includes('curry')) tags.push('indian');
  
  // Speed tags
  const servings = parseServings(recipe.servings);
  if (servings <= 2) tags.push('quick');
  if (servings >= 6) tags.push('family-friendly');
  
  return tags;
}

// Normalize API recipe to our format
function normalizeRecipe(apiRecipe: RecipeApiResponse): NormalizedRecipe {
  const parsedIngredients = apiRecipe.ingredients.map(parseIngredient);
  const dietType = detectDietType(apiRecipe.ingredients);
  const tags = generateTags(apiRecipe);
  
  return {
    id: generateRecipeId(apiRecipe.title),
    name: apiRecipe.title,
    description: `${apiRecipe.title} - Serves ${parseServings(apiRecipe.servings)}`,
    imageUrl: null, // API doesn't provide images
    prepTime: null,
    cookTime: null,
    servings: parseServings(apiRecipe.servings),
    calories: null,
    dietType,
    ingredients: parsedIngredients,
    instructions: [apiRecipe.instructions],
    tags,
    averageRating: null,
    totalRatings: 0,
    ratings: [],
  };
}

// Fetch recipes from API
async function fetchRecipesFromApi(params: {
  title?: string;
  ingredients?: string;
}): Promise<RecipeApiResponse[]> {
  if (!RECIPE_API_KEY) {
    throw new Error("RECIPE_API_KEY environment variable is not set");
  }

  const queryParams = new URLSearchParams();
  if (params.title) queryParams.append('title', params.title);
  if (params.ingredients) queryParams.append('ingredients', params.ingredients);
  // Note: api-ninjas doesn't support limit/offset, returns fixed set

  const url = `${RECIPE_API_BASE_URL}?${queryParams.toString()}`;
  console.log('Calling api-ninjas with URL:', url);
  
  const response = await fetch(url, {
    headers: {
      'X-Api-Key': RECIPE_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('api-ninjas error response:', errorText);
    throw new Error(`Recipe API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Memoized version with 5 minute cache
const fetchRecipesFromApiMemoized = memoizee(fetchRecipesFromApi, {
  maxAge: 5 * 60 * 1000, // 5 minutes
  promise: true,
  normalizer: (args) => JSON.stringify(args[0]),
});

// Main search function
export async function searchRecipes(params: {
  searchQuery?: string;
  ingredients?: string[];
  dietType?: string;
  maxCalories?: number;
  limit?: number;
  offset?: number;
}): Promise<NormalizedRecipe[]> {
  const apiParams: Parameters<typeof fetchRecipesFromApi>[0] = {};

  // Search by title if query provided
  if (params.searchQuery) {
    apiParams.title = params.searchQuery;
  }
  // Search by ingredients if provided
  else if (params.ingredients && params.ingredients.length > 0) {
    apiParams.ingredients = params.ingredients.join(',');
  }
  // Default search for popular recipes
  else {
    apiParams.title = 'chicken';
  }

  const apiRecipes = await fetchRecipesFromApiMemoized(apiParams);
  let recipes = apiRecipes.map(normalizeRecipe);

  // Apply frontend filters (skip if "all")
  if (params.dietType && params.dietType !== 'all') {
    recipes = recipes.filter(r => r.dietType === params.dietType);
  }

  if (params.maxCalories && params.maxCalories > 0) {
    // Since API doesn't provide calories, we can't filter by it
    // In a real app, you'd need a different API or calculate calories
  }

  // Apply limit/offset on client side since API doesn't support it
  const offset = params.offset || 0;
  const limit = params.limit || 10;
  recipes = recipes.slice(offset, offset + limit);

  return recipes;
  }
}

// Get recipe by ID (reconstruct from search)
export async function getRecipeById(id: string): Promise<NormalizedRecipe | null> {
  try {
    // Extract title from ID
    const title = id.replace('api-', '').replace(/-/g, ' ');
    const apiParams = { title, limit: 1 };
    
    const apiRecipes = await fetchRecipesFromApiMemoized(apiParams);
    if (apiRecipes.length > 0) {
      return normalizeRecipe(apiRecipes[0]);
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching recipe by ID:", error);
    return null;
  }
}
