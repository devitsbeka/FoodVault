import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package } from "lucide-react";

interface IngredientImageProps {
  imageUrl?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function IngredientImage({ imageUrl, name, size = 30, className = "" }: IngredientImageProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  return (
    <Avatar className={`${className}`} style={{ width: `${size}px`, height: `${size}px` }}>
      {imageUrl && (
        <AvatarImage 
          src={imageUrl} 
          alt={name}
          className="object-cover"
        />
      )}
      <AvatarFallback className="text-xs bg-muted">
        {initials || <Package className="w-3 h-3" />}
      </AvatarFallback>
    </Avatar>
  );
}
