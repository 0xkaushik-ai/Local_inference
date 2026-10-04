import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Terminal, X } from 'lucide-react';
import Brand from './Brand';
import { navigateTabs } from '../lib/tabs';

const platforms = ['Linux', 'macOS', 'Windows'] as const;
type Platform = (typeof platforms)[number];
type DownloadInfo = {
  version: string;
  filename: string;
  bytes: number;
  sha256: string;
  glibc: string;
};

export default function StartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [platform, setPlatform] = useState<Platform>('Linux');
  const [protocol, setProtocol] = useState('ollama');
  const [copyStatus, setCopyStatus] = useState('');
  const [download, setDownload] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const runtimeOptions =
    protocol === 'openai' ? ' --endpoint http://127.0.0.1:1234 --protocol openai' : '';
  const commands = (
    platform === 'Windows'
      ? ['$env:PYTHONPATH = "src"', `py -3 -m devicebench serve${runtimeOptions}`]
      : [`PYTHONPATH=src python3 -m devicebench serve${runtimeOptions}`]
  ).join('\n');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('/downloads/manifest.json', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Download unavailable');
        const data = await response.json();
        if (
          data.platform !== 'linux-x86_64' ||
          data.status !== 'local-preview' ||
          !/^devicebench-[\d.]+-linux-x86_64\.tgz$/.test(data.filename) ||
          !/^[a-f0-9]{64}$/.test(data.sha256) ||
          !/^[\d.]+$/.test(data.glibc) ||
          typeof data.version !== 'string' ||
          !Number.isFinite(data.bytes) ||
          data.bytes <= 0
        )
          throw new Error('Invalid download metadata');
        setDownload(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDownload(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open]);

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
      <span className="eyebrow">V1 PREVIEW / LOCAL APPLICATION</span>
      <h2 id="start-title">Download. Open. Check.</h2>
      <p>
        The application bundles Python and the local dashboard. Keep your AI server and models
        installed separately.
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
            aria-controls="setup-platform"
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
      <div id="setup-platform" role="tabpanel" aria-labelledby={`setup-${platform}`}>
        <div className="app-download" aria-live="polite">
          {platform !== 'Linux' ? (
            <>
              <h3>{platform} application pending</h3>
              <p>
                A {platform} download is not available. Builds and execution on this platform are
                not yet validated.
              </p>
            </>
          ) : loading ? (
            <p>Checking download availability…</p>
          ) : download ? (
            <>
              <div className="download-heading">
                <h3>Linux x64 preview</h3>
                <span>
                  {(download.bytes / 1024 ** 2).toFixed(1)} MB · {download.version}
                </span>
              </div>
              <p>
                Portable application. No Python installation, source checkout, or build required.
              </p>
              <a className="button dark" href={`/downloads/${download.filename}`} download>
                <Download size={16} /> Download Linux preview
              </a>
              <p className="download-requirements">
                Requires a Linux desktop, x86_64, and glibc {download.glibc} or newer. Verified on
                the build workstation; other distributions still need validation.
              </p>
              <details className="download-verification">
                <summary>Verify your download</summary>
                <p>Compare the file’s SHA-256 with:</p>
                <code>{download.sha256}</code>
                <a href={`/downloads/${download.filename}.sha256`} download>
                  Download checksum
                </a>
              </details>
            </>
          ) : (
            <>
              <h3>Application download not available here</h3>
              <p>
                This website does not include a verified Linux bundle yet. Public distribution is
                pending. The developer preview remains available below.
              </p>
            </>
          )}
        </div>
        {platform === 'Linux' && download && !loading && (
          <ol className="download-steps">
            <li>
              <strong>Extract the complete folder</strong>
              <span>Keep DeviceBench and its bundled files together.</span>
            </li>
            <li>
              <strong>Open DeviceBench</strong>
              <span>
                The launcher starts your workspace and opens the browser. Use its connection
                settings for your AI server.
              </span>
            </li>
            <li>
              <strong>Run your first check</strong>
              <span>
                Start with Doctor. Download reports to keep them, then use Quit in the launcher when
                finished.
              </span>
            </li>
          </ol>
        )}
        <details className="developer-setup">
          <summary>Developer setup · source or Python package</summary>
          <p className="setup-requirements">
            Requires Python 3.11+ and a source checkout. Open a terminal in the source folder.
            Package installation is also covered in the full guide.
          </p>
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
              Use your server’s port and root address without /v1. Only unauthenticated local
              servers are supported.
            </p>
          )}
          <div className="setup-code" id="setup-command">
            <div>
              <span>
                <Terminal size={14} /> {platform === 'Windows' ? 'PowerShell' : 'Terminal'} · Source
                folder
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
            Keep this terminal open. Then open{' '}
            <a href="http://127.0.0.1:8766/" target="_blank" rel="noreferrer">
              127.0.0.1:8766 <ExternalLink size={13} />
            </a>
            .
          </p>
        </details>
      </div>
      <a className="text-link" href="#/docs/quickstart" onClick={onClose}>
        Full setup and troubleshooting <ExternalLink size={14} />
      </a>
    </dialog>
  );
}
