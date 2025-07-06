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
import { load } from "js-yaml";

export const Route = createFileRoute('/docker/compose-builder')({
    component: App,
});

interface PortMapping { host: string; container: string; protocol: string; }
interface VolumeMapping { host: string; container: string; read_only?: boolean; }
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
    container_name?: string;
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
    shm_size?: string;
    security_opt?: string[];
}

interface NetworkConfig {
    name: string;
    driver: string;
    driver_opts: { key: string; value: string }[];
    attachable: boolean;
    labels: { key: string; value: string }[];
    external: boolean;
    name_external: string;
    internal: boolean;
    enable_ipv6: boolean;
    ipam: {
        driver: string;
        config: { subnet: string; gateway: string }[];
        options: { key: string; value: string }[];
    };
}
interface VolumeConfig {
    name: string;
    driver: string;
    driver_opts: { key: string; value: string }[];
    labels: { key: string; value: string }[];
    external: boolean;
    name_external: string;
    driver_opts_type: string;
    driver_opts_device: string;
    driver_opts_o: string;
}

function defaultService(): ServiceConfig {
    return {
        name: '',
        image: '',
        container_name: '',
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
        privileged: undefined,
        read_only: undefined,
        shm_size: '',
        security_opt: [],
    };
}

function defaultNetwork(): NetworkConfig {
    return { 
        name: '', 
        driver: '', 
        driver_opts: [], 
        attachable: false, 
        labels: [],
        external: false,
        name_external: '',
        internal: false,
        enable_ipv6: false,
        ipam: {
            driver: '',
            config: [],
            options: []
        }
    };
}
function defaultVolume(): VolumeConfig {
    return { name: '', driver: '', driver_opts: [], labels: [], external: false, name_external: '', driver_opts_type: '', driver_opts_device: '', driver_opts_o: '' };
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
    const [composeFiles, setComposeFiles] = useState<any[]>([]);
    const [composeLoading, setComposeLoading] = useState(false);
    const [composeError, setComposeError] = useState<string | null>(null);
    const [composeSearch, setComposeSearch] = useState("");
    const [composeCache, setComposeCache] = useState<any[]>(() => {
        const cached = localStorage.getItem('composeStoreCache');
        return cached ? JSON.parse(cached) : [];
    });
    const [composeCacheTimestamp, setComposeCacheTimestamp] = useState<number | null>(() => {
        const cached = localStorage.getItem('composeStoreCacheTimestamp');
        return cached ? parseInt(cached) : null;
    });
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

    function generateYaml(services: ServiceConfig[], networks: NetworkConfig[], volumes: VolumeConfig[]): string {
        const compose: any = { services: {} };
        services.forEach((svc) => {
            if (!svc.name) return;

            const parseCommandString = (cmd: string): string[] => {
                if (!cmd) return [];
                if (Array.isArray(cmd)) {
                    return cmd;
                }

                try {
                    const parsed = JSON.parse(cmd);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                } catch (e) {
                }
                const parts = cmd.match(/(?:"[^"]*"|'[^']*'|\S+)/g) || [];
                return parts.map(part => {
                    const trimmed = part.replace(/^["']|["']$/g, '');
                    return trimmed;
                });
            };
            
            compose.services[svc.name] = {
                image: svc.image || undefined,
                container_name: svc.container_name || undefined,
                command: svc.command ? parseCommandString(svc.command) : undefined,
                restart: svc.restart || undefined,
                ports: svc.ports.length
                    ? svc.ports.map(p => p.host && p.container ? `${p.host}:${p.container}/${p.protocol || 'tcp'}` : p.container ? p.container : undefined).filter(Boolean)
                    : undefined,
                volumes: svc.volumes.length
                    ? svc.volumes.map(v => {
                        if (v.host && v.container) {
                            return v.read_only ? `${v.host}:${v.container}:ro` : `${v.host}:${v.container}`;
                        }
                        return v.container ? v.container : undefined;
                    }).filter(Boolean)
                    : undefined,
                environment: svc.environment.length
                    ? svc.environment.filter(({ key }) => key).map(({ key, value }) => `${key}=${value}`)
                    : undefined,
                healthcheck: svc.healthcheck && svc.healthcheck.test ? {
                    test: parseCommandString(svc.healthcheck.test),
                    interval: svc.healthcheck.interval || undefined,
                    timeout: svc.healthcheck.timeout || undefined,
                    retries: svc.healthcheck.retries || undefined,
                    start_period: svc.healthcheck.start_period || undefined,
                    start_interval: svc.healthcheck.start_interval || undefined,
                } : undefined,
                depends_on: svc.depends_on && svc.depends_on.filter(Boolean).length ? svc.depends_on.filter(Boolean) : undefined,
                entrypoint: svc.entrypoint ? parseCommandString(svc.entrypoint) : undefined,
                env_file: svc.env_file && svc.env_file.trim() ? svc.env_file.split(',').map(f => f.trim()) : undefined,
                extra_hosts: svc.extra_hosts && svc.extra_hosts.filter(Boolean).length ? svc.extra_hosts.filter(Boolean) : undefined,
                dns: svc.dns && svc.dns.filter(Boolean).length ? svc.dns.filter(Boolean) : undefined,
                networks: svc.networks && svc.networks.filter(Boolean).length ? svc.networks.filter(Boolean) : undefined,
                user: svc.user ? `"${svc.user}"` : undefined,
                working_dir: svc.working_dir || undefined,
                labels: svc.labels && svc.labels.filter(l => l.key).length ? svc.labels.filter(l => l.key).map(({ key, value }) => `"${key}=${value}"`) : undefined,
                privileged: svc.privileged !== undefined ? svc.privileged : undefined,
                read_only: svc.read_only !== undefined ? svc.read_only : undefined,
                shm_size: svc.shm_size || undefined,
                security_opt: svc.security_opt && svc.security_opt.filter(Boolean).length ? svc.security_opt.filter(Boolean) : undefined,
            };
        });
        for (const name in compose.services) {
            Object.keys(compose.services[name]).forEach(
                (k) => compose.services[name][k] === undefined && delete compose.services[name][k]
            );
        }
        if (networks.length) {
            compose.networks = {};
            networks.forEach(n => {
                if (!n.name) return;
                if (n.external) {
                    compose.networks[n.name] = {
                        external: n.name_external ? { name: n.name_external } : true,
                    };
                } else {
                compose.networks[n.name] = {
                    driver: n.driver || undefined,
                    attachable: n.attachable !== undefined ? n.attachable : undefined,
                        internal: n.internal !== undefined ? n.internal : undefined,
                        enable_ipv6: n.enable_ipv6 !== undefined ? n.enable_ipv6 : undefined,
                    driver_opts: n.driver_opts && n.driver_opts.length ? n.driver_opts.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                        labels: n.labels && n.labels.length ? n.labels.filter(l => l.key).map(({ key, value }) => `"${key}=${value}"`) : undefined,
                        ipam: (n.ipam.driver || n.ipam.config.length || n.ipam.options.length) ? {
                            driver: n.ipam.driver || undefined,
                            config: n.ipam.config.length ? n.ipam.config : undefined,
                            options: n.ipam.options.length ? n.ipam.options.filter(opt => opt.key).reduce((acc, { key, value }) => { acc[key] = value; return acc; }, {} as Record<string, string>) : undefined,
                        } : undefined,
                };
                }
                Object.keys(compose.networks[n.name]).forEach(
                    (k) => compose.networks[n.name][k] === undefined && delete compose.networks[n.name][k]
                );
            });
        }
        if (volumes.length) {
            compose.volumes = {};
            volumes.forEach(v => {
                if (!v.name) return;
                if (v.external) {
                    const externalVolume: any = {
                        external: v.name_external ? { name: v.name_external } : true,
                    };

                    if (v.driver) {
                        externalVolume.driver = v.driver;
                    }

                    const driverOpts: Record<string, string> = {};

                    if (v.driver_opts && v.driver_opts.length) {
                        v.driver_opts.filter(opt => opt.key).forEach(({ key, value }) => {
                            driverOpts[key] = value;
                        });
                    }

                    if (v.driver_opts_type) driverOpts.type = v.driver_opts_type;
                    if (v.driver_opts_device) driverOpts.device = v.driver_opts_device;
                    if (v.driver_opts_o) driverOpts.o = v.driver_opts_o;

                    if (Object.keys(driverOpts).length > 0) {
                        externalVolume.driver_opts = driverOpts;
                    }

                    if (v.labels && v.labels.length) {
                        externalVolume.labels = v.labels.filter(l => l.key).map(({ key, value }) => `"${key}=${value}"`);
                    }
                    
                    compose.volumes[v.name] = externalVolume;
                } else {
                    const driverOpts: Record<string, string> = {};

                    if (v.driver_opts && v.driver_opts.length) {
                        v.driver_opts.filter(opt => opt.key).forEach(({ key, value }) => {
                            driverOpts[key] = value;
                        });
                    }

                    if (v.driver_opts_type) driverOpts.type = v.driver_opts_type;
                    if (v.driver_opts_device) driverOpts.device = v.driver_opts_device;
                    if (v.driver_opts_o) driverOpts.o = v.driver_opts_o;
                    
                    compose.volumes[v.name] = {
                        driver: v.driver || undefined,
                        driver_opts: Object.keys(driverOpts).length > 0 ? driverOpts : undefined,
                        labels: v.labels && v.labels.length ? v.labels.filter(l => l.key).map(({ key, value }) => `"${key}=${value}"`) : undefined,
                    };
                }
                Object.keys(compose.volumes[v.name]).forEach(
                    (k) => compose.volumes[v.name][k] === undefined && delete compose.volumes[v.name][k]
                );
            });
        }
        return yamlStringify(compose);
    }

    function yamlStringify(obj: any, indent = 0, parentKey = ''): string {
        const pad = (n: number) => '  '.repeat(n);
        if (typeof obj !== 'object' || obj === null) return String(obj);
        if (Array.isArray(obj)) {
            const shouldBeSingleLine = ['command', 'entrypoint'].includes(parentKey) || 
                                     (parentKey === 'test' && indent > 0);
            if (shouldBeSingleLine && obj.length > 0 && typeof obj[0] === 'string') {
                return `[${obj.map(v => `"${v}"`).join(', ')}]`;
            }
            return obj.map((v) => `\n${pad(indent)}- ${yamlStringify(v, indent + 1, parentKey).trimStart()}`).join('');
        }
        const entries = Object.entries(obj)
            .map(([k, v]) => {
                if (v === undefined) return '';
                if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                    return `\n${pad(indent)}${k}:` + yamlStringify(v, indent + 1, k);
                }
                if (Array.isArray(v)) {
                    if (['command', 'entrypoint'].includes(k) || (k === 'test' && indent > 0)) {
                        return `\n${pad(indent)}${k}: [${v.map(item => `"${item}"`).join(', ')}]`;
                    }
                    return `\n${pad(indent)}${k}: ` + yamlStringify(v, indent + 1, k);
                }
                return `\n${pad(indent)}${k}: ${v}`;
            })
            .join('');
        return indent === 0 && entries.startsWith('\n') ? entries.slice(1) : entries;
    }

    useEffect(() => {
        setYaml(generateYaml(services, networks, volumes));
    }, [services, networks, volumes]);

    function updateServiceField(field: keyof ServiceConfig, value: any) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx] as any)[field] = value;
        setServices(newServices);
    }

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

    function addService() {
        const newServices = [...services, defaultService()];
        setServices(newServices);
        setSelectedIdx(services.length);
        setSelectedType('service');
        setSelectedNetworkIdx(null);
        setSelectedVolumeIdx(null);
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

    function updatePortField(idx: number, field: 'host' | 'container' | 'protocol', value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (field === 'protocol') {
            newServices[selectedIdx].ports[idx][field] = value;
        } else {
            newServices[selectedIdx].ports[idx][field] = value.replace(/[^0-9]/g, '');
        }
        setServices(newServices);
    }
    function addPortField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.push({ host: '', container: '', protocol: 'tcp' });
        setServices(newServices);
    }
    function removePortField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].ports.splice(idx, 1);
        setServices(newServices);
    }

    function updateVolumeField(idx: number, field: 'host' | 'container' | 'read_only', value: string | boolean) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        (newServices[selectedIdx].volumes[idx] as any)[field] = value;
        setServices(newServices);
    }
    function addVolumeField() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.push({ host: '', container: '', read_only: false });
        setServices(newServices);
    }
    function removeVolumeField(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].volumes.splice(idx, 1);
        setServices(newServices);
    }

    function updateHealthcheckField(field: keyof Healthcheck, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].healthcheck) newServices[selectedIdx].healthcheck = { test: '', interval: '', timeout: '', retries: '', start_period: '', start_interval: '' };
        newServices[selectedIdx].healthcheck![field] = value;
        setServices(newServices);
    }

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

    function updateSecurityOpt(idx: number, value: string) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].security_opt![idx] = value;
        setServices(newServices);
    }
    function addSecurityOpt() {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        if (!newServices[selectedIdx].security_opt) newServices[selectedIdx].security_opt = [];
        newServices[selectedIdx].security_opt!.push('');
        setServices(newServices);
    }
    function removeSecurityOpt(idx: number) {
        if (typeof selectedIdx !== 'number') return;
        const newServices = [...services];
        newServices[selectedIdx].security_opt!.splice(idx, 1);
        setServices(newServices);
    }

    function addNetwork() {
        const newNetworks = [...networks, defaultNetwork()];
        setNetworks(newNetworks);
        setSelectedType('network');
        setSelectedNetworkIdx(newNetworks.length - 1);
        setSelectedIdx(null);
        setSelectedVolumeIdx(null);
    }
    function updateNetwork(idx: number, field: keyof NetworkConfig, value: any) {
        const newNetworks = [...networks];
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
        const newServices = services.map(svc => ({
            ...svc,
            networks: svc.networks?.filter(n => n !== removedName) || [],
        }));
        setServices(newServices);
        if (newNetworks.length === 0) {
            setSelectedType('service');
            setSelectedNetworkIdx(null);
        } else {
            setSelectedNetworkIdx(0);
        }
    }
    function addVolume() {
        const newVolumes = [...volumes, defaultVolume()];
        setVolumes(newVolumes);
        setSelectedType('volume');
        setSelectedVolumeIdx(newVolumes.length - 1);
        setSelectedIdx(null);
        setSelectedNetworkIdx(null);
    }
    function updateVolume(idx: number, field: keyof VolumeConfig, value: any) {
        const newVolumes = [...volumes];
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
        const newServices = services.map(svc => ({
            ...svc,
            volumes: svc.volumes?.filter(v => v.host !== removedName) || [],
        }));
        setServices(newServices);
        if (newVolumes.length === 0) {
            setSelectedType('service');
            setSelectedVolumeIdx(null);
        } else {
            setSelectedVolumeIdx(0);
        }
    }

    useEffect(() => {
        if (!composeStoreOpen) return;
        
        const CACHE_DURATION = 60 * 60 * 1000;
        const now = Date.now();

        if (composeCache.length > 0 && composeCacheTimestamp && (now - composeCacheTimestamp) < CACHE_DURATION) {
            setComposeFiles(composeCache);
            setComposeLoading(false);
            setComposeError(null);
            return;
        }
        
        setComposeLoading(true);
        setComposeError(null);

        const workerUrl = 'https://dashix-compose-store.bugattiguy527.workers.dev';
        
        fetch(workerUrl)
            .then(res => res.json())
            .then(async (data) => {
                if (data.error) {
                    setComposeFiles([]);
                    setComposeCache([]);
                    setComposeCacheTimestamp(null);
                    localStorage.removeItem('composeStoreCache');
                    localStorage.removeItem('composeStoreCacheTimestamp');
                    setComposeLoading(false);
                    setComposeError(data.message || "Failed to load files from cache.");
                    return;
                }
                
                if (!data.files || data.files.length === 0) {
                    setComposeFiles([]);
                    setComposeCache([]);
                    setComposeCacheTimestamp(null);
                    localStorage.removeItem('composeStoreCache');
                    localStorage.removeItem('composeStoreCacheTimestamp');
                    setComposeLoading(false);
                    return;
                }
                
                const fileData = await Promise.all(data.files.map(async (file: any) => {
                    try {
                        const doc = load(file.rawText) as any;
                        const servicesArray = doc && doc.services ? Object.entries(doc.services).map(([svcName, svcObj]: [string, any]) => {
                            return {
                                name: svcName,
                                image: svcObj.image || '',
                                rawService: svcObj,
                            };
                        }) : [];

                        const servicesObject = servicesArray.reduce((acc, service) => {
                            acc[service.name] = service;
                            return acc;
                        }, {} as Record<string, any>);
                        
                        return {
                            name: file.name,
                            url: file.url,
                            services: servicesObject,
                            networks: doc && doc.networks ? doc.networks : {},
                            volumes: doc && doc.volumes ? doc.volumes : {},
                            rawText: file.rawText,
                        };
                    } catch (e) {
                        return null;
                    }
                }));
                
                const filteredData = fileData.filter(Boolean);
                setComposeFiles(filteredData);
                setComposeCache(filteredData);
                setComposeCacheTimestamp(now);
                localStorage.setItem('composeStoreCache', JSON.stringify(filteredData));
                localStorage.setItem('composeStoreCacheTimestamp', now.toString());
                setComposeLoading(false);
            })
            .catch(() => {
                setComposeError("Failed to fetch compose files from cache.");
                setComposeLoading(false);
            });
    }, [composeStoreOpen, composeCache, composeCacheTimestamp]);

    function refreshComposeStore() {
        setComposeCache([]);
        setComposeCacheTimestamp(null);
        localStorage.removeItem('composeStoreCache');
        localStorage.removeItem('composeStoreCacheTimestamp');
    }

    function handleAddComposeServiceFull(svc: any, allNetworks: any, allVolumes: any) {
        const serviceData = svc.rawService || {};

        const actualServiceData = serviceData.rawService || serviceData;

        const parseCommandArray = (cmd: any): string => {
            if (Array.isArray(cmd)) {
                return JSON.stringify(cmd);
            }
            return cmd || '';
        };
        
        const newService: ServiceConfig = {
            ...defaultService(),
            name: svc.name,
            image: svc.image,
            container_name: actualServiceData.container_name || '',
            command: parseCommandArray(actualServiceData.command),
            restart: actualServiceData.restart || '',
            ports: Array.isArray(actualServiceData.ports) ? actualServiceData.ports.map((p: string) => {
                const parts = p.split(':');
                const host = parts[0];
                const containerWithProtocol = parts[1] || '';
                const [container, protocol] = containerWithProtocol.split('/');
                const result = { 
                    host, 
                    container, 
                    protocol: protocol || 'tcp'
                };
                return result;
            }) : [],
            volumes: Array.isArray(actualServiceData.volumes) ? actualServiceData.volumes.map((v: string) => {
                const parts = v.split(':');
                const host = parts[0];
                const container = parts[1] || '';
                const read_only = parts[2] === 'ro';
                const result = { host, container, read_only };
                return result;
            }) : [],
            environment: Array.isArray(actualServiceData.environment) ? actualServiceData.environment.map((e: string) => {
                const [key, ...rest] = e.split('=');
                return { key, value: rest.join('=') };
            }) : (actualServiceData.environment && typeof actualServiceData.environment === 'object' ? Object.entries(actualServiceData.environment).map(([key, value]: [string, any]) => ({ key, value: String(value) })) : []),
            healthcheck: actualServiceData.healthcheck ? {
                test: parseCommandArray(actualServiceData.healthcheck.test),
                interval: actualServiceData.healthcheck.interval || '',
                timeout: actualServiceData.healthcheck.timeout || '',
                retries: actualServiceData.healthcheck.retries ? String(actualServiceData.healthcheck.retries) : '',
                start_period: actualServiceData.healthcheck.start_period || '',
                start_interval: actualServiceData.healthcheck.start_interval || '',
            } : undefined,
            depends_on: Array.isArray(actualServiceData.depends_on) ? actualServiceData.depends_on : (actualServiceData.depends_on ? Object.keys(actualServiceData.depends_on) : []),
            entrypoint: parseCommandArray(actualServiceData.entrypoint),
            env_file: Array.isArray(actualServiceData.env_file) ? actualServiceData.env_file.join(',') : (actualServiceData.env_file || ''),
            extra_hosts: Array.isArray(actualServiceData.extra_hosts) ? actualServiceData.extra_hosts : [],
            dns: Array.isArray(actualServiceData.dns) ? actualServiceData.dns : [],
            networks: Array.isArray(actualServiceData.networks) ? actualServiceData.networks : (actualServiceData.networks ? Object.keys(actualServiceData.networks) : []),
            user: actualServiceData.user || '',
            working_dir: actualServiceData.working_dir || '',
            labels: actualServiceData.labels ? (Array.isArray(actualServiceData.labels)
                ? actualServiceData.labels.map((l: string) => {
                    const [key, ...rest] = l.split('=');
                    return { key, value: rest.join('=') };
                })
                : Object.entries(actualServiceData.labels).map(([key, value]: [string, any]) => ({ key, value: String(value) }))) : [],
            privileged: actualServiceData.privileged !== undefined ? !!actualServiceData.privileged : undefined,
            read_only: actualServiceData.read_only !== undefined ? !!actualServiceData.read_only : undefined,
            shm_size: actualServiceData.shm_size || '',
            security_opt: Array.isArray(actualServiceData.security_opt) ? actualServiceData.security_opt : [],
        };
        setServices(prev => {
            const updated = [...prev, newService];
            return updated;
        });
        if (allNetworks && Object.keys(allNetworks).length > 0) {
            const networkConfigs: NetworkConfig[] = Object.entries(allNetworks).map(([name, config]: [string, any]) => ({
                name,
                driver: config.driver || '',
                driver_opts: config.driver_opts ? Object.entries(config.driver_opts).map(([key, value]: [string, any]) => ({ key, value: String(value) })) : [],
                attachable: config.attachable !== undefined ? !!config.attachable : false,
                labels: config.labels ? (Array.isArray(config.labels) 
                    ? config.labels.map((l: string) => {
                        const [key, ...rest] = l.split('=');
                        return { key, value: rest.join('=') };
                    })
                    : Object.entries(config.labels).map(([key, value]: [string, any]) => ({ key, value: String(value) }))) : [],
                external: !!config.external,
                name_external: config.external && typeof config.external === 'object' ? config.external.name || '' : '',
                internal: config.internal !== undefined ? !!config.internal : false,
                enable_ipv6: config.enable_ipv6 !== undefined ? !!config.enable_ipv6 : false,
                ipam: {
                    driver: config.ipam?.driver || '',
                    config: config.ipam?.config || [],
                    options: config.ipam?.options ? Object.entries(config.ipam.options).map(([key, value]: [string, any]) => ({ key, value: String(value) })) : []
                }
            }));
            setNetworks(prev => {
                const existingNames = new Set(prev.map(n => n.name));
                const newNetworks = networkConfigs.filter(n => !existingNames.has(n.name));
                return [...prev, ...newNetworks];
            });
        }
        if (allVolumes && Object.keys(allVolumes).length > 0) {
            const volumeConfigs: VolumeConfig[] = Object.entries(allVolumes).map(([name, config]: [string, any]) => {
                let driverOptsType = '';
                let driverOptsDevice = '';
                let driverOptsO = '';
                
                if (config && config.driver_opts) {
                    driverOptsType = config.driver_opts.type || '';
                    driverOptsDevice = config.driver_opts.device || '';
                    driverOptsO = config.driver_opts.o || '';
                }
                
                return {
                    name,
                    driver: config && config.driver ? config.driver : '',
                    driver_opts: config && config.driver_opts ? Object.entries(config.driver_opts).map(([key, value]: [string, any]) => ({ key, value: String(value) })) : [],
                    labels: config && config.labels ? (Array.isArray(config.labels)
                        ? config.labels.map((l: string) => {
                            const [key, ...rest] = l.split('=');
                            return { key, value: rest.join('=') };
                        })
                        : Object.entries(config.labels).map(([key, value]: [string, any]) => ({ key, value: String(value) }))) : [],
                    external: !!config?.external,
                    name_external: config?.external && typeof config.external === 'object' ? config.external.name || '' : '',
                    driver_opts_type: driverOptsType,
                    driver_opts_device: driverOptsDevice,
                    driver_opts_o: driverOptsO,
                };
            });
            setVolumes(prev => {
                const existingNames = new Set(prev.map(v => v.name));
                const newVolumes = volumeConfigs.filter(v => !existingNames.has(v.name));
                return [...prev, ...newVolumes];
            });
        }
        setSelectedType('service');
        setSelectedIdx(prev => {
            const newIndex = (prev || 0) + 1;
            return newIndex;
        });
        setComposeStoreOpen(false);
    }

    if (!yaml) setYaml(generateYaml(services, networks, volumes));

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
            <div className="flex min-h-screen h-screen w-screen">
                <div className="w-64 h-full flex-shrink-0 flex-grow-0 bg-card border-r">
                <SidebarUI />
                </div>
                <main className="flex-1 flex flex-row h-full w-full">
                    {/* Service List Sidebar */}
                    <aside className="flex-[2_2_0%] h-full bg-card border-r flex flex-col p-4 gap-4 overflow-y-auto box-border">
                        <div className="flex items-center justify-between mb-2 w-full box-border">
                            <span className="font-bold text-lg">Services</span>
                            <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => { setSelectedType('service'); setSelectedIdx(services.length); addService(); }}>+ Add</Button>
                            </div>
                        </div>
                        <Button variant="outline" className="mb-2" onClick={() => setComposeStoreOpen(true)}>
                            Browse Compose Store
                        </Button>
                        {/* Compose Store Custom Overlay */}
                        {composeStoreOpen && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                                onClick={() => setComposeStoreOpen(false)}
                            >
                                <div
                                    className="relative max-w-screen-3xl w-[98vw] min-h-[90vh] rounded-2xl border bg-background p-8 pt-4 shadow-xl"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="absolute top-4 right-4 flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={refreshComposeStore}
                                            disabled={composeLoading}
                                            className="flex items-center gap-1"
                                        >
                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                                                <path d="M21 3v5h-5"/>
                                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                                                <path d="M3 21v-5h5"/>
                                            </svg>
                                            Refresh
                                        </Button>
                                        <button
                                            className="text-xl text-muted-foreground hover:text-foreground"
                                            onClick={() => setComposeStoreOpen(false)}
                                            aria-label="Close Compose Store"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="mb-1 text-2xl font-bold">Compose Store</div>
                                    <div className="mb-2 mt-0 text-base text-muted-foreground">
                                        Browse and import popular self-hosted Docker Compose services.
                                        {composeCacheTimestamp && (
                                            <span className="ml-2 text-xs">
                                                (Cached {Math.round((Date.now() - composeCacheTimestamp) / 1000 / 60)}m ago)
                                            </span>
                                        )}
                                    </div>
                                    <div className="mb-4 text-xs text-muted-foreground">
                                        Want to contribute? <a 
                                            href="https://github.com/LukeGus/Containix" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            Add your compose files to the store
                                        </a> - read the README for instructions.
                                    </div>
                                    <Input
                                        placeholder="Search by service name or image..."
                                        value={composeSearch}
                                        onChange={e => setComposeSearch(e.target.value)}
                                        className="mb-4 mt-0 text-base"
                                    />
                                    {composeLoading ? (
                                        <div className="h-32 flex items-center justify-center text-muted-foreground text-lg">
                                            {composeCache.length > 0 ? 'Refreshing...' : 'Loading...'}
                                        </div>
                                    ) : composeError ? (
                                        <div className="h-32 flex items-center justify-center text-destructive text-lg">{composeError}</div>
                                    ) : composeFiles.length === 0 ? (
                                        <div className="h-32 flex items-center justify-center text-muted-foreground text-lg">No .yml files found in the repo.</div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mt-4 max-h-[60vh] overflow-y-auto">
                                                {composeFiles
                                                    .filter((file: any) => 
                                                        file.name.toLowerCase().includes(composeSearch.toLowerCase()) ||
                                                        Object.values(file.services || {}).some((svc: any) => 
                                                            svc.name.toLowerCase().includes(composeSearch.toLowerCase())
                                                        )
                                                    )
                                                    .map((file: any) => (
                                                        <div key={file.name} className="bg-card rounded-lg shadow p-4 flex flex-col gap-2 items-start justify-between border border-border min-h-0">
                                                            <div className="font-bold text-lg break-words w-full min-h-0">{file.name.replace('.yml', '')}</div>
                                                            <div className="text-sm text-muted-foreground break-words w-full min-h-0">{Object.keys(file.services || {}).length} service{Object.keys(file.services || {}).length !== 1 ? 's' : ''}</div>
                                                            <Button size="sm" className="mt-2 w-full" onClick={() => {
                                                                Object.entries(file.services || {}).forEach(([serviceName, serviceData]: [string, any]) => {
                                                                    handleAddComposeServiceFull({
                                                                        name: serviceName,
                                                                        image: serviceData.image || '',
                                                                        rawService: serviceData,
                                                                    }, file.networks, file.volumes);
                                                                });
                                                            }}>
                                                                Add All Services
                                                            </Button>
                                                        </div>
                                                    ))
                                                }
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
                    {/* Configuration Panel */}
                    <section className="flex-[3_3_0%] h-full p-4 flex flex-col gap-4 bg-background border-r overflow-y-auto box-border">
                        {selectedType === 'service' && (
                            <>
                                <div className="mb-2 w-full box-border flex items-center justify-between">
                                <span className="font-bold text-lg">Service Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                    <Input value={svc.name} onChange={e => updateServiceField('name', e.target.value)} placeholder="e.g. web" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Container Name</Label>
                                    <Input value={svc.container_name || ''} onChange={e => updateServiceField('container_name', e.target.value)} placeholder="e.g. my-nginx" />
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
                                                <Input type="number" min="1" max="65535" value={port.host} onChange={e => updatePortField(idx, 'host', e.target.value)} placeholder="Host" className="w-1/3" />
                                                <span>→</span>
                                                <Input type="number" min="1" max="65535" value={port.container} onChange={e => updatePortField(idx, 'container', e.target.value)} placeholder="Container" className="w-1/3" />
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="w-16 justify-between">
                                                            {port.protocol || 'tcp'}
                                                            <svg className="ml-1" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path d="M6 9l6 6 6-6"/>
                                                            </svg>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => updatePortField(idx, 'protocol', 'tcp')}>
                                                            TCP
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => updatePortField(idx, 'protocol', 'udp')}>
                                                            UDP
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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
                                                <div className="flex items-center gap-1">
                                                    <Toggle 
                                                        pressed={vol.read_only || false} 
                                                        onPressedChange={v => updateVolumeField(idx, 'read_only', v)} 
                                                        aria-label="Read Only" 
                                                        className="border rounded px-2 py-1"
                                                    >
                                                        <span className="select-none text-xs">RO</span>
                                                    </Toggle>
                                                </div>
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
                                        {/* Shared Memory Size */}
                                        <div>
                                            <Label className="mb-1 block">Shared Memory Size</Label>
                                            <Input value={svc.shm_size || ''} onChange={e => updateServiceField('shm_size', e.target.value)} placeholder="e.g. 1gb, 512m" />
                                        </div>
                                        {/* Security Options */}
                                        <div>
                                            <Label className="mb-1 block">Security Options</Label>
                                            <div className="flex flex-col gap-2">
                                                {svc.security_opt?.map((opt, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <Input value={opt} onChange={e => updateSecurityOpt(idx, e.target.value)} placeholder="e.g. seccomp:unconfined" />
                                                        <Button size="icon" variant="ghost" onClick={() => removeSecurityOpt(idx)}>
                                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button size="sm" variant="outline" onClick={addSecurityOpt}>+ Add Security Option</Button>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        </>
                        )}
                        
                        {selectedType === 'network' && selectedNetworkIdx !== null && (
                            <>
                                <div className="mb-2 w-full box-border flex items-center justify-between">
                                <span className="font-bold text-lg">Network Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                        <Input value={networks[selectedNetworkIdx]?.name || ''} onChange={e => updateNetwork(selectedNetworkIdx, 'name', e.target.value)} placeholder="e.g. frontend" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Driver</Label>
                                        <Input value={networks[selectedNetworkIdx]?.driver || ''} onChange={e => updateNetwork(selectedNetworkIdx, 'driver', e.target.value)} placeholder="e.g. bridge" />
                                </div>
                                <div className="flex items-center gap-2">
                                        <Toggle pressed={!!networks[selectedNetworkIdx]?.attachable} onPressedChange={v => updateNetwork(selectedNetworkIdx, 'attachable', v)} aria-label="Attachable" className="border rounded px-2 py-1">
                                            <span className="select-none">Attachable</span>
                                    </Toggle>
                                </div>
                                    <div className="flex items-center gap-2">
                                        <Toggle pressed={!!networks[selectedNetworkIdx]?.external} onPressedChange={v => updateNetwork(selectedNetworkIdx, 'external', v)} aria-label="External" className="border rounded px-2 py-1">
                                            <span className="select-none">External</span>
                                        </Toggle>
                                            </div>
                                    {networks[selectedNetworkIdx]?.external && (
                                <div>
                                            <Label className="mb-1 block">External Name</Label>
                                            <Input value={networks[selectedNetworkIdx]?.name_external || ''} onChange={e => updateNetwork(selectedNetworkIdx, 'name_external', e.target.value)} placeholder="External network name" />
                                            </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Toggle pressed={!!networks[selectedNetworkIdx]?.internal} onPressedChange={v => updateNetwork(selectedNetworkIdx, 'internal', v)} aria-label="Internal" className="border rounded px-2 py-1">
                                            <span className="select-none">Internal</span>
                                        </Toggle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Toggle pressed={!!networks[selectedNetworkIdx]?.enable_ipv6} onPressedChange={v => updateNetwork(selectedNetworkIdx, 'enable_ipv6', v)} aria-label="Enable IPv6" className="border rounded px-2 py-1">
                                            <span className="select-none">Enable IPv6</span>
                                        </Toggle>
                                </div>
                            </div>
                            </>
                        )}
                        
                        {selectedType === 'volume' && selectedVolumeIdx !== null && (
                            <>
                                <div className="mb-2 w-full box-border flex items-center justify-between">
                                <span className="font-bold text-lg">Volume Configuration</span>
                            </div>
                            <div className="flex flex-col gap-4 w-full box-border">
                                <div>
                                    <Label className="mb-1 block">Name</Label>
                                        <Input value={volumes[selectedVolumeIdx]?.name || ''} onChange={e => updateVolume(selectedVolumeIdx, 'name', e.target.value)} placeholder="e.g. webdata" />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Driver</Label>
                                        <Input value={volumes[selectedVolumeIdx]?.driver || ''} onChange={e => updateVolume(selectedVolumeIdx, 'driver', e.target.value)} placeholder="e.g. local" />
                                </div>
                                {/* Driver Options */}
                                <div>
                                    <Label className="mb-1 block">Driver Options</Label>
                                    <div className="flex flex-col gap-2">
                                        <Input value={volumes[selectedVolumeIdx]?.driver_opts_type || ''} onChange={e => updateVolume(selectedVolumeIdx, 'driver_opts_type', e.target.value)} placeholder="Type (e.g. none)" />
                                        <Input value={volumes[selectedVolumeIdx]?.driver_opts_device || ''} onChange={e => updateVolume(selectedVolumeIdx, 'driver_opts_device', e.target.value)} placeholder="Device (e.g. /path/to/device)" />
                                        <Input value={volumes[selectedVolumeIdx]?.driver_opts_o || ''} onChange={e => updateVolume(selectedVolumeIdx, 'driver_opts_o', e.target.value)} placeholder="Options (e.g. bind)" />
                                    </div>
                                </div>
                                {/* Labels */}
                                <div>
                                    <Label className="mb-1 block">Labels</Label>
                                    <div className="flex flex-col gap-2">
                                        {volumes[selectedVolumeIdx]?.labels?.map((label, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input value={label.key} onChange={e => {
                                                    const newLabels = [...(volumes[selectedVolumeIdx]?.labels || [])];
                                                    newLabels[idx] = { ...newLabels[idx], key: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'labels', newLabels);
                                                }} placeholder="Key" className="w-1/2" />
                                                <Input value={label.value} onChange={e => {
                                                    const newLabels = [...(volumes[selectedVolumeIdx]?.labels || [])];
                                                    newLabels[idx] = { ...newLabels[idx], value: e.target.value };
                                                    updateVolume(selectedVolumeIdx, 'labels', newLabels);
                                                }} placeholder="Value" className="w-1/2" />
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    const newLabels = [...(volumes[selectedVolumeIdx]?.labels || [])];
                                                    newLabels.splice(idx, 1);
                                                    updateVolume(selectedVolumeIdx, 'labels', newLabels);
                                                }}>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" onClick={() => updateVolume(selectedVolumeIdx, 'labels', [...(volumes[selectedVolumeIdx]?.labels || []), { key: '', value: '' }])}>+ Add Label</Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Toggle pressed={!!volumes[selectedVolumeIdx]?.external} onPressedChange={v => updateVolume(selectedVolumeIdx, 'external', v)} aria-label="External" className="border rounded px-2 py-1">
                                        <span className="select-none">External</span>
                                    </Toggle>
                                </div>
                                {volumes[selectedVolumeIdx]?.external && (
                                    <div>
                                        <Label className="mb-1 block">External Name</Label>
                                        <Input value={volumes[selectedVolumeIdx]?.name_external || ''} onChange={e => updateVolume(selectedVolumeIdx, 'name_external', e.target.value)} placeholder="External volume name" />
                                    </div>
                                )}
                            </div>
                            </>
                        )}
                        </section>
                    {/* Docker Compose File Panel */}
                    <section className="flex-[5_5_0%] h-full pl-4 pr-3 pb-4 pt-2 flex flex-col bg-background box-border overflow-hidden">
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