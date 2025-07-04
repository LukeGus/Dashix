import {AuthCard} from "@/components/AuthCard.tsx";
import {
    ChevronUp,
    ChevronDown,
    Container,
    User2,
} from "lucide-react";

import { useNavigate, useRouter } from "@tanstack/react-router";

import { SidebarProvider } from "@/components/ui/sidebar.tsx";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    SidebarHeader,
} from "@/components/ui/sidebar.tsx";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu.tsx";

import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible.tsx";

import { Separator } from "@/components/ui/separator"

import { useState } from "react";

// Example data
const items = [
    {
        title: "Compose Builder",
        url: "/docker/compose-builder", // Note: leading slash is important
        icon: Container,
        group: "Docker",
    },
];

// Group by `group`
const groupedItems = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
}, {});

export function SidebarUI({}: {}) {
    const navigate = useNavigate();
    const router = useRouter();
    const location = router.state.location;
    const [isAuthCardHidden, setAuthCardHidden] = useState(true);

    return (
        <>
        <SidebarProvider>
            <Sidebar className="w-64 !block !flex !visible" style={{ display: 'flex' }}>
                <SidebarHeader>
                    <div className="flex flex-col items-center w-full">
                        <div className="flex items-center justify-center w-full py-2 gap-3">
                            <span className="font-bold text-lg">Dashix</span>
                            <div className="w-px h-6 bg-muted-foreground/60 mx-1 rounded" />
                            <a
                                href="https://github.com/LukeGus/Dashix"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center p-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                                title="View on GitHub"
                                aria-label="GitHub Repository"
                            >
                                {/* GitHub Mark SVG */}
                                <svg height="22" viewBox="0 0 16 16" width="22" fill="currentColor" aria-hidden="true">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                                </svg>
                            </a>
                        </div>
                        <Separator className="w-full mb-0.5" />
                    </div>
                </SidebarHeader>

                <SidebarContent className="gap-y-0 pt-0">
                    {Object.entries(groupedItems).map(([groupName, groupItems], idx) => (
                        <Collapsible
                            key={groupName}
                            defaultOpen
                            className={`group/collapsible mb-0${idx === 0 ? ' -mt-2' : ''}`}
                        >
                            <SidebarGroup>
                                <SidebarGroupLabel asChild>
                                    <CollapsibleTrigger className="flex items-center cursor-pointer">
                                        {groupName}
                                        <ChevronDown
                                            className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180"/>
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        <SidebarMenu>
                                            {groupItems.map((item) => {
                                                const isActive = location.pathname === item.url;

                                                return (
                                                    <SidebarMenuItem key={item.title}>
                                                        <SidebarMenuButton
                                                            className={isActive ? "bg-muted" : ""}
                                                            onClick={() => {
                                                                if (!isActive) {
                                                                    navigate({to: item.url});
                                                                }
                                                            }}
                                                        >
                                                            <item.icon/>
                                                            <span>{item.title}</span>
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                );
                                            })}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>
                    ))}
                </SidebarContent>

                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton>
                                        <User2/> Username
                                        <ChevronUp className="ml-auto"/>
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="top"
                                    className="w-[--radix-popper-anchor-width]"
                                >
                                    <DropdownMenuItem onClick={() => setAuthCardHidden((h) => !h)}>
                                        <span>Account</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
        </SidebarProvider>

        <AuthCard isHidden={isAuthCardHidden} setIsHidden={setAuthCardHidden} />
        </>
    );
}