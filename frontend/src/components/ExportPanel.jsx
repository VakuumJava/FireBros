import { useState } from 'react';
import { exportCsv } from '../api/client';
import { fmt } from '../ui/format';

export default function ExportPanel({ aoi, range, unit = 'hotspot_days_1km' }) {
  const [kind, setKind] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const download = async () => {
    setBusy(true); setMsg(null);
    try {
      const { blob, filename, rowCount } = await exportCsv(aoi, range, kind);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg({ ok: true, text: `${filename}${rowCount != null ? ` · ${fmt(rowCount)} строк` : ''}` });
    } catch (e) {
      setMsg({ ok: false, text: e.detail || e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="export">
      <label className="export__opt"><input type="radio" name="kind" checked={kind === 'monthly'} onChange={() => setKind('monthly')} />
        <span>Сводка по месяцам <small>(то, что на графике; {unit})</small></span></label>
      <label className="export__opt"><input type="radio" name="kind" checked={kind === 'hotspots'} onChange={() => setKind('hotspots')} />
        <span>Сырые детекции <small>(каждый хотспот)</small></span></label>
      <button className="btn" onClick={download} disabled={busy}>{busy ? 'Готовим файл…' : '⬇ Скачать CSV'}</button>
      {msg && <p className={`card__msg ${msg.ok ? '' : 'card__msg--error'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  );
}
