import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Terminal, X } from 'lucide-react';
import Brand from './Brand';
import { navigateTabs } from '../lib/tabs';

const platforms = ['Linux', 'macOS', 'Windows'] as const;
type Platform = (typeof platforms)[number];

export default function StartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [platform, setPlatform] = useState<Platform>('Linux');
  const [protocol, setProtocol] = useState('ollama');
  const [copyStatus, setCopyStatus] = useState('');
  const runtimeOptions =
    protocol === 'openai' ? ' --endpoint http://127.0.0.1:1234 --protocol openai' : '';
  const commands = [
    ...(platform === 'Windows'
      ? ['$env:PYTHONPATH = "src"', `py -3 -m devicebench serve${runtimeOptions}`]
      : [`PYTHONPATH=src python3 -m devicebench serve${runtimeOptions}`]),
  ].join('\n');
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      setCopyStatus('Copied to clipboard');
    } catch {
      setCopyStatus('Copy unavailable. Select and copy the command below.');
    }
  }
  return (
    <dialog
      ref={dialog}
      className="start-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="start-title"
    >
      <div className="dialog-head">
        <Brand />
        <button className="icon-button" onClick={onClose} aria-label="Close setup">
          <X size={20} />
        </button>
      </div>
      <span className="eyebrow">V1 PREVIEW / SOURCE SETUP</span>
      <h2 id="start-title">Your first local check.</h2>
      <p>
        Use Python 3.11+, the V1 preview source folder, and a running local AI server with a model
        installed. Open a terminal in the source folder to launch your workspace.
      </p>
      <div
        className="runtime-tabs"
        role="tablist"
        aria-label="Your operating system"
        onKeyDown={navigateTabs}
      >
        {platforms.map((name) => (
          <button
            key={name}
            role="tab"
            tabIndex={platform === name ? 0 : -1}
            aria-selected={platform === name}
            aria-controls="setup-command"
            id={`setup-${name}`}
            onClick={() => {
              setPlatform(name);
              setCopyStatus('');
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="setup-requirements">
        {platform === 'Linux'
          ? 'Linux: live validation recorded. Start your runtime before launching DeviceBench.'
          : `${platform}: setup instructions are provided, but execution on this platform is not yet validated.`}
      </div>
      <div className="setup-runtime">
        <label htmlFor="setup-runtime">Your local AI server</label>
        <select
          id="setup-runtime"
          value={protocol}
          onChange={(event) => {
            setProtocol(event.target.value);
            setCopyStatus('');
          }}
        >
          <option value="ollama">Ollama · port 11434</option>
          <option value="openai">OpenAI-compatible · example port 1234</option>
        </select>
      </div>
      {protocol === 'openai' && (
        <p className="setup-runtime-note">
          Replace 1234 with your server’s port. Use the root address without /v1. This preview
          supports unauthenticated local servers.
        </p>
      )}
      <div
        className="setup-code"
        id="setup-command"
        role="tabpanel"
        aria-labelledby={`setup-${platform}`}
      >
        <div>
          <span>
            <Terminal size={14} />
            {platform === 'Windows' ? 'PowerShell' : 'Terminal'} · Run from the source folder
          </span>
          <button onClick={copy} aria-label="Copy setup commands">
            {copyStatus === 'Copied to clipboard' ? <Check size={15} /> : <Copy size={15} />}
            <span>{copyStatus === 'Copied to clipboard' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre tabIndex={0} aria-label="Launch commands">
          {commands}
        </pre>
      </div>
      <div className="copy-status" role="status">
        {copyStatus}
      </div>
      <p className="setup-runtime-note">
        Source setup is available for preview testing. A public installer and package download have
        not been published. See the full setup guide for local wheel installation.
      </p>
      <div className="setup-open">
        <span>Then open your local workspace</span>
        <a href="http://127.0.0.1:8766/" target="_blank" rel="noreferrer">
          127.0.0.1:8766 <ExternalLink size={14} />
        </a>
        <p>
          Run Local AI Doctor, choose a model, and test the features you need. Keep the terminal
          open while using the dashboard.
        </p>
      </div>
      <a className="text-link" href="#/docs/quickstart" onClick={onClose}>
        Full setup and troubleshooting <ExternalLink size={14} />
      </a>
    </dialog>
  );
}
