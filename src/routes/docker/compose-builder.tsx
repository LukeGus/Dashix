import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createFileRoute } from '@tanstack/react-router';
import { ThemeProvider } from "@/components/ThemeProvider.tsx";
import { CodeEditor } from "@/components/CodeEditor";
import { SidebarUI } from "@/components/SidebarUI";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { load } from "js-yaml";

console.log('typeof yaml:', typeof load, 'yaml:', load);

export const Route = createFileRoute('/docker/compose-builder')({
    component: App,
});

// Type for a single service
interface PortMapping { host: string; container: string; }
interface VolumeMapping { host: string; container: string; }
interface Healthcheck {
    test: string;
    interval: string;
    timeout: string;
    retries: string;
    start_period: string;
    start_interval: string;
}

interface ServiceConfig {
    name: string;
    image: string;
    ports: PortMapping[];
    volumes: VolumeMapping[];
    environment: { key: string; value: string }[];
    command: string;
    restart: string;
    healthcheck?: Healthcheck;
    depends_on?: string[];
    entrypoint?: string;
    env_file?: string;
    extra_hosts?: string[];
    dns?: string[];
    networks?: string[];
    user?: string;
    working_dir?: string;
    labels?: { key: string; value: string }[];
    privileged?: boolean;
    read_only?: boolean;
}

interface NetworkConfig {
    name: string;
    driver: string;
    driver_opts: { key: string; value: string }[];
    attachable: boolean;
    labels: { key: string; value: string }[];
}
interface VolumeConfig {
    name: string;
    driver: string;
    driver_opts: { key: string; value: string }[];
    labels: { key: string; value: string }[];
}

function defaultService(): ServiceConfig {
    return {
        name: '',
        image: '',
        ports: [],
        volumes: [],
        environment: [],
        command: '',
        restart: '',
        healthcheck: undefined,
        depends_on: [],
        entrypoint: '',
        env_file: '',
        extra_hosts: [],
        dns: [],
        networks: [],
        user: '',
        working_dir: '',
        labels: [],
        privileged: false,
        read_only: false,
    };
}

function defaultNetwork(): NetworkConfig {
    return { name: '', driver: '', driver_opts: [], attachable: false, labels: [] };
}
function defaultVolume(): VolumeConfig {
    return { name: '', driver: '', driver_opts: [], labels: [] };
}

function App() {
    const [services, setServices] = useState<ServiceConfig[]>([defaultService()]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(0);
    const [selectedType, setSelectedType] = useState<'service' | 'network' | 'volume'>('service');
    const [selectedNetworkIdx, setSelectedNetworkIdx] = useState<null | number>(null);
    const [selectedVolumeIdx, setSelectedVolumeIdx] = useState<null | number>(null);
    const [yaml, setYaml] = useState('');
    const [networks, setNetworks] = useState<NetworkConfig[]>([]);
    const [volumes, setVolumes] = useState<VolumeConfig[]>([]);
    const [composeStoreOpen, setComposeStoreOpen] = useState(false);
    // Compose Store state
    const [composeFiles, setComposeFiles] = useState<any[]>([]); // [{name, url, services: [{name, image, rawService}] }]
    const [composeLoading, setComposeLoading] = useState(false);
    const [composeError, setComposeError] = useState<string | null>(null);
    const [composeSearch, setComposeSearch] = useState("");
    const codeFileRef = useRef<HTMLDivElement>(null);
    const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!codeFileRef.current) return;
        const handleResize = () => {
            const rect = codeFileRef.current?.getBoundingClientRect();
            if (rect) setEditorSize({ width: rect.width, height: rect.height });
        };
        handleResize();
        const ro = new window.ResizeObserver(handleResize);
        ro.observe(codeFileRef.current);
        return () => ro.disconnect();
    }, [codeFileRef]);

    // Generate YAML from services, networks, and volumes state
    function generateYaml(services: ServiceConfig[], networks: NetworkConfig[], volumes: VolumeConfig[]): string {
        // Compose root object
        const compose: any = { services: {} };
        services.forEach((svc) => {
            if (!svc.name) return;
            compose.services[svc.name] = {
                image: svc.image || undefined,
                command: svc.command || undefined,
                restart: svc.restart || undefined,
                ports: svc.ports.length
                    ? svc.ports.map(p => p.host && p.container ? `${p.host}:${p.container}` : p.container ? p.container : undefined).filter(Boolean)
                    : undefined,
                volumes: svc.volumes.length
                    ? svc.volumes.map(v => v.host && v.container ? `${v.host}:${v.container}` : v.container ? v.container : undefined).filter(Boolean)
                    : undefined,
                environment: svc.environment.length
                    ? svc.environment.reduce((acc, { key, value }) => {
                        if (key) acc[key] = value;
                        return acc;
                    }, {} as Record<string, string>)
                    : undefined,
                healthcheck: svc.healthcheck && svc.healthcheck.test ? {
                    test: svc.healthcheck.test,
                    interval: svc.healthcheck.interval || undefined,
                    timeout: svc.healthcheck.timeout || undefined,
                    retries: svc.healthcheck.retries || undefined,
                    start_period: svc.healthcheck.start_period || undefined,
                    start_interval: svc.healthcheck.start_interval || undefined,
                } : undefined,
                depends_on: svc.depends_on && svc.depends_on.filter(Boolean).length ? svc.depends_on.filter(Boolean) : undefined,
                entrypoint: svc.entrypoint || undefined,
                env_file: svc.env_file && svc.env_file.trim() ? svc.env_file : undefined,
                extra_hosts: svc.extra_hosts && svc.extra_hosts.filter(Boolean).length ? svc.extra_hosts.filter(Boolean) : undefined,
                dns: svc.dns && svc.dns.filter(Boolean).length ? svc.dns.filter(Boolean) : undefined,
                networks: svc.networks && svc.networks.filter(Boolean).length ? svc.networks.filter(Boolean) : undefined,
                user: svc.user || undefined,
                working_dir: svc.working_dir || undefined,
                labels: svc.labels && svc.labels.filter(l => l.key).length ? svc.labels.filter(l => l.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                privileged: svc.privileged ? true : undefined,
                read_only: svc.read_only ? true : undefined,
            };
        });
        for (const name in compose.services) {
            Object.keys(compose.services[name]).forEach(
                (k) => compose.services[name][k] === undefined && delete compose.services[name][k]
            );
        }
        // Always add all networks
        if (networks.length) {
            compose.networks = {};
            networks.forEach(n => {
                if (!n.name) return;
                compose.networks[n.name] = {
                    driver: n.driver || undefined,
                    attachable: n.attachable ? true : undefined,
                    driver_opts: n.driver_opts && n.driver_opts.length ? n.driver_opts.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                    labels: n.labels && n.labels.length ? n.labels.filter(l => l.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                };
                Object.keys(compose.networks[n.name]).forEach(
                    (k) => compose.networks[n.name][k] === undefined && delete compose.networks[n.name][k]
                );
            });
        }
        // Always add all volumes
        if (volumes.length) {
            compose.volumes = {};
            volumes.forEach(v => {
                if (!v.name) return;
                compose.volumes[v.name] = {
                    driver: v.driver || undefined,
                    driver_opts: v.driver_opts && v.driver_opts.length ? v.driver_opts.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                    labels: v.labels && v.labels.length ? v.labels.filter(l => l.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                };
                Object.keys(compose.volumes[v.name]).forEach(
                    (k) => compose.volumes[v.name][k] === undefined && delete compose.volumes[v.name][k]
                );
            });
        }
        return yamlStringify(compose);
    }

    // Simple YAML stringifier for this use case
    function yamlStringify(obj: any, indent = 0): string {
        const pad = (n: number) => '  '.repeat(n);
        if (typeof obj !== 'object' || obj === null) return String(obj);
        if (Array.isArray(obj)) {
            return obj.map((v) => `\n${pad(indent)}- ${yamlStringify(v, indent + 1).trimStart()}`).join('');
        }
        // Remove leading newline for top-level
        const entries = Object.entries(obj)
            .map(([k, v]) => {
                if (v === undefined) return '';
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                    return `\n${pad(indent)}${k}:` + yamlStringify(v, indent + 1);
                }
                if (Array.isArray(v)) {
                    return `\n${pad(indent)}${k}:` + yamlStringify(v, indent + 1);
                }
                return `\n${pad(indent)}${k}: ${v}`;
            })
            .join('');
        return indent === 0 && entries.startsWith('\n') ? entries.slice(1) : entries;
    }

    // Always update YAML when services, networks, or volumes change
    useEffect(() => {
        setYaml(generateYaml(services, networks, volumes));
    }, [services, networks, volumes]);

    // Handle service field change
    function updateServiceField(field: keyof ServiceConfig, value: any) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx] as any)[field] = value;
        setServices(newServices);
    }

    // Handle dynamic list field change (ports, volumes, env)
    function updateListField(field: keyof ServiceConfig, idx: number, value: any) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx][field] as any[])[idx] = value;
        setServices(newServices);
    }

    function addListField(field: keyof ServiceConfig) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (field === 'environment') {
            newServices[selectedIdx].environment.push({ key: '', value: '' });
        } else {
            (newServices[selectedIdx][field] as any[]).push('');
        }
        setServices(newServices);
    }

    function removeListField(field: keyof ServiceConfig, idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx][field] as any[]).splice(idx, 1);
        setServices(newServices);
    }

    // Add/remove/select service
    function addService() {
        const newServices = [...services, defaultService()];
        setServices(newServices);
        setSelectedIdx(services.length);
    }
    function removeService(idx: number) {
        if (services.length === 1) return;
        const newServices = services.filter((_, i) => i !== idx);
        setServices(newServices);
        setSelectedIdx(
            typeof selectedIdx === 'number'
                ? Math.max(0, selectedIdx - (idx < selectedIdx ? 1 : 0))
                : 0
        );
    }

    // Update port field
    function updatePortField(idx: number, field: 'host' | 'container', value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports[idx][field] = value.replace(/[^0-9]/g, '');
        setServices(newServices);
    }
    function addPortField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.push({ host: '', container: '' });
        setServices(newServices);
    }
    function removePortField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.splice(idx, 1);
        setServices(newServices);
    }

    // Update volume field
    function updateVolumeField(idx: number, field: 'host' | 'container', value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes[idx][field] = value;
        setServices(newServices);
    }
    function addVolumeField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.push({ host: '', container: '' });
        setServices(newServices);
    }
    function removeVolumeField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.splice(idx, 1);
        setServices(newServices);
    }

    // Update healthcheck field
    function updateHealthcheckField(field: keyof Healthcheck, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].healthcheck) newServices[selectedIdx].healthcheck = { test: '', interval: '', timeout: '', retries: '', start_period: '', start_interval: '' };
        newServices[selectedIdx].healthcheck![field] = value;
        setServices(newServices);
    }

    // Update depends_on field
    function updateDependsOn(idx: number, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].depends_on![idx] = value;
        setServices(newServices);
    }
    function addDependsOn() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].depends_on) newServices[selectedIdx].depends_on = [];
        newServices[selectedIdx].depends_on!.push('');
        setServices(newServices);
    }
    function removeDependsOn(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].depends_on!.splice(idx, 1);
        setServices(newServices);
    }

    // Network management
    function addNetwork() {
        setNetworks(prev => {
            const newNetworks = [...prev, defaultNetwork()];
            return newNetworks;
        });
        setSelectedType('network');
        setSelectedNetworkIdx(() => null);
        setSelectedVolumeIdx(() => null);
    }
    function updateNetwork(idx: number, field: keyof NetworkConfig, value: any) {
        const newNetworks = [...networks];
        // If renaming, update all service references
        if (field === 'name') {
            const oldName = newNetworks[idx].name;
            newNetworks[idx][field] = value;
            setNetworks(newNetworks);
            setServices(prev => {
                const newSvcs = prev.map(svc => ({
                    ...svc,
                    networks: svc.networks?.map(n => n === oldName ? value : n) || [],
                }));
                return newSvcs;
            });
            return;
        }
        (newNetworks[idx] as any)[field] = value;
        setNetworks(newNetworks);
    }
    function removeNetwork(idx: number) {
        const newNetworks = [...networks];
        const removedName = newNetworks[idx].name;
        newNetworks.splice(idx, 1);
        setNetworks(newNetworks);
        // Remove from all services
        const newServices = services.map(svc => ({
            ...svc,
            networks: svc.networks?.filter(n => n !== removedName) || [],
        }));
        setServices(newServices);
        // Reset selection: if no networks left, go to service; else, select first network
        if (newNetworks.length === 0) {
            setSelectedType('service');
            setSelectedNetworkIdx(null);
        } else {
            setSelectedNetworkIdx(0);
        }
    }
    // Volume management
    function addVolume() {
        setVolumes(prev => {
            const newVolumes = [...prev, defaultVolume()];
            return newVolumes;
        });
        setSelectedType('volume');
        setSelectedVolumeIdx(() => null);
        setSelectedVolumeIdx(volumes.length);
        setSelectedNetworkIdx(null);
    }
    function updateVolume(idx: number, field: keyof VolumeConfig, value: any) {
        const newVolumes = [...volumes];
        // If renaming, update all service references
        if (field === 'name') {
            const oldName = newVolumes[idx].name;
            newVolumes[idx][field] = value;
            setVolumes(newVolumes);
            setServices(prev => {
                const newSvcs = prev.map(svc => ({
                    ...svc,
                    volumes: svc.volumes?.map(v => v.host === oldName ? { ...v, host: value } : v) || [],
                }));
                return newSvcs;
            });
            return;
        }
        (newVolumes[idx] as any)[field] = value;
        setVolumes(newVolumes);
    }
    function removeVolume(idx: number) {
        const newVolumes = [...volumes];
        const removedName = newVolumes[idx].name;
        newVolumes.splice(idx, 1);
        setVolumes(newVolumes);
        // Remove from all services
        const newServices = services.map(svc => ({
            ...svc,
            volumes: svc.volumes?.filter(v => v.host !== removedName) || [],
        }));
        setServices(newServices);
        // Reset selection: if no volumes left, go to service; else, select first volume
        if (newVolumes.length === 0) {
            setSelectedType('service');
            setSelectedVolumeIdx(null);
        } else {
            setSelectedVolumeIdx(0);
        }
    }

    // Fetch compose files from GitHub when modal opens
    useEffect(() => {
        if (!composeStoreOpen) return;
        setComposeLoading(true);
        setComposeError(null);
        fetch("https://api.github.com/repos/LukeGus/Containix/contents")
            .then(res => res.json())
            .then(async (files) => {
                if (!Array.isArray(files)) {
                    setComposeFiles([]);
                    setComposeLoading(false);
                    setComposeError("Failed to load files from GitHub.");
                    return;
                }
                // Debug: log all file names
                console.log('GitHub files:', files.map((f: any) => f.name));
                const ymlFiles = files.filter((f: any) => f.type === 'file' && f.name.toLowerCase().endsWith('.yml'));
                console.log('Detected .yml files:', ymlFiles.map((f: any) => f.name));
                if (ymlFiles.length === 0) {
                    setComposeFiles([]);
                    setComposeLoading(false);
                    return;
                }
                const fileData = await Promise.all(ymlFiles.map(async (file: any) => {
                    try {
                        const rawRes = await fetch(file.download_url);
                        const rawText = await rawRes.text();
                        console.log('Raw YAML for', file.name, ':', rawText);
                        const doc = load(rawText) as any;
                        console.log('Parsed doc for', file.name, ':', doc);
                        const services = doc && doc.services ? Object.entries(doc.services).map(([svcName, svcObj]: [string, any]) => ({
                            name: svcName,
                            image: svcObj.image || '',
                            rawService: svcObj,
                        })) : [];
                        return {
                            name: file.name.replace('.yml', ''),
                            url: file.download_url,
                            services,
                            rawText,
                        };
                    } catch (e) {
                        return null;
                    }
                }));
                setComposeFiles(fileData.filter(Boolean));
                setComposeLoading(false);
            })
            .catch(e => {
                setComposeError("Failed to fetch compose files.");
                setComposeLoading(false);
            });
    }, [composeStoreOpen]);

    // Add all services from a compose file to builder state
    function handleAddComposeServices(file: any) {
        const newSvcs = file.services.map((svc: any) => ({
            ...defaultService(),
            name: svc.name,
            image: svc.image,
            // Populate more fields if needed from svc.rawService
        }));
        setServices(prev => [...prev, ...newSvcs]);
        setSelectedType('service');
        setSelectedIdx(services.length); // Focus first new service
        setComposeStoreOpen(false);
    }

    // Add a new function to import all fields from a service
    function handleAddComposeServiceFull(svc: any) {
        // Map all possible fields from the rawService
        const raw = svc.rawService || {};
        const newService: ServiceConfig = {
            ...defaultService(),
            name: svc.name,
            image: svc.image,
            command: raw.command || '',
            restart: raw.restart || '',
            ports: Array.isArray(raw.ports) ? raw.ports.map((p: string) => {
                // Format: "host:container" or just "container"
                const [host, container] = p.split(':');
                return container ? { host, container } : { host: '', container: host };
            }) : [],
            volumes: Array.isArray(raw.volumes) ? raw.volumes.map((v: string) => {
                const [host, container] = v.split(':');
                return container ? { host, container } : { host: '', container: host };
            }) : [],
            environment: Array.isArray(raw.environment) ? raw.environment.map((e: string) => {
                // Format: "KEY=VALUE"
                const [key, ...rest] = e.split('=');
                return { key, value: rest.join('=') };
            }) : [],
            healthcheck: raw.healthcheck ? {
                test: Array.isArray(raw.healthcheck.test) ? raw.healthcheck.test.join(' ') : (raw.healthcheck.test || ''),
                interval: raw.healthcheck.interval || '',
                timeout: raw.healthcheck.timeout || '',
                retries: raw.healthcheck.retries ? String(raw.healthcheck.retries) : '',
                start_period: raw.healthcheck.start_period || '',
                start_interval: raw.healthcheck.start_interval || '',
            } : undefined,
            depends_on: Array.isArray(raw.depends_on) ? raw.depends_on : (raw.depends_on ? Object.keys(raw.depends_on) : []),
            entrypoint: raw.entrypoint || '',
            env_file: raw.env_file || '',
            extra_hosts: Array.isArray(raw.extra_hosts) ? raw.extra_hosts : [],
            dns: Array.isArray(raw.dns) ? raw.dns : [],
            networks: Array.isArray(raw.networks) ? raw.networks : (raw.networks ? Object.keys(raw.networks) : []),
            user: raw.user || '',
            working_dir: raw.working_dir || '',
            labels: raw.labels ? (Array.isArray(raw.labels)
                ? raw.labels.map((l: string) => {
                    const [key, ...rest] = l.split('=');
                    return { key, value: rest.join('=') };
                })
                : Object.entries(raw.labels).map(([key, value]: [string, any]) => ({ key, value }))) : [],
            privileged: !!raw.privileged,
            read_only: !!raw.read_only,
        };
        setServices(prev => [...prev, newService]);
        setSelectedType('service');
        setSelectedIdx(services.length); // Focus new service
        setComposeStoreOpen(false);
    }

    // Initial YAML
    if (!yaml) setYaml(generateYaml(services, networks, volumes));

    const svc = selectedIdx !== null && typeof selectedIdx === 'number' && services[selectedIdx] ? services[selectedIdx] : services[0];

    const restartOptions = [
        { value: '', label: 'None' },
        { value: 'no', label: 'no' },
        { value: 'always', label: 'always' },
        { value: 'on-failure', label: 'on-failure' },
        { value: 'unless-stopped', label: 'unless-stopped' },
    ];

    // Add debug log before rendering
    console.log('composeFiles for UI:', composeFiles);

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex min-h-screen h-screen w-screen">
                <div className="w-64 h-full flex-shrink-0 flex-grow-0 bg-card border-r">
                <SidebarUI />
                </div>
                <main className="flex-1 flex flex-row h-full w-full">
                    {/* Service List Sidebar */}
                    <aside className="flex-[2_2_0%] h-full bg-card border-r flex flex-col p-4 gap-4 overflow-y-auto box-border">
                        <div className="flex items-center justify-between mb-2 w-full box-border">
                            <span className="font-bold text-lg">Services</span>
                            <Button size="sm" onClick={() => { setSelectedType('service'); setSelectedIdx(services.length); addService(); }}>+ Add</Button>
                        </div>
                        <Button variant="outline" className="mb-2" onClick={() => setComposeStoreOpen(true)}>
                            Browse Compose Store
                        </Button>
                        {/* Compose Store Custom Overlay */}
                        {composeStoreOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                                <div className="relative max-w-screen-3xl w-[98vw] min-h-[90vh] rounded-2xl border bg-background p-8 pt-4 shadow-xl">
                                    <button
                                        className="absolute top-4 right-4 text-xl text-muted-foreground hover:text-foreground"
                                        onClick={() => setComposeStoreOpen(false)}
                                        aria-label="Close Compose Store"
                                    >
                                        ×
                                    </button>
                                    <div className="mb-1 text-2xl font-bold">Compose Store</div>
                                    <div className="mb-2 mt-0 text-base text-muted-foreground">Browse and import popular self-hosted Docker Compose services.</div>
                                    <Input
                                        placeholder="Search by service name or image..."
                                        value={composeSearch}
                                        onChange={e => setComposeSearch(e.target.value)}
                                        className="mb-4 mt-0 text-base"
                                    />
                                    {composeLoading ? (
                                        <div className="h-32 flex items-center justify-center text-muted-foreground text-lg">Loading...</div>
                                    ) : composeError ? (
                                        <div className="h-32 flex items-center justify-center text-destructive text-lg">{composeError}</div>
                                    ) : composeFiles.length === 0 ? (
                                        <div className="h-32 flex items-center justify-center text-muted-foreground text-lg">No .yml files found in the repo.</div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="grid [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] gap-4 max-h-[75vh] overflow-y-auto w-full">
                                                {composeFiles.flatMap((file: any) =>
                                                    file.services
                                                        .filter((svc: any) =>
                                                            svc.name.toLowerCase().includes(composeSearch.toLowerCase()) ||
                                                            svc.image.toLowerCase().includes(composeSearch.toLowerCase())
                                                        )
                                                        .map((svc: any, idx: number) => (
                                                            <div key={file.name + '-' + svc.name} className="min-w-[300px] max-w-[340px] bg-card rounded-lg shadow p-4 flex flex-col gap-2 items-start justify-between border border-border min-h-0">
                                                                <div className="font-bold text-lg break-words w-full min-h-0">{svc.name}</div>
                                                                <div className="text-base text-muted-foreground break-words w-full min-h-0">{svc.image}</div>
                                                                <Button size="sm" className="mt-2 w-full" onClick={() => handleAddComposeServiceFull(svc)}>
                                                                    Add Service
                                                                </Button>
                                                            </div>
                                                        ))
                                                )}
                                                {composeFiles.every(file => file.services.length === 0) && (
                                                    <div className="col-span-full h-32 flex items-center justify-center text-muted-foreground text-lg">No services found in .yml files.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-2 w-full box-border">
                            {services.map((svc, idx) => (
                                <Card key={idx} className={`relative p-2 pr-8 cursor-pointer flex flex-col justify-center ${selectedType === 'service' && selectedIdx === idx ? 'border-primary border-2' : ''}`}
                                    onClick={() => { setSelectedType('service'); setSelectedIdx(idx); setSelectedNetworkIdx(null); setSelectedVolumeIdx(null); }}>
                                    <div className="flex flex-col items-start">
                                        <div className="font-semibold text-left">{svc.name || <span className="text-muted-foreground">(unnamed)</span>}</div>
                                        <div className="text-xs text-muted-foreground text-left">{svc.image || <span>no image</span>}</div>
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); removeService(idx); }} disabled={services.length === 1}
                                        className="absolute top-1 right-1">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </Button>
                                </Card>
                            ))}
                        </div>
                        <Separator className="my-2" />
                        {/* Networks Management */}
                        <div>
                            <div className="flex items-center justify-between mb-2 w-full box-border">
                                <span className="font-bold text-md">Networks</span>
                                <Button size="sm" onClick={addNetwork}>+ Add</Button>
                            </div>
                            <div className="flex flex-col gap-2 w-full box-border">
                                {networks.map((n, idx) => (
                                    <Card key={idx} className={`relative p-2 pr-8 cursor-pointer flex flex-col justify-center ${selectedType === 'network' && selectedNetworkIdx === idx ? 'border-primary border-2' : ''}`}
                                        onClick={() => { setSelectedType('network'); setSelectedNetworkIdx(idx); setSelectedIdx(null); setSelectedVolumeIdx(null); }}>
                                        <div className="flex flex-col items-start">
                                            <div className="font-semibold text-left">{n.name || <span className="text-muted-foreground">(unnamed)</span>}</div>
                                            <div className="text-xs text-muted-foreground text-left">{n.driver || <span>no driver</span>}</div>
                                        </div>
                                        <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); removeNetwork(idx); }}
                                            className="absolute top-1 right-1">
                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                        </div>
                        <Separator className="my-2" />
                        {/* Volumes Management */}
                        <div>
                            <div className="flex items-center justify-between mb-2 w-full box-border">
                                <span className="font-bold text-md">Volumes</span>
                                <Button size="sm" onClick={addVolume}>+ Add</Button>
                            </div>
                            <div className="flex flex-col gap-2 w-full box-border">
                                {volumes.map((v, idx) => (
                                    <Card key={idx} className={`relative p-2 pr-8 cursor-pointer flex flex-col justify-center ${selectedType === 'volume' && selectedVolumeIdx === idx ? 'border-primary border-2' : ''}`}
                                        onClick={() => { setSelectedType('volume'); setSelectedVolumeIdx(idx); setSelectedIdx(null); setSelectedNetworkIdx(null); }}>
                                        <div className="flex flex-col items-start">
                                            <div className="font-semibold text-left">{v.name || <span className="text-muted-foreground">(unnamed)</span>}</div>
                                            <div className="text-xs text-muted-foreground text-left">{v.driver || <span>no driver</span>}</div>
                                        </div>
                                        <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); removeVolume(idx); }}
                                            className="absolute top-1 right-1">
                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </aside>
                    {/* Service Config Panel */}
                    <section className="flex-[3_3_0%] h-full p-4 flex flex-col gap-4 bg-background border-r overflow-y-auto box-border">
                        <div className="mb-2 w-full box-border flex items-center justify-between">
                                <span className="font-bold text-lg">Service Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                    <Input value={svc.name} onChange={e => updateServiceField('name', e.target.value)} placeholder="e.g. web" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Image</Label>
                                    <Input value={svc.image} onChange={e => updateServiceField('image', e.target.value)} placeholder="e.g. nginx:latest" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Command</Label>
                                    <Input value={svc.command} onChange={e => updateServiceField('command', e.target.value)} placeholder="e.g. npm start" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Restart Policy</Label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                {restartOptions.find(opt => opt.value === svc.restart)?.label || 'None'}
                                                <svg className="ml-2" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-full">
                                            {restartOptions.map(opt => (
                                                <DropdownMenuItem key={opt.value} onClick={() => updateServiceField('restart', opt.value)}>
                                                    {opt.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                {/* Ports */}
                                <div>
                                    <Label className="mb-1 block">Ports</Label>
                                    <div className="flex flex-col gap-2">
                                        {svc.ports.map((port, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input type="number" min="1" max="65535" value={port.host} onChange={e => updatePortField(idx, 'host', e.target.value)} placeholder="Host" className="w-1/2" />
                                                <span>→</span>
                                                <Input type="number" min="1" max="65535" value={port.container} onChange={e => updatePortField(idx, 'container', e.target.value)} placeholder="Container" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => removePortField(idx)}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={addPortField}>+ Add Port</Button>
                                    </div>
                                </div>
                                {/* Volumes */}
                                <div>
                                    <Label className="mb-1 block">Volumes</Label>
                                    <div className="flex flex-col gap-2">
                                        {svc.volumes.map((vol, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={vol.host} onChange={e => updateVolumeField(idx, 'host', e.target.value)} placeholder="Host path/volume" className="w-1/2" />
                                                <span>→</span>
                                                <Input value={vol.container} onChange={e => updateVolumeField(idx, 'container', e.target.value)} placeholder="Container path" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => removeVolumeField(idx)}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={addVolumeField}>+ Add Volume</Button>
                                    </div>
                                </div>
                                {/* Environment Variables */}
                                <div>
                                    <Label className="mb-1 block">Environment Variables</Label>
                                    <div className="flex flex-col gap-2">
                                        {svc.environment.map((env, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={env.key} onChange={e => updateListField('environment', idx, { ...env, key: e.target.value })} placeholder="KEY" className="w-1/2" />
                                                <Input value={env.value} onChange={e => updateListField('environment', idx, { ...env, value: e.target.value })} placeholder="value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => removeListField('environment', idx)}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => addListField('environment')}>+ Add Variable</Button>
                                    </div>
                                </div>
                                {/* Advanced Section */}
                                <Collapsible>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="outline" className="mt-4 w-full">Advanced Options</Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-4 flex flex-col gap-4">
                                        {/* Healthcheck */}
                                        <div>
                                            <Label className="mb-1 block">Healthcheck</Label>
                                            <Input value={svc.healthcheck?.test || ''} onChange={e => updateHealthcheckField('test', e.target.value)} placeholder="Test command (e.g. CMD curl -f http://localhost)" />
                                            <div className="flex gap-2 mt-2">
                                                <Input value={svc.healthcheck?.interval || ''} onChange={e => updateHealthcheckField('interval', e.target.value)} placeholder="Interval (e.g. 1m30s)" className="w-1/2" />
                                                <Input value={svc.healthcheck?.timeout || ''} onChange={e => updateHealthcheckField('timeout', e.target.value)} placeholder="Timeout (e.g. 10s)" className="w-1/2" />
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <Input value={svc.healthcheck?.retries || ''} onChange={e => updateHealthcheckField('retries', e.target.value)} placeholder="Retries (e.g. 3)" className="w-1/2" />
                                                <Input value={svc.healthcheck?.start_period || ''} onChange={e => updateHealthcheckField('start_period', e.target.value)} placeholder="Start period (e.g. 40s)" className="w-1/2" />
                                            </div>
                                            <Input value={svc.healthcheck?.start_interval || ''} onChange={e => updateHealthcheckField('start_interval', e.target.value)} placeholder="Start interval (e.g. 5s)" className="mt-2" />
                                        </div>
                                        {/* Depends On */}
                                        <div>
                                            <Label className="mb-1 block">Depends On</Label>
                                            <div className="flex flex-col gap-2">
                                                {svc.depends_on?.map((dep, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <Input value={dep} onChange={e => updateDependsOn(idx, e.target.value)} placeholder="Service name" />
                                                        <Button size="icon" variant="ghost" onClick={() => removeDependsOn(idx)}>
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button size="sm" variant="outline" onClick={addDependsOn}>+ Add Dependency</Button>
                                            </div>
                                        </div>
                                        {/* Entrypoint */}
                                        <div>
                                            <Label className="mb-1 block">Entrypoint</Label>
                                            <Input value={svc.entrypoint || ''} onChange={e => updateServiceField('entrypoint', e.target.value)} placeholder="Entrypoint" />
                                        </div>
                                        {/* Env File */}
                                        <div>
                                            <Label className="mb-1 block">Env File</Label>
                                            <Input value={svc.env_file || ''} onChange={e => updateServiceField('env_file', e.target.value)} placeholder=".env file path" />
                                        </div>
                                        {/* Extra Hosts */}
                                        <div>
                                            <Label className="mb-1 block">Extra Hosts</Label>
                                            <Input value={svc.extra_hosts?.join(',') || ''} onChange={e => updateServiceField('extra_hosts', e.target.value.split(','))} placeholder="host1:ip1,host2:ip2" />
                                        </div>
                                        {/* DNS */}
                                        <div>
                                            <Label className="mb-1 block">DNS</Label>
                                            <Input value={svc.dns?.join(',') || ''} onChange={e => updateServiceField('dns', e.target.value.split(','))} placeholder="8.8.8.8,8.8.4.4" />
                                        </div>
                                        {/* Networks */}
                                        <div>
                                            <Label className="mb-1 block">Networks</Label>
                                            <Input value={svc.networks?.join(',') || ''} onChange={e => updateServiceField('networks', e.target.value.split(','))} placeholder="network1,network2" />
                                        </div>
                                        {/* User */}
                                        <div>
                                            <Label className="mb-1 block">User</Label>
                                            <Input value={svc.user || ''} onChange={e => updateServiceField('user', e.target.value)} placeholder="user" />
                                        </div>
                                        {/* Working Dir */}
                                        <div>
                                            <Label className="mb-1 block">Working Dir</Label>
                                            <Input value={svc.working_dir || ''} onChange={e => updateServiceField('working_dir', e.target.value)} placeholder="/app" />
                                        </div>
                                        {/* Labels */}
                                        <div>
                                            <Label className="mb-1 block">Labels</Label>
                                            <div className="flex flex-col gap-2">
                                                {svc.labels?.map((label, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <Input value={label.key} onChange={e => {
                                                            const newLabels = [...(svc.labels || [])];
                                                            newLabels[idx] = { ...newLabels[idx], key: e.target.value };
                                                            updateServiceField('labels', newLabels);
                                                        }} placeholder="Key" className="w-1/2" />
                                                        <Input value={label.value} onChange={e => {
                                                            const newLabels = [...(svc.labels || [])];
                                                            newLabels[idx] = { ...newLabels[idx], value: e.target.value };
                                                            updateServiceField('labels', newLabels);
                                                        }} placeholder="Value" className="w-1/2" />
                                                        <Button size="icon" variant="ghost" onClick={() => {
                                                            const newLabels = [...(svc.labels || [])];
                                                            newLabels.splice(idx, 1);
                                                            updateServiceField('labels', newLabels);
                                                        }}>
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button size="sm" variant="outline" onClick={() => updateServiceField('labels', [...(svc.labels || []), { key: '', value: '' }])}>+ Add Label</Button>
                                            </div>
                                        </div>
                                        {/* Privileged */}
                                        <div className="flex items-center gap-2">
                                            <Toggle pressed={!!svc.privileged} onPressedChange={v => updateServiceField('privileged', v)} aria-label="Privileged" className="border rounded px-2 py-1">
                                                <span className="select-none">Privileged</span>
                                            </Toggle>
                                        </div>
                                        {/* Read Only */}
                                        <div className="flex items-center gap-2">
                                            <Toggle pressed={!!svc.read_only} onPressedChange={v => updateServiceField('read_only', v)} aria-label="Read Only" className="border rounded px-2 py-1">
                                                <span className="select-none">Read Only</span>
                                            </Toggle>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        </section>
                    {/* Docker Compose File Panel */}
                    <section className="flex-[5_5_0%] h-full pl-4 pr-2 pb-6 pt-2 flex flex-col bg-background box-border overflow-hidden">
                        <div className="mb-2 w-full box-border flex items-center justify-between">
                            <span className="font-bold text-lg">Docker Compose File</span>
                        </div>
                        <div ref={codeFileRef} className="flex-1 w-full h-full min-h-0 min-w-0 overflow-hidden">
                            <CodeEditor content={yaml} onContentChange={() => {}} width={editorSize.width} height={editorSize.height} />
                        </div>
                    </section>
                </main>
            </div>
        </ThemeProvider>
    );
}