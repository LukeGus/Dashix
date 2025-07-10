import {
    ChevronDown,
    Container,
    AlertCircleIcon,
    CheckCircle2Icon,
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
import {useState, useEffect, useRef} from "react";
import {CardContent} from "@/components/ui/card.tsx";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
    FormLabel
} from "@/components/ui/form.tsx";
import {useForm} from "react-hook-form";
import {Textarea} from "@/components/ui/textarea";
import axios from 'axios';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

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
    const feedbackForm = useForm({defaultValues: {title: "", feedback: "", honey: ""}});
    const turnstileWidgetRef = useRef<HTMLDivElement>(null);
    const [captchaToken, setCaptchaToken] = useState("");
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [feedbackError, setFeedbackError] = useState("");

    useEffect(() => {
        if (!document.getElementById('cf-turnstile-script')) {
            const script = document.createElement('script');
            script.id = 'cf-turnstile-script';
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        }
    }, []);

    useEffect(() => {
        if (showFeedbackCard && (window as any).turnstile && turnstileWidgetRef.current) {
            turnstileWidgetRef.current.innerHTML = "";
            (window as any).turnstile.render(turnstileWidgetRef.current, {
                sitekey: "0x4AAAAAABkpdrsssAICPqnw",
                callback: (token: string) => setCaptchaToken(token),
                "error-callback": () => setCaptchaToken(""),
                "expired-callback": () => setCaptchaToken("")
            });
        }
        if (!showFeedbackCard) setCaptchaToken("");
    }, [showFeedbackCard]);

    useEffect(() => {
        if (showFeedbackCard) {
            setFeedbackSent(false);
            feedbackForm.reset();
            setCaptchaToken("");
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [showFeedbackCard]);

    const onSubmit = (data: { title: string; feedback: string; honey?: string }) => {
        if (!captchaToken) {
            alert('Please complete the CAPTCHA.');
            return;
        }
        setFeedbackSent(false);
        setFeedbackError("");
        let apiUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            apiUrl = 'http://localhost:2000/feedback';
        } else {
            apiUrl = `${window.location.origin}/feedback`;
        }
        axios.post(apiUrl, {
            title: data.title,
            feedback: data.feedback,
            honey: data.honey,
            date: new Date().toLocaleString(),
            'cf-turnstile-response': captchaToken,
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(() => {
            setFeedbackSent(true);
            timerRef.current = setTimeout(() => {
                setShowFeedbackCard(false);
                setFeedbackSent(false);
                feedbackForm.reset();
                setCaptchaToken("");
                timerRef.current = null;
            }, 1500);
        }).catch((err) => {
            if (err.response && (err.response.status === 429 || (err.response.data && err.response.data.error && err.response.data.error.includes('Too many feedback submissions')))) {
                setFeedbackError("You have made too many feedback requests. Please try again later.");
            } else {
                setFeedbackError("Failed to send feedback. Please try again.");
            }
        });
    };

    useEffect(() => {
        (window as any).onTurnstileSuccess = (token: string) => {
            setCaptchaToken(token);
        };
    }, []);

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
                            {feedbackError && (
                                <Alert
                                    variant="destructive"
                                    className="mb-4 bg-card px-4 py-4 flex items-center gap-3 items-center -mb-2"
                                    style={{ backgroundColor: 'var(--sidebar-bg, #18181b)' }}
                                >
                                    <AlertCircleIcon className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--foreground, #fff)' }} />
                                    <div className="flex flex-col justify-center w-full">
                                        <AlertTitle className="font-semibold text-foreground leading-tight m-0 p-0">Error</AlertTitle>
                                        <AlertDescription
                                            className="m-0 p-0 leading-normal"
                                            style={{ marginBottom: 0, paddingBottom: 0, lineHeight: '1.4', marginTop: 0 }}
                                        >
                                            {feedbackError}
                                        </AlertDescription>
                                    </div>
                                </Alert>
                            )}
                            {!feedbackError && feedbackSent && (
                                <Alert
                                    className="mb-4 bg-card px-4 py-4 flex items-center gap-3 items-center -mb-2"
                                    style={{ backgroundColor: 'var(--sidebar-bg, #18181b)' }}
                                >
                                    <CheckCircle2Icon className="h-6 w-6 flex-shrink-0" style={{ color: 'var(--foreground, #fff)' }} />
                                    <div className="flex flex-col justify-center w-full">
                                        <AlertTitle className="font-semibold text-foreground leading-tight m-0 p-0">Thank you for your feedback!</AlertTitle>
                                        <AlertDescription
                                            className="m-0 p-0 leading-normal"
                                            style={{ marginBottom: 0, paddingBottom: 0, lineHeight: '1.4', marginTop: 0 }}
                                        >
                                            Your feedback was submitted successfully.
                                        </AlertDescription>
                                    </div>
                                </Alert>
                            )}
                            {!feedbackError && !feedbackSent && (
                                <Form {...feedbackForm}>
                                    <form onSubmit={feedbackForm.handleSubmit(onSubmit)} className="space-y-4">
                                        {/* Honeypot field for bots */}
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            tabIndex={-1}
                                            style={{ display: 'none' }}
                                            {...feedbackForm.register('honey')}
                                        />
                                        {/* Title input */}
                                        <FormField
                                            control={feedbackForm.control}
                                            name="title"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Title</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="Enter a short title..."
                                                            maxLength={100}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {/* Feedback textarea with label */}
                                        <FormItem>
                                            <FormLabel>Body</FormLabel>
                                            <FormField
                                                control={feedbackForm.control}
                                                name="feedback"
                                                render={({ field }) => (
                                                    <FormControl>
                                                        <Textarea
                                                            {...field}
                                                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors resize-vertical"
                                                            placeholder="Let us know your thoughts..."
                                                            required
                                                            style={{
                                                                minHeight: '120px',
                                                                maxHeight: '40vh',
                                                                height: '20vh',
                                                            }}
                                                        />
                                                    </FormControl>
                                                )}
                                            />
                                            <FormMessage />
                                        </FormItem>
                                        <Separator className="w-full my-3" />
                                        {/* Cloudflare Turnstile CAPTCHA */}
                                        <div className="flex justify-center mb-2">
                                            <div className="w-full relative">
                                                <div
                                                    ref={turnstileWidgetRef}
                                                    className="w-full"
                                                    style={{ width: '100%' }}
                                                ></div>
                                                <style>{`
                                                  .cf-turnstile,
                                                  .cf-turnstile > iframe {
                                                    width: 100% !important;
                                                    min-width: 0 !important;
                                                    max-width: 100% !important;
                                                    display: block !important;
                                                  }
                                                `}</style>
                                            </div>
                                        </div>
                                        <Button
                                            type="submit"
                                            className="w-full mt-0"
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