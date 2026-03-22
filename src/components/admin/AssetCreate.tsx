import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Card, CardHeader, CardTitle } from '../shared/Card';
import { useToast } from '../shared/Toast';
import { useAdmin } from '../../hooks/useAdmin';
import { uploadFile, STORAGE_BUCKETS } from '../../lib/supabase';
import { validateMapUpload, validateTokenUpload, getImageDimensions } from '../../lib/validation';
import { nanoid } from 'nanoid';

type AssetType = 'token' | 'map';

export const AssetCreate: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated, createGlobalAsset } = useAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assetType, setAssetType] = useState<AssetType>('token');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [defaultSize, setDefaultSize] = useState('medium');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate based on type
    const validation =
      assetType === 'map'
        ? await validateMapUpload(selectedFile)
        : validateTokenUpload(selectedFile);

    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error');
      return;
    }

    // Get dimensions for maps
    if (assetType === 'map') {
      try {
        const dims = await getImageDimensions(selectedFile);
        setDimensions(dims);
      } catch {
        showToast('Could not read image dimensions', 'error');
        return;
      }
    }

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);

    // Auto-fill name from filename
    if (!name) {
      setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!file) newErrors.file = 'Image is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Upload image to storage
      const fileId = nanoid();
      const extension = file!.name.split('.').pop() || 'png';
      const bucket = assetType === 'map' ? STORAGE_BUCKETS.MAPS : STORAGE_BUCKETS.TOKENS;
      const storagePath = `global/${fileId}.${extension}`;

      const uploadResult = await uploadFile(bucket, storagePath, file!);
      if ('error' in uploadResult) {
        showToast(uploadResult.error, 'error');
        setIsLoading(false);
        return;
      }

      // Parse tags
      const tagArray = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      // Create asset record
      const result = await createGlobalAsset({
        assetType,
        name: name.trim(),
        description: description.trim(),
        imageUrl: uploadResult.url,
        defaultSize: assetType === 'token' ? defaultSize : undefined,
        category: category.trim() || undefined,
        width: dimensions?.width,
        height: dimensions?.height,
        tags: tagArray,
        isActive: true,
      });

      if (result.success) {
        showToast('Asset created successfully', 'success');
        navigate('/admin/dashboard');
      } else {
        showToast(result.error || 'Failed to create asset', 'error');
      }
    } catch (error) {
      showToast('An error occurred', 'error');
    }

    setIsLoading(false);
  };

  const tokenCategories = ['monster', 'npc', 'hero', 'animal', 'environmental', 'other'];
  const mapCategories = ['dungeon', 'wilderness', 'urban', 'interior', 'other'];
  const tokenSizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Add Global Asset</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Asset Type */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Asset Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssetType('token');
                    setFile(null);
                    setPreview(null);
                    setDimensions(null);
                  }}
                  className={`
                    p-3 rounded-lg border transition-colors text-left
                    ${
                      assetType === 'token'
                        ? 'bg-slate-700 border-tempest-500 text-slate-100'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div className="font-medium">Token</div>
                  <div className="text-xs opacity-70">Character/NPC tokens</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssetType('map');
                    setFile(null);
                    setPreview(null);
                    setDimensions(null);
                  }}
                  className={`
                    p-3 rounded-lg border transition-colors text-left
                    ${
                      assetType === 'map'
                        ? 'bg-slate-700 border-tempest-500 text-slate-100'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div className="font-medium">Map</div>
                  <div className="text-xs opacity-70">Battle maps and backgrounds</div>
                </button>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />

              {preview ? (
                <div className="relative">
                  <div
                    className={`
                    rounded-lg overflow-hidden bg-slate-800 border border-slate-600
                    ${assetType === 'token' ? 'w-32 h-32' : 'w-full max-h-64'}
                  `}
                  >
                    <img
                      src={preview}
                      alt="Preview"
                      className={`${assetType === 'token' ? 'w-full h-full object-cover' : 'w-full h-full object-contain'}`}
                    />
                  </div>
                  {dimensions && (
                    <p className="text-xs text-slate-400 mt-1">
                      {dimensions.width} x {dimensions.height} pixels
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Image
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    w-full p-6 border-2 border-dashed border-slate-600 rounded-lg
                    hover:border-tempest-500 transition-colors text-center
                    ${errors.file ? 'border-red-500' : ''}
                  `}
                >
                  <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Click to upload image</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {assetType === 'map'
                      ? 'PNG, JPG, WEBP - Max 25MB, 5000x5000px'
                      : 'PNG, JPG, WEBP, GIF - Max 2MB'}
                  </p>
                </button>
              )}
              {errors.file && <p className="text-red-400 text-sm mt-1">{errors.file}</p>}
            </div>

            {/* Name */}
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={assetType === 'token' ? 'e.g., Goblin Warrior' : 'e.g., Forest Clearing'}
              error={errors.name}
            />

            {/* Description */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this asset..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-tempest-400"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100"
              >
                <option value="">Select category...</option>
                {(assetType === 'token' ? tokenCategories : mapCategories).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Token Size (only for tokens) */}
            {assetType === 'token' && (
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Default Size</label>
                <select
                  value={defaultSize}
                  onChange={(e) => setDefaultSize(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100"
                >
                  {tokenSizes.map((size) => (
                    <option key={size} value={size}>
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags */}
            <Input
              label="Tags (optional)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., tempest, creature, undead (comma separated)"
              helperText="Add tags to help find this asset later"
            />

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => navigate('/admin/dashboard')}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" isLoading={isLoading}>
                Create Asset
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
