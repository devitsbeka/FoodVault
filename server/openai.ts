// Blueprint reference: javascript_openai_ai_integrations
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export async function getChatCompletion(messages: Array<{ role: string; content: string }>) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: messages as any,
      max_completion_tokens: 8192,
    });
    return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

export interface ProductRecommendation {
  name: string;
  brand: string;
  price: string;
  imageUrl: string;
  features: string[];
  rating: number;
  description: string;
}

export async function getProductRecommendations(
  itemType: string,
  itemName: string
): Promise<ProductRecommendation[]> {
  try {
    const prompt = `You are a kitchen equipment expert. Recommend the 5 best ${itemName} products available in 2025.

For each product, provide:
- name: Full product name
- brand: Manufacturer name
- price: Typical retail price range (e.g., "$200-250")
- imageUrl: A placeholder image URL (use https://images.unsplash.com/photo-[relevant-id]?w=400&h=400&fit=crop)
- features: Array of 3-5 key features/benefits
- rating: Average rating out of 5 (e.g., 4.5)
- description: 1-2 sentence description

Focus on popular, well-reviewed products from reputable brands. Be realistic with pricing and ratings.

Return ONLY a valid JSON object with this exact structure:
{
  "products": [
    { "name": "...", "brand": "...", "price": "...", "imageUrl": "...", "features": [...], "rating": 4.5, "description": "..." }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const products = parsed.products;
    
    if (!products || !Array.isArray(products)) {
      console.error("Invalid OpenAI response format:", parsed);
      throw new Error("Invalid response format from OpenAI - expected products array");
    }

    return products.slice(0, 5);
  } catch (error) {
    console.error("Error getting product recommendations:", error);
    throw error;
  }
}

export async function getProductImageUrl(
  itemName: string,
  brand?: string,
  model?: string
): Promise<string | null> {
  try {
    const productQuery = brand && model
      ? `${brand} ${model} ${itemName}`
      : brand
      ? `${brand} ${itemName}`
      : itemName;

    const prompt = `Find a high-quality product image URL for: ${productQuery}

Return ONLY a JSON object with a single field "imageUrl" containing a valid Unsplash image URL in the format:
https://images.unsplash.com/photo-[id]?w=400&h=400&fit=crop

Choose an image that best represents this specific product or similar products.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return parsed.imageUrl || null;
  } catch (error) {
    console.error("Error getting product image:", error);
    return null;
  }
}
