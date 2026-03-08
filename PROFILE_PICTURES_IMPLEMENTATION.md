# Profile Pictures Implementation Guide

## Overview
This guide covers the implementation of profile pictures with zoom and center positioning functionality in the Rygrove app. Users can upload, edit, and manage their profile pictures across the application.

## Files Modified/Created

### 1. **Database Migration**
- **File:** [supabase/migrations/20260211_add_profile_pictures.sql](supabase/migrations/20260211_add_profile_pictures.sql)
- **Changes:**
  - Added `profile_picture_url` (TEXT, nullable) to profiles table
  - Added `picture_metadata` (JSONB) to store zoom and center coordinates
  - Default metadata: `{"zoom": 1, "offsetX": 0, "offsetY": 0}`

**Run this migration:**
```bash
# Option 1: Via Supabase Dashboard
# Go to SQL Editor and paste the migration content

# Option 2: Via Supabase CLI
supabase db push
```

### 2. **Supabase Helper Functions**
- **File:** [src/lib/supabase.ts](src/lib/supabase.ts)
- **New Exports:**
  - `uploadProfilePicture(file, userId, metadata)` - Uploads and saves picture metadata
  - `deleteProfilePicture(userId)` - Deletes picture from storage and clears profile data
  - `PictureMetadata` interface for type safety

**Key Features:**
- Validates file type (JPEG, PNG, HEIC, HEIF)
- Enforces 5MB file size limit
- Stores pictures in `avatars/{userId}/{timestamp}-{filename}` path
- Updates profile with public URL and zoom/center metadata

### 3. **ProfilePictureUploader Component**
- **File:** [src/components/ProfilePictureUploader.tsx](src/components/ProfilePictureUploader.tsx) (NEW)
- **Features:**
  - Drag-and-drop file upload
  - Real-time image preview
  - Zoom slider (0.5x to 3x magnification)
  - Drag-to-center functionality for positioning
  - Live offset display (percentages)
  - Error handling with user feedback
  - Loading states during upload
  - Change/delete picture options

**Usage:**
```tsx
import { ProfilePictureUploader } from './ProfilePictureUploader';

<ProfilePictureUploader
  userId={user.id}
  currentPictureUrl={profile?.profile_picture_url}
  currentMetadata={profile?.picture_metadata}
  onSuccess={(url, metadata) => console.log('Picture saved!')}
  onError={(error) => console.error('Upload failed:', error)}
/>
```

### 4. **Dashboard Updates**
- **File:** [src/components/Dashboard.tsx](src/components/Dashboard.tsx)
- **Changes:**
  - Updated Profile interface to include `profile_picture_url` and `picture_metadata`
  - Modified user query to fetch profile picture data
  - Updated user dropdown to display profile picture with proper zoom/center transforms
  - Fallback to User icon if no picture exists

### 5. **AdminPage Updates**
- **File:** [src/components/AdminPage.tsx](src/components/AdminPage.tsx)
- **Changes:**
  - Updated UserProfile interface with picture fields
  - Modified fetchUsers() to include picture data in query
  - Enhanced user table to display profile pictures in Name column
  - Shows generic User icon if no picture is set

### 6. **Storage Setup Guide**
- **File:** [supabase/AVATARS_STORAGE_SETUP.sql](supabase/AVATARS_STORAGE_SETUP.sql)
- **Contains:** Complete instructions for setting up the avatars bucket with RLS policies

## Step-by-Step Setup

### Step 1: Run Database Migration
Apply the migration to add profile picture columns:
```bash
supabase db push
```

Alternatively, copy and paste the SQL from [supabase/migrations/20260211_add_profile_pictures.sql](supabase/migrations/20260211_add_profile_pictures.sql) into the Supabase SQL Editor.

### Step 2: Create Storage Bucket
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Storage > Buckets
3. Click "New Bucket"
4. Name: `avatars`
5. Check "Public bucket" ✓
6. Click "Create Bucket"

### Step 3: Set Up RLS Policies
Copy all four RLS policy definitions from [supabase/AVATARS_STORAGE_SETUP.sql](supabase/AVATARS_STORAGE_SETUP.sql) and run them in the SQL Editor:

1. **INSERT Policy** - Users can upload their own avatars
2. **UPDATE Policy** - Users can update their own avatars
3. **DELETE Policy** - Users can delete their own avatars
4. **SELECT Policy** - Public read access to avatar images

### Step 4: Test the Implementation
1. Start the dev server: `npm run dev`
2. Navigate to a user profile or admin panel
3. Look for profile picture upload functionality
4. Test upload, zoom, center, and delete operations
5. Verify pictures display in Dashboard header and AdminPage table

## Data Structure

### Profile Picture Metadata
```typescript
interface PictureMetadata {
  zoom: number;      // 0.5 to 3.0 (scale factor)
  offsetX: number;   // -50 to 50 (percentage)
  offsetY: number;   // -50 to 50 (percentage)
}
```

### Profile Table Schema
```sql
ALTER TABLE profiles ADD COLUMN profile_picture_url TEXT;
ALTER TABLE profiles ADD COLUMN picture_metadata JSONB DEFAULT '{"zoom": 1, "offsetX": 0, "offsetY": 0}'::jsonb;
```

## File Upload Path Structure
```
avatars/
  ├── {user_id_1}/
  │   ├── 1707619200000-profile.jpg
  │   └── 1707619300000-selfie.png
  └── {user_id_2}/
      └── 1707619250000-photo.jpg
```

Each file is stored as: `avatars/{userId}/{timestamp}-{originalFileName}`

## Styling & Display

### CSS Transform for Picture Display
The picture_metadata zoom and offset values are applied via inline styles:
```typescript
style={{
  transform: `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`
}}
```

This allows:
- **zoom**: Magnifies image (0.5 = 50%, 1 = 100%, 2 = 200%)
- **offsetX/offsetY**: Centers image within container (negative values shift left/up)

### Component Sizes
- **Dashboard header:** 32x32px (h-8 w-8) thumbnail
- **Admin table:** 32x32px thumbnail with user icon fallback
- **Upload editor:** Full container (aspect-square) for preview

## Security Considerations

### Row-Level Security (RLS)
- Users can only upload to their own folder: `avatars/{auth.uid()}/{filename}`
- Users can only delete their own pictures
- Public read access allows avatar display across the app

### File Validation
- **Type:** JPEG, PNG, HEIC, HEIF only
- **Size:** 5MB maximum (client-side enforcement)
- **Path:** Restricted to user's UUID folder

### Authentication
- Upload/delete operations require authenticated user session
- User ID extracted from `auth.uid()` function in policies

## Troubleshooting

### Issue: "Permission denied" on upload
**Solution:**
1. Verify avatars bucket exists and is marked Public
2. Check all RLS policies are created in the SQL Editor
3. Confirm user is authenticated (check localStorage for auth token)
4. Review Supabase logs for detailed error

### Issue: Pictures don't display
**Solution:**
1. Verify `profile_picture_url` is set in profiles table
2. Check `picture_metadata` JSON format is correct
3. Confirm CSS transform is applied (open browser DevTools)
4. Verify bucket is public and files are accessible

### Issue: Upload size limit exceeded
**Solution:**
- Client enforces 5MB limit (can be increased in ProfilePictureUploader.tsx line 87)
- Supabase has 5GB default limit per file

## Integration Points

### Using ProfilePictureUploader in a Profile Settings Page
```tsx
import { ProfilePictureUploader } from '../components/ProfilePictureUploader';

export function ProfileSettings() {
  const [profile, setProfile] = useState(null);

  const handlePictureSuccess = (url, metadata) => {
    setProfile(prev => ({
      ...prev,
      profile_picture_url: url,
      picture_metadata: metadata
    }));
  };

  return (
    <div>
      <h2>Profile Picture</h2>
      <ProfilePictureUploader
        userId={profile.id}
        currentPictureUrl={profile.profile_picture_url}
        currentMetadata={profile.picture_metadata}
        onSuccess={handlePictureSuccess}
      />
    </div>
  );
}
```

## Next Steps

1. **Run migration** - Add columns to profiles table
2. **Create storage bucket** - Set up avatars bucket in Supabase
3. **Add RLS policies** - Secure storage access
4. **Test upload** - Verify functionality works end-to-end
5. **Create profile settings page** - Integrate ProfilePictureUploader component
6. **Update onboarding** - Add picture upload during user creation

## Additional Notes

- The app follows existing receipt upload patterns for consistency
- Profile pictures are stored separately from other user assets
- Zoom/center metadata is stored as JSONB for future extensibility
- Public read access allows avatar display without additional queries
- User deletion via `clearAllUserData()` should also delete profile pictures (enhancement opportunity)
