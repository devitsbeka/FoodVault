import { Plus, Check, Star } from "lucide-react";

type IndoorKitchenLayoutProps = {
  size: "small" | "medium" | "large";
  onItemClick: (itemType: string, itemName: string) => void;
  isItemOwned: (itemType: string) => boolean;
  isItemWishlisted: (itemType: string) => boolean;
};

const EQUIPMENT_ITEMS = {
  countertop: [
    { type: "toaster", name: "Toaster", x: 150, y: 180 },
    { type: "stand-mixer", name: "Stand Mixer", x: 300, y: 180 },
    { type: "blender", name: "Blender", x: 450, y: 180 },
    { type: "air-fryer", name: "Air Fryer", x: 600, y: 180 },
    { type: "juicer", name: "Juicer", x: 750, y: 180 },
  ],
  table: [
    { type: "plates", name: "Plates", x: 200, y: 400 },
    { type: "forks", name: "Forks", x: 350, y: 400 },
    { type: "knives", name: "Knives", x: 500, y: 400 },
    { type: "glasses", name: "Glasses", x: 650, y: 400 },
  ],
  storage: [
    { type: "pots", name: "Pots", x: 150, y: 580 },
    { type: "pans", name: "Pans", x: 300, y: 580 },
    { type: "cutting-boards", name: "Cutting Boards", x: 450, y: 580 },
  ],
  appliances: [
    { type: "microwave", name: "Microwave", x: 600, y: 580 },
    { type: "coffee-maker", name: "Coffee Maker", x: 100, y: 320 },
    { type: "food-processor", name: "Food Processor", x: 800, y: 320 },
  ],
};

export function IndoorKitchenLayout({
  size,
  onItemClick,
  isItemOwned,
  isItemWishlisted,
}: IndoorKitchenLayoutProps) {
  const scale = size === "small" ? 0.7 : size === "large" ? 1.2 : 1;
  const width = 900 * scale;
  const height = 700 * scale;

  const allItems = [
    ...EQUIPMENT_ITEMS.countertop,
    ...EQUIPMENT_ITEMS.table,
    ...EQUIPMENT_ITEMS.storage,
    ...EQUIPMENT_ITEMS.appliances,
  ];

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
      data-testid="svg-indoor-kitchen"
    >
      <defs>
        <pattern id="tile-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
        </pattern>
      </defs>

      <rect width="900" height="700" fill="url(#tile-pattern)" />

      <rect x="50" y="120" width="800" height="100" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" />
        <text x="450" y="110" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Countertop
        </text>

        <rect x="100" y="350" width="700" height="80" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" />
        <text x="450" y="340" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Dining Table
        </text>

        <rect x="50" y="530" width="450" height="100" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" />
        <text x="275" y="520" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Storage
        </text>

        <rect x="550" y="530" width="250" height="100" fill="none" stroke="hsl(var(--border))" strokeWidth="2" rx="4" />
        <text x="675" y="520" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14" fontWeight="500">
          Appliances
        </text>

        {allItems.map((item) => (
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
