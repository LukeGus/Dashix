import {
    ChevronDown,
    Container,
} from "lucide-react";

import {useNavigate, useRouter} from "@tanstack/react-router";

import {SidebarProvider} from "@/components/ui/sidebar.tsx";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
} from "@/components/ui/sidebar.tsx";

import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible.tsx";

import {Separator} from "@/components/ui/separator"
import {Button} from "@/components/ui/button"
import {useState} from "react";
import {CardContent} from "@/components/ui/card.tsx";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage
} from "@/components/ui/form.tsx";
import {useForm} from "react-hook-form";
import {Textarea} from "@/components/ui/textarea";
import axios from 'axios';

const items = [
    {
        title: "Compose Builder",
        url: "/docker/compose-builder",
        icon: Container,
        group: "Docker",
    },
];

const groupedItems = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
}, {});

export function SidebarUI({}: {}) {
    const navigate = useNavigate();
    const router = useRouter();
    const location = router.state.location;
    const [showFeedbackCard, setShowFeedbackCard] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const feedbackForm = useForm({defaultValues: {feedback: ""}});

    const onSubmit = (data: { feedback: string }) => {
        setFeedbackSent(true);
        setTimeout(() => {
            setShowFeedbackCard(false);
            setFeedbackSent(false);
            feedbackForm.reset();
        }, 1500);
        let apiUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            apiUrl = 'http://localhost:2000/feedback';
        } else {
            apiUrl = `${window.location.origin}/feedback`;
        }
        axios.post(apiUrl, {
            feedback: data.feedback,
            date: new Date().toLocaleString(),
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    };

    return (
        <>
            <SidebarProvider>
                <Sidebar className="w-64 !block !flex !visible" style={{display: 'flex'}}>
                    <SidebarHeader>
                        <div className="flex flex-col items-center w-full">
                            <div className="flex items-center justify-center w-full py-2 gap-2">
                                <div className="flex items-center">
                                    <span className="font-bold text-lg">Dashix</span>
                                </div>
                                <div className="w-px h-6 bg-muted-foreground/30"></div>
                                <div className="flex items-center">
                                    <a
                                        href="https://github.com/LukeGus/Dashix"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center p-1 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                                        title="View on GitHub"
                                        aria-label="GitHub Repository"
                                    >
                                        <svg height="22" viewBox="0 0 16 16" width="22" fill="currentColor"
                                             aria-hidden="true">
                                            <path
                                                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                                        </svg>
                                    </a>
                                </div>
                                <div className="w-px h-6 bg-muted-foreground/30"></div>
                                <div className="flex items-center">
                                    <Button variant="link" className="p-0"
                                            onClick={() => setShowFeedbackCard(prev => !prev)}>
                                        Feedback
                                    </Button>
                                </div>
                            </div>
                            <Separator className="w-full mb-0.5"/>
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
                </Sidebar>
            </SidebarProvider>

            {showFeedbackCard && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                    onClick={() => setShowFeedbackCard(false)}
                >
                    <div
                        className="relative max-w-md w-[90vw] rounded-2xl border bg-background p-6 shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            className="absolute top-4 right-4 text-xl text-muted-foreground hover:text-foreground"
                            onClick={() => setShowFeedbackCard(false)}
                            aria-label="Close Feedback"
                        >
                            ×
                        </button>
                        <div className="mb-4 text-xl font-bold">Feedback</div>
                        <CardContent className="p-0">
                            {feedbackSent ? (
                                <div className="font-semibold py-8 text-center">Thank you for your feedback!</div>
                            ) : (
                                <Form {...feedbackForm}>
                                    <form onSubmit={feedbackForm.handleSubmit(onSubmit)} className="space-y-4">
                                        <FormField
                                            control={feedbackForm.control}
                                            name="feedback"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Textarea
                                                            {...field}
                                                            className="min-h-[300px] resize-vertical"
                                                            placeholder="Let us know your thoughts..."
                                                            required
                                                        />
                                                    </FormControl>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <Separator className="w-full mb-0.5"/>
                                        <Button
                                            type="submit"
                                            className="w-full mt-2"
                                        >
                                            Submit
                                        </Button>
                                    </form>
                                </Form>
                            )}
                        </CardContent>
                    </div>
                </div>
            )}
        </>
    );
}