import { db } from "./db";
import { pollQuestions } from "@shared/schema";

async function seedPolls() {
  console.log("🌱 Seeding poll questions...");

  const polls = [
    {
      question: "How do you like your eggs?",
      category: "breakfast_preferences" as const,
      options: [
        { value: "scrambled", label: "Scrambled", relatedTags: ["breakfast", "eggs", "protein"] },
        { value: "fried", label: "Fried", relatedTags: ["breakfast", "eggs", "protein"] },
        { value: "poached", label: "Poached", relatedTags: ["breakfast", "eggs", "protein"] },
        { value: "boiled", label: "Boiled", relatedTags: ["breakfast", "eggs", "protein"] },
      ],
      isActive: true,
    },
    {
      question: "Coffee or tea in the morning?",
      category: "breakfast_preferences" as const,
      options: [
        { value: "coffee", label: "Coffee", relatedTags: ["breakfast", "hot-beverage", "caffeine"] },
        { value: "tea", label: "Tea", relatedTags: ["breakfast", "hot-beverage", "caffeine"] },
        { value: "both", label: "Both", relatedTags: ["breakfast", "hot-beverage", "caffeine"] },
        { value: "neither", label: "Neither", relatedTags: ["breakfast"] },
      ],
      isActive: true,
    },
    {
      question: "Sweet or savory breakfast?",
      category: "breakfast_preferences" as const,
      options: [
        { value: "sweet", label: "Sweet", relatedTags: ["breakfast", "sweet", "dessert"] },
        { value: "savory", label: "Savory", relatedTags: ["breakfast", "savory"] },
        { value: "both", label: "Both", relatedTags: ["breakfast"] },
        { value: "skip", label: "Skip breakfast", relatedTags: [] },
      ],
      isActive: true,
    },
    {
      question: "How do you take your coffee?",
      category: "breakfast_preferences" as const,
      options: [
        { value: "black", label: "Black", relatedTags: ["coffee", "breakfast"] },
        { value: "cream", label: "With cream", relatedTags: ["coffee", "breakfast", "dairy"] },
        { value: "sugar", label: "With sugar", relatedTags: ["coffee", "breakfast", "sweet"] },
        { value: "latte", label: "Latte/Cappuccino", relatedTags: ["coffee", "breakfast", "dairy"] },
      ],
      isActive: true,
    },
    {
      question: "Preferred protein for dinner?",
      category: "protein_types" as const,
      options: [
        { value: "chicken", label: "Chicken", relatedTags: ["protein", "meat", "poultry"] },
        { value: "beef", label: "Beef", relatedTags: ["protein", "meat", "red-meat"] },
        { value: "fish", label: "Fish", relatedTags: ["protein", "seafood"] },
        { value: "vegetarian", label: "Vegetarian", relatedTags: ["protein", "plant-based"] },
      ],
      isActive: true,
    },
    {
      question: "How do you like your steak?",
      category: "protein_types" as const,
      options: [
        { value: "rare", label: "Rare", relatedTags: ["beef", "steak", "red-meat"] },
        { value: "medium-rare", label: "Medium-rare", relatedTags: ["beef", "steak", "red-meat"] },
        { value: "medium", label: "Medium", relatedTags: ["beef", "steak", "red-meat"] },
        { value: "well-done", label: "Well-done", relatedTags: ["beef", "steak", "red-meat"] },
      ],
      isActive: true,
    },
    {
      question: "How spicy do you like your food?",
      category: "spice_levels" as const,
      options: [
        { value: "mild", label: "Mild", relatedTags: ["spice", "mild"] },
        { value: "medium", label: "Medium", relatedTags: ["spice", "medium"] },
        { value: "hot", label: "Hot", relatedTags: ["spice", "hot"] },
        { value: "extra-hot", label: "Extra Hot", relatedTags: ["spice", "extra-hot"] },
      ],
      isActive: true,
    },
    {
      question: "Which cuisine do you crave most?",
      category: "cuisine_styles" as const,
      options: [
        { value: "italian", label: "Italian", relatedTags: ["italian", "pasta", "mediterranean"] },
        { value: "mexican", label: "Mexican", relatedTags: ["mexican", "spicy", "latin"] },
        { value: "asian", label: "Asian", relatedTags: ["asian", "chinese", "japanese", "thai"] },
        { value: "mediterranean", label: "Mediterranean", relatedTags: ["mediterranean", "healthy"] },
      ],
      isActive: true,
    },
    {
      question: "What's your favorite pasta shape?",
      category: "cuisine_styles" as const,
      options: [
        { value: "spaghetti", label: "Spaghetti", relatedTags: ["pasta", "italian", "long-pasta"] },
        { value: "penne", label: "Penne", relatedTags: ["pasta", "italian", "short-pasta"] },
        { value: "fusilli", label: "Fusilli", relatedTags: ["pasta", "italian", "short-pasta"] },
        { value: "rigatoni", label: "Rigatoni", relatedTags: ["pasta", "italian", "short-pasta"] },
      ],
      isActive: true,
    },
    {
      question: "Preferred cooking method?",
      category: "cooking_methods" as const,
      options: [
        { value: "baking", label: "Baking", relatedTags: ["cooking", "oven", "dry-heat"] },
        { value: "grilling", label: "Grilling", relatedTags: ["cooking", "outdoor", "charred"] },
        { value: "stir-frying", label: "Stir-frying", relatedTags: ["cooking", "asian", "quick"] },
        { value: "slow-cooking", label: "Slow cooking", relatedTags: ["cooking", "tender", "easy"] },
      ],
      isActive: true,
    },
    {
      question: "Rice or potatoes with dinner?",
      category: "meal_times" as const,
      options: [
        { value: "rice", label: "Rice", relatedTags: ["side-dish", "grain", "asian"] },
        { value: "potatoes", label: "Potatoes", relatedTags: ["side-dish", "starch", "comfort"] },
        { value: "both", label: "Both", relatedTags: ["side-dish"] },
        { value: "neither", label: "Neither", relatedTags: [] },
      ],
      isActive: true,
    },
    {
      question: "Favorite type of cheese?",
      category: "texture_preferences" as const,
      options: [
        { value: "cheddar", label: "Cheddar", relatedTags: ["cheese", "dairy", "sharp"] },
        { value: "mozzarella", label: "Mozzarella", relatedTags: ["cheese", "dairy", "mild", "stretchy"] },
        { value: "parmesan", label: "Parmesan", relatedTags: ["cheese", "dairy", "hard", "italian"] },
        { value: "blue-cheese", label: "Blue cheese", relatedTags: ["cheese", "dairy", "strong", "pungent"] },
      ],
      isActive: true,
    },
    {
      question: "What's your go-to snack?",
      category: "meal_times" as const,
      options: [
        { value: "chips", label: "Chips", relatedTags: ["snack", "salty", "crunchy"] },
        { value: "fruit", label: "Fruit", relatedTags: ["snack", "sweet", "healthy"] },
        { value: "nuts", label: "Nuts", relatedTags: ["snack", "protein", "healthy"] },
        { value: "candy", label: "Candy", relatedTags: ["snack", "sweet", "dessert"] },
      ],
      isActive: true,
    },
    {
      question: "Preferred salad dressing?",
      category: "texture_preferences" as const,
      options: [
        { value: "ranch", label: "Ranch", relatedTags: ["salad", "creamy", "dairy"] },
        { value: "caesar", label: "Caesar", relatedTags: ["salad", "creamy", "savory"] },
        { value: "vinaigrette", label: "Vinaigrette", relatedTags: ["salad", "tangy", "light"] },
        { value: "oil-vinegar", label: "Oil & Vinegar", relatedTags: ["salad", "simple", "light"] },
      ],
      isActive: true,
    },
    {
      question: "Do you prefer smooth or chunky textures?",
      category: "texture_preferences" as const,
      options: [
        { value: "smooth", label: "Smooth", relatedTags: ["texture", "creamy"] },
        { value: "chunky", label: "Chunky", relatedTags: ["texture", "hearty"] },
        { value: "both", label: "Both", relatedTags: ["texture"] },
        { value: "neither", label: "Neither", relatedTags: [] },
      ],
      isActive: true,
    },
    {
      question: "Vegetarian, vegan, or omnivore?",
      category: "dietary_choices" as const,
      options: [
        { value: "vegetarian", label: "Vegetarian", relatedTags: ["diet", "vegetarian", "plant-based"] },
        { value: "vegan", label: "Vegan", relatedTags: ["diet", "vegan", "plant-based"] },
        { value: "omnivore", label: "Omnivore", relatedTags: ["diet", "meat", "balanced"] },
        { value: "flexitarian", label: "Flexitarian", relatedTags: ["diet", "flexible", "balanced"] },
      ],
      isActive: true,
    },
  ];

  try {
    // Delete existing polls and insert fresh ones for clean reseed
    await db.delete(pollQuestions);
    await db.insert(pollQuestions).values(polls);
    console.log(`✅ Successfully seeded ${polls.length} poll questions`);
  } catch (error) {
    console.error("❌ Error seeding polls:", error);
    throw error;
  }
}

seedPolls()
  .then(() => {
    console.log("✅ Poll seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Poll seeding failed:", error);
    process.exit(1);
  });
