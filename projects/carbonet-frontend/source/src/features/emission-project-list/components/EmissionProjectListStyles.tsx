export function EmissionProjectListStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-focus: #005fde;
        --kr-gov-bg-gray: #f4f7fa;
        --kr-gov-radius: 8px;
        --scope1-color: #ef4444;
        --scope2-color: #f97316;
        --scope3-color: #eab308;
        --total-color: #00378b;
        --emerald-accent: #10b981;
        --orange-accent: #f97316;
        --blue-accent: #3b82f6;
      }
      body {
        font-family: 'Noto Sans KR', 'Inter', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
        background-color: var(--kr-gov-bg-gray);
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px 24px;
        z-index: 100;
        transition: top .2s ease;
        border-radius: 0 0 8px 0;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
        vertical-align: middle;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .metric-card {
        background: white;
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid var(--kr-gov-border-light);
        transition: all .2s ease;
      }
      .metric-card:hover {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }
      .site-card {
        background: white;
        border-radius: 16px;
        border: 1px solid var(--kr-gov-border-light);
        overflow: hidden;
        transition: all .3s ease;
      }
      .site-card:hover {
        border-color: var(--kr-gov-focus);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
        transform: translateY(-4px);
      }
      .progress-bar {
        height: 8px;
        border-radius: 9999px;
        background: #e5e7eb;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        border-radius: 9999px;
        transition: width 0.6s ease;
      }
      .trend-bar {
        border-radius: 4px 4px 0 0;
        transition: all .3s ease;
      }
      .trend-bar:hover {
        opacity: 0.85;
      }
      .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .status-badge-normal {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }
      .status-badge-delayed {
        background: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
      }
      .status-badge-verifying {
        background: #eff6ff;
        color: #2563eb;
        border: 1px solid #bfdbfe;
      }
      .status-badge-pending {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      .scope-badge {
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .scope1-badge { background: #fef2f2; color: #dc2626; }
      .scope2-badge { background: #fffbeb; color: #d97706; }
      .scope3-badge { background: #fef9c3; color: #ca8a04; }
      .pulse-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .pulse-dot {
        animation: pulse-animation 2s infinite;
      }
      @keyframes pulse-animation {
        0% { box-shadow: 0 0 0 0 currentColor; }
        50% { box-shadow: 0 0 0 6px currentColor; opacity: 0.5; }
        100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
      }
      .task-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1.25rem;
        transition: all .2s ease;
      }
      .task-card:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateX(4px);
      }
      .chart-container {
        background: white;
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid var(--kr-gov-border-light);
      }
      .data-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
      }
      .data-table th {
        background: #f8fafc;
        padding: 0.75rem 1rem;
        text-align: left;
        font-weight: 700;
        font-size: 12px;
        color: var(--kr-gov-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid var(--kr-gov-border-light);
      }
      .data-table td {
        padding: 1rem;
        border-bottom: 1px solid #f1f5f9;
        transition: background .15s ease;
      }
      .data-table tr:hover td {
        background: #f8fafc;
      }
      .filter-tab {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        transition: all .15s ease;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .filter-tab:hover {
        background: #f1f5f9;
      }
      .filter-tab-active {
        background: var(--kr-gov-blue);
        color: white;
      }
      .filter-tab-inactive {
        background: white;
        color: var(--kr-gov-text-secondary);
        border-color: var(--kr-gov-border-light);
      }
      .action-button-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: var(--kr-gov-blue);
        color: white;
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        transition: all .15s ease;
      }
      .action-button-primary:hover {
        background: var(--kr-gov-blue-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 55, 139, 0.3);
      }
      .action-button-secondary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: white;
        color: var(--kr-gov-blue);
        border: 1px solid var(--kr-gov-blue);
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        transition: all .15s ease;
      }
      .action-button-secondary:hover {
        background: var(--kr-gov-bg-gray);
      }
      .hero-gradient {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      }
      .hero-pattern {
        background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0);
        background-size: 24px 24px;
      }
      .glow-effect {
        box-shadow: 0 0 60px rgba(99, 102, 241, 0.15);
      }
      .export-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--kr-gov-border-light);
        transition: all .2s ease;
      }
      .export-card:hover {
        border-color: var(--kr-gov-focus);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }
      .footer-link {
        color: var(--kr-gov-text-secondary);
        font-weight: 500;
        transition: color .15s ease;
      }
      .footer-link:hover {
        color: var(--kr-gov-blue);
      }
      .ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
      }
      .search-input {
        width: 100%;
        padding: 0.875rem 1rem 0.875rem 3rem;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 14px;
        transition: all .15s ease;
        background: #f9fafb;
      }
      .search-input:focus {
        border-color: var(--kr-gov-blue);
        background: white;
        box-shadow: 0 0 0 4px rgba(0, 55, 139, 0.1);
        outline: none;
      }
      .sparkline-svg {
        width: 100%;
        height: 100%;
      }
      .activity-timeline {
        position: relative;
      }
      .activity-timeline::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: #e5e7eb;
      }
      .activity-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        border: 2px solid #d1d5db;
        position: relative;
        z-index: 1;
      }
      .pagination-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        height: 36px;
        padding: 0 0.75rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        transition: all .15s ease;
        border: 1px solid var(--kr-gov-border-light);
        background: white;
        color: var(--kr-gov-text-secondary);
      }
      .pagination-button:hover:not(:disabled) {
        border-color: var(--kr-gov-blue);
        color: var(--kr-gov-blue);
      }
      .pagination-button-active {
        background: var(--kr-gov-blue);
        color: white;
        border-color: var(--kr-gov-blue);
      }
      .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .mobile-menu-open { overflow: hidden; }
      @media (max-width: 768px) {
        .material-symbols-outlined { font-size: 20px; }
        .metric-card { padding: 1rem; }
        .site-card { border-radius: 12px; }
      }
    `}</style>
  );
}