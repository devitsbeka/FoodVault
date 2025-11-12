import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChefHat, Refrigerator, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  {
    icon: Refrigerator,
    title: "Track Your Kitchen",
    description: "Keep tabs on what's in your fridge and pantry. Never forget about expiring ingredients again.",
  },
  {
    icon: ChefHat,
    title: "Discover Perfect Recipes",
    description: "Find recipes that match what you have on hand. Filter by diet, allergies, and calories.",
  },
  {
    icon: Users,
    title: "Plan Meals Together",
    description: "Collaborate with your family. Vote on meals and let everyone have a say in what's for dinner.",
  },
  {
    icon: Sparkles,
    title: "AI Cooking Assistant",
    description: "Get personalized recipe suggestions and cooking tips from your AI kitchen companion.",
  },
];

export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const skip = () => {
    onComplete();
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mb-8">
            <Icon className="w-16 h-16 text-primary" />
          </div>

          <h2 className="text-title-1 font-semibold mb-4">{slide.title}</h2>
          <p className="text-muted-foreground text-base leading-relaxed mb-12">
            {slide.description}
          </p>

          {/* Pagination Dots */}
          <div className="flex gap-2 mb-12">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentSlide
                    ? "bg-primary w-8"
                    : "bg-muted-foreground/30"
                )}
                data-testid={`dot-${index}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-3">
            <Button 
              onClick={nextSlide}
              size="lg"
              className="w-full"
              data-testid="button-continue"
            >
              {currentSlide === slides.length - 1 ? "Get Started" : "Continue"}
            </Button>
            
            {currentSlide < slides.length - 1 && (
              <Button 
                variant="ghost" 
                onClick={skip}
                data-testid="button-skip"
              >
                Skip
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
