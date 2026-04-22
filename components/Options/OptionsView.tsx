import { useState, useEffect } from 'react';

export function OptionsView() {
  const [bindings, setBindings] = useState<string[]>(['8080']);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetch('/api/proxy-settings')
      .then(res => res.json())
      .then(data => {
        setBindings(data.bindings && data.bindings.length > 0 ? data.bindings : ['8080']);
      });
  }, []);

  const handleBindingChange = (index: number, value: string) => {
    const newBindings = [...bindings];
    newBindings[index] = value;
    setBindings(newBindings);
  };

  const addBinding = () => setBindings([...bindings, '']);

  const removeBinding = (index: number) => {
    if (bindings.length > 1) {
      setBindings(bindings.filter((_, i) => i !== index));
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const cleanBindings = bindings.filter(b => b.trim() !== '');

      const res = await fetch('/api/proxy-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindings: cleanBindings }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveMessage('Network listeners updated successfully!');
        setBindings(cleanBindings.length > 0 ? cleanBindings : ['8080']);
      } else {
        setSaveMessage(`Error: ${data.error}`);
      }
    } catch (e) {
      setSaveMessage('Failed to connect to proxy engine.');
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="flex-1 flex overflow-y-auto bg-zinc-950 p-8 justify-center">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in pb-24">

        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Proxy_Options</h1>
          <p className="text-zinc-500 text-xs font-mono">Configure local network bindings and install SSL certificates for HTTPS interception.</p>
        </div>

        {/* Listen Settings */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-sky-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 1. Network_Binding
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <span>Listen Addresses (IP:PORT)</span>
              <button onClick={addBinding} className="text-sky-400 hover:text-sky-300 transition-colors">+ Add Binding</button>
            </div>

            <div className="space-y-2">
              {bindings.map((bindStr, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input
                    type="text"
                    value={bindStr}
                    onChange={(e) => handleBindingChange(idx, e.target.value)}
                    placeholder="e.g. 8080 (All Interfaces) OR 127.0.0.1:8080 (Localhost)"
                    className="w-full bg-zinc-950 border border-zinc-700 p-3 rounded text-amber-400 font-black outline-none focus:border-sky-500 transition-colors text-xs font-mono"
                  />
                  {bindings.length > 1 && (
                    <button
                      onClick={() => removeBinding(idx)}
                      className="p-3 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-zinc-500 text-[10px] font-mono leading-relaxed bg-zinc-950 p-3 border border-zinc-800 rounded">
              <span className="text-sky-400 font-bold">Pro-tip:</span> Type just a port (e.g. <strong className="text-zinc-300">8080</strong>) to listen on all interfaces. Type an IP and port (e.g. <strong className="text-zinc-300">127.0.0.1:8888</strong>) to restrict access to a specific network.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <span className={`text-xs font-mono ${saveMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {saveMessage}
            </span>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-[10px] rounded uppercase font-black tracking-widest transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Rebinding...' : 'Apply & Restart'}
            </button>
          </div>
        </div>

        {/* Certificate Settings */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-emerald-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 2. SSL_Certificates
          </h2>

          <div className="space-y-4">
            <p className="text-zinc-400 text-xs font-mono leading-relaxed">
              To intercept HTTPS traffic on your physical devices (iOS/Android) or external browsers, you must install and trust the root Certificate Authority (CA) generated by this proxy.
            </p>

            <div className="flex flex-col gap-3 bg-zinc-950 p-4 border border-zinc-800 border-dashed rounded">
              <h4 className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Setup Instructions:</h4>
              <ol className="list-decimal list-inside text-xs text-zinc-500 font-mono space-y-2">
                <li>Connect your device to the same Wi-Fi network.</li>
                <li>Configure your device's proxy to point to <strong className="text-sky-400">YOUR_IP</strong> and the configured <strong className="text-amber-400">PORT</strong>.</li>
                <li>Download the certificate below and transfer it to the device.</li>
                <li>Go to device settings and explicitly <strong className="text-emerald-400">Trust the Root Certificate</strong>.</li>
              </ol>
            </div>

            <a
              href="/api/cert"
              download="mitmproxy-ca-cert.pem"
              className="inline-flex items-center justify-center w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs rounded uppercase font-black tracking-widest transition-colors"
            >
              Download Root CA (.pem)
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
