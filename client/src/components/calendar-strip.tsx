import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, addDays, isSameDay, startOfDay } from "date-fns";

interface CalendarStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  mealPlanDates?: Date[];
  nutritionLogDates?: Date[];
  cookingLessonDates?: Date[];
  className?: string;
}

export function CalendarStrip({
  selectedDate,
  onDateSelect,
  mealPlanDates = [],
  nutritionLogDates = [],
  cookingLessonDates = [],
  className,
}: CalendarStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const today = startOfDay(new Date());
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i - 7));

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      container.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const selectedIndex = dates.findIndex((date) => isSameDay(date, selectedDate));
    if (selectedIndex === -1) return;

    const dateElement = container.children[selectedIndex] as HTMLElement;
    if (!dateElement) return;

    const containerWidth = container.clientWidth;
    const elementLeft = dateElement.offsetLeft;
    const elementWidth = dateElement.offsetWidth;

    container.scrollTo({
      left: elementLeft - containerWidth / 2 + elementWidth / 2,
      behavior: "smooth",
    });
  }, [selectedDate]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const hasIndicator = (date: Date, type: "meal" | "nutrition" | "lesson") => {
    const checkDates = 
      type === "meal" ? mealPlanDates :
      type === "nutrition" ? nutritionLogDates :
      cookingLessonDates;

    return checkDates.some((d) => isSameDay(d, date));
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className="shrink-0"
          data-testid="button-scroll-left"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {dates.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const hasMeal = hasIndicator(date, "meal");
            const hasNutrition = hasIndicator(date, "nutrition");
            const hasLesson = hasIndicator(date, "lesson");

            return (
              <button
                key={index}
                onClick={() => onDateSelect(date)}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[60px] px-3 py-2 rounded-lg transition-all",
                  "hover-elevate active-elevate-2",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card",
                  isToday && !isSelected && "border-2 border-primary"
                )}
                data-testid={`calendar-date-${format(date, "yyyy-MM-dd")}`}
              >
                <span className="text-xs font-medium mb-1">
                  {format(date, "EEE")}
                </span>
                <span className="text-lg font-bold mb-2">
                  {format(date, "d")}
                </span>
                
                <div className="flex gap-1">
                  {hasMeal && (
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-blue-500"
                      data-testid={`indicator-meal-${format(date, "yyyy-MM-dd")}`}
                    />
                  )}
                  {hasNutrition && (
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-green-500"
                      data-testid={`indicator-nutrition-${format(date, "yyyy-MM-dd")}`}
                    />
                  )}
                  {hasLesson && (
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-orange-500"
                      data-testid={`indicator-lesson-${format(date, "yyyy-MM-dd")}`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className="shrink-0"
          data-testid="button-scroll-right"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
