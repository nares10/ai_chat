import { useState } from "react";

interface ProviderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (provider: string, apiKey?: string) => void;
  apiKeys: Array<{ id: string; name: string; provider: string; key: string }>;
  isLoading: boolean;
}

const providers = [
  { id: "openrouter", name: "OpenRouter", icon: "🌐" },
  { id: "openai", name: "OpenAI", icon: "🤖" },
  { id: "anthropic", name: "Claude (Anthropic)", icon: "🧠" },
];

export default function ProviderSelectModal({
  isOpen,
  onClose,
  onSelect,
  apiKeys,
  isLoading,
}: ProviderSelectModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState("");
  const [useExistingKey, setUseExistingKey] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedProvider) return;

    let apiKey: string | undefined;
    
    if (useExistingKey && selectedKeyId) {
      const key = apiKeys.find(k => k.id === selectedKeyId);
      apiKey = key?.key;
    } else if (customApiKey.trim()) {
      apiKey = customApiKey.trim();
    }

    onSelect(selectedProvider, apiKey);
    handleClose();
  };

  const handleClose = () => {
    setSelectedProvider(null);
    setCustomApiKey("");
    setUseExistingKey(false);
    setSelectedKeyId(null);
    onClose();
  };

  const availableKeys = selectedProvider 
    ? apiKeys.filter(k => k.provider === selectedProvider)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Select AI Provider</h3>
        <p className="mt-2 text-sm text-zinc-400">Choose a provider and configure your API key</p>

        {/* Provider Selection */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-zinc-500">Provider</p>
          <div className="grid grid-cols-1 gap-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                  selectedProvider === provider.id
                    ? "border-zinc-500 bg-zinc-800"
                    : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <p className="font-medium text-white">{provider.name}</p>
                  <p className="text-xs text-zinc-400">
                    {availableKeys.filter(k => k.provider === provider.id).length} saved key(s)
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* API Key Configuration */}
        {selectedProvider && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-medium text-zinc-500">API Key</p>
            
            {availableKeys.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useExisting"
                  checked={useExistingKey}
                  onChange={(e) => setUseExistingKey(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-zinc-200 focus:ring-zinc-500"
                />
                <label htmlFor="useExisting" className="text-sm text-zinc-300">
                  Use existing API key
                </label>
              </div>
            )}

            {useExistingKey && availableKeys.length > 0 ? (
              <select
                value={selectedKeyId || ""}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
              >
                <option value="">Select a saved key</option>
                {availableKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name} ({key.key.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-500"
              />
            )}

            <p className="text-xs text-zinc-500">
              {availableKeys.length > 0 && !useExistingKey && (
                <span className="text-yellow-500">Using a new key will not save it automatically</span>
              )}
              {availableKeys.length === 0 && (
                <span className="text-yellow-500">No saved keys found. Enter a key to continue.</span>
              )}
            </p>
          </div>
        )}

        {/* Free Message Info */}
        <div className="mt-4 rounded-lg bg-zinc-800/50 p-3">
          <p className="text-xs text-zinc-400">
            💡 You have <span className="font-semibold text-white">5 free messages</span> without an API key
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 active:scale-[0.99]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedProvider || isLoading}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}