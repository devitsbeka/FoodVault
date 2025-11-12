import { Plus, Check, Star } from "lucide-react";

type OutdoorKitchenLayoutProps = {
  size: "small" | "medium" | "large";
  onItemClick: (itemType: string, itemName: string) => void;
  isItemOwned: (itemType: string) => boolean;
  isItemWishlisted: (itemType: string) => boolean;
};

const OUTDOOR_EQUIPMENT_ITEMS = [
  { type: "grill", name: "Grill", x: 200, y: 200 },
  { type: "smoker", name: "Smoker", x: 400, y: 200 },
  { type: "outdoor-cooler", name: "Outdoor Cooler", x: 600, y: 200 },
  { type: "patio-heater", name: "Patio Heater", x: 150, y: 450 },
  { type: "outdoor-dining-set", name: "Outdoor Dining Set", x: 450, y: 450 },
  { type: "pizza-oven", name: "Pizza Oven", x: 750, y: 450 },
];

export function OutdoorKitchenLayout({
  size,
  onItemClick,
  isItemOwned,
  isItemWishlisted,
}: OutdoorKitchenLayoutProps) {
  const scale = size === "small" ? 0.7 : size === "large" ? 1.2 : 1;
  const width = 900 * scale;
  const height = 700 * scale;

  const renderIcon = (itemType: string, x: number, y: number) => {
    const owned = isItemOwned(itemType);
    const wishlisted = isItemWishlisted(itemType);

    if (owned) {
      return (
        <g transform={`translate(${x}, ${y})`}>
          <circle cx="0" cy="0" r="20" fill="hsl(var(--primary))" opacity="0.2" />
          <foreignObject x="-12" y="-12" width="24" height="24">
            <Check className="w-6 h-6 text-primary" />
          </foreignObject>
        </g>
      );
    }

    if (wishlisted) {
      return (
        <g transform={`translate(${x}, ${y})`}>
          <circle cx="0" cy="0" r="20" fill="hsl(var(--accent))" opacity="0.2" />
          <foreignObject x="-12" y="-12" width="24" height="24">
            <Star className="w-6 h-6 text-accent-foreground" />
          </foreignObject>
        </g>
      );
    }

    return (
      <g transform={`translate(${x}, ${y})`}>
        <circle cx="0" cy="0" r="20" fill="hsl(var(--muted))" className="hover-elevate" />
        <foreignObject x="-10" y="-10" width="20" height="20">
          <Plus className="w-5 h-5 text-muted-foreground" />
        </foreignObject>
      </g>
    );
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 900 700"
      className="mx-auto"
      data-testid="svg-outdoor-kitchen"
    >
      <defs>
        <pattern id="grass-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="hsl(var(--muted))" opacity="0.1" />
          <line x1="0" y1="30" x2="60" y2="30" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
          <line x1="30" y1="0" x2="30" y2="60" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <radialGradient id="patio-gradient">
          <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.1" />
        </radialGradient>
      </defs>

      <rect width="900" height="700" fill="url(#grass-pattern)" />

      <ellipse cx="450" cy="350" rx="400" ry="280" fill="url(#patio-gradient)" stroke="hsl(var(--border))" strokeWidth="2" />

        <rect x="100" y="140" width="600" height="140" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" strokeDasharray="8,4" />
        <text x="400" y="125" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Cooking Area
        </text>

        <rect x="80" y="380" width="740" height="150" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" strokeDasharray="8,4" />
        <text x="450" y="365" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Dining & Comfort
        </text>

        {OUTDOOR_EQUIPMENT_ITEMS.map((item) => (
          <g
            key={item.type}
            onClick={() => onItemClick(item.type, item.name)}
            style={{ cursor: "pointer" }}
            data-testid={`item-${item.type}`}
          >
            {renderIcon(item.type, item.x, item.y)}
            <text
              x={item.x}
              y={item.y + 35}
              textAnchor="middle"
              fill="hsl(var(--foreground))"
              fontSize="11"
              fontWeight="500"
            >
              {item.name}
            </text>
          </g>
        ))}
    </svg>
  );
}
