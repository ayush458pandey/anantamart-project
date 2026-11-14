import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../api/axios';
import { Check, X, RotateCcw, Pencil, ImageOff, RefreshCw } from 'lucide-react';
import DraftImageManager from '../components/DraftImageManager';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `\u20b9${n.toFixed(2)}` : '\u2014';
};

function Thumb({ images }) {
  const primary = images?.find((i) => i.is_primary) || images?.[0];
  if (!primary?.image_url) {
    return (
      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
        <ImageOff size={18} />
      </div>
    );
  }
  return (
    <img
      src={primary.image_url}
      alt=""
      className="w-12 h-12 rounded object-cover bg-white border border-gray-200"
    />
  );
}

function EditModal({ draft, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: draft.name || '',
    description: draft.description || '',
    sku: draft.sku || '',
    base_price: draft.base_price ?? '',
    mrp: draft.mrp ?? '',
    stock: draft.stock ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await axiosInstance.patch(`/admin/drafts/${draft.id}/`, form);
      onSaved();
    } catch (err) {
      const data = err?.response?.data;
      setError(
        typeof data === 'object'
          ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' \u00b7 ')
          : 'Could not save this draft.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Edit draft</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <span className="text-xs font-medium text-gray-500">Images</span>
            <div className="mt-1">
              <DraftImageManager draft={draft} onChanged={onSaved} />
            </div>
          </div>

          {[
            ['name', 'Name'],
            ['sku', 'SKU'],
            ['base_price', 'Selling price'],
            ['mrp', 'MRP'],
            ['stock', 'Stock'],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <input
                value={form[key]}
                onChange={set(key)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          ))}

          <label className="block">
            <span className="text-xs font-medium text-gray-500">Description</span>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductDrafts() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axiosInstance.get(`/admin/drafts/?status=${tab}`);
      const data = res.data;
      setRows(Array.isArray(data) ? data : data.results || []);
      setSelected([]);
    } catch {
      setMessage('Could not load drafts.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBulk = async (action) => {
    if (!selected.length) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await axiosInstance.post(`/admin/drafts/bulk-${action}/`, { ids: selected });
      const done = res.data[action] || [];
      const skipped = res.data.skipped || [];
      const invalid = skipped.filter((s) => s.reason === 'invalid');
      let text = `${done.length} ${action}`;
      if (skipped.length) text += `, ${skipped.length} skipped`;
      if (invalid.length) {
        const reasons = invalid
          .flatMap((s) => (s.problems || []).map((p) => p.detail))
          .slice(0, 3)
          .join(' ');
        text += ` \u2014 ${reasons}`;
      }
      setMessage(text);
      await load();
    } catch {
      setMessage(`Could not ${action} the selected drafts.`);
    } finally {
      setBusy(false);
    }
  };

  const canApprove = tab === 'pending';
  const canReopen = tab === 'rejected';

  const header = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            tab === t.key
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-600 border-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
      <button
        onClick={load}
        className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-600"
      >
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  ), [tab, load]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-800 mb-1">AI Product Drafts</h1>
      <p className="text-sm text-gray-500 mb-5">
        Review drafts submitted by AI. Nothing is published until you approve it.
      </p>

      {header}

      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="text-sm text-emerald-800">{selected.length} selected</span>
          {canApprove && (
            <>
              <button
                onClick={() => runBulk('approve')}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                <Check size={14} /> Approve
              </button>
              <button
                onClick={() => runBulk('reject')}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
            </>
          )}
          {canReopen && (
            <button
              onClick={() => runBulk('reopen')}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-white disabled:opacity-50"
            >
              <RotateCcw size={14} /> Reopen
            </button>
          )}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}

      <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Loading\u2026</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No drafts in this view.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="w-16 px-3 py-2" />
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Images</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-gray-100 ${
                    row.draft_status === 'rejected' ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                  <td className="px-3 py-2"><Thumb images={row.images} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{row.name}</div>
                    <div className="text-xs text-gray-400">{row.brand_name}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{row.sku}</td>
                  <td className="px-3 py-2 text-gray-600">{row.category_name}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{money(row.base_price)}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.images?.length || 0}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {row.draft_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.draft_status === 'pending' && (
                      <button
                        onClick={() => setEditing(row)}
                        className="text-gray-400 hover:text-emerald-600"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditModal
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
