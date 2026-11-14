import React, { useRef, useState } from 'react';
import axiosInstance from '../api/axios';
import { Star, Trash2, ArrowLeft, ArrowRight, Upload, Loader2 } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  buildUploadForm,
  describeUploadError,
  describeUploadSuccess,
  validateImageFile,
} from './draftImageUpload';

/**
 * Image controls for a pending AI draft: upload, reorder, set primary, delete.
 *
 * The backend enforces that only pending AI drafts can be changed and keeps
 * exactly one primary image; this component just reflects that state.
 *
 * Uploads go to the staff-authenticated endpoint using the normal JWT. The AI
 * token is never involved and is never stored in the browser.
 */
export default function DraftImageManager({ draft, onChanged }) {
  const [images, setImages] = useState(draft.images || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const fileInput = useRef(null);

  const locked = draft.draft_status !== 'pending';

  const call = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged?.();
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.error || 'Could not update images.');
    } finally {
      setBusy(false);
    }
  };

  const move = (index, delta) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    call(() =>
      axiosInstance.post(`/admin/drafts/${draft.id}/images/reorder/`, {
        order: next.map((img) => img.id),
      }),
    );
  };

  const setPrimary = (image) => {
    setImages(images.map((img) => ({ ...img, is_primary: img.id === image.id })));
    call(() =>
      axiosInstance.post(`/admin/drafts/${draft.id}/images/${image.id}/primary/`, {}),
    );
  };

  const remove = (image) => {
    setImages(images.filter((img) => img.id !== image.id));
    call(() => axiosInstance.delete(`/admin/drafts/${draft.id}/images/${image.id}/`));
  };

  const pickFile = () => fileInput.current?.click();

  const upload = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');

    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const res = await axiosInstance.post(
        `/admin/drafts/${draft.id}/images/`,
        buildUploadForm(file, draft.name || ''),
        {
          // Let the browser set the multipart boundary.
          headers: { 'Content-Type': undefined },
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
          },
        },
      );

      const created = res.data?.image;
      if (created) setImages((prev) => [...prev, created]);
      setNotice(describeUploadSuccess(res.data));
      onChanged?.();
    } catch (err) {
      setError(describeUploadError(err));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const uploadControl = !locked && (
    <div className="flex items-center gap-2">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={upload}
        className="hidden"
        data-testid="draft-image-input"
      />
      <button
        type="button"
        onClick={pickFile}
        disabled={uploading || busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {uploading ? `Uploading ${progress}%` : 'Upload image'}
      </button>
      <span className="text-xs text-gray-400">JPG, PNG or WebP &middot; max 8 MB</span>
    </div>
  );

  if (!images.length) {
    return (
      <div className="space-y-2">
        {uploadControl}
        {uploading && (
          <div className="h-1.5 w-full rounded bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {!uploading && (
          <p className="text-sm text-gray-400">No images attached to this draft.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {uploadControl}
      {uploading && (
        <div className="h-1.5 w-full rounded bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {images.map((image, index) => (
        <div
          key={image.id}
          className="flex items-center gap-3 p-2 rounded-lg border border-gray-200"
        >
          <img
            src={image.image_url}
            alt={image.alt_text || ''}
            className="w-14 h-16 object-cover rounded bg-white border border-gray-100"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {image.is_primary && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  Primary
                </span>
              )}
              {image.source_kind && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {image.source_kind}
                </span>
              )}
            </div>
            {image.source_url && (
              <p className="text-xs text-gray-400 truncate mt-1" title={image.source_url}>
                {image.source_url}
              </p>
            )}
          </div>

          {!locked && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(index, -1)}
                disabled={busy || index === 0}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                title="Move up"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                onClick={() => move(index, 1)}
                disabled={busy || index === images.length - 1}
                className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                title="Move down"
              >
                <ArrowRight size={15} />
              </button>
              <button
                onClick={() => setPrimary(image)}
                disabled={busy || image.is_primary}
                className="p-1.5 text-gray-400 hover:text-amber-500 disabled:opacity-30"
                title="Set as primary"
              >
                <Star size={15} />
              </button>
              <button
                onClick={() => remove(image)}
                disabled={busy}
                className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
                title="Delete image"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
