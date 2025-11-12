import { db } from "./db";
import { recipes, users, families, familyMembers } from "@shared/schema";

const sampleRecipes = [
  {
    name: "Classic Spaghetti Carbonara",
    description: "A traditional Italian pasta dish with eggs, cheese, pancetta, and black pepper",
    imageUrl: null,
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    calories: 520,
    dietType: null,
    ingredients: JSON.stringify([
      { name: "Spaghetti", amount: "1", unit: "lb" },
      { name: "Pancetta", amount: "6", unit: "oz" },
      { name: "Eggs", amount: "4", unit: "large" },
      { name: "Parmesan cheese", amount: "1", unit: "cup" },
      { name: "Black pepper", amount: "2", unit: "tsp" },
    ]),
    instructions: [
      "Cook spaghetti in salted boiling water until al dente",
      "Meanwhile, cook pancetta in a large pan until crispy",
      "Beat eggs with grated Parmesan and black pepper",
      "Drain pasta and add to pan with pancetta",
      "Remove from heat and quickly stir in egg mixture",
      "Serve immediately with extra Parmesan",
    ],
    tags: ["Italian", "Pasta", "Quick"],
  },
  {
    name: "Grilled Chicken Salad",
    description: "Healthy and delicious salad with grilled chicken breast, mixed greens, and vinaigrette",
    imageUrl: null,
    prepTime: 15,
    cookTime: 15,
    servings: 2,
    calories: 340,
    dietType: "keto",
    ingredients: JSON.stringify([
      { name: "Chicken breast", amount: "2", unit: "pieces" },
      { name: "Mixed greens", amount: "4", unit: "cups" },
      { name: "Cherry tomatoes", amount: "1", unit: "cup" },
      { name: "Cucumber", amount: "1", unit: "medium" },
      { name: "Olive oil", amount: "3", unit: "tbsp" },
      { name: "Lemon juice", amount: "2", unit: "tbsp" },
    ]),
    instructions: [
      "Season chicken breasts with salt and pepper",
      "Grill chicken for 6-7 minutes per side until cooked through",
      "Let chicken rest for 5 minutes, then slice",
      "Mix greens, tomatoes, and cucumber in a large bowl",
      "Whisk together olive oil and lemon juice for dressing",
      "Top salad with sliced chicken and drizzle with dressing",
    ],
    tags: ["Healthy", "Low-carb", "Salad"],
  },
  {
    name: "Vegetarian Buddha Bowl",
    description: "Nutritious bowl with quinoa, roasted vegetables, chickpeas, and tahini dressing",
    imageUrl: null,
    prepTime: 20,
    cookTime: 30,
    servings: 2,
    calories: 450,
    dietType: "vegetarian",
    ingredients: JSON.stringify([
      { name: "Quinoa", amount: "1", unit: "cup" },
      { name: "Sweet potato", amount: "1", unit: "large" },
      { name: "Chickpeas", amount: "1", unit: "can" },
      { name: "Kale", amount: "2", unit: "cups" },
      { name: "Tahini", amount: "3", unit: "tbsp" },
      { name: "Avocado", amount: "1", unit: "medium" },
    ]),
    instructions: [
      "Cook quinoa according to package instructions",
      "Dice sweet potato and roast at 400°F for 25 minutes",
      "Drain and rinse chickpeas, pat dry and roast with spices",
      "Massage kale with a bit of olive oil and lemon",
      "Make tahini dressing by mixing tahini with water and lemon",
      "Assemble bowls with quinoa, vegetables, chickpeas, and dressing",
    ],
    tags: ["Vegetarian", "Healthy", "Bowl"],
  },
  {
    name: "Tacos al Pastor",
    description: "Mexican-style tacos with marinated pork, pineapple, and fresh cilantro",
    imageUrl: null,
    prepTime: 30,
    cookTime: 20,
    servings: 4,
    calories: 380,
    dietType: null,
    ingredients: JSON.stringify([
      { name: "Pork shoulder", amount: "2", unit: "lbs" },
      { name: "Pineapple", amount: "1", unit: "fresh" },
      { name: "Corn tortillas", amount: "12", unit: "small" },
      { name: "Cilantro", amount: "1", unit: "bunch" },
      { name: "Onion", amount: "1", unit: "medium" },
      { name: "Lime", amount: "2", unit: "medium" },
    ]),
    instructions: [
      "Marinate pork in adobo sauce for at least 2 hours",
      "Grill or pan-fry pork until caramelized and cooked through",
      "Grill pineapple slices until charred",
      "Warm tortillas on a griddle",
      "Slice pork and pineapple into small pieces",
      "Assemble tacos with pork, pineapple, onion, and cilantro",
      "Serve with lime wedges",
    ],
    tags: ["Mexican", "Tacos", "Pork"],
  },
  {
    name: "Mediterranean Quinoa Bowl",
    description: "Fresh and flavorful bowl with quinoa, feta, olives, cucumber, and lemon dressing",
    imageUrl: null,
    prepTime: 15,
    cookTime: 15,
    servings: 3,
    calories: 420,
    dietType: "vegetarian",
    ingredients: JSON.stringify([
      { name: "Quinoa", amount: "1.5", unit: "cups" },
      { name: "Feta cheese", amount: "1", unit: "cup" },
      { name: "Kalamata olives", amount: "0.5", unit: "cup" },
      { name: "Cucumber", amount: "1", unit: "large" },
      { name: "Cherry tomatoes", amount: "1", unit: "cup" },
      { name: "Red onion", amount: "0.5", unit: "medium" },
    ]),
    instructions: [
      "Cook quinoa and let cool",
      "Dice cucumber, halve tomatoes, and slice onion",
      "Crumble feta cheese",
      "Mix all ingredients in a large bowl",
      "Whisk together lemon juice, olive oil, and oregano",
      "Toss with dressing and serve chilled",
    ],
    tags: ["Mediterranean", "Vegetarian", "Bowl"],
  },
  {
    name: "Creamy Tomato Soup",
    description: "Rich and comforting tomato soup with a touch of cream and fresh basil",
    imageUrl: null,
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    calories: 180,
    dietType: "vegetarian",
    ingredients: JSON.stringify([
      { name: "Tomatoes", amount: "2", unit: "lbs" },
      { name: "Onion", amount: "1", unit: "medium" },
      { name: "Garlic", amount: "4", unit: "cloves" },
      { name: "Vegetable broth", amount: "2", unit: "cups" },
      { name: "Heavy cream", amount: "0.5", unit: "cup" },
      { name: "Fresh basil", amount: "0.25", unit: "cup" },
    ]),
    instructions: [
      "Sauté onion and garlic until softened",
      "Add tomatoes and cook until broken down",
      "Add vegetable broth and simmer for 15 minutes",
      "Blend until smooth using an immersion blender",
      "Stir in cream and fresh basil",
      "Season with salt and pepper, serve hot",
    ],
    tags: ["Soup", "Vegetarian", "Comfort Food"],
  },
];

async function seed() {
  console.log("Seeding database...");
  
  try {
    // Seed sample user and family members for kanchaveli.b@gmail.com
    console.log("\n📧 Creating sample users and family...");
    
    const sampleUsers = [
      {
        id: 'kanchaveli-b-gmail',
        email: 'kanchaveli.b@gmail.com',
        firstName: 'Kanchaveli',
        lastName: 'B',
      },
      {
        id: 'family-member-1',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        id: 'family-member-2',
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      },
      {
        id: 'family-member-3',
        email: 'alex.jones@example.com',
        firstName: 'Alex',
        lastName: 'Jones',
      },
    ];

    for (const user of sampleUsers) {
      await db.insert(users).values(user).onConflictDoNothing();
      console.log(`✓ Created user: ${user.firstName} ${user.lastName}`);
    }

    // Create family
    await db.insert(families).values({
      id: 'kanchaveli-family',
      name: 'B Family',
      createdById: 'kanchaveli-b-gmail',
      voteThreshold: 2,
    }).onConflictDoNothing();
    console.log("✓ Created family: B Family");

    // Add family members
    const familyMemberData = [
      { familyId: 'kanchaveli-family', userId: 'kanchaveli-b-gmail', role: 'admin' },
      { familyId: 'kanchaveli-family', userId: 'family-member-1', role: 'member' },
      { familyId: 'kanchaveli-family', userId: 'family-member-2', role: 'member' },
      { familyId: 'kanchaveli-family', userId: 'family-member-3', role: 'member' },
    ];

    for (const member of familyMemberData) {
      await db.insert(familyMembers).values(member).onConflictDoNothing();
      console.log(`✓ Added family member: ${member.userId}`);
    }

    // Seed sample recipes
    console.log("\n🍳 Creating sample recipes...");
    for (const recipe of sampleRecipes) {
      await db.insert(recipes).values(recipe).onConflictDoNothing();
      console.log(`✓ Added recipe: ${recipe.name}`);
    }
    
    console.log("\n✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seed();
