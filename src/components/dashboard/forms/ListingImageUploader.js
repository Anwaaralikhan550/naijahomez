'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import { AD_IMAGE_ACCEPT, uploadToS3, validateAdImageFiles } from '@/utils/s3Upload';
import toast from 'react-hot-toast';

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ListingImageUploader({
  images = [],
  draftId = null,
  userId = null,
  onImagesChange,
  onDraftIdChange,
  onRemoveImage,
  onUploadingChange,
  maxImages = 10,
  disabled = false
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const dragIndexRef = useRef(null);
  const fileInputRef = useRef(null);

  const updateImages = useCallback((nextImages, nextDraftId = draftId) => {
    onImagesChange?.(nextImages, nextDraftId);
  }, [draftId, onImagesChange]);

  const uploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || disabled) return;

    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const validFiles = validateAdImageFiles(files, toast.error);
    if (validFiles.length === 0) return;

    setIsUploading(true);
    onUploadingChange?.(true);
    let activeDraftId = draftId;
    const uploadedImages = [];

    try {
      for (let index = 0; index < validFiles.length; index += 1) {
        const file = validFiles[index];
        setUploadNote(`Optimizing and uploading ${index + 1} of ${validFiles.length}`);
        const result = await uploadToS3(file, activeDraftId, userId, {
          watermark: true,
          watermarkPlacement: 'center'
        });
        activeDraftId = result.draftId || activeDraftId;
        uploadedImages.push({
          url: result.url,
          metadata: result.metadata || {
            name: file.name,
            originalSize: file.size,
            compressedSize: file.size,
            compressed: false,
            uploadedAt: new Date().toISOString()
          }
        });
      }

      if (activeDraftId && activeDraftId !== draftId) {
        onDraftIdChange?.(activeDraftId);
      }

      updateImages([...images, ...uploadedImages], activeDraftId);
      toast.success('Images uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
      setUploadNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [disabled, draftId, images, maxImages, onDraftIdChange, onUploadingChange, updateImages, userId]);

  const moveImage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= images.length || fromIndex === toIndex) return;
    const next = [...images];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    updateImages(next);
  };

  const removeImage = async (index) => {
    if (disabled) return;
    if (onRemoveImage) {
      await onRemoveImage(index);
      return;
    }
    updateImages(images.filter((_, imageIndex) => imageIndex !== index));
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-900">Upload Images</h3>
          <p className="text-sm text-gray-500">
            Bulk upload, compress to WebP, reorder, then the first image becomes the cover.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
          {images.length}/{maxImages} images
        </span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          uploadFiles(event.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${
          isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((imageItem, index) => (
            <div
              key={`${imageItem.url}-${index}`}
              draggable={!disabled}
              onDragStart={() => { dragIndexRef.current = index; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndexRef.current !== null) moveImage(dragIndexRef.current, index);
                dragIndexRef.current = null;
              }}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <img
                src={imageItem.url}
                alt={`Upload ${index + 1}`}
                className="h-32 w-full object-cover"
              />
              <div className="absolute left-2 top-2 flex items-center gap-1">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold shadow-sm ${
                  index === 0 ? 'bg-blue-600 text-white' : 'bg-white/90 text-gray-700'
                }`}>
                  {index === 0 ? 'Cover' : `#${index + 1}`}
                </span>
              </div>
              <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveImage(index, index - 1)}
                  disabled={index === 0 || disabled}
                  className="rounded-full bg-white/90 p-1 text-blue-700 shadow disabled:opacity-40"
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(index, index + 1)}
                  disabled={index === images.length - 1 || disabled}
                  className="rounded-full bg-white/90 p-1 text-blue-700 shadow disabled:opacity-40"
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  disabled={disabled}
                  className="rounded-full bg-red-500 p-1 text-white shadow disabled:opacity-40"
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <GripVertical size={13} />
                  Drag
                </span>
                {imageItem.metadata?.compressed && (
                  <span className="text-emerald-700">
                    {formatBytes(imageItem.metadata.originalSize)} to {formatBytes(imageItem.metadata.compressedSize)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {images.length < maxImages && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-center transition-colors hover:border-blue-500 hover:bg-blue-50 disabled:opacity-60"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mb-2 h-6 w-6 animate-spin text-blue-500" />
                  <span className="px-2 text-sm font-medium text-blue-700">{uploadNote || 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-2 h-7 w-7 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-900">Add images</span>
                  <span className="mt-1 px-3 text-xs text-gray-500">Click or drag here</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={AD_IMAGE_ACCEPT}
        multiple
        onChange={(event) => uploadFiles(event.target.files)}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <ImageIcon size={14} />
        Supported formats: JPEG, PNG, GIF, WebP, AVIF, HEIC/HEIF. Images are compressed before S3 upload.
      </p>
    </div>
  );
}
