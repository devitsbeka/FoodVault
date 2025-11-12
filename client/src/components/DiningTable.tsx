import { useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Seat {
  seatNumber: number;
  position: { x: number; y: number };
  dietaryRestrictions: string[];
  recipeId?: string;
  recipeName?: string;
  recipeImage?: string;
}

interface DiningTableProps {
  seatCount: number; // 1-6
  seats: Seat[];
  onSeatClick: (seatNumber: number) => void;
  onAddRecipe: (seatNumber: number) => void;
}

// Calculate seat positions in a circular/oval layout (poker table style)
function calculateSeatPositions(count: number): { x: number; y: number }[] {
  const centerX = 400; // SVG viewBox center
  const centerY = 300;
  const radiusX = 280; // Horizontal radius (wider)
  const radiusY = 200; // Vertical radius (narrower)
  
  if (count === 1) {
    // Solo mode - center position
    return [{ x: centerX, y: centerY }];
  }
  
  const positions: { x: number; y: number }[] = [];
  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2; // Start at top
  
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (i * angleStep);
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    positions.push({ x, y });
  }
  
  return positions;
}

export function DiningTable({ seatCount, seats, onSeatClick, onAddRecipe }: DiningTableProps) {
  const seatPositions = calculateSeatPositions(seatCount);
  
  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <svg
        viewBox="0 0 800 600"
        className="w-full h-auto"
        style={{ minHeight: "500px" }}
      >
        {/* Dining table surface (oval) */}
        <ellipse
          cx="400"
          cy="300"
          rx="320"
          ry="220"
          className="fill-card stroke-border"
          strokeWidth="3"
        />
        
        {/* Table wood grain effect */}
        <ellipse
          cx="400"
          cy="300"
          rx="300"
          ry="200"
          className="fill-muted/20 stroke-muted-foreground/10"
          strokeWidth="1"
        />
        
        {/* Render seats/plates */}
        {seatPositions.map((pos, index) => {
          const seatNumber = index + 1;
          const seat = seats.find(s => s.seatNumber === seatNumber);
          
          return (
            <g key={seatNumber}>
              {/* Plate circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r="70"
                className="fill-background stroke-border cursor-pointer hover-elevate active-elevate-2 transition-all"
                strokeWidth="2"
                onClick={() => onSeatClick(seatNumber)}
                data-testid={`seat-plate-${seatNumber}`}
              />
              
              {/* Plate inner ring */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r="65"
                className="fill-none stroke-muted-foreground/20"
                strokeWidth="1"
              />
              
              {/* Content based on state */}
              {seat?.recipeId ? (
                // Recipe assigned - show recipe card
                <g>
                  {seat.recipeImage && (
                    <image
                      href={seat.recipeImage}
                      x={pos.x - 50}
                      y={pos.y - 50}
                      width="100"
                      height="100"
                      clipPath={`circle(45px at ${pos.x}px ${pos.y}px)`}
                    />
                  )}
                  <text
                    x={pos.x}
                    y={pos.y + 80}
                    textAnchor="middle"
                    className="fill-foreground text-sm font-medium"
                  >
                    {seat.recipeName}
                  </text>
                </g>
              ) : (
                // Empty state - show + icon
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddRecipe(seatNumber);
                  }}
                  className="cursor-pointer"
                  data-testid={`button-add-recipe-${seatNumber}`}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="30"
                    className="fill-muted hover:fill-muted-foreground/20 transition-colors"
                  />
                  <line
                    x1={pos.x}
                    y1={pos.y - 15}
                    x2={pos.x}
                    y2={pos.y + 15}
                    className="stroke-muted-foreground"
                    strokeWidth="3"
                  />
                  <line
                    x1={pos.x - 15}
                    y1={pos.y}
                    x2={pos.x + 15}
                    y2={pos.y}
                    className="stroke-muted-foreground"
                    strokeWidth="3"
                  />
                </g>
              )}
              
              {/* Seat number label */}
              <text
                x={pos.x}
                y={pos.y - 85}
                textAnchor="middle"
                className="fill-muted-foreground text-xs font-semibold"
              >
                Seat {seatNumber}
              </text>
              
              {/* Dietary restriction badges */}
              {seat && seat.dietaryRestrictions.length > 0 && (
                <foreignObject
                  x={pos.x - 60}
                  y={pos.y + 85}
                  width="120"
                  height="30"
                >
                  <div className="flex flex-wrap gap-1 justify-center">
                    {seat.dietaryRestrictions.map((restriction, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] px-1 py-0"
                      >
                        {restriction}
                      </Badge>
                    ))}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
