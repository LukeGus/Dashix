import { useState } from "react";
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

function defaultNetwork(name: string): NetworkConfig {
    return { name, driver: '', driver_opts: [], attachable: false, labels: [] };
}
function defaultVolume(name: string): VolumeConfig {
    return { name, driver: '', driver_opts: [], labels: [] };
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

    // Generate YAML from services state
    function generateYaml(services: ServiceConfig[]): string {
        // Collect referenced networks/volumes
        const referencedNetworks = new Set<string>();
        const referencedVolumes = new Set<string>();
        services.forEach(svc => {
            svc.networks?.forEach(n => n && referencedNetworks.add(n));
            svc.volumes?.forEach(v => {
                if (v.host) referencedVolumes.add(v.host);
            });
        });
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
        // Add top-level networks/volumes if referenced
        if (referencedNetworks.size) {
            compose.networks = {};
            networks.forEach(n => {
                if (referencedNetworks.has(n.name)) {
                    compose.networks[n.name] = {
                        driver: n.driver || undefined,
                        attachable: n.attachable ? true : undefined,
                        driver_opts: n.driver_opts && n.driver_opts.length ? n.driver_opts.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                        labels: n.labels && n.labels.length ? n.labels.filter(l => l.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                    };
                    Object.keys(compose.networks[n.name]).forEach(
                        (k) => compose.networks[n.name][k] === undefined && delete compose.networks[n.name][k]
                    );
                }
            });
        }
        if (referencedVolumes.size) {
            compose.volumes = {};
            volumes.forEach(v => {
                if (referencedVolumes.has(v.name)) {
                    compose.volumes[v.name] = {
                        driver: v.driver || undefined,
                        driver_opts: v.driver_opts && v.driver_opts.length ? v.driver_opts.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                        labels: v.labels && v.labels.length ? v.labels.filter(l => l.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                    };
                    Object.keys(compose.volumes[v.name]).forEach(
                        (k) => compose.volumes[v.name][k] === undefined && delete compose.volumes[v.name][k]
                    );
                }
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

    // Update YAML whenever services change
    function updateYaml(svcs: ServiceConfig[]) {
        setYaml(generateYaml(svcs));
    }

    // Handle service field change
    function updateServiceField(field: keyof ServiceConfig, value: any) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx] as any)[field] = value;
        setServices(newServices);
        updateYaml(newServices);
    }

    // Handle dynamic list field change (ports, volumes, env)
    function updateListField(field: keyof ServiceConfig, idx: number, value: any) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx][field] as any[])[idx] = value;
        setServices(newServices);
        updateYaml(newServices);
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
        updateYaml(newServices);
    }

    function removeListField(field: keyof ServiceConfig, idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx][field] as any[]).splice(idx, 1);
        setServices(newServices);
        updateYaml(newServices);
    }

    // Add/remove/select service
    function addService() {
        setServices([...services, defaultService()]);
        setSelectedIdx(services.length);
        setTimeout(() => updateYaml([...services, defaultService()]), 0);
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
        updateYaml(newServices);
    }
    function selectService(idx: number) {
        setSelectedIdx(idx);
    }

    // Update port field
    function updatePortField(idx: number, field: 'host' | 'container', value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports[idx][field] = value.replace(/[^0-9]/g, '');
        setServices(newServices);
        updateYaml(newServices);
    }
    function addPortField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.push({ host: '', container: '' });
        setServices(newServices);
        updateYaml(newServices);
    }
    function removePortField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.splice(idx, 1);
        setServices(newServices);
        updateYaml(newServices);
    }

    // Update volume field
    function updateVolumeField(idx: number, field: 'host' | 'container', value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes[idx][field] = value;
        setServices(newServices);
        updateYaml(newServices);
    }
    function addVolumeField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.push({ host: '', container: '' });
        setServices(newServices);
        updateYaml(newServices);
    }
    function removeVolumeField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.splice(idx, 1);
        setServices(newServices);
        updateYaml(newServices);
    }

    // Update healthcheck field
    function updateHealthcheckField(field: keyof Healthcheck, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].healthcheck) newServices[selectedIdx].healthcheck = { test: '', interval: '', timeout: '', retries: '', start_period: '', start_interval: '' };
        newServices[selectedIdx].healthcheck![field] = value;
        setServices(newServices);
        updateYaml(newServices);
    }
    function addHealthcheckField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].healthcheck) newServices[selectedIdx].healthcheck = { test: '', interval: '', timeout: '', retries: '', start_period: '', start_interval: '' };
        newServices[selectedIdx].healthcheck!.test = '';
        setServices(newServices);
        updateYaml(newServices);
    }
    function removeHealthcheckField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].healthcheck = undefined;
        setServices(newServices);
        updateYaml(newServices);
    }

    // Update depends_on field
    function updateDependsOn(idx: number, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].depends_on![idx] = value;
        setServices(newServices);
        updateYaml(newServices);
    }
    function addDependsOn() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].depends_on) newServices[selectedIdx].depends_on = [];
        newServices[selectedIdx].depends_on!.push('');
        setServices(newServices);
        updateYaml(newServices);
    }
    function removeDependsOn(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].depends_on!.splice(idx, 1);
        setServices(newServices);
        updateYaml(newServices);
    }

    // Network management
    function addNetwork() {
        setNetworks([...networks, defaultNetwork('network' + (networks.length + 1))]);
        setSelectedType('network');
        setSelectedNetworkIdx(() => null);
        setSelectedVolumeIdx(() => null);
    }
    function updateNetwork(idx: number, field: keyof NetworkConfig, value: any) {
        const newNetworks = [...networks];
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
        updateYaml(newServices);
        setSelectedType('service');
        setSelectedNetworkIdx(() => null);
    }
    // Volume management
    function addVolume() {
        setVolumes([...volumes, defaultVolume('volume' + (volumes.length + 1))]);
        setSelectedType('volume');
        setSelectedVolumeIdx(() => null);
        setSelectedVolumeIdx(volumes.length);
        setSelectedNetworkIdx(null);
    }
    function updateVolume(idx: number, field: keyof VolumeConfig, value: any) {
        const newVolumes = [...volumes];
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
        updateYaml(newServices);
        setSelectedType('service');
        setSelectedVolumeIdx(null);
    }

    // Initial YAML
    if (!yaml) updateYaml(services);

    const svc = selectedIdx !== null && typeof selectedIdx === 'number' && services[selectedIdx] ? services[selectedIdx] : services[0];

    const restartOptions = [
        { value: '', label: 'None' },
        { value: 'no', label: 'no' },
        { value: 'always', label: 'always' },
        { value: 'on-failure', label: 'on-failure' },
        { value: 'unless-stopped', label: 'unless-stopped' },
    ];

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex min-h-screen">
                <SidebarUI />
                <main className="flex-1 flex flex-row p-0 m-0 bg-background">
                    {/* Service List Sidebar */}
                    <aside className="w-64 bg-card border-r flex flex-col p-4 gap-4 overflow-y-auto overflow-x-hidden max-h-screen">
                        <div className="flex items-center justify-between mb-2 w-full box-border">
                            <span className="font-bold text-lg">Services</span>
                            <Button size="sm" onClick={() => { setSelectedType('service'); setSelectedIdx(services.length); addService(); }}>+ Add</Button>
                        </div>
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
                    {/* Config Panel */}
                    {/* Only one configuration panel at a time */}
                    {selectedType === 'service' && typeof selectedIdx === 'number' && services[selectedIdx] ? (
                        <section className="w-[420px] max-w-[40vw] p-8 flex flex-col gap-4 bg-background border-r overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                            <div className="mb-2 w-full box-border">
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
                    ) : selectedType === 'network' && selectedNetworkIdx !== null && networks[selectedNetworkIdx] ? (
                        <section className="w-[420px] max-w-[40vw] p-8 flex flex-col gap-4 bg-background border-r overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                            <div className="mb-2 w-full box-border">
                                <span className="font-bold text-lg">Network Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                    <Input value={networks[selectedNetworkIdx].name} onChange={e => updateNetwork(selectedNetworkIdx, 'name', e.target.value)} />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Driver</Label>
                                    <Input value={networks[selectedNetworkIdx].driver} onChange={e => updateNetwork(selectedNetworkIdx, 'driver', e.target.value)} placeholder="e.g. bridge" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Toggle pressed={!!networks[selectedNetworkIdx].attachable} onPressedChange={v => updateNetwork(selectedNetworkIdx, 'attachable', v)} aria-label="Attachable" className="border rounded px-2 py-1">
                                        <span className="select-none font-medium">Attachable</span>
                                    </Toggle>
                                    <span className="text-xs text-muted-foreground">(Allow standalone containers to connect)</span>
                                </div>
                                {/* Driver Opts */}
                                <div>
                                    <Label className="mb-1 block">Driver Options</Label>
                                    <div className="flex flex-col gap-2">
                                        {networks[selectedNetworkIdx].driver_opts.map((opt, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={opt.key} onChange={e => {
                                                    const opts = [...networks[selectedNetworkIdx].driver_opts];
                                                    opts[idx] = { ...opts[idx], key: e.target.value };
                                                    updateNetwork(selectedNetworkIdx, 'driver_opts', opts);
                                                }} placeholder="Key" className="w-1/2" />
                                                <Input value={opt.value} onChange={e => {
                                                    const opts = [...networks[selectedNetworkIdx].driver_opts];
                                                    opts[idx] = { ...opts[idx], value: e.target.value };
                                                    updateNetwork(selectedNetworkIdx, 'driver_opts', opts);
                                                }} placeholder="Value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    const opts = [...networks[selectedNetworkIdx].driver_opts];
                                                    opts.splice(idx, 1);
                                                    updateNetwork(selectedNetworkIdx, 'driver_opts', opts);
                                                }}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => updateNetwork(selectedNetworkIdx, 'driver_opts', [...networks[selectedNetworkIdx].driver_opts, { key: '', value: '' }])}>+ Add Option</Button>
                                    </div>
                                </div>
                                {/* Labels */}
                                <div>
                                    <Label className="mb-1 block">Labels</Label>
                                    <div className="flex flex-col gap-2">
                                        {networks[selectedNetworkIdx].labels.map((label, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={label.key} onChange={e => {
                                                    const labels = [...networks[selectedNetworkIdx].labels];
                                                    labels[idx] = { ...labels[idx], key: e.target.value };
                                                    updateNetwork(selectedNetworkIdx, 'labels', labels);
                                                }} placeholder="Key" className="w-1/2" />
                                                <Input value={label.value} onChange={e => {
                                                    const labels = [...networks[selectedNetworkIdx].labels];
                                                    labels[idx] = { ...labels[idx], value: e.target.value };
                                                    updateNetwork(selectedNetworkIdx, 'labels', labels);
                                                }} placeholder="Value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    const labels = [...networks[selectedNetworkIdx].labels];
                                                    labels.splice(idx, 1);
                                                    updateNetwork(selectedNetworkIdx, 'labels', labels);
                                                }}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => updateNetwork(selectedNetworkIdx, 'labels', [...networks[selectedNetworkIdx].labels, { key: '', value: '' }])}>+ Add Label</Button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : selectedType === 'volume' && selectedVolumeIdx !== null && volumes[selectedVolumeIdx] ? (
                        <section className="w-[420px] max-w-[40vw] p-8 flex flex-col gap-4 bg-background border-r overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                            <div className="mb-2 w-full box-border">
                                <span className="font-bold text-lg">Volume Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                    <Input value={volumes[selectedVolumeIdx].name} onChange={e => updateVolume(selectedVolumeIdx, 'name', e.target.value)} />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Driver</Label>
                                    <Input value={volumes[selectedVolumeIdx].driver} onChange={e => updateVolume(selectedVolumeIdx, 'driver', e.target.value)} placeholder="e.g. local" />
                                </div>
                                {/* Driver Opts */}
                                <div>
                                    <Label className="mb-1 block">Driver Options</Label>
                                    <div className="flex flex-col gap-2">
                                        {volumes[selectedVolumeIdx].driver_opts.map((opt, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={opt.key} onChange={e => {
                                                    const opts = [...volumes[selectedVolumeIdx].driver_opts];
                                                    opts[idx] = { ...opts[idx], key: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'driver_opts', opts);
                                                }} placeholder="Key" className="w-1/2" />
                                                <Input value={opt.value} onChange={e => {
                                                    const opts = [...volumes[selectedVolumeIdx].driver_opts];
                                                    opts[idx] = { ...opts[idx], value: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'driver_opts', opts);
                                                }} placeholder="Value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    const opts = [...volumes[selectedVolumeIdx].driver_opts];
                                                    opts.splice(idx, 1);
                                                    updateVolume(selectedVolumeIdx, 'driver_opts', opts);
                                                }}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => updateVolume(selectedVolumeIdx, 'driver_opts', [...volumes[selectedVolumeIdx].driver_opts, { key: '', value: '' }])}>+ Add Option</Button>
                                    </div>
                                </div>
                                {/* Labels */}
                                <div>
                                    <Label className="mb-1 block">Labels</Label>
                                    <div className="flex flex-col gap-2">
                                        {volumes[selectedVolumeIdx].labels.map((label, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={label.key} onChange={e => {
                                                    const labels = [...volumes[selectedVolumeIdx].labels];
                                                    labels[idx] = { ...labels[idx], key: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'labels', labels);
                                                }} placeholder="Key" className="w-1/2" />
                                                <Input value={label.value} onChange={e => {
                                                    const labels = [...volumes[selectedVolumeIdx].labels];
                                                    labels[idx] = { ...labels[idx], value: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'labels', labels);
                                                }} placeholder="Value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    const labels = [...volumes[selectedVolumeIdx].labels];
                                                    labels.splice(idx, 1);
                                                    updateVolume(selectedVolumeIdx, 'labels', labels);
                                                }}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => updateVolume(selectedVolumeIdx, 'labels', [...volumes[selectedVolumeIdx].labels, { key: '', value: '' }])}>+ Add Label</Button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        // Default: show first service config if nothing else is selected
                        <section className="w-[420px] max-w-[40vw] p-8 flex flex-col gap-4 bg-background border-r overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                            <div className="mb-2 w-full box-border">
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
                    )}
                    {/* YAML Code Editor */}
                    <section className="flex-1 flex flex-col p-8 bg-background overflow-y-auto overflow-x-hidden max-h-screen min-w-0">
                        <div className="mb-2 flex items-center justify-between w-full box-border">
                            <span className="font-bold text-lg">Docker Compose File</span>
                        </div>
                        <CodeEditor content={yaml} onContentChange={() => {}} />
                    </section>
                </main>
            </div>
        </ThemeProvider>
    );
}