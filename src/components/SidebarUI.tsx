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

    return (
        <SidebarProvider>
            <Sidebar className="w-64">
                <SidebarContent className="gap-y-0">
                    {Object.entries(groupedItems).map(([groupName, groupItems]) => (
                        <Collapsible
                            key={groupName}
                            defaultOpen
                            className="group/collapsible mb-0"
                        >
                            <SidebarGroup>
                                <SidebarGroupLabel asChild>
                                    <CollapsibleTrigger className="flex items-center cursor-pointer">
                                        {groupName}
                                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
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
                                                                    navigate({ to: item.url });
                                                                }
                                                            }}
                                                        >
                                                            <item.icon />
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
                                        <User2 /> Username
                                        <ChevronUp className="ml-auto" />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    side="top"
                                    className="w-[--radix-popper-anchor-width]"
                                >
                                    <DropdownMenuItem>
                                        <span>Account</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <span>Sign out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
        </SidebarProvider>
    );
}