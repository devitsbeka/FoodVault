import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Pause, Play, CheckCircle, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe, CookingSession } from "@shared/schema";

export default function CookingMode() {
  const [, params] = useRoute("/cooking/:recipeId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const recipeId = params?.recipeId;

  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const { data: recipe, isLoading: recipeLoading } = useQuery<Recipe>({
    queryKey: ["/api/recipes", recipeId],
    enabled: !!recipeId,
  });

  const { data: activeSession } = useQuery<CookingSession | null>({
    queryKey: ["/api/cooking-sessions/active"],
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/cooking-sessions`, { recipeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cooking-sessions/active"] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: { currentStep?: number; status?: string; timers?: any[] }) => {
      if (!activeSession?.id) return;
      return await apiRequest("PUT", `/api/cooking-sessions/${activeSession.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cooking-sessions/active"] });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (deductIngredients: boolean) => {
      if (!activeSession?.id) return;
      return await apiRequest("POST", `/api/cooking-sessions/${activeSession.id}/complete`, { deductIngredients });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cooking-sessions/active"] });
      toast({
        title: "Cooking completed!",
        description: "Great job! Your meal is ready.",
      });
      setLocation(`/recipes/${recipeId}`);
    },
  });

  useEffect(() => {
    if (recipe && !activeSession && !startSessionMutation.isPending) {
      startSessionMutation.mutate();
    }
  }, [recipe, activeSession]);

  useEffect(() => {
    if (activeSession) {
      setCurrentStep(activeSession.currentStep || 0);
      setIsPaused(activeSession.status === 'paused');
    }
  }, [activeSession]);

  const steps = recipe?.instructions || [];
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateSessionMutation.mutate({ currentStep: nextStep });
    } else {
      setShowCompletionModal(true);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateSessionMutation.mutate({ currentStep: prevStep });
    }
  };

  const handlePauseResume = () => {
    const newStatus = isPaused ? 'active' : 'paused';
    setIsPaused(!isPaused);
    updateSessionMutation.mutate({ status: newStatus });
  };

  const handleExit = () => {
    if (activeSession?.id) {
      updateSessionMutation.mutate({ status: 'abandoned' });
    }
    setLocation(`/recipes/${recipeId}`);
  };

  const handleComplete = (deductIngredients: boolean) => {
    completeSessionMutation.mutate(deductIngredients);
    setShowCompletionModal(false);
  };

  if (recipeLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl">Loading recipe...</div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl">Recipe not found</div>
          <Button onClick={() => setLocation("/recipes")} className="mt-4">
            Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  if (totalSteps === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl">No instructions available for this recipe</div>
          <Button onClick={() => setLocation(`/recipes/${recipeId}`)} className="mt-4">
            Back to Recipe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExit}
              data-testid="button-exit-cooking"
            >
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-recipe-name">
                {recipe.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handlePauseResume}
            data-testid="button-pause-resume"
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            )}
          </Button>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-bar" />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-semibold">Step {currentStep + 1}</span>
              </div>
              <p 
                className="text-3xl leading-relaxed"
                data-testid={`step-instruction-${currentStep}`}
              >
                {steps[currentStep]}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePreviousStep}
            disabled={currentStep === 0}
            data-testid="button-previous-step"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Previous
          </Button>
          <Button
            size="lg"
            onClick={handleNextStep}
            data-testid="button-next-step"
          >
            {currentStep === totalSteps - 1 ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent data-testid="dialog-completion">
          <DialogHeader>
            <DialogTitle>Cooking Complete!</DialogTitle>
            <DialogDescription>
              Congratulations on completing {recipe.name}! Would you like to automatically deduct the ingredients from your kitchen inventory?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleComplete(false)}
              data-testid="button-complete-no-deduct"
            >
              No, Keep Inventory
            </Button>
            <Button
              onClick={() => handleComplete(true)}
              data-testid="button-complete-deduct"
            >
              Yes, Deduct Ingredients
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
