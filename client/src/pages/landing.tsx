import { Button } from "@/components/ui/button";
import { ChefHat, Smartphone, Users, Sparkles } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-accent/50 text-accent-foreground px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>Smart Kitchen Management</span>
          </div>
          
          <h1 className="text-large-title sm:text-[3.5rem] font-bold text-foreground mb-6 leading-tight">
            Your Kitchen,
            <br />
            Smarter Than Ever
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Manage your ingredients, discover perfect recipes, plan meals with your family, 
            and get AI-powered cooking suggestions—all with an elegant, intuitive interface.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="min-h-12 px-8 text-base font-semibold"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="min-h-12 px-8 text-base font-semibold"
              data-testid="button-learn-more"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <ChefHat className="w-8 h-8" />
            </div>
            <h3 className="text-headline mb-3">Smart Recipe Discovery</h3>
            <p className="text-muted-foreground leading-relaxed">
              Find perfect recipes based on ingredients you have, dietary preferences, and calorie goals.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <Smartphone className="w-8 h-8" />
            </div>
            <h3 className="text-headline mb-3">Kitchen Inventory</h3>
            <p className="text-muted-foreground leading-relaxed">
              Track what's in your fridge and pantry. Get alerts before ingredients expire.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-headline mb-3">Family Meal Planning</h3>
            <p className="text-muted-foreground leading-relaxed">
              Collaborate with family members and vote on meals together for the week ahead.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-muted/30 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-title-1 font-semibold mb-4">Ready to transform your kitchen?</h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of families already managing their meals smarter.
          </p>
          <Button 
            size="lg" 
            className="min-h-12 px-8"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-get-started"
          >
            Start Free Today
          </Button>
        </div>
      </div>
    </div>
  );
}
