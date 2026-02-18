import { User } from 'lucide-react';

interface PictureMetadata {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface ProfileAvatarProps {
  pictureUrl?: string | null;
  metadata?: PictureMetadata | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  userId?: string; // Optional for cache busting on update
  lastUpdated?: number; // Timestamp of last upload to control cache busting
}

/**
 * Shared component for displaying profile pictures with consistent transform logic
 * Replaces duplicate CSS transform code in Dashboard and AdminPage
 */
export function ProfileAvatar({ 
  pictureUrl, 
  metadata, 
  size = 'md', 
  className = '',
  lastUpdated 
}: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 32,
  };

  // Only append cache buster if lastUpdated is provided (on actual upload)
  const imageUrl = pictureUrl 
    ? lastUpdated 
      ? `${pictureUrl}?t=${lastUpdated}` 
      : pictureUrl
    : null;

  const transformStyle = metadata
    ? {
        transform: `scale(${metadata.zoom}) translate(${metadata.offsetX}%, ${metadata.offsetY}%)`,
      }
    : undefined;

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200 flex items-center justify-center ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Profile"
          className="w-full h-full object-cover"
          style={transformStyle}
        />
      ) : (
        <User size={iconSizes[size]} className="text-gray-400" />
      )}
    </div>
  );
}
