import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Activity, AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check,
  CheckCircle2, CircleDot, Clock3, Cpu, FilePlus2, Filter, Gauge,
  LayoutDashboard, ListFilter, LoaderCircle, LockKeyhole, Search,
  ShieldCheck, Siren, Trash2, TrendingUp, UserRound, Wrench, X
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getGetIncidentEventsQueryKey, getGetIncidentQueryKey,
  getListIncidentsQueryKey, useAnalyzeIncident,
  useCreateIncident, useDeleteIncident, useGetDashboard, useGetIncident,
  useGetIncidentEvents, useHealthCheck, useListCategories, useListIncidents,
  useResolveIncident, useUpdateIncident
} from '@workspace/api-client-react';
import type { Incident, IncidentPriority, IncidentStatus } from '@workspace/api-client-react';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';

const statuses: IncidentStatus[] = ['open', 'in_progress', 'resolved', 'escalated', 'closed'];
const priorities: IncidentPriority[] = ['low', 'medium', 'high', 'critical'];
const PAGE_SIZE = 10;
const incidentFormSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().min(8).max(10000),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assignedTo: z.string().max(160),
  reporterEmail: z.union([z.literal(''), z.string().email()]),
});
const resolutionFormSchema = z.object({
  resolution: z.string().max(10000),
  verified: z.boolean(),
});
type IncidentFormValues = z.infer<typeof incidentFormSchema>;
type ResolutionFormValues = z.infer<typeof resolutionFormSchema>;

function cx(...parts: Array<string | false | undefined>) { return parts.filter(Boolean).join(' '); }
function pretty(value?: string | null) {
  if (!value) return 'Unclassified';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function shortDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
function statusTone(status?: string | null) {
  return status === 'resolved' || status === 'closed' ? 'tone-green' : status === 'escalated' ? 'tone-red' : status === 'in_progress' ? 'tone-blue' : 'tone-amber';
}
function priorityTone(priority?: string | null) {
  return priority === 'critical' ? 'priority-critical' : priority === 'high' ? 'priority-high' : priority === 'medium' ? 'priority-medium' : 'priority-low';
}

function Button({ children, onClick, kind = 'secondary', disabled, type = 'button', testId, className = '' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean;
  type?: 'button' | 'submit'; testId: string; className?: string;
}) {
  return <button type={type} data-testid={testId} className={cx('button', `button-${kind}`, className)} onClick={onClick} disabled={disabled}>{children}</button>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={cx('status-pill', statusTone(status))} data-testid={`status-${status}`}>{pretty(status)}</span>;
}

function PriorityMark({ priority }: { priority: string }) {
  return <span className={cx('priority-mark', priorityTone(priority))} data-testid={`priority-${priority}`}><span />{pretty(priority)}</span>;
}

function LoadingBlock({ label = 'Loading live data' }: { label?: string }) {
  return <div className="loading-block" data-testid="loading-state"><span className="skeleton-line wide" /><span className="skeleton-line" /><span className="loading-label"><LoaderCircle size={14} />{label}</span></div>;
}

function QueryError({ retry }: { retry: () => void }) {
  return <div className="query-error" data-testid="error-state"><AlertCircle size={18} /><div><strong>Could not load this view</strong><p>Check the connection and try again.</p></div><Button testId="button-retry" kind="secondary" onClick={retry}>Retry</Button></div>;
}

function IncidentRow({ incident, compact = false }: { incident: Incident; compact?: boolean }) {
  return <Link href={`/incidents/${incident.id}`} className={cx('incident-row', compact && 'incident-row-compact')} data-testid={`link-incident-${incident.id}`}>
    <div className="row-main">
      <span className="incident-code">INC-{String(incident.id).padStart(4, '0')}</span>
      <span className="incident-title" data-testid={`text-incident-title-${incident.id}`}>{incident.title}</span>
      {!compact && <span className="incident-category">{pretty(incident.category || incident.predictedCategory)}</span>}
    </div>
    <div className="row-meta">
      <PriorityMark priority={incident.priority} />
      <StatusPill status={incident.status} />
      <span className="row-time">{shortDate(incident.updatedAt)}</span>
      <ArrowUpRight className="row-arrow" size={15} />
    </div>
  </Link>;
}

function WorkspaceLayout({ children, title, eyebrow, action }: { children: ReactNode; title: string; eyebrow: string; action?: ReactNode }) {
  const [location] = useLocation();
  const active = location.startsWith('/incidents') ? 'incidents' : 'dashboard';
  return <div className="workspace">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand" data-testid="link-home"><span className="brand-mark"><Activity size={19} strokeWidth={2.4} /></span><span>incid<span>ai</span></span></Link>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <Link href="/dashboard" className={cx('nav-link', active === 'dashboard' && 'nav-active')} data-testid="link-dashboard"><LayoutDashboard size={17} /><span>Dashboard</span></Link>
        <Link href="/incidents" className={cx('nav-link', active === 'incidents' && 'nav-active')} data-testid="link-incidents"><Siren size={17} /><span>Incidents</span></Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="side-service"><span className="service-led" /><span>Incident operations</span></div>
        <div className="profile-card"><div className="profile-avatar">IT</div><div><strong>Service desk</strong><span>Operations workspace</span></div></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>Operations</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
        <div className="topbar-right"><span className="live-indicator">INCIDENT OPERATIONS</span><span className="topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div>
      </header>
      <div className="page-wrap">
        <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{action}</div>
        {children}
      </div>
    </main>
  </div>;
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 30000 },
  });
  const health = useHealthCheck();
  return <WorkspaceLayout title="Dashboard" eyebrow="Operations overview" action={<Link href="/incidents/new" className="button button-primary" data-testid="button-report-incident"><FilePlus2 size={16} /> Report incident</Link>}>
    {isLoading ? <LoadingBlock label="Gathering operational summary" /> : isError || !data ? <QueryError retry={() => { void refetch(); }} /> : <>
      <section className="summary-strip" aria-label="Incident summary">
        <div className="summary-primary"><span className="metric-label">Active incidents</span><div className="metric-value" data-testid="metric-active">{data.open + data.inProgress + data.escalated}</div><div className="metric-foot"><span className="metric-dot" /> Across all priorities</div></div>
        <div className="summary-stat"><span className="metric-label">Open</span><strong data-testid="metric-open">{data.open}</strong><span className="stat-foot">Awaiting triage</span></div>
        <div className="summary-stat"><span className="metric-label">In progress</span><strong data-testid="metric-in-progress">{data.inProgress}</strong><span className="stat-foot">Being investigated</span></div>
        <div className="summary-stat"><span className="metric-label">Resolved</span><strong data-testid="metric-resolved">{data.resolved}</strong><span className="stat-foot">Human verified</span></div>
        <div className="summary-stat urgent-stat"><span className="metric-label">Escalated</span><strong data-testid="metric-escalated">{data.escalated}</strong><span className="stat-foot">Needs attention</span></div>
      </section>
      <section className="dashboard-grid">
        <div className="panel recent-panel">
          <div className="panel-heading"><div><div className="section-kicker">IN THE QUEUE</div><h2>Recent incidents</h2></div><Link href="/incidents" className="text-link" data-testid="link-view-all">View all <ArrowRight size={15} /></Link></div>
          {data.recentIncidents.length ? <div className="incident-list">{data.recentIncidents.slice(0, 7).map((incident) => <IncidentRow key={incident.id} incident={incident} compact />)}</div> : <div className="empty-state"><div className="empty-icon"><CheckCircle2 size={21} /></div><strong>Nothing in the queue</strong><p>New reports will appear here as they arrive.</p><Link href="/incidents/new" className="text-link" data-testid="link-create-first">Report an incident <ArrowRight size={14} /></Link></div>}
        </div>
        <div className="dashboard-side">
          <div className="panel distribution-panel">
            <div className="section-kicker">CURRENT LOAD</div><h2>Priority mix</h2>
            {data.byPriority.length ? <div className="bar-list">{data.byPriority.map((item) => {
              const max = Math.max(...data.byPriority.map((entry) => entry.count), 1);
              return <div className="bar-row" key={item.label} data-testid={`priority-count-${item.label}`}><div className="bar-label"><span>{pretty(item.label)}</span><strong>{item.count}</strong></div><div className="bar-track"><span className={cx('bar-fill', priorityTone(item.label))} style={{ width: `${Math.max(3, item.count / max * 100)}%` }} /></div></div>;
            })}</div> : <div className="mini-empty">No priority data yet</div>}
            <div className="panel-rule" />
            <div className="section-kicker">CLASSIFICATION</div><h2>By category</h2>
            {data.byCategory.length ? <div className="category-cloud">{data.byCategory.slice(0, 6).map((item) => <span className="category-chip" key={item.label} data-testid={`category-count-${item.label}`}>{item.label}<b>{item.count}</b></span>)}</div> : <div className="mini-empty">Categories appear as incidents are classified</div>}
          </div>
          <div className="health-card">
            <div className="health-head"><span className="health-icon"><Gauge size={17} /></span><div><strong>Platform health</strong><span>Readiness checks</span></div><span className={cx('health-badge', health.data?.status === 'ok' ? 'health-ok' : health.isError ? 'health-down' : 'health-checking')} data-testid="health-status">{health.isLoading ? 'Checking' : health.data?.status ?? 'Unavailable'}</span></div>
            <div className="health-services"><span><span className={cx('small-led', health.data?.database === 'connected' ? 'led-good' : 'led-bad')} />Database</span><b data-testid="health-database">{health.data?.database ?? '—'}</b><span><span className={cx('small-led', health.data?.classifier === 'ready' ? 'led-good' : 'led-bad')} />Classifier</span><b data-testid="health-classifier">{health.data?.classifier ?? '—'}</b></div>
          </div>
        </div>
      </section>
      <div className="dashboard-footer"><span><Activity size={14} /> Auto-refreshes every 30 seconds</span><span><span className="mono">{data.total}</span> total recorded incidents</span></div>
    </>}
  </WorkspaceLayout>;
}

export function IncidentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const categories = useListCategories();
  const params = useMemo(() => ({
    search: search.trim() || undefined,
    status: (status || undefined) as IncidentStatus | undefined,
    priority: (priority || undefined) as IncidentPriority | undefined,
    category: category || undefined,
    limit: PAGE_SIZE,
    offset
  }), [search, status, priority, category, offset]);
  const query = useListIncidents(params);
  const clear = () => { setSearch(''); setStatus(''); setPriority(''); setCategory(''); setOffset(0); };
  return <WorkspaceLayout title="Incidents" eyebrow="Service desk · Incident register" action={<Link href="/incidents/new" className="button button-primary" data-testid="button-report-incident"><FilePlus2 size={16} /> Report incident</Link>}>
    <div className="list-toolbar">
      <label className="search-box"><Search size={17} /><input aria-label="Search incidents" data-testid="input-search-incidents" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Search by title or description" /></label>
      <div className="filters">
        <label className="select-wrap"><ListFilter size={14} /><select aria-label="Filter by status" data-testid="filter-status" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All statuses</option>{statuses.map((s) => <option value={s} key={s}>{pretty(s)}</option>)}</select></label>
        <label className="select-wrap"><Filter size={14} /><select aria-label="Filter by priority" data-testid="filter-priority" value={priority} onChange={(event) => { setPriority(event.target.value); setOffset(0); }}><option value="">All priorities</option>{priorities.map((p) => <option value={p} key={p}>{pretty(p)}</option>)}</select></label>
        <label className="select-wrap category-select"><select aria-label="Filter by category" data-testid="filter-category" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">All categories</option>{(categories.data || []).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
        {(status || priority || category || search) && <button className="clear-filter" onClick={clear} data-testid="button-clear-filters"><X size={14} /> Clear</button>}
      </div>
    </div>
    {query.isLoading ? <LoadingBlock label="Loading incident register" /> : query.isError || !query.data ? <QueryError retry={() => { void query.refetch(); }} /> : <>
      <div className="list-summary"><span><strong data-testid="text-result-count">{query.data.total}</strong> incidents found</span><span className="sort-label"><ArrowDown size={13} /> Recently updated</span></div>
      <div className="incident-table">
        <div className="table-head"><span>INCIDENT</span><span>PRIORITY</span><span>STATUS</span><span>UPDATED</span><span /></div>
        {query.data.results.length ? query.data.results.map((incident) => <IncidentRow key={incident.id} incident={incident} />) : <div className="empty-state list-empty"><div className="empty-icon"><Search size={20} /></div><strong>No incidents match these filters</strong><p>Try broadening your search or clearing a filter.</p><button className="text-link" onClick={clear} data-testid="button-empty-clear">Clear filters <ArrowRight size={14} /></button></div>}
      </div>
      <div className="pagination"><span data-testid="text-pagination">{query.data.total ? `${offset + 1}–${Math.min(offset + query.data.results.length, query.data.total)} of ${query.data.total}` : '0 results'}</span><div><Button testId="button-previous-page" kind="secondary" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ArrowLeft size={14} /> Previous</Button><Button testId="button-next-page" kind="secondary" disabled={offset + PAGE_SIZE >= query.data.total || query.isFetching} onClick={() => setOffset(offset + PAGE_SIZE)}>Next <ArrowRight size={14} /></Button></div></div>
    </>}
  </WorkspaceLayout>;
}

export function NewIncidentPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const create = useCreateIncident();
  const [formError, setFormError] = useState('');
  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      assignedTo: '',
      reporterEmail: '',
    },
  });
  const submit = (values: IncidentFormValues) => {
    setFormError('');
    create.mutate({
      data: {
        title: values.title,
        description: values.description,
        priority: values.priority,
        ...(values.reporterEmail && { reporterEmail: values.reporterEmail }),
        ...(values.assignedTo.trim() && { assignedTo: values.assignedTo.trim() }),
      },
    }, {
      onSuccess: async (incident) => {
        form.reset();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() })
        ]);
        setLocation(`/incidents/${incident.id}`);
      },
      onError: () => setFormError('The incident could not be reported. Please try again.')
    });
  };
  return <WorkspaceLayout title="Report incident" eyebrow="New service request" action={<Link href="/incidents" className="button button-secondary" data-testid="button-cancel-report"><ArrowLeft size={15} /> Back to incidents</Link>}>
    <div className="form-layout">
      <Form {...form}>
        <form className="panel incident-form" onSubmit={form.handleSubmit(submit)} data-testid="form-create-incident">
          <div className="form-intro"><div className="form-icon"><Siren size={20} /></div><div><h2>Tell us what happened</h2><p>Share the symptoms and impact. Classification can be reviewed after submission.</p></div></div>
          <FormField control={form.control} name="title" render={({ field }) => <FormItem className="field"><FormLabel><span>Incident title <i>Required</i></span></FormLabel><FormControl><input {...field} data-testid="input-incident-title" placeholder="e.g. Unable to access shared drive" maxLength={240} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="description" render={({ field }) => <FormItem className="field"><FormLabel><span>Description <i>Required</i></span></FormLabel><FormControl><textarea {...field} data-testid="input-incident-description" placeholder="What were you doing when this happened? Include any error messages or steps already tried." rows={6} maxLength={10000} /></FormControl><small>Include the impact, affected service, and any troubleshooting already attempted.</small><FormMessage /></FormItem>} />
          <div className="form-two-col">
            <FormField control={form.control} name="priority" render={({ field }) => <FormItem className="field"><FormLabel><span>Priority</span></FormLabel><FormControl><select {...field} data-testid="input-incident-priority">{priorities.map((item) => <option value={item} key={item}>{pretty(item)}</option>)}</select></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="assignedTo" render={({ field }) => <FormItem className="field"><FormLabel><span>Assigned to <i>Optional</i></span></FormLabel><FormControl><input {...field} data-testid="input-assignee" maxLength={160} placeholder="Name or team" /></FormControl><FormMessage /></FormItem>} />
          </div>
          <FormField control={form.control} name="reporterEmail" render={({ field }) => <FormItem className="field"><FormLabel><span>Reporter email <i>Optional</i></span></FormLabel><FormControl><input {...field} type="email" data-testid="input-reporter-email" placeholder="you@company.com" /></FormControl><FormMessage /></FormItem>} />
          <div className="privacy-note"><ShieldCheck size={17} /><span>Classification is evidence-led. Similar historical incidents will be shown for a human to review.</span></div>
          {formError && <div className="form-error" role="alert" data-testid="text-form-error"><AlertCircle size={16} />{formError}</div>}
          <div className="form-actions"><Link href="/incidents" className="cancel-text" data-testid="link-cancel-report">Cancel</Link><Button testId="button-submit-incident" kind="primary" type="submit" disabled={create.isPending}>{create.isPending ? <><LoaderCircle size={16} /> Reporting…</> : <>Submit report <ArrowRight size={16} /></>}</Button></div>
        </form>
      </Form>
      <aside className="form-aside"><div className="aside-stamp"><Cpu size={19} /><span>INCIDAI CLASSIFIER</span></div><h3>Transparent by design.</h3><p>Once reported, IncidAI compares the incident with historical tickets and shows why it suggested a category.</p><div className="aside-step"><span>01</span><div><strong>Report</strong><small>Capture symptoms and impact</small></div></div><div className="aside-step"><span>02</span><div><strong>Investigate</strong><small>Review evidence and similar cases</small></div></div><div className="aside-step"><span>03</span><div><strong>Verify</strong><small>Record a human-confirmed resolution</small></div></div></aside>
    </div>
  </WorkspaceLayout>;
}

export function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const incidentQuery = useGetIncident(id, { query: { queryKey: getGetIncidentQueryKey(id), enabled: Number.isFinite(id) && id > 0 } });
  const eventsQuery = useGetIncidentEvents(id, { query: { queryKey: getGetIncidentEventsQueryKey(id), enabled: Number.isFinite(id) && id > 0 } });
  const categories = useListCategories();
  const analyze = useAnalyzeIncident();
  const update = useUpdateIncident();
  const resolve = useResolveIncident();
  const remove = useDeleteIncident();
  const resolutionForm = useForm<ResolutionFormValues>({
    resolver: zodResolver(resolutionFormSchema),
    defaultValues: { resolution: '', verified: false },
  });
  const resolutionVerified = resolutionForm.watch('verified');
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyze.mutateAsync>> | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [, setLocation] = useLocation();
  const incident = incidentQuery.data;
  const saveUpdate = (
    data: { status?: IncidentStatus; category?: string | null; assignedTo?: string | null },
    afterSuccess?: () => void,
  ) => {
    setActionError('');
    update.mutate({ id, data }, {
      onSuccess: async () => {
        afterSuccess?.();
        await Promise.all([queryClient.invalidateQueries({ queryKey: getGetIncidentQueryKey(id) }), queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetIncidentEventsQueryKey(id) })]);
      }, onError: () => setActionError('Could not save this update. Try again.')
    });
  };
  useEffect(() => {
    setAnalysis(null);
    setAssignee(null);
    setActionError('');
    resolutionForm.reset({ resolution: '', verified: false });
  }, [id, resolutionForm.reset]);
  const runAnalysis = () => {
    setActionError('');
    analyze.mutate({ id, data: { similarLimit: 5 } }, {
      onSuccess: async (result) => {
        setAnalysis(result);
        await Promise.all([queryClient.invalidateQueries({ queryKey: getGetIncidentQueryKey(id) }), queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetIncidentEventsQueryKey(id) })]);
      }, onError: () => setActionError('Analysis is unavailable right now. Your report is still saved.')
    });
  };
  const submitResolution = resolutionForm.handleSubmit((values) => {
    setActionError('');
    const savedNote = incident?.resolutionVerified ? '' : incident?.resolution ?? '';
    const resolutionText = values.resolution.trim() || savedNote.trim();
    if (resolutionText.length < 8) {
      resolutionForm.setError('resolution', {
        type: 'manual',
        message: 'Describe the resolution in at least 8 characters.',
      });
      return;
    }
    resolve.mutate({ id, data: { resolution: resolutionText, verified: values.verified } }, {
      onSuccess: async () => {
        resolutionForm.reset({ resolution: '', verified: false });
        await Promise.all([queryClient.invalidateQueries({ queryKey: getGetIncidentQueryKey(id) }), queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetIncidentEventsQueryKey(id) })]);
      }, onError: () => setActionError('Resolution could not be recorded. Please retry.')
    });
  });
  const deleteCurrent = () => {
    if (!window.confirm('Delete this incident? This action cannot be undone.')) return;
    remove.mutate({ id }, {
      onSuccess: async () => {
        await Promise.all([queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() })]);
        setLocation('/incidents');
      }, onError: () => setActionError('Incident could not be deleted.')
    });
  };
  const activeAnalysis = analysis;
  const timeline = eventsQuery.data || [];

  if (incidentQuery.isLoading) return <WorkspaceLayout title="Incident" eyebrow="Investigation"><LoadingBlock label="Opening incident record" /></WorkspaceLayout>;
  if (incidentQuery.isError || !incident) return <WorkspaceLayout title="Incident unavailable" eyebrow="Investigation"><QueryError retry={() => { void incidentQuery.refetch(); }} /><Link href="/incidents" className="text-link" data-testid="link-return-incidents"><ArrowLeft size={14} /> Return to incidents</Link></WorkspaceLayout>;
  return <WorkspaceLayout title={`INC-${String(incident.id).padStart(4, '0')}`} eyebrow="Incident investigation" action={<Link href="/incidents" className="button button-secondary" data-testid="button-back-incidents"><ArrowLeft size={15} /> All incidents</Link>}>
    <div className="detail-title-row"><div><div className="detail-title-meta"><StatusPill status={incident.status} /><PriorityMark priority={incident.priority} /><span className="detail-created">Reported {shortDate(incident.createdAt)}</span></div><h2 data-testid="text-incident-heading">{incident.title}</h2></div><Button testId="button-delete-incident" kind="quiet" onClick={deleteCurrent} disabled={remove.isPending}><Trash2 size={15} /> Delete</Button></div>
    {actionError && <div className="form-error action-error" role="alert" data-testid="text-action-error"><AlertCircle size={16} />{actionError}<button aria-label="Dismiss error" onClick={() => setActionError('')} data-testid="button-dismiss-error"><X size={14} /></button></div>}
    <div className="detail-layout">
      <div className="detail-main">
        <section className="panel incident-description"><div className="panel-heading"><div><div className="section-kicker">REPORTED ISSUE</div><h2>Incident details</h2></div><span className="mono subdued">#{incident.id}</span></div><p data-testid="text-incident-description">{incident.description}</p><div className="reporter-line"><span><UserRound size={14} /> Reporter</span><strong data-testid="text-reporter">{incident.reporterEmail || 'Not provided'}</strong><span><Clock3 size={14} /> Updated</span><strong data-testid="text-updated-at">{shortDate(incident.updatedAt)}</strong></div></section>
        <section className="panel classification-panel">
          <div className="panel-heading"><div><div className="section-kicker">EVIDENCE-LED CLASSIFICATION</div><h2>Classification & investigation</h2></div><Button testId="button-run-analysis" kind="secondary" onClick={runAnalysis} disabled={analyze.isPending}>{analyze.isPending ? <><LoaderCircle size={15} /> Analyzing…</> : <><Activity size={15} /> {activeAnalysis ? 'Run again' : 'Analyze incident'}</>}</Button></div>
          {activeAnalysis ? <div className="analysis-result" data-testid="analysis-result">
             <div className="analysis-callout"><div className="analysis-category-icon"><TrendingUp size={18} /></div><div className="analysis-overview"><span>Suggested category</span><strong data-testid="text-predicted-category">{activeAnalysis.predictedCategory}</strong><small>{activeAnalysis.method} · {Math.round(activeAnalysis.confidence * 100)}% match score</small></div><div className="confidence-meter"><div className="confidence-track"><span style={{ width: `${Math.round(activeAnalysis.confidence * 100)}%` }} /></div><span>Ranking signal, not probability</span></div></div>
            <div className="rationale"><strong>Why this classification</strong><p data-testid="text-analysis-rationale">{activeAnalysis.rationale}</p></div>
            <div className="panel-rule" />
            <div className="similar-heading"><div><strong>Similar historical incidents</strong><span>Evidence from prior tickets</span></div><span className="evidence-count">{activeAnalysis.similarIncidents.length} MATCH{activeAnalysis.similarIncidents.length === 1 ? '' : 'ES'}</span></div>
            {activeAnalysis.similarIncidents.length ? <div className="similar-list">{activeAnalysis.similarIncidents.map((item, index) => <article className="similar-card" key={`${item.title}-${index}`} data-testid={`similar-incident-${index}`}><div className="similar-card-top"><div><strong>{item.title}</strong><span>{item.category}</span></div><div className="similar-score">{Math.round(item.similarity * 100)}<small>%</small><span>similar</span></div></div>{item.resolution && <p><CheckCircle2 size={14} /> {item.resolution}</p>}</article>)}</div> : <div className="mini-empty">No similar historical incidents found.</div>}
            <div className="recommendation"><div className="recommend-icon"><Wrench size={16} /></div><div><span>Recommended resolution approach</span><p data-testid="text-recommended-resolution">{activeAnalysis.recommendedResolution}</p><small>Method: {activeAnalysis.resolutionMethod}</small></div></div>
          </div> : <div className="analysis-empty"><div className="analysis-empty-icon"><Activity size={19} /></div><div><strong>Investigate with historical evidence</strong><p>Run analysis to see the suggested category, its rationale, and comparable resolved tickets.</p></div></div>}
           {incident.predictedCategory && <div className="saved-classification"><span>Saved prediction</span><strong>{pretty(incident.predictedCategory)}</strong>{incident.confidence !== null && <small>{Math.round(incident.confidence * 100)}% match score</small>}</div>}
          <div className="classification-controls"><label className="field"><span>Human-reviewed category</span><select data-testid="select-category" value={incident.category || ''} disabled={update.isPending} onChange={(event) => saveUpdate({ category: event.target.value || null })}><option value="">Not assigned</option>{(categories.data || []).map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label><span className="field-hint">Your selection is stored separately from the model prediction.</span></div>
        </section>
         <section className="panel resolution-panel"><div className="panel-heading"><div><div className="section-kicker">HUMAN-IN-THE-LOOP</div><h2>Resolution & verification</h2></div>{incident.resolutionVerified && <span className="verified-label"><ShieldCheck size={15} /> Verified</span>}</div>
           {incident.resolution && <div className="saved-resolution"><div className="resolved-banner"><CheckCircle2 size={17} /><strong>{incident.resolutionVerified ? 'Resolution verified' : 'Resolution note saved'}</strong><span>{incident.resolvedAt ? shortDate(incident.resolvedAt) : ''}</span></div><p data-testid="text-saved-resolution">{incident.resolution}</p><div className="resolution-meta"><span>Method</span><strong>{incident.resolutionMethod || activeAnalysis?.resolutionMethod || 'Manually recorded'}</strong><span>Human verification</span><strong>{incident.resolutionVerified ? 'Confirmed' : 'Not verified'}</strong></div></div>}
           {!incident.resolutionVerified && <Form {...resolutionForm}><form onSubmit={submitResolution} data-testid="form-resolution">
             <FormField control={resolutionForm.control} name="resolution" render={({ field }) => <FormItem className="field"><FormLabel><span>{incident.resolution ? 'Update or verify the saved note' : 'What resolved the issue?'}</span></FormLabel><FormControl><textarea {...field} data-testid="input-resolution" rows={4} maxLength={10000} placeholder={incident.resolution ? 'Leave blank to keep the saved note, or enter an update.' : activeAnalysis?.recommendedResolution || 'Record the steps taken and the outcome.'} /></FormControl>{incident.resolution && <small>Leaving this blank keeps the pending note above.</small>}<FormMessage /></FormItem>} />
             <FormField control={resolutionForm.control} name="verified" render={({ field }) => <FormItem className="verify-form-field"><FormLabel className="verify-check"><FormControl><input type="checkbox" name={field.name} ref={field.ref} onBlur={field.onBlur} checked={field.value} onChange={(event) => field.onChange(event.target.checked)} data-testid="checkbox-verify-resolution" /></FormControl><span className="check-visual"><Check size={13} /></span><span><strong>I verified this resolution with the reporter or affected user.</strong><small>Only confirmed fixes should be marked resolved.</small></span></FormLabel><FormMessage /></FormItem>} />
             <Button testId="button-submit-resolution" kind="primary" type="submit" disabled={resolve.isPending}>{resolve.isPending ? <><LoaderCircle size={15} /> Saving…</> : resolutionVerified ? <><ShieldCheck size={15} /> Verify and resolve</> : <><Check size={15} /> Save note for verification</>}</Button>
           </form></Form>}
         </section>
       </div>
      <aside className="detail-aside">
        <section className="panel status-panel"><div className="section-kicker">WORKFLOW</div><h2>Incident status</h2><label className="field"><span>Update status</span><select value={incident.status} data-testid="select-incident-status" disabled={update.isPending} onChange={(event) => { const next = event.target.value as IncidentStatus; if (next === 'resolved') { setActionError('Record a resolution and verify it with the affected user before marking this incident resolved.'); return; } saveUpdate({ status: next }); }}>{statuses.map((item) => <option value={item} key={item} disabled={(item === 'resolved' && incident.status !== 'resolved') || (item === 'closed' && incident.status !== 'resolved' && incident.status !== 'closed')}>{pretty(item)}</option>)}</select></label><div className="status-note"><CircleDot size={14} /><span>Resolution requires a human-verified fix. Status changes are recorded in history.</span></div></section>
         <section className="panel assignment-panel"><div className="section-kicker">OWNERSHIP</div><h2>Assignment</h2><label className="field"><span>Assigned to</span><div className="assignment-input"><input value={assignee === null ? incident.assignedTo || '' : assignee} onChange={(event) => setAssignee(event.target.value)} data-testid="input-update-assignee" maxLength={160} placeholder="Name or team" /><Button testId="button-save-assignee" kind="secondary" className="save-assignee" onClick={() => { const assigneeToSave = (assignee === null ? incident.assignedTo || '' : assignee).trim() || null; saveUpdate({ assignedTo: assigneeToSave }, () => setAssignee(null)); }} disabled={update.isPending}><Check size={14} /></Button></div></label></section>
        <section className="panel timeline-panel"><div className="panel-heading"><div><div className="section-kicker">AUDIT TRAIL</div><h2>Incident history</h2></div><span className="timeline-count">{timeline.length}</span></div>
          {eventsQuery.isLoading ? <div className="timeline-loading"><span /><span /><span /></div> : eventsQuery.isError ? <div className="inline-error"><span>History unavailable</span><button onClick={() => { void eventsQuery.refetch(); }} data-testid="button-retry-history">Retry</button></div> : timeline.length ? <div className="timeline">{timeline.map((event) => <article className="timeline-event" key={event.id} data-testid={`timeline-event-${event.id}`}><span className="timeline-dot"><span /></span><div><strong>{pretty(event.eventType)}</strong><p>{event.message}</p><time>{shortDate(event.createdAt)}</time></div></article>)}</div> : <div className="timeline-empty"><Clock3 size={17} /><span>No history recorded yet.</span></div>}
        </section>
        <div className="audit-note"><LockKeyhole size={15} /><span>Incident actions and status changes are recorded for audit.</span></div>
      </aside>
    </div>
  </WorkspaceLayout>;
}
