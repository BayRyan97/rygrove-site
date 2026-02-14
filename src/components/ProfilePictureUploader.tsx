import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { uploadProfilePicture, deleteProfilePicture, PictureMetadata } from '../lib/supabase';
import { supabase } from '../lib/supabase';

interface ProfilePictureUploaderProps {
  userId: string;
  currentPictureUrl?: string;
  currentMetadata?: PictureMetadata;
  onSuccess?: (publicUrl: string, metadata: PictureMetadata) => void;
  onError?: (error: Error) => void;
}

export function ProfilePictureUploader({
  userId,
  currentPictureUrl,
  currentMetadata = { zoom: 1, offsetX: 0, offsetY: 0 },
  onSuccess,
  onError
}: ProfilePictureUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(currentPictureUrl || '');
  const [zoom, setZoom] = useState(currentMetadata.zoom);
  const [offsetX, setOffsetX] = useState(currentMetadata.offsetX);
  const [offsetY, setOffsetY] = useState(currentMetadata.offsetY);
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isAdjustable = Boolean(file) || isEditing;

  useEffect(() => {
    if (file) return;
    setPreview(currentPictureUrl || '');
    setZoom(currentMetadata?.zoom ?? 1);
    setOffsetX(currentMetadata?.offsetX ?? 0);
    setOffsetY(currentMetadata?.offsetY ?? 0);
  }, [currentPictureUrl, currentMetadata, file]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a JPEG or PNG image');
      return;
    }

    // Validate file size (5MB max)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    reader.readAsDataURL(selectedFile);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        fileInputRef.current.files = dataTransfer.files;
        handleFileChange({
          target: fileInputRef.current
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Handle image dragging for centering
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAdjustable) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isAdjustable) return;

    const deltaX = (e.clientX - dragStart.x) / 2;
    const deltaY = (e.clientY - dragStart.y) / 2;

    // Clamp offset values to reasonable range (-50 to 50)
    setOffsetX(Math.max(-50, Math.min(50, offsetX + deltaX)));
    setOffsetY(Math.max(-50, Math.min(50, offsetY + deltaY)));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zoom
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdjustable) return;
    setZoom(parseFloat(e.target.value));
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const metadata: PictureMetadata = { zoom, offsetX, offsetY };
      const { publicUrl } = await uploadProfilePicture(file, userId, metadata);

      setFile(null);
      setError(null);
      setPreview(publicUrl);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.(publicUrl, metadata);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle updating position/zoom of existing picture
  const handleUpdatePosition = async () => {
    if (!currentPictureUrl) return;

    setIsLoading(true);
    try {
      const metadata: PictureMetadata = { zoom, offsetX, offsetY };
      
      // Update the profile with new metadata without re-uploading
      const { error } = await supabase
        .from('profiles')
        .update({ picture_metadata: metadata })
        .eq('id', userId);

      if (error) throw error;

      onSuccess?.(currentPictureUrl, metadata);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update failed');
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!currentPictureUrl) return;

    setIsLoading(true);
    try {
      await deleteProfilePicture(userId);
      setPreview('');
      setFile(null);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setIsEditing(false);
      setError(null);
      onSuccess?.('', { zoom: 1, offsetX: 0, offsetY: 0 });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Delete failed');
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!file && !currentPictureUrl && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="mx-auto mb-2 text-gray-400" size={32} />
          <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
          <p className="text-sm text-gray-500">PNG, JPG (max 5MB)</p>
        </div>
      )}

      {/* Preview & Editor */}
      {(file || currentPictureUrl) && (
        <div className="space-y-4">
          {/* Image Preview */}
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative bg-gray-100 rounded-full overflow-hidden border-2 border-gray-300 ${
              isAdjustable ? 'cursor-move' : 'cursor-default'
            }`}
            style={{ height: '350px', width: '350px', margin: '0 auto', aspectRatio: '1' }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={preview}
                alt="Preview"
                className="object-cover"
                style={{
                  transform: `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3">
              <ZoomOut size={20} className="text-gray-600" />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={zoom}
                onChange={handleZoomChange}
                className="flex-1"
                disabled={!isAdjustable}
              />
              <ZoomIn size={20} className="text-gray-600" />
              <span className="text-sm font-medium w-12">{zoom.toFixed(1)}x</span>
            </div>

            {/* Offset Info */}
            <p className="text-xs text-gray-500 text-center">
              Drag image to center • Offset: ({offsetX.toFixed(0)}%, {offsetY.toFixed(0)}%)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {file ? (
              <>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(currentPictureUrl || '');
                    setZoom(currentMetadata.zoom);
                    setOffsetX(currentMetadata.offsetX);
                    setOffsetY(currentMetadata.offsetY);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Uploading...' : 'Save Picture'}
                </button>
              </>
            ) : currentPictureUrl ? (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setZoom(currentMetadata.zoom);
                        setOffsetX(currentMetadata.offsetX);
                        setOffsetY(currentMetadata.offsetY);
                      }}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdatePosition}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Updating...' : 'Update Position'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    >
                      Adjust Position
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Change Picture
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </>
                )}
              </>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
